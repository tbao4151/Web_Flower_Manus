"use client";

import { useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, RotateCcw, Save, Smartphone } from "lucide-react";
import type { ProductImageCrop } from "@/lib/products";

type CropEditorImage = ProductImageCrop & {
  src: string;
  alt?: string;
};

type Props = {
  image: CropEditorImage;
  productName: string;
  onSave: (crop: ProductImageCrop) => Promise<void> | void;
  onClose: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const percent = (value: number) => `${Math.round(clamp(value, 0, 1) * 100)}%`;

function imageStyle(crop: ProductImageCrop) {
  return {
    objectPosition: `${percent(crop.focalX)} ${percent(crop.focalY)}`,
    transform: `scale(${crop.cropZoom})`,
    transformOrigin: `${percent(crop.focalX)} ${percent(crop.focalY)}`,
  } as const;
}

export default function ProductImageCropEditor({ image, productName, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<ProductImageCrop>({ cropX: image.cropX, cropY: image.cropY, cropZoom: image.cropZoom, focalX: image.focalX, focalY: image.focalY });
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; focalX: number; focalY: number; width: number; height: number } | null>(null);

  const previewStyle = useMemo(() => imageStyle(draft), [draft]);
  const updateZoom = (value: number) => setDraft((current) => ({ ...current, cropZoom: clamp(Number(value.toFixed(2)), 1, 3) }));
  const resetCenter = () => setDraft({ cropX: 0.5, cropY: 0.5, cropZoom: 1, focalX: 0.5, focalY: 0.5 });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { x: event.clientX, y: event.clientY, focalX: draft.focalX, focalY: draft.focalY, width: rect.width, height: rect.height };
    setDragging(true);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start) return;
    setDraft((current) => {
      const focalX = clamp(start.focalX - (event.clientX - start.x) / start.width / Math.max(current.cropZoom, 1), 0, 1);
      const focalY = clamp(start.focalY - (event.clientY - start.y) / start.height / Math.max(current.cropZoom, 1), 0, 1);
      return { ...current, cropX: focalX, cropY: focalY, focalX, focalY };
    });
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  };

  async function save() {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-foreground/45 p-3 sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="crop-editor-title" className="mx-auto max-w-5xl rounded-[28px] border border-border bg-surface p-4 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Image crop / focal point</p>
            <h2 id="crop-editor-title" className="mt-2 font-display text-3xl sm:text-4xl">Chỉnh vùng hiển thị</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Kéo ảnh để chọn vùng bó hoa, hoặc dùng zoom. Ảnh gốc vẫn được giữ nguyên trong Storage; chỉ metadata vùng hiển thị được lưu.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border" aria-label="Đóng crop editor">×</button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.72fr)]">
          <div>
            <div
              className={`relative mx-auto aspect-[2/3] max-h-[70vh] w-full max-w-[520px] touch-none select-none overflow-hidden rounded-[24px] bg-surface-muted ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img src={image.src} alt={image.alt || productName} className="h-full w-full object-cover transition-transform duration-100 motion-reduce:transition-none" style={previewStyle} draggable={false} />
              <div className="pointer-events-none absolute inset-0 border-2 border-white/80" aria-hidden="true" />
              <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-foreground/75 px-3 py-1.5 text-[11px] font-bold text-white">Preview storefront · 2:3</span>
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="crop-zoom" className="text-sm font-bold">Zoom</label>
                <output htmlFor="crop-zoom" className="text-sm font-bold text-primary">{draft.cropZoom.toFixed(2)}×</output>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button type="button" onClick={() => updateZoom(draft.cropZoom - 0.1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border" aria-label="Giảm zoom"><Minus size={16} /></button>
                <input id="crop-zoom" type="range" min="1" max="3" step="0.05" value={draft.cropZoom} onChange={(event) => updateZoom(Number(event.target.value))} className="min-w-0 flex-1 accent-primary" />
                <button type="button" onClick={() => updateZoom(draft.cropZoom + 0.1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border" aria-label="Tăng zoom"><Plus size={16} /></button>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Trên mobile, kéo trực tiếp trong khung; thanh zoom dễ dùng thay cho pinch khi trình duyệt không hỗ trợ pinch.</p>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-bold"><Smartphone size={16} className="text-primary" /> Xem trước trên card</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div><div className="aspect-[2/3] overflow-hidden rounded-xl bg-surface-muted"><img src={image.src} alt="" className="h-full w-full object-cover" style={previewStyle} draggable={false} /></div><p className="mt-2 line-clamp-1 text-xs font-bold">{productName}</p><p className="mt-1 text-xs text-primary">Giá sản phẩm</p></div>
                <div><div className="aspect-[2/3] overflow-hidden rounded-xl bg-surface-muted"><img src={image.src} alt="" className="h-full w-full object-cover" style={previewStyle} draggable={false} /></div><p className="mt-2 line-clamp-1 text-xs font-bold">{productName}</p><p className="mt-1 text-xs text-primary">Giá sản phẩm</p></div>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Mô phỏng grid 2 cột trên mobile để kiểm tra chủ thể không bị chặt mất.</p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-[#f3f7ef] p-4 text-sm leading-6 text-primary">
              <p className="font-bold">Tọa độ vùng chọn</p>
              <p className="mt-1 text-xs">Focal: {Math.round(draft.focalX * 100)}% ngang · {Math.round(draft.focalY * 100)}% dọc</p>
              <p className="mt-1 text-xs">Khung storefront luôn cố định 2:3.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={resetCenter} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-bold"><RotateCcw size={15} /> Đặt lại về giữa</button>
              <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white disabled:opacity-60"><Save size={15} /> {saving ? "Đang lưu..." : "Lưu vùng hiển thị"}</button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Maximize2 size={14} /> Không tạo file crop mới và không overwrite ảnh gốc.</div>
          </aside>
        </div>
      </section>
    </div>
  );
}
