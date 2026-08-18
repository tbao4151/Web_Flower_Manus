"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; type: ToastType; message: string };
type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current.slice(-2), { id, type, message }]);
    window.setTimeout(() => dismiss(id), 4200);
  }, [dismiss]);

  const value = useMemo(() => ({
    success: (message: string) => push("success", message),
    error: (message: string) => push("error", message),
    info: (message: string) => push("info", message),
  }), [push]);

  return <ToastContext.Provider value={value}>
    {children}
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4" aria-live="polite" aria-atomic="true">
      <div className="flex w-full max-w-md flex-col gap-2">
        {toasts.map((toast) => <div key={toast.id} className={`pointer-events-auto rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg ${toast.type === "success" ? "border-primary/30 bg-[#e4ecdf] text-primary" : toast.type === "error" ? "border-danger/30 bg-[#fae8e4] text-danger" : "border-border bg-surface text-foreground"}`}>
          {toast.message}
        </div>)}
      </div>
    </div>
  </ToastContext.Provider>;
}
