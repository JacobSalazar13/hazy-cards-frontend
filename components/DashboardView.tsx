"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { deleteCards, editCard, fetchCards, runCardPricing, type Card } from "@/lib/api";
import styles from "./AppShell.module.css";
import { useToast } from "@/components/ToastProvider";
import { CardsGrid } from "@/components/CardsGrid";

export function DashboardView({ user, userId }: { user: User; userId: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<Card[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [statusTab, setStatusTab] = useState<
    "Personal Collection" | "For Sale" | "Watch List" | "Sold"
  >("Personal Collection");
  const [editing, setEditing] = useState<Card | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    card_name: "",
    card_condition: "near mint",
    card_url: "",
    cost_of_card: "",
    status: "Personal Collection",
    card_price_sold: ""
  });

  const [soldPriceModalOpen, setSoldPriceModalOpen] = useState(false);
  const [soldPriceDraft, setSoldPriceDraft] = useState("");
  const [soldPriceError, setSoldPriceError] = useState<string | null>(null);
  const [soldPricePrevStatus, setSoldPricePrevStatus] = useState<string | null>(null);
  const soldPriceInputRef = useRef<HTMLInputElement | null>(null);

  const normalizeStatus = (v: unknown) => String(v ?? "").trim().toLowerCase();

  const money2 = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
      }),
    []
  );

  function toFiniteNumber(v: unknown): number {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function validateSoldPrice(raw: string): { ok: true; value: number; normalized: string } | { ok: false; error: string } {
    const trimmed = raw.trim();
    if (!trimmed.length) return { ok: false, error: "Sold price is required." };
    const n = Number(trimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, error: "Sold price must be an integer." };
    if (n < 0) return { ok: false, error: "Sold price must be a non-negative integer." };
    return { ok: true, value: n, normalized: String(n) };
  }

  function openSoldPriceModal(opts: { prevStatus: string; initial?: string }) {
    setSoldPricePrevStatus(opts.prevStatus);
    setSoldPriceDraft(opts.initial ?? "");
    setSoldPriceError(null);
    setSoldPriceModalOpen(true);
  }

  const load = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchCards({ user, userId, opts: { signal: controller.signal } })
      .then((data) => setCards(data))
      .catch((err) => {
        // Ignore intentional cancellations (common in dev due to Fast Refresh / Strict Mode)
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof Error && /aborted|abort/i.test(err.message)) return;
        const message = err instanceof Error ? err.message : "Failed to fetch cards.";
        toast.error(message, { title: "Dashboard error" });
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [toast, user, userId]);

  useEffect(() => load(), [load]);

  const summary = useMemo(() => {
    if (loading) return "Loading cards…";
    return cards.length ? `Loaded ${cards.length} card(s).` : "No cards returned yet.";
  }, [cards.length, loading]);

  const filteredByStatus = useMemo(() => {
    const target = statusTab.trim().toLowerCase();
    return cards.filter((c) => {
      const s = typeof (c as any).status === "string" ? (c as any).status : "";
      return s.trim().toLowerCase() === target;
    });
  }, [cards, statusTab]);

  const totalsByStatus = useMemo(() => {
    const out: Record<string, { spent: number; earned: number; count: number; marketValue: number }> = {
      "personal collection": { spent: 0, earned: 0, count: 0, marketValue: 0 },
      "for sale": { spent: 0, earned: 0, count: 0, marketValue: 0 },
      "watch list": { spent: 0, earned: 0, count: 0, marketValue: 0 },
      sold: { spent: 0, earned: 0, count: 0, marketValue: 0 }
    };
    for (const c of cards) {
      const s = normalizeStatus((c as any).status);
      const bucket = out[s] ?? null;
      if (!bucket) continue;
      bucket.count += 1;
      bucket.spent += toFiniteNumber((c as any).cost_of_card);
      bucket.marketValue += toFiniteNumber((c as any).market_price);
      if (s === "sold") bucket.earned += toFiniteNumber((c as any).card_price_sold);
    }
    return out;
  }, [cards]);

  const activeTotals = useMemo(() => {
    const key = normalizeStatus(statusTab);
    return totalsByStatus[key] ?? { spent: 0, earned: 0, count: 0, marketValue: 0 };
  }, [statusTab, totalsByStatus]);

  const activeProfit = useMemo(() => {
    if (normalizeStatus(statusTab) !== "sold") return null;
    const profit = activeTotals.earned - activeTotals.spent;
    const roi = activeTotals.spent > 0 ? (profit / activeTotals.spent) * 100 : null;
    return { profit, roi };
  }, [activeTotals.earned, activeTotals.spent, statusTab]);


  const counts = useMemo(() => {
    const out = { "personal collection": 0, "for sale": 0, "watch list": 0, sold: 0 };
    for (const c of cards) {
      const s = typeof (c as any).status === "string" ? (c as any).status : "";
      const k = s.trim().toLowerCase();
      if (k === "personal collection") out["personal collection"]++;
      else if (k === "for sale") out["for sale"]++;
      else if (k === "watch list") out["watch list"]++;
      else if (k === "sold") out.sold++;
    }
    return out;
  }, [cards]);

  async function onDeleteSelected() {
    if (!selected.length) return;
    setDeleting(true);
    try {
      await deleteCards({ user, cards: selected });
      const selectedIds = new Set(
        selected.map((c) => (typeof (c as any).card_id === "string" ? (c as any).card_id : null)).filter(Boolean)
      );
      setCards((prev) =>
        prev.filter((c) => {
          const id = (c as any).card_id;
          return !(typeof id === "string" && selectedIds.has(id));
        })
      );
      setSelected([]);
      setResetSignal((x) => x + 1);
      toast.push({ type: "success", title: "Deleted", message: "Delete request sent (placeholder).", durationMs: 5000 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed.";
      toast.error(message, { title: "Delete failed" });
    } finally {
      setDeleting(false);
    }
  }

  async function onRunPriceSelected() {
    if (!selected.length) return;
    setPricing(true);
    try {
      const cardIds = selected
        .map((c) => (typeof (c as any).card_id === "string" ? (c as any).card_id : null))
        .filter((x): x is string => Boolean(x && x.trim()));
      if (!cardIds.length) {
        toast.error("No valid card_id found in the selected rows.", { title: "Run price failed" });
        return;
      }
      const res = await runCardPricing({ user, cardIds });
      toast.push({
        type: "success",
        title: "Run price complete",
        message: `Updated ${res.counter ?? 0} card(s). Failed ${res.failed ?? 0}.`,
        durationMs: 6000
      });
      // Full refresh so the UI reflects all updated fields.
      window.setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Run price failed.";
      toast.error(message, { title: "Run price failed" });
    } finally {
      setPricing(false);
    }
  }

  function openEdit(card: Card) {
    setEditing(card);
    setEditForm({
      card_name: typeof (card as any).card_name === "string" ? (card as any).card_name : "",
      card_condition:
        typeof (card as any).card_condition === "string" ? (card as any).card_condition : "near mint",
      card_url: typeof (card as any).card_url === "string" ? (card as any).card_url : "",
      cost_of_card:
        (card as any).cost_of_card != null ? String((card as any).cost_of_card) : "",
      status: typeof (card as any).status === "string" ? (card as any).status : "Personal Collection",
      card_price_sold:
        (card as any).card_price_sold != null ? String((card as any).card_price_sold) : ""
    });
  }

  useEffect(() => {
    if (!soldPriceModalOpen) return;
    const t = window.setTimeout(() => soldPriceInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [soldPriceModalOpen]);

  async function saveEdit() {
    if (!editing) return;
    const card_id = (editing as any).card_id;
    if (typeof card_id !== "string" || !card_id.trim()) {
      toast.error("Missing card_id for this row.", { title: "Edit failed" });
      return;
    }
    setSaving(true);
    try {
      const updates: any = {
        card_name: editForm.card_name,
        card_condition: editForm.card_condition,
        card_url: editForm.card_url,
        status: editForm.status
      };
      if (editForm.cost_of_card.trim().length) updates.cost_of_card = Number(editForm.cost_of_card);
      if (normalizeStatus(editForm.status) === "sold") {
        const check = validateSoldPrice(editForm.card_price_sold);
        if (!check.ok) {
          openSoldPriceModal({ prevStatus: editForm.status, initial: editForm.card_price_sold });
          setSoldPriceError(check.error);
          return;
        }
        updates.card_price_sold = check.value;
      } else {
        // Avoid stale sold price if moving out of Sold status.
        if (editForm.card_price_sold.trim().length) updates.card_price_sold = null;
      }
      const res = await editCard({ user, card_id, updates });
      setCards((prev) => prev.map((c) => ((c as any).card_id === card_id ? res.card : c)));
      toast.push({ type: "success", title: "Saved", message: "Card updated.", durationMs: 3500 });
      setEditing(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Edit failed.";
      toast.error(message, { title: "Edit failed" });
    } finally {
      setSaving(false);
    }
  }

  function confirmSoldPriceFromModal() {
    const check = validateSoldPrice(soldPriceDraft);
    if (!check.ok) {
      setSoldPriceError(check.error);
      return;
    }
    setEditForm((p) => ({ ...p, status: "Sold", card_price_sold: check.normalized }));
    setSoldPriceModalOpen(false);
    setSoldPriceError(null);
    setSoldPricePrevStatus(null);
  }

  return (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>Dashboard</h2>
      <div className={styles.row} style={{ justifyContent: "space-between" }}>
        <div className={styles.row}>
          <div className={styles.muted}>{summary}</div>
          <div className={styles.segmented} role="tablist" aria-label="Status tabs">
            <button
              type="button"
              role="tab"
              aria-selected={statusTab === "Personal Collection"}
              className={`${styles.segment} ${statusTab === "Personal Collection" ? styles.segmentActive : ""}`}
              onClick={() => {
                setStatusTab("Personal Collection");
                setSelected([]);
                setResetSignal((x) => x + 1);
              }}
            >
              Personal Collection ({counts["personal collection"]})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusTab === "For Sale"}
              className={`${styles.segment} ${statusTab === "For Sale" ? styles.segmentActive : ""}`}
              onClick={() => {
                setStatusTab("For Sale");
                setSelected([]);
                setResetSignal((x) => x + 1);
              }}
            >
              For Sale ({counts["for sale"]})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusTab === "Watch List"}
              className={`${styles.segment} ${statusTab === "Watch List" ? styles.segmentActive : ""}`}
              onClick={() => {
                setStatusTab("Watch List");
                setSelected([]);
                setResetSignal((x) => x + 1);
              }}
            >
              Watch List ({counts["watch list"]})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusTab === "Sold"}
              className={`${styles.segment} ${statusTab === "Sold" ? styles.segmentActive : ""}`}
              onClick={() => {
                setStatusTab("Sold");
                setSelected([]);
                setResetSignal((x) => x + 1);
              }}
            >
              Sold ({counts.sold})
            </button>
          </div>
        </div>
        <div className={styles.row}>
          <button className={styles.button} type="button" onClick={() => load()} disabled={loading}>
            Refresh
          </button>
          <button
            className={styles.button}
            type="button"
            onClick={() => onRunPriceSelected()}
            disabled={!selected.length || pricing}
          >
            {pricing ? "Running..." : `Run price (${selected.length})`}
          </button>
          <button
            className={styles.button}
            type="button"
            onClick={() => onDeleteSelected()}
            disabled={!selected.length || deleting}
          >
            {deleting ? "Deleting..." : `Delete selected (${selected.length})`}
          </button>
        </div>
      </div>

      <div className={styles.metricsGrid}>
        {normalizeStatus(statusTab) === "sold" ? (
          <>
            <div className={styles.metricCard}>
              <div className={styles.metricTop}>
                <div className={styles.metricLabel}>Spent</div>
                <div className={styles.metricAccent} aria-hidden="true" />
              </div>
              <div className={styles.metricValue}>{money2.format(activeTotals.spent)}</div>
              <div className={styles.metricSub}>Across {activeTotals.count} sold card(s)</div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricTop}>
                <div className={styles.metricLabel}>Earned</div>
                <div className={styles.metricAccent} aria-hidden="true" />
              </div>
              <div className={styles.metricValue}>{money2.format(activeTotals.earned)}</div>
              <div className={styles.metricSub}>Gross revenue</div>
            </div>

            <div
              className={`${styles.metricCard} ${
                activeProfit && activeProfit.profit < -0.00001 ? styles.metricNegative : activeProfit && activeProfit.profit > 0.00001 ? styles.metricPositive : ""
              }`}
            >
              <div className={styles.metricTop}>
                <div className={styles.metricLabel}>Profit</div>
                <div className={styles.metricAccent} aria-hidden="true" />
              </div>
              <div className={styles.metricValue}>{money2.format(activeProfit?.profit ?? 0)}</div>
              <div className={styles.metricSub}>Earned − spent</div>
            </div>

            <div
              className={`${styles.metricCard} ${
                activeProfit && (activeProfit.roi ?? 0) < -0.00001 ? styles.metricNegative : activeProfit && (activeProfit.roi ?? 0) > 0.00001 ? styles.metricPositive : ""
              }`}
            >
              <div className={styles.metricTop}>
                <div className={styles.metricLabel}>ROI</div>
                <div className={styles.metricAccent} aria-hidden="true" />
              </div>
              <div className={styles.metricValue}>
                {activeProfit?.roi == null ? "—" : `${Math.round(activeProfit.roi)}%`}
              </div>
              <div className={styles.metricSub}>Profit ÷ spent</div>
            </div>
          </>
        ) : (
          <>
            <div className={styles.metricCard}>
              <div className={styles.metricTop}>
                <div className={styles.metricLabel}>Total spent</div>
                <div className={styles.metricAccent} aria-hidden="true" />
              </div>
              <div className={styles.metricValue}>{money2.format(activeTotals.spent)}</div>
              <div className={styles.metricSub}>Across {activeTotals.count} card(s) in this tab</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricTop}>
                <div className={styles.metricLabel}>Total value</div>
                <div className={styles.metricAccent} aria-hidden="true" />
              </div>
              <div className={styles.metricValue}>{money2.format(activeTotals.marketValue)}</div>
              <div className={styles.metricSub}>Sum of market prices</div>
            </div>
            <div className={`${styles.metricCard} ${
              activeTotals.spent > 0
                ? activeTotals.marketValue >= activeTotals.spent
                  ? styles.metricPositive
                  : styles.metricNegative
                : ""
            }`}>
              <div className={styles.metricTop}>
                <div className={styles.metricLabel}>Return</div>
                <div className={styles.metricAccent} aria-hidden="true" />
              </div>
              <div className={styles.metricValue}>
                {activeTotals.spent > 0
                  ? `${Math.round(((activeTotals.marketValue - activeTotals.spent) / activeTotals.spent) * 100)}%`
                  : "—"}
              </div>
              <div className={styles.metricSub}>Value ÷ spent</div>
            </div>
          </>
        )}
      </div>

      <CardsGrid
        cards={filteredByStatus}
        onSelectionChange={setSelected}
        resetSignal={resetSignal}
        onEdit={openEdit}
      />

      {editing && soldPriceModalOpen ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Set sold price">
          <div className={styles.modal} style={{ width: "min(520px, 96vw)" }}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Set sold price</h3>
                <div className={styles.muted}>
                  {(editing as any).card_name ? String((editing as any).card_name) : "—"}
                </div>
              </div>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => {
                  // Revert status if the user cancels the sold-price step.
                  if (soldPricePrevStatus != null) setEditForm((p) => ({ ...p, status: soldPricePrevStatus }));
                  setSoldPriceModalOpen(false);
                  setSoldPriceError(null);
                  setSoldPricePrevStatus(null);
                }}
              >
                Close
              </button>
            </div>

            <div className={styles.formGrid} style={{ gridTemplateColumns: "1fr" }}>
              <div className={styles.field}>
                <div className={styles.label}>Sold Price (integer)</div>
                <input
                  ref={soldPriceInputRef}
                  className={styles.input}
                  inputMode="numeric"
                  placeholder="e.g. 25"
                  value={soldPriceDraft}
                  onChange={(e) => {
                    setSoldPriceDraft(e.target.value);
                    setSoldPriceError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmSoldPriceFromModal();
                    if (e.key === "Escape") {
                      if (soldPricePrevStatus != null) setEditForm((p) => ({ ...p, status: soldPricePrevStatus }));
                      setSoldPriceModalOpen(false);
                      setSoldPriceError(null);
                      setSoldPricePrevStatus(null);
                    }
                  }}
                />
                {soldPriceError ? (
                  <div className={styles.muted} style={{ color: "var(--danger, #ff6b6b)" }}>
                    {soldPriceError}
                  </div>
                ) : (
                  <div className={styles.muted}>Whole dollars only (no decimals).</div>
                )}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  if (soldPricePrevStatus != null) setEditForm((p) => ({ ...p, status: soldPricePrevStatus }));
                  setSoldPriceModalOpen(false);
                  setSoldPriceError(null);
                  setSoldPricePrevStatus(null);
                }}
              >
                Cancel
              </button>
              <button type="button" className={styles.button} onClick={confirmSoldPriceFromModal}>
                Save sold price
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Edit card</h3>
                <div className={styles.muted}>
                  {(editing as any).card_name ? String((editing as any).card_name) : "—"}
                </div>
              </div>
              <button type="button" className={styles.iconBtn} onClick={() => setEditing(null)}>
                Close
              </button>
            </div>

            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.span2}`}>
                <div className={styles.label}>Name</div>
                <input
                  className={styles.input}
                  value={editForm.card_name}
                  onChange={(e) => setEditForm((p) => ({ ...p, card_name: e.target.value }))}
                />
              </div>

              <div className={styles.field}>
                <div className={styles.label}>Condition</div>
                <select
                  className={styles.select}
                  value={editForm.card_condition}
                  onChange={(e) => setEditForm((p) => ({ ...p, card_condition: e.target.value }))}
                >
                  <option value="near mint">near mint</option>
                  <option value="lightly played">lightly played</option>
                  <option value="moderately played">moderately played</option>
                  <option value="heavily played">heavily played</option>
                  <option value="damaged">damaged</option>
                </select>
              </div>

              <div className={styles.field}>
                <div className={styles.label}>Cost</div>
                <input
                  className={styles.input}
                  inputMode="decimal"
                  placeholder="e.g. 12.50"
                  value={editForm.cost_of_card}
                  onChange={(e) => setEditForm((p) => ({ ...p, cost_of_card: e.target.value }))}
                />
              </div>

              <div className={`${styles.field} ${styles.span2}`}>
                <div className={styles.label}>URL</div>
                <input
                  className={styles.input}
                  placeholder="https://..."
                  value={editForm.card_url}
                  onChange={(e) => setEditForm((p) => ({ ...p, card_url: e.target.value }))}
                />
              </div>

              <div className={`${styles.field} ${styles.span2}`}>
                <div className={styles.label}>Status</div>
                <select
                  className={styles.select}
                  value={editForm.status}
                  onChange={(e) => {
                    const next = e.target.value;
                    const prev = editForm.status;
                    if (normalizeStatus(next) === "sold" && normalizeStatus(prev) !== "sold") {
                      // Switch to Sold immediately, then require sold price in a styled modal.
                      setEditForm((p) => ({ ...p, status: next }));
                      openSoldPriceModal({ prevStatus: prev, initial: editForm.card_price_sold });
                      return;
                    }
                    setEditForm((p) => ({
                      ...p,
                      status: next,
                      card_price_sold: normalizeStatus(next) === "sold" ? p.card_price_sold : ""
                    }));
                  }}
                >
                  <option value="Personal Collection">Personal Collection</option>
                  <option value="For Sale">For Sale</option>
                  <option value="Watch List">Watch List</option>
                  <option value="Sold">Sold</option>
                </select>
              </div>

              {String(editForm.status).trim().toLowerCase() === "sold" ? (
                <div className={styles.field}>
                  <div className={styles.label}>Sold Price (integer)</div>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    placeholder="e.g. 25"
                    value={editForm.card_price_sold}
                    onChange={(e) => {
                      const next = e.target.value;
                      // Keep it permissive while typing; validation happens on Save / prompt.
                      setEditForm((p) => ({ ...p, card_price_sold: next }));
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.button} onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className={styles.button} onClick={() => saveEdit()} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}


