"use client";

import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type AuthError
} from "firebase/auth";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { fetchUserDocByEmail, type BackendUserDocResponse } from "@/lib/api";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  userDataLoading: boolean;
  isLoggingIn: boolean;
  error: string | null;
  userId: string | null;
  userDoc: BackendUserDocResponse["user_doc"] | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getAuthErrorMessage(err: unknown): string {
  const e = err as Partial<AuthError> | null | undefined;
  const code = typeof e?.code === "string" ? e.code : "";
  if (code === "auth/popup-closed-by-user") return "Sign-in popup closed.";
  if (code === "auth/cancelled-popup-request") return "Sign-in popup cancelled.";
  if (code === "auth/popup-blocked") return "Popup blocked. Allow popups and try again.";
  return "Sign-in failed. Please try again.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userDoc, setUserDoc] = useState<BackendUserDocResponse["user_doc"] | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);

      if (u) {
        // Useful for "tell who is accessing" during development
        console.log("[auth] signed in:", {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          providerData: u.providerData.map((p) => ({ providerId: p.providerId, uid: p.uid, email: p.email }))
        });

        // Gate access on backend whitelist/user-doc check
        const email = u.email ?? "";
        if (!email) {
          setError("No email found on this Firebase user.");
          setUserDataLoading(false);
          setUserId(null);
          setUserDoc(null);
          await signOut(auth);
          return;
        }

        setUserDataLoading(true);
        try {
          const { user_id, user_doc } = await fetchUserDocByEmail({
            user: u,
            signal: controller.signal
          });
          setUserId(user_id);
          setUserDoc(user_doc);
          setError(null);
        } catch (err) {
          const e = err as Error & { status?: number };
          setError(e.message || "Access check failed.");
          setUserId(null);
          setUserDoc(null);
          await signOut(auth);
        } finally {
          setUserDataLoading(false);
        }
      } else {
        console.log("[auth] signed out");
        setUserDataLoading(false);
        setUserId(null);
        setUserDoc(null);
      }
    });

    return () => {
      controller.abort();
      unsub();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      userDataLoading,
      isLoggingIn,
      error,
      userId,
      userDoc,
      loginWithGoogle: async () => {
        setError(null);
        setIsLoggingIn(true);
        try {
          await signInWithPopup(auth, googleProvider);
        } catch (err) {
          setError(getAuthErrorMessage(err));
        } finally {
          setIsLoggingIn(false);
        }
      },
      logout: async () => {
        setError(null);
        await signOut(auth);
      }
    }),
    [user, loading, userDataLoading, isLoggingIn, error, userId, userDoc]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within <AuthProvider />");
  return ctx;
}


