"use client";

import { useEffect } from "react";

const STORAGE_KEY = "cas-hoa-navigation-resume";
const TAB_KEY = "cas-hoa-navigation-tab";
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

type ResumeMarker = { route: string; hiddenAt: number; tabId: string };

function readMarker(): ResumeMarker | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const marker = JSON.parse(raw) as Partial<ResumeMarker>;
    if (typeof marker.route !== "string" || typeof marker.hiddenAt !== "number" || typeof marker.tabId !== "string") return null;
    return marker as ResumeMarker;
  } catch {
    return null;
  }
}

function getTabId() {
  try {
    const existing = window.sessionStorage.getItem(TAB_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(TAB_KEY, created);
    return created;
  } catch {
    return "fallback-tab";
  }
}

export default function StaleNavigationReset() {
  useEffect(() => {
    const tabId = getTabId();
    let redirected = false;

    const resetIfStaleResume = (allowNavigationRestore: boolean) => {
      if (redirected || !allowNavigationRestore) return;
      const marker = readMarker();
      if (!marker || marker.tabId !== tabId || Date.now() - marker.hiddenAt <= STALE_AFTER_MS) return;
      redirected = true;
      try { window.sessionStorage.setItem("cas-hoa-navigation-reset", String(Date.now())); } catch { /* best effort */ }
      window.localStorage.removeItem(STORAGE_KEY);
      if (window.location.pathname !== "/") window.location.replace("/");
    };

    const markHidden = () => {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ route: `${window.location.pathname}${window.location.search}`, hiddenAt: Date.now(), tabId } satisfies ResumeMarker)); } catch { /* best effort */ }
    };
    const clearActiveMarker = () => {
      try {
        const marker = readMarker();
        if (marker?.tabId === tabId) window.localStorage.removeItem(STORAGE_KEY);
      } catch { /* best effort */ }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") markHidden();
      else resetIfStaleResume(true);
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const restoredNavigation = Boolean(event.persisted) || navigation?.type === "back_forward" || navigation?.type === "reload";
      resetIfStaleResume(restoredNavigation);
    };
    const handlePageHide = () => markHidden();

    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    resetIfStaleResume(navigation?.type === "back_forward" || navigation?.type === "reload");
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      clearActiveMarker();
    };
  }, []);

  return null;
}
