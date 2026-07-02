# "Continue in chat" CTA — Design

**Date:** 2026-07-01
**Status:** Approved (pending spec review)
**Branch:** contact-form-ari-thread (builds on the thread-page work there)

## Goal

Give users a clear way to continue the conversation after the one-shot Ari
answer on a thread, by opening the already-embedded Plain chat widget. This is
the supported home for multi-turn AI chat (Ask AI/Ari + history + human
handoff), since the headless API cannot do a customer↔Ari back-and-forth.

## Why not a headless chat loop

Investigated and rejected: the SDK (`@team-plain/typescript-sdk` v4.6.1) has
`replyToThread({ threadId, textContent })` but **no customer identifier** — a
reply sent with our machine-user key is attributed to the workspace/support
side (`MachineUserActor`), not the customer. Ari answers *customer* messages,
so it would not respond to such replies. There is no customer-inbound message
method (`sendChat` is not exposed). Therefore a headless customer↔Ari loop is
not supported; the chat widget is the correct place for ongoing AI chat.

## Known limitation (accepted)

Opening the widget starts a **fresh** chat conversation. The thread's prior Q&A
is **not** carried into it — the contact-form thread is not a widget "chat
conversation," and the widget can only open a new chat or an existing *widget*
chat by `externalId`. We cannot bridge the thread context into the widget.

## Architecture

A small `"use client"` button calls `window.Plain.open()` to open the
already-embedded floating widget. No new dependencies; reuses the existing
widget (mounted globally via `<PlainChat />` in `app/layout.tsx`) and existing
button styling.

## Files touched (3)

### 1. `components/plainChat.tsx` (modify)
Extend the existing global declaration so `window.Plain.open()` is type-safe.
Change the `Window.Plain` type from:

```ts
declare global {
	interface Window {
		Plain?: {
			init: (options: { appId: string; requireAuthentication?: boolean }) => void;
		};
	}
}
```

to also include `open`:

```ts
declare global {
	interface Window {
		Plain?: {
			init: (options: { appId: string; requireAuthentication?: boolean }) => void;
			open: () => void;
		};
	}
}
```

This is the **single source of truth** for the `Window.Plain` type. Do not
declare `Window.Plain` a second time in the new component — a duplicate
property declaration with a different shape is a TypeScript error, and
`declare global` already makes this type available project-wide.

### 2. `components/continueInChatButton.tsx` (create, `"use client"`)
Named-export client component:

```tsx
"use client";
import styles from "./button.module.css";

export function ContinueInChatButton() {
	return (
		<button
			type="button"
			className={styles.button}
			onClick={() => window.Plain?.open()}
		>
			💬 Continue in chat
		</button>
	);
}
```

- Reuses `button.module.css` for visual consistency with the existing form button.
- `type="button"` (not submit — it is not inside a form, but be explicit).
- Optional-chaining `window.Plain?.open()` → harmless no-op if the widget
  script has not loaded yet.

### 3. `app/thread/[threadId]/page.tsx` (modify)
Import the component:

```ts
import { ContinueInChatButton } from "@/components/continueInChatButton";
```

Render a short lead-in line plus the button below the timeline, near the
existing `<ThreadAutoRefresh …/>`. For example, after the timeline `</div>`:

```tsx
				</div>
				<ThreadAutoRefresh entryCount={timelineEntries.edges.length} />
				<div style={{ padding: "12px 0", color: "#888" }}>
					Didn&apos;t fully answer your question?
				</div>
				<ContinueInChatButton />
			</main>
```

No other changes; the page stays a server component.

## Data flow

Click → `window.Plain.open()` → the floating widget opens to its composer (a
fresh AI chat). All chat happens inside Plain's widget thereafter.

## Error handling / SSR

- Widget not yet loaded → `window.Plain?.open()` is a no-op; no crash.
- SSR-safe: client component; `window` is only touched inside the onClick
  handler, never during render.

## Out of scope (YAGNI)

- No seeding the composer or attaching the thread's context (both impossible).
- No disabling/hiding the button while the widget loads.
- No changes to the widget config, the auto-refresh poller, or the home list.

## Testing / verification

No test framework in this repo. Verification:
1. `npx tsc --noEmit` — passes.
2. `npm run build` — succeeds.
3. Manual: open a thread (`/thread/<id>`), click "💬 Continue in chat", confirm
   the chat widget opens to its composer.
