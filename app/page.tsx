"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/contexts/AuthContext";
import styles from "@/components/AppShell.module.css";
import { DashboardView } from "@/components/DashboardView";
import { UploadCardsView } from "@/components/UploadCardsView";
import { CreateCardView } from "@/components/CreateCardView";

export default function Home() {
  const router = useRouter();
  const { user, loading, userDataLoading, userId, userDoc, logout } = useAuthContext();
  const [active, setActive] = useState<"dashboard" | "upload" | "create">("dashboard");
  const userLine = useMemo(
    () => user?.email ?? user?.displayName ?? user?.uid ?? "",
    [user]
  );

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [loading, user, router]);

  if (loading) return <main style={{ padding: 24 }}>Loading...</main>;
  if (!user) return null;
  if (userDataLoading || !userDoc) return <main style={{ padding: 24 }}>Loading profile...</main>;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandTitle}>Hazy Cards</div>
          <div className={styles.brandSub}>Signed in • {userLine}</div>
        </div>

        <nav className={styles.nav}>
          <button
            type="button"
            className={`${styles.navButton} ${active === "dashboard" ? styles.navButtonActive : ""}`}
            onClick={() => setActive("dashboard")}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`${styles.navButton} ${active === "upload" ? styles.navButtonActive : ""}`}
            onClick={() => setActive("upload")}
          >
            Upload Cards
          </button>
          <button
            type="button"
            className={`${styles.navButton} ${active === "create" ? styles.navButtonActive : ""}`}
            onClick={() => setActive("create")}
          >
            Create Card
          </button>
        </nav>

        <div className={styles.footer}>
          <div className={styles.userLine}>Backend user id: {userId ?? "—"}</div>
          <button type="button" className={styles.signOut} onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        {active === "dashboard" ? <DashboardView user={user} userId={userId ?? ""} /> : null}
        {active === "upload" ? <UploadCardsView user={user} /> : null}
        {active === "create" ? (
          <CreateCardView user={user} onDone={() => setActive("dashboard")} />
        ) : null}
      </main>
    </div>
  );
}


