"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/ToastProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}


