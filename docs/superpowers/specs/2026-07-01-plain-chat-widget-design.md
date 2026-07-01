# Plain Chat Widget Integration — Design

**Date:** 2026-07-01
**Status:** Approved (pending spec review)

## Goal

Embed Plain's Chat widget into this headless support portal so visitors can use
**Ask AI** (search over the workspace's published knowledge base) and, when Ask AI
can't resolve a question, escalate into a Plain thread where Ari / a human takes
over. This brings the hosted Help Center's AI experience into the custom Next.js
app without replacing any existing functionality.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Customer identity | Anonymous (not identified as the hardcoded Bob) | Simplest path; no server-side HMAC secret, no server route. |
| Email handling | `requireAuthentication: true` | Plain sends a one-time code so each thread is tied to a verified email, without us managing a secret. |
| Placement | Floating launcher on all pages | Mounted globally in `app/layout.tsx`; Plain default. |
| Coexistence | Keep existing `/thread/new` contact form and home thread list unchanged | Additive feature; YAGNI — don't remove working code. |
| Load mechanism | Dedicated `"use client"` component | Isolates all Plain config in one focused file; keeps the server-component layout clean; easy to extend later. |
| `appId` location | Hardcoded named constant with a comment | Consistent with how the repo hardcodes `tenantExternalId = "abcd1234"`. The appId is public/non-secret. |

## Architecture

A single new client component communicates directly with Plain's backend from the
browser. No server involvement, no environment secret, no changes to existing
server code.

```
app/layout.tsx (server component)
  └─ renders <PlainChat />  (client component, near <Toaster />)

components/plainChat.tsx  ("use client")
  ├─ useEffect(() => { inject script once; window.Plain.init(...) }, [])
  ├─ double-injection guard (bail if #plain-chat-script exists)
  └─ returns null (widget renders its own floating launcher)
```

## Component detail: `components/plainChat.tsx`

- `"use client"` directive.
- Named constant at top:
  `const PLAIN_CHAT_APP_ID = "liveChatApp_01KWFTY91VR19R7MHGJ69P86HA";`
  with a comment noting this is where forkers swap in their own Chat app id.
- `useEffect` with empty deps runs Plain's official loader:
  - Guard: `if (document.getElementById("plain-chat-script")) return;`
  - Create a `<script id="plain-chat-script" src="https://chat.cdn-plain.com/index.js">` with `script.async = false` (matching Plain's official snippet).
  - `script.onload` → `window.Plain.init({ appId: PLAIN_CHAT_APP_ID, requireAuthentication: true })`.
  - `script.onerror` → `console.warn(...)` (non-fatal).
  - Append to `document.head`.
- Minimal TS global so `window.Plain` typechecks:
  `declare global { interface Window { Plain?: { init: (options: { appId: string; requireAuthentication?: boolean }) => void } } }`
- Renders `null`.

## Data flow

1. Browser loads the app; `<PlainChat />` injects the Plain script client-side.
2. Visitor opens the floating launcher.
3. `requireAuthentication` → Plain collects and verifies the visitor's email via a
   one-time code.
4. Ask AI answers from the workspace's **published** knowledge base articles.
5. If unresolved, Plain creates a thread; Ari and/or a human continue it.

All AI search, thread creation, and handoff happen inside Plain. The portal is not
involved after the widget loads.

## Error handling & SSR

- Injection runs only inside `useEffect`, so it never executes during SSR — no
  hydration mismatch risk.
- Script load failure logs a warning and is otherwise non-fatal: the widget simply
  does not appear; the rest of the app is unaffected.
- The `#plain-chat-script` guard prevents duplicate launchers across React
  strict-mode double-mounts (dev) and client-side navigation.
- No Content Security Policy is configured in this repo, so no CSP changes are
  required.

## Out of scope (explicit)

- Identifying the visitor as the hardcoded `bob.smith@example.com` / tenant
  `abcd1234` (would require a server-side HMAC email hash + chat secret).
- Because threads are tied to the verified email rather than tenant `abcd1234`,
  they will **not** appear in this portal's tenant-filtered home list. This is
  expected given the anonymous path.
- Any changes to `/thread/new`, the home thread list, or `app/api/contact-form`.

## Verification

1. `npm run build` (typecheck) passes.
2. `npm run dev`; load http://localhost:3000 — floating launcher appears
   bottom-right on every page (home, `/thread/new`, `/thread/[threadId]`).
3. Open the launcher → email verification prompt appears → ask a question → Ask AI
   responds from published KB articles.
   - Requires at least one **published** knowledge base article for Ask AI to give
     useful answers.

## Prerequisites (outside the code change)

- A Plain Chat app exists (`liveChatApp_01KWFTY91VR19R7MHGJ69P86HA`).
- At least one published knowledge base article so Ask AI has content to search.
