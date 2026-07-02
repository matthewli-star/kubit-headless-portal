# Widget-home for resumable ARI follow-ups — Design

**Date:** 2026-07-01
**Status:** Approved (pending spec review)
**Branch:** contact-form-ari-thread
**Supersedes framing of:** `2026-07-01-continue-in-chat-cta-design.md` (that shipped a
button opening a *fresh* widget chat; this makes the widget the authenticated,
resumable home for ARI conversations).

## Goal

Give users a real way to **follow up conversations with ARI**. Today there are two
half-experiences: the headless contact form answers once but cannot be followed up
on, and the chat widget supports multi-turn but opens a fresh, anonymous chat with
no continuity. This design makes the **Plain chat widget the home for live,
authenticated, resumable ARI chat**, so a user can leave and return to the *same*
ongoing conversation.

## Why the widget (and not a headless loop)

Confirmed against Plain's docs:

- The chat widget JS API (`window.Plain`) exposes only `init`, `update`,
  `setCustomerDetails`, `open`, `close`, `onOpen`, `onClose`, `isInitialized`,
  `exportDebugLogs`. There is **no** method to send a message, prefill the composer,
  or open with preset text. So text cannot be injected into ARI programmatically.
- The headless SDK's `replyToThread` attributes replies to our machine user, not the
  customer, so ARI will not respond to headless follow-ups (documented in the prior
  spec). There is no customer-inbound message method.

Therefore the widget is the only place a real customer↔ARI back-and-forth can happen.
The lever that makes follow-up work is **known-user auth + a stable per-user chat
`externalId`**, which lets the widget resume the same conversation on every visit.

## Accepted limitation

The headless contact-form thread and the widget chat are **different objects**. The
prior Q&A from a contact-form thread cannot be bridged into the widget (no seed/send
API). The contact form remains a separate async intake lane; the widget is where
ongoing ARI chat lives.

## Architecture

```
Logged-in user (demo: hardcoded Bob Smith)
        │
        ▼
GET /api/chat-identity ──► { email, fullName, emailHash, chatExternalId }
        │                    (server; emailHash = HMAC-SHA256(email, PLAIN_CHAT_SECRET))
        ▼
<PlainChat> Plain.init({
    appId,
    customerDetails: { email, fullName, emailHash },                        // known-user; no OTP; ARI responds
    threadDetails:  { externalId: chatExternalId },                         // stamp the resumable chat
    entryPoint:     { type: "chat", externalId: chatExternalId,             // resume the same chat
                      singleChatMode: true },
})
        │
        ▼
"Chat live with ARI" button → Plain.open() → drops user into their ONE ongoing ARI chat
```

Nothing about the headless SDK usage changes. All new work is client-side widget
initialization plus one server route that mints the auth hash.

## Components

### 1. `lib/customerIdentity.ts` (new)
Single source of truth for the demo customer, removing the literals currently inline
in the contact-form route.

- Exports the demo identity: `email` (`bob.smith@example.com`), `fullName`
  (`Bob Smith`), `tenantExternalId` (`abcd1234`).
- Exports a helper to derive the stable per-user chat external id, e.g.
  `chatExternalId(email) => "ari-chat:" + email`.
- In production this module is where real auth claims would be read; the comment that
  currently says so in the route moves here.

### 2. `app/api/chat-identity/route.ts` (new)
Server route returning `{ email, fullName, emailHash, chatExternalId }`.

- `emailHash = crypto.createHmac("sha256", process.env.PLAIN_CHAT_SECRET).update(email).digest("hex")`.
- If `PLAIN_CHAT_SECRET` is unset, respond 500 (the client treats this as the fallback
  case — see Error handling).
- Reads identity from `lib/customerIdentity.ts`.

### 3. `components/plainChat.tsx` (modify)
- In the existing `useEffect` (after the script loads), `fetch("/api/chat-identity")`.
- On success: `Plain.init({ appId, customerDetails: { email, fullName, emailHash },
  threadDetails: { externalId: chatExternalId }, entryPoint: { type: "chat",
  externalId: chatExternalId, singleChatMode: true } })`.
- On failure: fall back to `Plain.init({ appId, requireAuthentication: true })` (OTP)
  and `console.warn`. Chat still works, just without the seamless known-user path.
- Widen the `window.Plain` type (single source of truth) to include `customerDetails`,
  `threadDetails`, and `entryPoint` on `init`. Keep `open` on the type.

### 4. `app/api/contact-form/route.ts` (modify)
Import `email`, `fullName`, `tenantExternalId` from `lib/customerIdentity.ts` instead
of the local `const`s. No behavior change.

### 5. `app/thread/[threadId]/page.tsx` (modify — copy only)
Reword the lead-in + button so it no longer implies continuing *this* thread:

```
Didn't fully answer your question?
[ 💬 Chat live with ARI ]      ← button label was "💬 Continue in chat"
```

`ContinueInChatButton` keeps calling `window.Plain?.open()` — no logic change; its
behavior upgrades because `init` now resumes the user's ongoing chat.

### 6. `app/page.tsx` (modify — add button)
Surface the same "Chat live with ARI" button on the home page, so live ARI chat is
reachable without first filing a contact-form thread. Reuses `ContinueInChatButton`.

### 7. `.env.local` + `README` (modify)
Document `PLAIN_CHAT_SECRET` (Plain → Settings → Chat).

## Data flow

1. `PlainChat` mounts → loads widget script → `GET /api/chat-identity`.
2. `Plain.init` with `customerDetails` (known user, no OTP) + `entryPoint.externalId`.
3. User (or the "Chat live with ARI" button) opens the widget → resumes their single
   ongoing ARI chat by `externalId`.
4. Messages originate from the real customer → ARI responds → multi-turn follow-up.

## Open technical question (resolve during implementation, not design)

Whether re-asserting a single stable `externalId` on every `init` makes the widget
**resume** the existing chat vs. erroring on a duplicate id before one exists. Plain's
docs describe `entryPoint.externalId` as "open this chat, else default to last
conversation," implying safe resume. Verify against the live widget in the manual
step; if it conflicts, switch to an id that is created once and only *referenced*
thereafter (e.g. persist the created chat's externalId rather than re-stamping via
`threadDetails` every time).

## Error handling / SSR

- `/api/chat-identity` fails or `PLAIN_CHAT_SECRET` missing → warn + fall back to
  `requireAuthentication: true` (OTP). No crash.
- `window.Plain?.open()` stays optional-chained → no-op if script not yet loaded.
- All `window`/`fetch` access stays inside `useEffect`/onClick → SSR-safe; page stays
  a server component where it already is.

## Out of scope (YAGNI)

- No bridging the contact-form thread's Q&A into the widget (impossible — no seed API).
- No real user-auth system — identity stays the hardcoded demo user, just centralized.
- No changes to the headless SDK flow, `createThread`, or the auto-refresh poller.
- No composer prefill / preset messages (no API for it).

## Testing / verification

No test framework in this repo. Verification:
1. `npx tsc --noEmit` — passes.
2. `npm run build` — succeeds.
3. Manual:
   - Load app → widget authenticates as Bob Smith with **no OTP prompt**.
   - Send a message → receive an ARI reply.
   - Reload the page, re-open the widget → **the same chat resumes** (proves
     `externalId` resumption).
   - "Chat live with ARI" button (thread page and home page) opens that same chat.
4. Resolve the open `externalId` question above during step 3.
