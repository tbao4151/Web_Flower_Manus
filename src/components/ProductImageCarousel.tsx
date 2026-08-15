"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const AUTOPLAY_INTERVAL_MS = 10_000;
const SWIPE_THRESHOLD_PX = 48;

type ProductImageCarouselProps = {
  images: string[];
  alt: string;
};

export default function ProductImageCarousel({ images, alt }: ProductImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [interactionVersion, setInteractionVersion] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const reducedMotionRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const imageCount = images.length;

  const selectImage = useCallback((index: number) => {
    if (!imageCount) return;
    setActiveIndex(((index % imageCount) + imageCount) % imageCount);
    setInteractionVersion((version) => version + 1);
  }, [imageCount]);

  const moveRelative = useCallback((delta: number) => {
    if (!imageCount) return;
    setActiveIndex((current) => (current + delta + imageCount) % imageCount);
    setInteractionVersion((version) => version + 1);
  }, [imageCount]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReducedMotion = () => {
      reducedMotionRef.current = mediaQuery.matches;
    };
    updateReducedMotion();
    mediaQuery.addEventListener?.("change", updateReducedMotion);
    return () => mediaQuery.removeEventListener?.("change", updateReducedMotion);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => setIsPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (imageCount < 2) return;
    const nextImage = new Image();
    nextImage.decoding = "async";
    nextImage.src = images[(activeIndex + 1) % imageCount];
  }, [activeIndex, imageCount, images]);

  useEffect(() => {
    if (imageCount < 2 || isHovered || isFocused || !isPageVisible || reducedMotionRef.current) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % imageCount);
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, imageCount, interactionVersion, isFocused, isHovered, isPageVisible]);

  if (!imageCount) return null;

  const activeImage = images[activeIndex];

  return (
    <div
      className="group"
      role="region"
      aria-roledescription={imageCount > 1 ? "carousel" : undefined}
      aria-label={`Thư viện ảnh của ${alt}`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (imageCount < 2) return;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          moveRelative(-1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          moveRelative(1);
        }
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFocused(false);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="relative touch-pan-y overflow-hidden rounded-[28px] bg-surface-muted"
        onTouchStart={(event) => {
          if (imageCount < 2) return;
          const touch = event.changedTouches[0];
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStartRef.current;
          touchStartRef.current = null;
          if (!start || imageCount < 2) return;
          const touch = event.changedTouches[0];
          const deltaX = touch.clientX - start.x;
          const deltaY = touch.clientY - start.y;
          if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) <= Math.abs(deltaY)) return;
          moveRelative(deltaX < 0 ? 1 : -1);
        }}
      >
        <img
          key={activeImage}
          src={activeImage}
          alt={`${alt} - ảnh ${activeIndex + 1}`}
          className="aspect-square w-full object-cover transition-opacity duration-300 motion-reduce:transition-none"
          fetchPriority={activeIndex === 0 ? "high" : "auto"}
          decoding="async"
          draggable={false}
        />
        {imageCount > 1 && (
          <>
            <button
              type="button"
              className="press absolute left-3 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-background focus-visible:bg-background"
              aria-label="Ảnh trước"
              onClick={() => moveRelative(-1)}
            >
              <ChevronLeft size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="press absolute right-3 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-background focus-visible:bg-background"
              aria-label="Ảnh tiếp theo"
              onClick={() => moveRelative(1)}
            >
              <ChevronRight size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-foreground/70 px-2.5 py-1 text-[11px] font-semibold text-white md:hidden" aria-hidden="true">
              {activeIndex + 1} / {imageCount}
            </span>
          </>
        )}
      </div>
      {imageCount > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Chọn ảnh sản phẩm">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              className={`press min-h-16 min-w-16 overflow-hidden rounded-xl border-2 bg-surface-muted transition sm:min-h-20 sm:min-w-20 ${index === activeIndex ? "border-primary ring-2 ring-primary/20" : "border-transparent opacity-75 hover:opacity-100"}`}
              aria-label={`Xem ảnh ${index + 1}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => selectImage(index)}
            >
              <img
                src={image}
                alt=""
                aria-hidden="true"
                className="aspect-square h-full w-full object-cover"
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}
      {imageCount > 1 && <p className="sr-only" aria-live="polite">Đang xem ảnh {activeIndex + 1} trên {imageCount}</p>}
    </div>
  );
}

export { AUTOPLAY_INTERVAL_MS };

