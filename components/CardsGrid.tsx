"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Card } from "@/lib/api";
import styles from "./CardsGrid.module.css";

function toText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function getRowId(card: Card, idx: number): string {
  const id = (card as any).card_id;
  if (typeof id === "string" && id.length) return id;
  return `row_${idx}`;
}

const float2 = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});

function formatFloat(v: unknown): string {
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return toText(v);
  return float2.format(n);
}

function normalizeCondition(v: unknown): string {
  const s = toText(v).trim().toLowerCase();
  return s;
}

function normalizeStatus(v: unknown): string {
  return toText(v).trim().toLowerCase();
}

function toFiniteNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatSignedPercent(p: number): string {
  // Keep it compact on the tile: show whole percent.
  const rounded = Math.round(p);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

type SortDir = "asc" | "desc";

type ExtraColumn = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  colClassName?: string;
  render: (card: Card) => React.ReactNode;
};

export function CardsGrid(props: {
  cards: Card[];
  onSelectionChange?: (selected: Card[]) => void;
  resetSignal?: number;
  onEdit?: (card: Card) => void;
  extraColumns?: ExtraColumn[];
}) {
  const { cards } = props;

  const rows = useMemo(() => cards.map((c, idx) => ({ id: getRowId(c, idx), card: c })), [cards]);

  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [sortKey, setSortKey] = useState<string>("card_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof props.resetSignal === "number") setSelectedIds(new Set());
  }, [props.resetSignal]);

  const searchableText = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const parts: string[] = [];
      for (const key in r.card) {
        if (key !== "card_id" && key !== "user_id" && key !== "userId" && key !== "userID") {
          parts.push(toText((r.card as any)[key]));
        }
      }
      map.set(r.id, parts.join(" ").toLowerCase());
    }
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (searchableText.get(r.id) ?? "").includes(q));
  }, [query, rows, searchableText]);

  const sorted = useMemo(() => {
    const key = sortKey;
    if (!key) return filtered;

    const dir = sortDir === "asc" ? 1 : -1;
    const toSortable = (v: unknown) => {
      if (v == null) return { kind: "empty" as const, s: "", n: 0 };
      if (key === "cost_of_card" || key === "market_price" || key === "avg_sale_price") {
        const n = typeof v === "number" ? v : Number(v);
        return { kind: "num" as const, s: "", n: Number.isFinite(n) ? n : 0 };
      }
      return { kind: "str" as const, s: toText(v).toLowerCase(), n: 0 };
    };

    return [...filtered].sort((a, b) => {
      const av = toSortable((a.card as any)[key]);
      const bv = toSortable((b.card as any)[key]);

      if (av.kind === "empty" && bv.kind !== "empty") return 1;
      if (bv.kind === "empty" && av.kind !== "empty") return -1;

      if (av.kind === "num" && bv.kind === "num") {
        return (av.n - bv.n) * dir;
      }
      return av.s.localeCompare(bv.s) * dir;
    });
  }, [filtered, sortDir, sortKey]);

  const selectedCards = useMemo(() => {
    const byId = new Map(rows.map((r) => [r.id, r.card] as const));
    return Array.from(selectedIds).map((id) => byId.get(id)).filter((c): c is Card => Boolean(c));
  }, [rows, selectedIds]);

  useEffect(() => {
    props.onSelectionChange?.(selectedCards);
  }, [props, selectedCards]);

  const allVisibleSelected = useMemo(() => {
    if (!sorted.length) return false;
    return sorted.every((r) => selectedIds.has(r.id));
  }, [sorted, selectedIds]);

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (sorted.every((r) => next.has(r.id))) {
        for (const r of sorted) next.delete(r.id);
      } else {
        for (const r of sorted) next.add(r.id);
      }
      return next;
    });
  }, [sorted]);

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getCardImageUrl(card: Card): string | null {
    const url = (card as any).card_photo_url;
    return typeof url === "string" && url.length > 0 ? url : null;
  }

  function getCardDetails(card: Card): Array<{ label: string; value: string }> {
    const details: Array<{ label: string; value: string }> = [];
    const cardAny = card as any;

    // Basic info
    if (cardAny.card_name) details.push({ label: "Name", value: toText(cardAny.card_name) });
    if (cardAny.card_number) details.push({ label: "Number", value: toText(cardAny.card_number) });
    if (cardAny.card_condition) {
      const cond = normalizeCondition(cardAny.card_condition);
      details.push({ label: "Condition", value: cond || "—" });
    }
    if (cardAny.status) {
      const status = normalizeStatus(cardAny.status);
      const label =
        status === "personal collection"
          ? "Personal Collection"
          : status === "for sale"
            ? "For Sale"
            : status === "watch list"
              ? "Watch List"
              : status === "sold"
                ? "Sold"
                : toText(cardAny.status);
      details.push({ label: "Status", value: label });
    }
    // Sold price (only show when the card is actually Sold)
    if (normalizeStatus(cardAny.status) === "sold" && cardAny.card_price_sold != null) {
      details.push({ label: "Sold Price", value: `$${formatFloat(cardAny.card_price_sold)}` });
    }

    // Card details
    if (cardAny.card_type) details.push({ label: "Type", value: toText(cardAny.card_type) });
    if (cardAny.card_rarity) details.push({ label: "Rarity", value: toText(cardAny.card_rarity) });
    if (cardAny.artist) details.push({ label: "Artist", value: toText(cardAny.artist) });

    // Pricing
    if (cardAny.cost_of_card != null) {
      details.push({ label: "Cost", value: `$${formatFloat(cardAny.cost_of_card)}` });
    }
    if (cardAny.market_price != null) {
      details.push({ label: "Market Price", value: `$${formatFloat(cardAny.market_price)}` });
    }
    if (cardAny.avg_sale_price != null) {
      details.push({ label: "Avg Sale Price", value: `$${formatFloat(cardAny.avg_sale_price)}` });
    }
    if (cardAny.avg_full_price != null) {
      details.push({ label: "Avg Full Price", value: `$${formatFloat(cardAny.avg_full_price)}` });
    }
    if (cardAny.listings_avg_price != null) {
      details.push({ label: "Listings Avg Price", value: `$${formatFloat(cardAny.listings_avg_price)}` });
    }
    if (cardAny.low_sale_price != null) {
      details.push({ label: "Low Sale Price", value: `$${formatFloat(cardAny.low_sale_price)}` });
    }
    if (cardAny.high_sale_price != null) {
      details.push({ label: "High Sale Price", value: `$${formatFloat(cardAny.high_sale_price)}` });
    }

    // Market data
    if (cardAny.current_quantity != null) {
      details.push({ label: "Current Quantity", value: toText(cardAny.current_quantity) });
    }
    if (cardAny.current_sellers != null) {
      details.push({ label: "Current Sellers", value: toText(cardAny.current_sellers) });
    }
    if (cardAny.total_sold != null) {
      details.push({ label: "Total Sold", value: toText(cardAny.total_sold) });
    }
    if (cardAny.avg_daily_sold != null) {
      details.push({ label: "Avg Daily Sold", value: formatFloat(cardAny.avg_daily_sold) });
    }

    // Recent sale prices
    const salePrices: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const key = `sale_price_${i}`;
      if (cardAny[key] != null) {
        salePrices.push(`$${formatFloat(cardAny[key])}`);
      }
    }
    if (salePrices.length > 0) {
      details.push({ label: "Recent Sales", value: salePrices.join(", ") });
    }

    // Expected return and target price (if available)
    if (cardAny.expected_return != null) {
      details.push({ label: "Expected Return", value: `${formatFloat(cardAny.expected_return)}%` });
    }
    if (cardAny.target_sell_price != null) {
      details.push({ label: "Target Sell Price", value: `$${formatFloat(cardAny.target_sell_price)}` });
    }

    return details;
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.pill}>
            Showing <b>{filtered.length}</b> / {cards.length}
          </div>
          <div className={styles.pill}>
            Selected <b>{selectedIds.size}</b>
          </div>
          {sorted.length > 0 && (
            <button
              type="button"
              className={styles.selectAllBtn}
              onClick={toggleAllVisible}
            >
              {allVisibleSelected ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>
        <input
          className={styles.search}
          placeholder="Search cards…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {cards.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No cards yet</div>
          <p className={styles.emptyBody}>
            Upload a CSV from the ‘Upload Cards’ page to create your first collection.
          </p>
        </div>
      ) : null}

      {sorted.length > 0 ? (
        <div className={styles.grid}>
          {sorted.map(({ id, card }) => {
            const selected = selectedIds.has(id);
            const imageUrl = getCardImageUrl(card);
            const details = getCardDetails(card);
            const isHovered = hoveredCardId === id;
            const cardName = toText((card as any).card_name || "");
            const status = normalizeStatus((card as any).status);
            const cost = toFiniteNumber((card as any).cost_of_card);
            const sold = toFiniteNumber((card as any).card_price_sold);
            const market = toFiniteNumber((card as any).market_price);
            const usesMarket = status === "for sale" || status === "personal collection";
            const referencePrice = status === "sold" ? sold : usesMarket ? market : null;
            const hasProfit = (status === "sold" || usesMarket) && cost != null && cost > 0 && referencePrice != null;
            const profitPct = hasProfit ? ((referencePrice! - cost!) / cost!) * 100 : null;
            const profitIsPositive = profitPct != null && profitPct > 0.00001;
            const profitIsNegative = profitPct != null && profitPct < -0.00001;
            const profitBadgeClass =
              profitPct == null
                ? ""
                : profitIsPositive
                  ? styles.profitBadgePositive
                  : profitIsNegative
                    ? styles.profitBadgeNegative
                    : styles.profitBadgeNeutral;
            const profitIcon = profitPct == null ? "" : profitIsPositive ? "▲" : profitIsNegative ? "▼" : "•";
            const profitText = profitPct == null ? "" : formatSignedPercent(profitPct);
            const profitTitle =
              profitPct == null
                ? ""
                : status === "sold"
                  ? `Cost $${formatFloat(cost)} → Sold $${formatFloat(sold)}`
                  : `Cost $${formatFloat(cost)} → Market $${formatFloat(market)}`;

            return (
              <div
                key={id}
                className={`${styles.cardWrapper} ${selected ? styles.cardSelected : ""}`}
                onMouseEnter={() => setHoveredCardId(id)}
                onMouseLeave={() => setHoveredCardId(null)}
                onClick={() => toggleOne(id)}
              >
                {selected && <div className={styles.selectedIndicator} />}
                {hasProfit ? (
                  <div
                    className={`${styles.profitBadge} ${profitBadgeClass}`}
                    title={profitTitle}
                  >
                    <span className={styles.profitBadgeIcon} aria-hidden="true">
                      {profitIcon}
                    </span>
                    <span className={styles.profitBadgeValue}>{profitText}</span>
                  </div>
                ) : null}
                <div className={styles.cardImageContainer}>
                  {imageUrl ? (
                    <img src={imageUrl} alt={cardName || "Card"} className={styles.cardImage} />
                  ) : (
                    <div className={styles.cardImagePlaceholder}>
                      <span>No Image</span>
                    </div>
                  )}
                  {isHovered && (
                    <div className={styles.cardHoverDetails}>
                      <div className={styles.hoverContent}>
                        {details.map((detail, idx) => (
                          <div key={idx} className={styles.hoverRow}>
                            <span className={styles.hoverLabel}>{detail.label}:</span>
                            <span className={styles.hoverValue}>{detail.value}</span>
                          </div>
                        ))}
                        {(card as any).card_url ? (
                          <a
                            href={(card as any).card_url}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.hoverLink}
                            onClick={(e) => e.stopPropagation()}
                          >
                            View on TCGplayer →
                          </a>
                        ) : null}
                        {props.onEdit ? (
                          <button
                            className={styles.hoverEditBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onEdit?.(card);
                            }}
                          >
                            Edit
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
                <div className={styles.cardName}>{cardName || "—"}</div>
              </div>
            );
          })}
        </div>
      ) : cards.length > 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No cards match your search.</div>
        </div>
      ) : null}
    </div>
  );
}

