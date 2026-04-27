"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Card } from "@/lib/api";
import styles from "./CardsTable.module.css";

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

type SortDir = "asc" | "desc";

type ExtraColumn = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  colClassName?: string;
  render: (card: Card) => React.ReactNode;
};

export function CardsTable(props: {
  cards: Card[];
  onSelectionChange?: (selected: Card[]) => void;
  resetSignal?: number;
  onEdit?: (card: Card) => void;
  extraColumns?: ExtraColumn[];
}) {
  const { cards } = props;

  const rows = useMemo(() => cards.map((c, idx) => ({ id: getRowId(c, idx), card: c })), [cards]);

  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const c of cards) Object.keys(c).forEach((k) => keys.add(k));
    const arr = Array.from(keys);
    // Hide internal columns from the UI
    const hidden = new Set(["card_id", "user_id", "userId", "userID"]);
    const visible = arr.filter((k) => !hidden.has(k));
    // Put common fields first if present
    const preferred = ["card_name", "card_condition", "cost_of_card", "card_url", "status"];
    visible.sort((a, b) => {
      const ia = preferred.indexOf(a);
      const ib = preferred.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return a.localeCompare(b);
    });
    return visible;
  }, [cards]);

  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [sortKey, setSortKey] = useState<string>("card_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    if (typeof props.resetSignal === "number") setSelectedIds(new Set());
  }, [props.resetSignal]);

  const searchableTextById = useMemo(() => {
    // Precompute concatenated text for global search.
    const map = new Map<string, string>();
    for (const r of rows) {
      const parts: string[] = [];
      for (const k of columns) parts.push(toText((r.card as any)[k]));
      map.set(r.id, parts.join(" ").toLowerCase());
    }
    return map;
  }, [columns, rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (searchableTextById.get(r.id) ?? "").includes(q));
  }, [query, rows, searchableTextById]);

  const sorted = useMemo(() => {
    const key = sortKey;
    if (!key || !columns.includes(key)) return filtered;

    const dir = sortDir === "asc" ? 1 : -1;
    const toSortable = (v: unknown) => {
      if (v == null) return { kind: "empty" as const, s: "", n: 0 };
      if (key === "cost_of_card") {
        const n = typeof v === "number" ? v : Number(v);
        return { kind: "num" as const, s: "", n: Number.isFinite(n) ? n : 0 };
      }
      return { kind: "str" as const, s: toText(v).toLowerCase(), n: 0 };
    };

    return [...filtered].sort((a, b) => {
      const av = toSortable((a.card as any)[key]);
      const bv = toSortable((b.card as any)[key]);

      // empties last
      if (av.kind === "empty" && bv.kind !== "empty") return 1;
      if (bv.kind === "empty" && av.kind !== "empty") return -1;

      if (av.kind === "num" && bv.kind === "num") {
        return (av.n - bv.n) * dir;
      }
      return av.s.localeCompare(bv.s) * dir;
    });
  }, [columns, filtered, sortDir, sortKey]);

  const selectedCards = useMemo(() => {
    const byId = new Map(rows.map((r) => [r.id, r.card] as const));
    return Array.from(selectedIds).map((id) => byId.get(id)).filter((c): c is Card => Boolean(c));
  }, [rows, selectedIds]);

  // Inform parent when selection changes
  useEffect(() => {
    props.onSelectionChange?.(selectedCards);
  }, [props, selectedCards]);

  const allVisibleSelected = useMemo(() => {
    if (!sorted.length) return false;
    return sorted.every((r) => selectedIds.has(r.id));
  }, [sorted, selectedIds]);

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (sorted.length === 0) return next;
      if (sorted.every((r) => next.has(r.id))) {
        // unselect visible
        for (const r of sorted) next.delete(r.id);
      } else {
        // select visible
        for (const r of sorted) next.add(r.id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const columnLabels: Record<string, string> = {
    card_name: "Name",
    card_condition: "Condition",
    cost_of_card: "Cost",
    card_url: "Link",
    status: "Status"
  };

  const alignFor = (col: string) => {
    if (col === "cost_of_card") return styles.alignRight;
    if (col === "card_condition") return styles.alignCenter;
    if (col === "card_url") return styles.alignCenter;
    if (col === "status") return styles.alignCenter;
    return styles.alignLeft;
  };

  const colClassFor = (col: string) => {
    if (col === "card_name") return styles.colName;
    if (col === "card_condition") return styles.colCondition;
    if (col === "cost_of_card") return styles.colCost;
    if (col === "card_url") return styles.colLink;
    if (col === "status") return styles.colStatus;
    return "";
  };

  const alignClass = (a?: ExtraColumn["align"]) => {
    if (a === "right") return styles.alignRight;
    if (a === "center") return styles.alignCenter;
    return styles.alignLeft;
  };

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
        </div>
        <input
          className={styles.search}
          placeholder="Search cards (all columns)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {cards.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No cards yet</div>
          <p className={styles.emptyBody}>
            Upload a CSV from the “Upload Cards” page to create your first collection.
          </p>
        </div>
      ) : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            <col className={styles.colCheckbox} />
            {columns.map((c) => (
              <col key={c} className={colClassFor(c)} />
            ))}
            {props.extraColumns?.map((c) => (
              <col key={c.key} className={c.colClassName ?? ""} />
            ))}
            {props.onEdit ? <col className={styles.colActions} /> : null}
          </colgroup>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.checkboxCell}`}>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
              </th>
              {columns.map((c) => (
                <th key={c} className={`${styles.th} ${alignFor(c)}`}>
                  <button
                    type="button"
                    className={`${styles.thButton} ${alignFor(c)}`}
                    onClick={() => {
                      if (sortKey === c) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      else {
                        setSortKey(c);
                        setSortDir("asc");
                      }
                    }}
                  >
                    <span>{columnLabels[c] ?? c}</span>
                    <span className={styles.sortIcon}>
                      {sortKey === c ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </span>
                  </button>
                </th>
              ))}
              {props.extraColumns?.map((c) => (
                <th key={c.key} className={`${styles.th} ${alignClass(c.align)}`}>
                  {c.label}
                </th>
              ))}
              {props.onEdit ? (
                <th className={`${styles.th} ${styles.actionsCell} ${styles.alignCenter}`}>Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ id, card }) => {
              const selected = selectedIds.has(id);
              return (
                <tr
                  key={id}
                  className={`${styles.row} ${styles.zebra} ${selected ? styles.rowSelected : ""}`}
                >
                  <td className={`${styles.td} ${styles.checkboxCell}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleOne(id)} />
                  </td>
                  {columns.map((col) => {
                    const value = (card as any)[col];
                    if (col === "card_condition") {
                      const cond = normalizeCondition(value);
                      return (
                        <td key={col} className={`${styles.td} ${styles.alignCenter}`}>
                          <span className={styles.badge} data-variant={cond || "near mint"}>
                            {cond || "—"}
                          </span>
                        </td>
                      );
                    }
                    if (col === "status") {
                      const status = normalizeStatus(value);
                      const label =
                        status === "personal collection"
                          ? "Personal Collection"
                          : status === "for sale"
                            ? "For Sale"
                            : status === "watch list"
                              ? "Watch List"
                              : status === "sold"
                                ? "Sold"
                                : toText(value) || "—";
                      return (
                        <td key={col} className={`${styles.td} ${styles.alignCenter}`}>
                          <span
                            className={styles.badge}
                            data-kind="status"
                            data-variant={status || "unknown"}
                          >
                            {label}
                          </span>
                        </td>
                      );
                    }
                    if (col === "cost_of_card") {
                      const text = formatFloat(value);
                      return (
                        <td key={col} className={`${styles.td} ${styles.alignRight}`}>
                          <div className={styles.cellTruncate} title={text}>
                            {text || "—"}
                          </div>
                        </td>
                      );
                    }
                    if (col.toLowerCase().includes("url") && typeof value === "string" && value.startsWith("http")) {
                      return (
                        <td key={col} className={`${styles.td} ${styles.nowrap} ${styles.alignCenter}`}>
                          <a className={styles.link} href={value} target="_blank" rel="noreferrer">
                            link
                          </a>
                        </td>
                      );
                    }
                    const text = toText(value);
                    return (
                      <td key={col} className={`${styles.td} ${alignFor(col)}`}>
                        <div className={styles.cellTruncate} title={text}>
                          {text || "—"}
                        </div>
                      </td>
                    );
                  })}
                  {props.extraColumns?.map((c) => (
                    <td key={c.key} className={`${styles.td} ${alignClass(c.align)}`}>
                      {c.render(card)}
                    </td>
                  ))}
                  {props.onEdit ? (
                    <td className={`${styles.td} ${styles.actionsCell} ${styles.alignCenter}`}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => props.onEdit?.(card)}
                      >
                        Edit
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {!filtered.length ? (
              <tr>
                <td
                  className={styles.td}
                  colSpan={
                    columns.length +
                    1 +
                    (props.extraColumns?.length ?? 0) +
                    (props.onEdit ? 1 : 0)
                  }
                >
                  {cards.length === 0 ? "No cards yet." : "No rows match your search."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}


