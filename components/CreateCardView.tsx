"use client";

import { useMemo, useState } from "react";
import type { User } from "firebase/auth";
import styles from "./AppShell.module.css";
import { createCard, runCardPricing } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

const CONDITIONS: Array<{ label: string; value: string }> = [
  { label: "Near Mint", value: "near mint" },
  { label: "Lightly Played", value: "lightly played" },
  { label: "Moderately Played", value: "moderately played" },
  { label: "Heavily Played", value: "heavily played" },
  { label: "Damaged", value: "damaged" }
];

const STATUSES: Array<{ label: string; value: string }> = [
  { label: "Personal Collection", value: "Personal Collection" },
  { label: "For Sale", value: "For Sale" },
  { label: "Watch List", value: "Watch List" },
  { label: "Sold", value: "Sold" }
];

export function CreateCardView(props: { user: User; onDone?: () => void }) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    card_url: "",
    card_condition: "near mint",
    cost_of_card: "",
    status: "Personal Collection"
  });

  const canSubmit = useMemo(() => {
    if (!form.card_url.trim()) return false;
    if (!form.cost_of_card.trim()) return false;
    const n = Number(form.cost_of_card);
    return Number.isFinite(n) && n >= 0;
  }, [form.card_url, form.cost_of_card]);

  async function onCreate() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const created = await createCard({
        user: props.user,
        card_url: form.card_url.trim(),
        card_condition: form.card_condition,
        cost_of_card: Number(form.cost_of_card),
        status: form.status
      });

      const priced = await runCardPricing({ user: props.user, cardIds: [created.card_id] });
      toast.push({
        type: "success",
        title: "Card created",
        message: `Card added. Enriched ${priced.counter ?? 0} card(s). Failed ${priced.failed ?? 0}.`,
        durationMs: 6500
      });

      // Reset form for quick entry of another card.
      setForm((p) => ({ ...p, card_url: "", cost_of_card: "" }));

      // Send user back to Dashboard and refresh so card appears with all fields.
      props.onDone?.();
      window.setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create card failed.";
      toast.error(message, { title: "Create card failed" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>Create Card</h2>
      <div className={styles.muted}>
        Create a single card with minimal info, then automatically run pricing to fetch the rest of the card data.
      </div>

      <div className={styles.formGrid} style={{ marginTop: 12 }}>
        <div className={`${styles.field} ${styles.span2}`}>
          <div className={styles.label}>Card URL</div>
          <input
            className={styles.input}
            placeholder="https://..."
            value={form.card_url}
            onChange={(e) => setForm((p) => ({ ...p, card_url: e.target.value }))}
            disabled={submitting}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.label}>Card condition</div>
          <select
            className={styles.select}
            value={form.card_condition}
            onChange={(e) => setForm((p) => ({ ...p, card_condition: e.target.value }))}
            disabled={submitting}
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <div className={styles.label}>Card purchase price</div>
          <input
            className={styles.input}
            inputMode="decimal"
            placeholder="e.g. 12.50"
            value={form.cost_of_card}
            onChange={(e) => setForm((p) => ({ ...p, cost_of_card: e.target.value }))}
            disabled={submitting}
          />
        </div>

        <div className={`${styles.field} ${styles.span2}`}>
          <div className={styles.label}>Status</div>
          <select
            className={styles.select}
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            disabled={submitting}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.row} style={{ marginTop: 14, justifyContent: "flex-end" }}>
        <button className={styles.button} type="button" onClick={onCreate} disabled={!canSubmit || submitting}>
          {submitting ? "Creating..." : "Create card"}
        </button>
      </div>
    </section>
  );
}


