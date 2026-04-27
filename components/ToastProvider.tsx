"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import styles from "./ToastProvider.module.css";

type ToastType = "error" | "info" | "success";

type Toast = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  createdAt: number;
};

type ToastContextValue = {
  push: (t: Omit<Toast, "id" | "createdAt"> & { durationMs?: number }) => void;
  error: (message: string, opts?: { title?: string; durationMs?: number }) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function randomId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const remove = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id" | "createdAt"> & { durationMs?: number }) => {
      const id = randomId();
      const toast: Toast = { id, createdAt: Date.now(), type: t.type, title: t.title, message: t.message };
      setToasts((prev) => [toast, ...prev].slice(0, 5));
      const duration = typeof t.durationMs === "number" ? t.durationMs : 6000;
      const timer = window.setTimeout(() => remove(id), duration);
      timers.current.set(id, timer);
    },
    [remove]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      error: (message, opts) => push({ type: "error", message, title: opts?.title ?? "Access denied", durationMs: opts?.durationMs })
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.viewport} aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${t.type === "error" ? styles.error : ""}`} role="status">
            <div>
              {t.title ? <div className={styles.title}>{t.title}</div> : null}
              <p className={styles.message}>{t.message}</p>
            </div>
            <button className={styles.close} type="button" onClick={() => remove(t.id)} aria-label="Dismiss notification">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider />");
  return ctx;
}


