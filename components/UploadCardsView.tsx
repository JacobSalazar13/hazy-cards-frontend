"use client";

import { useMemo, useState } from "react";
import type { User } from "firebase/auth";
import styles from "./AppShell.module.css";
import { uploadCardsCsv } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

export function UploadCardsView({ user }: { user: User }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileLabel = useMemo(() => {
    if (!file) return "No file selected.";
    const kb = Math.round(file.size / 1024);
    return `${file.name} (${kb.toLocaleString()} KB)`;
  }, [file]);

  async function onUpload() {
    if (!file) return;
    setUploading(true);
    try {
      await uploadCardsCsv({ user, file });
      toast.push({ type: "success", title: "Upload started", message: "CSV uploaded (placeholder).", durationMs: 5000 });
      setFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      toast.error(message, { title: "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>Upload Cards</h2>
      <div className={styles.muted}>
        Select a CSV file and upload it. This currently posts to the placeholder endpoint{" "}
        <code>/cards/upload</code>.
      </div>

      <div className={styles.row} style={{ marginTop: 12 }}>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={uploading}
        />
        <button className={styles.button} type="button" onClick={onUpload} disabled={!file || uploading}>
          {uploading ? "Uploading..." : "Upload CSV"}
        </button>
      </div>

      <div className={styles.muted} style={{ marginTop: 10 }}>
        {fileLabel}
      </div>
    </section>
  );
}


