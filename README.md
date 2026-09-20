# unfuckDSA

A recall-first LeetCode revision system. The extension stays on LeetCode all day; the website is a lightweight planning and revision dashboard opened once or twice a day.

- `/` — public product home, feature guide and extension download
- `/dashboard` — authenticated revision workspace
- `/login` and `/signup` — account entry

## What is included

- Metrics-first dashboard with daily/weekly question counts, rolling average, trend and an animated five-hour work meter
- Recoverable three-state overlay injected into LeetCode: expanded controls, tiny running pill, and in-page submission
- Concise end-of-session reflection and solution version history
- Adaptive 14-day planner with protected work, compression rules, topic clustering, and human-readable placement reasons
- Multi-select calendar from 10 AM through 1 AM for DSA, development and busy allocation
- Calendar-native solve-sprint and recall-sprint day markers—no separate sprint entities to manage
- Today, This week and All solved problem tabs with open, reschedule and remove actions
- MongoDB email/username/password authentication with salted `scrypt` hashes and expiring database sessions
- Weekly task inventory with multi-hour, collision-safe calendar drag and drop
- Chrome and Edge Manifest V3 companion with one-time pairing, revocable device tokens, idempotent capture, and offline retry
- MongoDB-owned workspace, pairing, device, and capture records
- Extension-owned local session log that syncs into the dashboard whenever it opens; cloud pairing remains optional

## Local setup

Requirements: Node.js 22.12 or newer and a MongoDB connection string.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add the project values.
3. Run `npm run dev` and open `http://localhost:3000`.

Without `MONGODB_URI`, account creation and workspace storage intentionally remain unavailable.

## Extension

### Install the ready-to-use build

Download `public/downloads/unfuckdsa-extension.zip` from the product homepage, extract it, then continue at step 2 below. The ZIP contains only the runtime files needed by the browser.

### Build it yourself

1. Run `npm run extension:build`.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode and choose **Load unpacked**.
4. Select `extension/dist`.
5. Open any LeetCode problem. The tracker appears in the top-right automatically.
6. Start collapses the tracker; Pause expands it; Resume collapses it again.
7. End opens the reflection form without leaving LeetCode. Choose Skip, Default, or Add.

The extension owns timer and session state and survives refreshes/browser restarts. Submitted sessions are kept in extension storage and imported by the dashboard when it opens. Each account has one reusable pairing key shown on the dashboard; pairing gives each browser its own device token. Once paired, today’s revision questions are placed naturally at the beginning of LeetCode’s existing Problemset list. It captures the user-authored editor buffer only when **End** is explicitly pressed. It does not scrape profiles, copy problem statements, inspect submission traffic, or infer acceptance.

## Verification

```text
npm test
npm run lint
npm run build
npm run extension:build
```

## Deployment

Configure `MONGODB_URI` and `NEXT_PUBLIC_SITE_URL` in Vercel, then deploy the repository. Keep the MongoDB connection string server-only.

## Repository map

- `src/app` — routes, authentication, and APIs
- `src/components` — command center and product areas
- `src/lib` — domain model, planner, authentication, and MongoDB access
- `extension` — shared Chrome/Edge companion and build
