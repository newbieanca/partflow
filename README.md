# PARTFLOW – Part Supply Management System
React + TypeScript + Vite + Tailwind, Firebase (Auth + Firestore), Vercel.

## Status: Phase 1 (partial)
Done: scaffold, auth + role bootstrap, Firestore rules draft, BOM calc + tests, atomic take function (`src/lib/supply.ts`).
Not done: master data, production, supply UI, dashboard, reports, audit writes, PWA icons/service worker, rules tests.

## Setup
1. Firebase console: create project, enable Email/Password auth and Firestore, register a web app.
2. Copy `.env.example` to `.env` (or set the same vars in Vercel) with the web app config.
3. Paste `firestore.rules` into Firestore > Rules and publish.
4. Sign in once, then in the console set your `users/{uid}.role` to `ADMIN` (only way to create the first admin).
5. `npm install`, `npm test`, `npm run build`. Import the repo into Vercel; `vercel.json` handles SPA routing.

## Decision: no Cloud Functions
Cloud Functions need the Blaze plan. Transactions use client Firestore `runTransaction` (retry-safe, doc id = idempotency key) with rules as the backstop.
