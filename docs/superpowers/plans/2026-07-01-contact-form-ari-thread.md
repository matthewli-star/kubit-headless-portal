# Contact Support → Ari Thread Auto-Answer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user ask once in the Contact Support form and see Ari's AI answer appear on the resulting thread automatically, without opening the chat widget or manually refreshing.

**Architecture:** The existing `/api/contact-form` route already creates a Plain thread; we make it return the new `threadId`, redirect the form to `/thread/[threadId]`, and add a client-side poller that calls `router.refresh()` until a new timeline entry (Ari's reply) appears. The thread page stays a server component with `fetchCache = "force-no-store"`, so each refresh re-fetches the timeline.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript (strict), Plain GraphQL SDK (`@team-plain/typescript-sdk`), `react-hot-toast`.

## Global Constraints

- **Load-bearing assumption:** the feature only works if **Ari answers threads created via the API**. Task 1 verifies this manually and gates the value of Tasks 2–3. If Ari does not answer API threads, STOP and revisit direction.
- Poller timing: `POLL_INTERVAL_MS = 4000`, `MAX_DURATION_MS = 60000`. Stop condition is **count-based**: stop when the timeline entry count grows past the count seen at mount (a new entry arrived), or after the max duration.
- TypeScript `strict: true`; indentation is **tabs**; client components use **named exports** (e.g. `export function PaginationControls`).
- Waiting indicator uses a **minimal inline style** — no new CSS module file.
- Shared response type `ContactFormResponse = { threadId: string }` is exported from the route and imported by the form.
- Do **not** change the home thread list, the embedded chat widget, or add a customer reply composer. Purely additive to the contact→thread flow.
- No test framework exists in this repo (no jest/vitest, no `test` script). Verification is `npx tsc --noEmit`, `npm run build`, and manual runtime — do not add a test framework.

---

### Task 1: Verify Ari answers API-created threads (manual gate — no code)

**Files:** none (manual verification).

This is a prerequisite. Tasks 2–3 can be written regardless, but the feature only *functions* if this passes.

- [ ] **Step 1: Confirm Plain-side config**

In Plain: Plain AI → Ari is created and **assigned to threads**; Plain AI → Knowledge sources has at least one **published** article.

- [ ] **Step 2: Create a thread via the existing flow**

Run the app (`npm run dev`), open http://localhost:3000, click **💬 Contact Support**, submit a question (e.g. "How do I create a report?").

- [ ] **Step 3: Observe whether Ari replies**

Open the thread in the Plain dashboard (or note the thread id from the server console log `Thread created <id>.`). Watch for an Ari reply appearing on that thread within ~1 minute.

- [ ] **Step 4: Decision**

- If Ari replies → the assumption holds; proceed to Task 2.
- If Ari does **not** reply → STOP. The feature cannot work as designed. Report back so we can revisit (e.g. Bring-Your-Own-Agent webhook, or confirm Ari trigger config with Plain).

---

### Task 2: Return threadId from the route and redirect the form to the thread

**Files:**
- Modify: `app/api/contact-form/route.ts` (add exported type; change final response)
- Modify: `app/thread/new/page.tsx` (import type; redirect to the new thread)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `export type ContactFormResponse = { threadId: string }` from `app/api/contact-form/route.ts`. The POST success response body is now `{ threadId: string }` instead of empty.

- [ ] **Step 1: Add the exported response type in the route**

In `app/api/contact-form/route.ts`, below the existing `RequestBody` type (currently at the top of the file), add:

```ts
export type ContactFormResponse = {
	threadId: string;
};
```

- [ ] **Step 2: Return the threadId from the route**

In `app/api/contact-form/route.ts`, replace the final success response:

```ts
	console.log(`Thread created ${createThreadRes.data.id}.`);
	return new Response("", { status: 200 });
```

with:

```ts
	console.log(`Thread created ${createThreadRes.data.id}.`);
	const responseBody: ContactFormResponse = { threadId: createThreadRes.data.id };
	return Response.json(responseBody);
```

Leave the customer upsert, thread creation, and both error branches unchanged.

- [ ] **Step 3: Import the response type in the form**

In `app/thread/new/page.tsx`, change the first import from:

```ts
import type { RequestBody } from "@/app/api/contact-form/route";
```

to:

```ts
import type { RequestBody, ContactFormResponse } from "@/app/api/contact-form/route";
```

- [ ] **Step 4: Redirect to the new thread on success**

In `app/thread/new/page.tsx` `onSubmit`, replace this block:

```ts
			if (result.ok) {
				toast.success("Nice, we'll be in touch shortly!");
				router.push("/");
			} else {
```

with:

```ts
			if (result.ok) {
				const data = (await result.json()) as ContactFormResponse;
				toast.success("Nice, we'll be in touch shortly!");
				router.push(data.threadId ? `/thread/${data.threadId}` : "/");
			} else {
```

Leave the `else` (error toast) and `catch` branches unchanged.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit 0).

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build succeeds with no type/lint errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/contact-form/route.ts app/thread/new/page.tsx
git commit -m "feat: redirect contact form to the created thread"
```

---

### Task 3: Auto-refresh the thread until Ari replies

**Files:**
- Create: `components/threadAutoRefresh.tsx`
- Modify: `app/thread/[threadId]/page.tsx` (render the poller below the timeline)

**Interfaces:**
- Consumes: nothing from other tasks (works on any thread page).
- Produces: `export function ThreadAutoRefresh(props: { entryCount: number }): JSX.Element | null` in `components/threadAutoRefresh.tsx`.

- [ ] **Step 1: Create the poller component**

Create `components/threadAutoRefresh.tsx` with exactly this content (tabs for indentation):

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 4000;
const MAX_DURATION_MS = 60000;

export function ThreadAutoRefresh({ entryCount }: { entryCount: number }) {
	const router = useRouter();
	// Count/time captured once at mount; router.refresh() preserves this
	// component's state across refreshes, so these refs stay stable.
	const initialCountRef = useRef(entryCount);
	const startTimeRef = useRef(Date.now());
	const [done, setDone] = useState(false);

	// A new timeline entry appearing (count grew) means a reply arrived.
	useEffect(() => {
		if (entryCount > initialCountRef.current) {
			setDone(true);
		}
	}, [entryCount]);

	// Poll by re-running the server component until done or timed out.
	useEffect(() => {
		if (done) {
			return;
		}

		const intervalId = setInterval(() => {
			if (Date.now() - startTimeRef.current >= MAX_DURATION_MS) {
				setDone(true);
				return;
			}
			router.refresh();
		}, POLL_INTERVAL_MS);

		return () => clearInterval(intervalId);
	}, [done, router]);

	if (done) {
		return null;
	}

	return (
		<div style={{ padding: "12px 0", color: "#888", fontStyle: "italic" }}>
			Waiting for a response…
		</div>
	);
}
```

- [ ] **Step 2: Render the poller on the thread page**

In `app/thread/[threadId]/page.tsx`, add the import after the existing `getPriority` import:

```ts
import { ThreadAutoRefresh } from "@/components/threadAutoRefresh";
```

Then render the poller directly after the timeline `</div>`, still inside `<main>`. Change:

```tsx
				<div className={styles.timeline}>
					{timelineEntries.edges.reverse().map((e, idx) => {
```

...(unchanged map body)...

```tsx
					})}
				</div>
			</main>
```

to add the component between the closing `</div>` and `</main>`:

```tsx
					})}
				</div>
				<ThreadAutoRefresh entryCount={timelineEntries.edges.length} />
			</main>
```

Make no other changes to the page; it stays a server component with `fetchCache = "force-no-store"`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit 0). Confirms the `entryCount` prop and `useRouter` usage satisfy strict mode.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds with no type/lint errors.

- [ ] **Step 5: Commit**

```bash
git add components/threadAutoRefresh.tsx "app/thread/[threadId]/page.tsx"
git commit -m "feat: auto-refresh thread until a reply arrives"
```

- [ ] **Step 6: Manual runtime verification (human — deferred)**

Requires Task 1 to have passed. Run `npm run dev`, open http://localhost:3000, click **💬 Contact Support**, submit a question, and confirm:
- You are redirected to `/thread/<id>` showing your question.
- A subtle "Waiting for a response…" line is visible.
- Ari's reply appears automatically within ~60s and the "Waiting…" line disappears.
- Known limitation (acceptable for this example): if Ari replies *before* the page mounts, the count never grows, so "Waiting…" lingers until the 60s cap even though the answer is already shown.

---

## Self-Review

**Spec coverage:**
- Load-bearing Ari verification → Task 1. ✓
- Route returns `{ threadId }` → Task 2 Steps 1–2. ✓
- Form redirects to `/thread/[threadId]`, falls back to `/` → Task 2 Steps 3–4. ✓
- `ContactFormResponse` shared type → Task 2 Steps 1 & 3. ✓
- `ThreadAutoRefresh` client component, count-based stop, 4s/60s constants, inline-style indicator → Task 3 Step 1. ✓
- Wired below the timeline with `entryCount={timelineEntries.edges.length}` → Task 3 Step 2. ✓
- SSR-safe (poller is `"use client"`, timing in effects) → Task 3 Step 1. ✓
- No test framework; tsc + build + manual → verification steps in Tasks 2–3. ✓
- Out-of-scope (home list, chat widget, reply composer untouched) → enforced by Global Constraints; only 4 files touched. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; all code shown in full. ✓

**Type consistency:** `ContactFormResponse` defined in the route (Task 2 Step 1) and imported/used in the form (Task 2 Steps 3–4). `ThreadAutoRefresh` prop `{ entryCount: number }` defined in Task 3 Step 1 and passed as `entryCount={timelineEntries.edges.length}` in Task 3 Step 2. ✓
