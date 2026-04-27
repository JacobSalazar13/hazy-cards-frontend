"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/components/ToastProvider";

export default function AuthPage() {
  const router = useRouter();
  const toast = useToast();
  const { loginWithGoogle, loading, userDataLoading, isLoggingIn, user, userDoc, error } =
    useAuthContext();

  useEffect(() => {
    if (!loading && !userDataLoading && user && userDoc) router.replace("/");
  }, [loading, userDataLoading, user, userDoc, router]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error, toast]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>
          Authenticate with Google to access the application.
        </p>

        <button
          className={styles.button}
          onClick={() => loginWithGoogle()}
          disabled={loading || isLoggingIn || userDataLoading}
          type="button"
        >
          {isLoggingIn || userDataLoading ? "Signing in..." : "Continue with Google"}
        </button>

        {error ? <div className={styles.error}>{error}</div> : null}
      </div>
    </main>
  );
}


