"use client";

import { ClipboardEvent, KeyboardEvent, useEffect, useRef } from "react";

export function OtpCodeInput({ value, onChange, disabled = false }: { value: string; onChange: (next: string) => void; disabled?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("").map((digit) => digit.trim());

  useEffect(() => {
    if (!disabled) refs.current[0]?.focus();
  }, [disabled]);

  function setDigit(index: number, next: string) {
    const clean = next.replace(/\D/g, "").slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = clean;
    const result = nextDigits.join("");
    onChange(result);
    if (clean && index < 5) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      const nextDigits = [...digits];
      nextDigits[index - 1] = "";
      onChange(nextDigits.join(""));
      refs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) refs.current[index + 1]?.focus();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Mã xác nhận gồm 6 chữ số">
      {Array.from({ length: 6 }).map((_, index) => (
        <input
          key={index}
          ref={(element) => { refs.current[index] = element; }}
          value={digits[index]}
          onChange={(event) => setDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          className="h-12 w-11 rounded-xl border border-border bg-background text-center text-lg font-bold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 sm:h-14 sm:w-14"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          aria-label={`Số thứ ${index + 1} của mã xác nhận`}
          disabled={disabled}
          autoComplete={index === 0 ? "one-time-code" : "off"}
        />
      ))}
    </div>
  );
}
