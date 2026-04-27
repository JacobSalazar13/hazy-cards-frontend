"use client";

import type { User } from "firebase/auth";

export type BackendUserDocResponse = {
  user_id: string;
  user_doc: Record<string, unknown>;
};

function getApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

async function getAuthHeaders(user?: User | null): Promise<Record<string, string>> {
  if (!user) return {};
  try {
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

export async function fetchUserDocByEmail(opts: {
  user: User;
  signal?: AbortSignal;
}): Promise<BackendUserDocResponse> {
  const baseUrl = getApiBaseUrl();
  const authHeaders = await getAuthHeaders(opts.user);
  const res = await fetch(`${baseUrl}/users/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({}),
    signal: opts.signal
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? ((await res.json()) as any) : null;

  if (!res.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) ||
      `You do not have access to this application. Please contact the admin to access`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return data as BackendUserDocResponse;
}

export type Card = Record<string, unknown>;

export async function fetchCards(params: {
  user?: User | null;
  userId: string;
  opts?: { signal?: AbortSignal };
}): Promise<Card[]> {
  const baseUrl = getApiBaseUrl();
  const authHeaders = await getAuthHeaders(params.user);
  const res = await fetch(`${baseUrl}/cards/get_cards/${encodeURIComponent(params.userId)}`, {
    method: "GET",
    headers: { ...authHeaders },
    signal: params.opts?.signal
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? ((await res.json()) as any) : null;

  if (!res.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) || `Failed to fetch cards (${res.status}).`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  // Placeholder: adjust to your backend response shape later
  if (Array.isArray(data)) return data as Card[];
  if (data && Array.isArray(data.cards)) return data.cards as Card[];
  return [];
}

export async function uploadCardsCsv(params: {
  user?: User | null;
  file: File;
  opts?: { signal?: AbortSignal };
}): Promise<{ ok: true }> {
  const baseUrl = getApiBaseUrl();
  const authHeaders = await getAuthHeaders(params.user);
  const form = new FormData();
  form.append("file", params.file);

  const res = await fetch(`${baseUrl}/cards/upload_cards`, {
    method: "POST",
    headers: { ...authHeaders },
    body: form,
    signal: params.opts?.signal
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? ((await res.json()) as any) : null;

  if (!res.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) || `Upload failed (${res.status}).`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return { ok: true };
}

export async function deleteCards(params: {
  user?: User | null;
  cards: Card[];
  opts?: { signal?: AbortSignal };
}): Promise<{ ok: true }> {
  const baseUrl = getApiBaseUrl();
  const authHeaders = await getAuthHeaders(params.user);

  const cardIds = params.cards
    .map((c) => (typeof c.card_id === "string" ? c.card_id : null))
    .filter((x): x is string => Boolean(x));

  // Placeholder endpoint: update to match your backend when ready
  const res = await fetch(`${baseUrl}/cards/delete_cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ card_ids: cardIds }),
    signal: params.opts?.signal
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? ((await res.json()) as any) : null;

  if (!res.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) || `Delete failed (${res.status}).`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return { ok: true };
}

export async function runCardPricing(params: {
  user?: User | null;
  cardIds: string[];
  opts?: { signal?: AbortSignal };
}): Promise<{ ok: true; counter?: number; failed?: number }> {
  const baseUrl = getApiBaseUrl();
  const authHeaders = await getAuthHeaders(params.user);

  const card_ids = params.cardIds.filter((id) => typeof id === "string" && id.trim().length > 0);

  const res = await fetch(`${baseUrl}/cards/get_a_cards_data`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ card_ids }),
    signal: params.opts?.signal
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? ((await res.json()) as any) : null;

  if (!res.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) || `Run price failed (${res.status}).`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return { ok: true, counter: data?.counter, failed: data?.failed };
}

export async function createCard(params: {
  user?: User | null;
  card_url: string;
  card_condition: string;
  cost_of_card: number;
  status: string;
  opts?: { signal?: AbortSignal };
}): Promise<{ ok: true; card_id: string; card?: Card }> {
  const baseUrl = getApiBaseUrl();
  const authHeaders = await getAuthHeaders(params.user);

  const res = await fetch(`${baseUrl}/cards/create_card`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      card_url: params.card_url,
      card_condition: params.card_condition,
      cost_of_card: params.cost_of_card,
      status: params.status
    }),
    signal: params.opts?.signal
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? ((await res.json()) as any) : null;

  if (!res.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) || `Create card failed (${res.status}).`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const card_id =
    (typeof data?.card_id === "string" && data.card_id) ||
    (typeof data?.card?.card_id === "string" && data.card.card_id) ||
    "";
  if (!card_id) throw new Error("Create card succeeded but no card_id was returned by the backend.");

  return { ok: true, card_id, card: (data?.card ?? null) as any };
}

export async function editCard(params: {
  user?: User | null;
  card_id: string;
  updates: Partial<{
    card_name: string;
    card_condition: string;
    card_url: string;
    cost_of_card: number;
    status: string;
    card_price_sold: number;
    expected_return: number;
    target_sell_price: number;
  }>;
  opts?: { signal?: AbortSignal };
}): Promise<{ ok: true; card: Card }> {
  const baseUrl = getApiBaseUrl();
  const authHeaders = await getAuthHeaders(params.user);

  const res = await fetch(`${baseUrl}/cards/edit_card`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ card_id: params.card_id, ...params.updates }),
    signal: params.opts?.signal
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? ((await res.json()) as any) : null;

  if (!res.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) || `Edit failed (${res.status}).`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return { ok: true, card: (data?.card ?? data) as Card };
}


