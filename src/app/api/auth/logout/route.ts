import { NextResponse } from "next/server";
import { clearManagementSessionCookie } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } finally {
    const response = NextResponse.json({ ok: true });
    clearManagementSessionCookie(response);
    return response;
  }
}
