# Contact Support → Thread → Ari Auto-Answer — Design

**Date:** 2026-07-01
**Status:** Approved (pending spec review)

## Goal

Reduce the friction of getting an AI answer. Today a user must open the chat
widget, click "Start a conversation," and paste their question. Instead, the
existing Contact Support form should let the user ask once; the app creates a
thread (as it already does), Ari answers asynchronously on that thread, and the
thread view updates on its own so the answer appears without a manual refresh.

## Why not the user's original idea

The user first wanted the form's Send to push the message straight into the
Plain AI **chat widget**. This is impossible: the Plain chat SDK exposes only
`init`, `update`, `setCustomerDetails`, `open`, `close`, `onOpen`, `onClose`,
`isInitialized` — there is **no** method to prefill the composer or send a
message programmatically. There is also **no** synchronous "Ask AI" query API:
the installed `@team-plain/typescript-sdk` has no AI/knowledge/agent method,
only thread/message operations (`createThread`, `replyToThread`, `sendChat`).
The only programmatic route to an AI answer is: create a thread, let **Ari**
answer asynchronously on it, and read the reply from the thread timeline.

## Load-bearing assumption (must verify first)

This design only works if **Ari actually replies to threads created via the
API**. Plain's docs do not explicitly confirm Ari triggers on API-created
threads (vs. only widget/hosted chat). Verification is **Task 0** and gates all
code: manually submit the current form, open the thread in Plain, and confirm
an Ari reply lands. Also confirm Ari is assigned to threads in Plain AI settings
and at least one KB article is published. If Ari does not answer API threads,
STOP — the feature cannot work and we revisit direction.

## Architecture / flow

```
/thread/new form (Send)
  → POST /api/contact-form   (already upserts customer + creates thread)
      ↳ now RETURNS { threadId }
  → router.push(`/thread/${threadId}`)          (was router.push("/"))
  → thread page renders timeline + <ThreadAutoRefresh entryCount=… />
  → poller calls router.refresh() every ~4s
      ↳ server component re-runs, passes fresh entryCount
      ↳ when entryCount grows past initial (a reply arrived) → poller stops
      ↳ hard cap ~60s so it never spins forever
```

## Files touched (4)

### 1. `app/api/contact-form/route.ts` (modify)
Change the final success response from an empty body to a JSON body carrying the
new thread id:
- Was: `return new Response("", { status: 200 });`
- Now: `return Response.json({ threadId: createThreadRes.data.id });`

`createThreadRes.data.id` is the thread id (already used in the existing
`console.log`). Add an exported response type for the form to consume, e.g.
`export type ContactFormResponse = { threadId: string };`. No change to the
existing `RequestBody` type, customer upsert, thread creation, or error handling.

### 2. `app/thread/new/page.tsx` (modify)
In `onSubmit`, on a successful (`result.ok`) response, parse the JSON and
redirect to the new thread instead of home:
- Was: `router.push("/")`
- Now: read `const { threadId } = (await result.json()) as ContactFormResponse;`
  then `router.push(`/thread/${threadId}`)`. If `threadId` is missing/falsy,
  fall back to `router.push("/")`.
Keep the existing success/error toasts and `isLoading` handling. The success
toast text may stay as-is.

### 3. `components/threadAutoRefresh.tsx` (create, `"use client"`)
A polling component that surfaces Ari's async reply.
- Props: `{ entryCount: number }` (current timeline-entry count from the server
  component). Interval and cap are internal constants
  (`POLL_INTERVAL_MS = 4000`, `MAX_DURATION_MS = 60000`).
- Behavior:
  - On first mount, record the initial `entryCount` in a ref and record a start
    timestamp.
  - Start a `setInterval` that calls `router.refresh()` every `POLL_INTERVAL_MS`.
  - `router.refresh()` re-runs the server component and re-renders this client
    component with an updated `entryCount` prop while preserving its state
    (refs, interval). On each render: if `entryCount > initialCountRef.current`,
    a new entry arrived → stop polling (clear interval), mark done. Also stop
    when `Date.now() - startRef >= MAX_DURATION_MS`.
  - Clear the interval on unmount.
- Render: while polling and not done, a subtle "Waiting for a response…" line
  using a minimal inline style (no new CSS module file — keep the component
  self-contained). When done, render nothing.
- Uses `useRouter` from `next/navigation` (same import the existing
  `paginationControls.tsx` client component uses).

### 4. `app/thread/[threadId]/page.tsx` (modify)
Below the timeline `<div>`, render
`<ThreadAutoRefresh entryCount={timelineEntries.edges.length} />`. No other
changes; the page stays a server component with `fetchCache = "force-no-store"`,
so each `router.refresh()` fetches a fresh timeline. Ari's reply renders through
the existing `ChatEntry`/`CustomEntry` branches already in the page.

## Design note: why count-based stop (not actor detection)

The thread's *initial* message is created by the API machine user and therefore
appears as a `MachineUserActor` (the page already special-cases `idx === 0`
`MachineUserActor` to show the customer's name). Ari's reply is also a machine
actor, so we cannot reliably distinguish "Ari replied" by actor type. A new
timeline entry appearing (count grows past the initial) is the reliable
"a reply arrived" signal for this example app.

## Error handling / edges

- Form: existing failure path (`!result.ok` or thrown) still toasts "Oops" and
  clears loading. Missing `threadId` → fall back to `/`.
- Poller: hard `MAX_DURATION_MS` cap prevents infinite polling; stops on reply;
  clears interval on unmount. `router.refresh()` preserves client state, so the
  interval and refs survive across refreshes.

## Testing / verification

No test framework exists in this repo (no jest/vitest, no `test` script). Do not
add one. Verification is:
1. `npx tsc --noEmit` — passes.
2. `npm run build` — succeeds.
3. Manual runtime (after Task 0 confirms Ari answers): submit the Contact
   Support form → redirected to `/thread/<id>` → "Waiting for a response…"
   appears → Ari's reply appears automatically within ~60s → indicator
   disappears.

## Out of scope (YAGNI)

- No streaming or websockets; polling only.
- No customer *reply* composer on the thread (one-shot question → answer).
- No changes to the embedded chat widget shipped earlier.
- No change to the home thread list or its tenant filter.
