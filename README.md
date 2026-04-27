# Hazy Cards

- **What it is:** A web dashboard for signed-in users to manage a personal trading-card collection.
- **What you can do:** Browse cards in a table or grid, add entries manually, upload CSV batches, edit fields, run pricing, and delete items.
- **Stack:** **Next.js 15** (App Router), **React 19**, **TypeScript**, and **Firebase Authentication** (including Google sign-in) so only authenticated users can use the app.
- **How it is structured:** A small **REST client** in `lib/api.ts` talks to a separate HTTP backend; the UI handles auth state, toasts, and switching between dashboard, create, and upload views.
- **Conventions:** Environment variables for config, **ESLint** for linting, and `fetch` with **Firebase ID tokens** in the `Authorization` header for protected API routes.
- **Resilience:** The list-cards flow accepts both a raw array and a `{ cards: [...] }` body; create-card requires a returned `card_id` so the UI does not get stuck in a blank state if the response shape drifts.
- **Configuration:** `NEXT_PUBLIC_*` values and a local **`.env`** (gitignored) so each environment can point at the right API and Firebase project.

## Backend (how this app talks to the server)

- The **server is a separate project**; this repo is only the browser app.
- **Base URL** — set with `NEXT_PUBLIC_API_BASE_URL` (with or without a trailing slash; the client normalizes it).
- **Auth** — signed-in requests send `Authorization: Bearer <Firebase ID token>`; unauthenticated calls send no token.
- **Error shape** — JSON may include an `error` string; the UI shows it as returned.
- **Scope** — This repository does not ship the server code; only the HTTP contract below is guaranteed by the frontend.

**Routes** (paths are relative to the API base URL):

- `POST /users/auth` — session / user document check
- `GET /cards/get_cards/{userId}` — list cards (raw array or `{ cards: [...] }`)
- `POST /cards/upload_cards` — CSV upload (`multipart` field `file`)
- `POST /cards/create_card`, `/cards/edit_card`, `/cards/delete_cards` — create, update, delete
- `POST /cards/get_a_cards_data` — body `{ card_ids: [...] }` for pricing / enrichment

## Local development

- Install dependencies: `npm install`
- Add a file such as **`.env.local`** with `NEXT_PUBLIC_API_BASE_URL` and the `NEXT_PUBLIC_FIREBASE_*` values from the Firebase console
- Start the app: `npm run dev`

## Run Commands

- `npm run dev` — development server
- `npm run build` — production build
- `npm start` — run production build
- `npm run lint` — ESLint
