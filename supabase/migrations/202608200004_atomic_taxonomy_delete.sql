-- CÁ'S HOA: atomic taxonomy deletion with guarded product relation handling.
-- Forward-only. No data is deleted unless an Admin explicitly requests a delete operation.

create or replace function public.delete_taxonomy_item(
  target_kind text,
  target_id uuid,
  operation text,
  replacement_product_type_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  usage_count integer := 0;
  target_slug text;
  replacement_slug text;
  transferred_count integer := 0;
begin
  if target_kind not in ('productTypes', 'categories', 'tones', 'occasions') then
    raise exception 'invalid_taxonomy_kind';
  end if;

  if operation not in ('delete', 'unlink_delete', 'transfer_delete') then
    raise exception 'invalid_taxonomy_operation';
  end if;

  if target_kind = 'productTypes' then
    select slug into target_slug
    from public.product_types
    where id = target_id
    for update;

    if target_slug is null then
      raise exception 'taxonomy_not_found';
    end if;

    select count(*)::integer into usage_count
    from public.products
    where product_type = target_slug;

    if usage_count > 0 and operation = 'delete' then
      raise exception 'taxonomy_in_use:%', usage_count;
    end if;

    if usage_count > 0 and operation = 'unlink_delete' then
      raise exception 'replacement_product_type_required';
    end if;

    if usage_count > 0 and operation = 'transfer_delete' then
      if replacement_product_type_id is null then
        raise exception 'replacement_product_type_required';
      end if;

      select slug into replacement_slug
      from public.product_types
      where id = replacement_product_type_id
        and id <> target_id
        and is_active = true
      for update;

      if replacement_slug is null then
        raise exception 'replacement_product_type_invalid';
      end if;

      update public.products
      set product_type = replacement_slug,
          updated_at = now()
      where product_type = target_slug;
      get diagnostics transferred_count = row_count;
    end if;

    delete from public.product_types where id = target_id;
    return jsonb_build_object('deleted', true, 'kind', target_kind, 'usage_count', usage_count, 'transferred_count', transferred_count);
  end if;

  if target_kind = 'categories' then
    if not exists (select 1 from public.categories where id = target_id for update) then
      raise exception 'taxonomy_not_found';
    end if;
    select count(*)::integer into usage_count from public.product_categories where category_id = target_id;
    if usage_count > 0 and operation = 'delete' then
      raise exception 'taxonomy_in_use:%', usage_count;
    end if;
    if operation = 'unlink_delete' then
      delete from public.product_categories where category_id = target_id;
    elsif operation = 'transfer_delete' then
      raise exception 'invalid_taxonomy_operation';
    end if;
    delete from public.categories where id = target_id;
    return jsonb_build_object('deleted', true, 'kind', target_kind, 'usage_count', usage_count);
  end if;

  if target_kind = 'tones' then
    if not exists (select 1 from public.color_tones where id = target_id for update) then
      raise exception 'taxonomy_not_found';
    end if;
    select count(*)::integer into usage_count from public.product_tones where tone_id = target_id;
    if usage_count > 0 and operation = 'delete' then
      raise exception 'taxonomy_in_use:%', usage_count;
    end if;
    if operation = 'unlink_delete' then
      delete from public.product_tones where tone_id = target_id;
    elsif operation = 'transfer_delete' then
      raise exception 'invalid_taxonomy_operation';
    end if;
    delete from public.color_tones where id = target_id;
    return jsonb_build_object('deleted', true, 'kind', target_kind, 'usage_count', usage_count);
  end if;

  if not exists (select 1 from public.occasions where id = target_id for update) then
    raise exception 'taxonomy_not_found';
  end if;
  select count(*)::integer into usage_count from public.product_occasions where occasion_id = target_id;
  if usage_count > 0 and operation = 'delete' then
    raise exception 'taxonomy_in_use:%', usage_count;
  end if;
  if operation = 'unlink_delete' then
    delete from public.product_occasions where occasion_id = target_id;
  elsif operation = 'transfer_delete' then
    raise exception 'invalid_taxonomy_operation';
  end if;
  delete from public.occasions where id = target_id;
  return jsonb_build_object('deleted', true, 'kind', target_kind, 'usage_count', usage_count);
end;
$$;

revoke all on function public.delete_taxonomy_item(text, uuid, text, uuid) from public;
grant execute on function public.delete_taxonomy_item(text, uuid, text, uuid) to service_role;
