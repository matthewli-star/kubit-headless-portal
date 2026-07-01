# Plain Chat Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed Plain's Chat widget (Ask AI + thread escalation) as a floating launcher on every page of this headless portal.

**Architecture:** A single `"use client"` component (`components/plainChat.tsx`) injects Plain's CDN script in a `useEffect` and calls `window.Plain.init` with the Chat app id and `requireAuthentication: true`. It is rendered once globally in the server-component `app/layout.tsx`. No server routes, no environment secret, no changes to existing thread/contact-form code.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript (strict), Plain Chat CDN (`https://chat.cdn-plain.com/index.js`).

## Global Constraints

- TypeScript `strict: true` — no implicit `any`, no unchecked global access. Window global must be typed via `declare global`.
- Indentation is **tabs**, matching every existing file.
- Client components use **named exports** (e.g. `export function PaginationControls`), imported as `import { PlainChat } from "@/components/plainChat"`.
- Chat identity is **anonymous** with `requireAuthentication: true`. Do NOT pass `customerDetails`, email, or `tenantIdentifier`.
- `appId` value is `liveChatApp_01KWFTY91VR19R7MHGJ69P86HA`, hardcoded as a named constant with a comment (consistent with `tenantExternalId = "abcd1234"` elsewhere in the repo).
- Do NOT modify `/thread/new`, the home thread list, or `app/api/contact-form`. This feature is purely additive.
- No test framework exists in this repo. Verification is `npx tsc --noEmit` (typecheck), `npm run build`, and a manual runtime check — do not add jest/vitest.

---

### Task 1: Plain Chat widget component + global mount

**Files:**
- Create: `components/plainChat.tsx`
- Modify: `app/layout.tsx` (add import; render `<PlainChat />` inside the existing fragment)

**Interfaces:**
- Consumes: nothing (leaf component).
- Produces: `export function PlainChat(): null` — a client component that mounts the Plain chat widget as a side effect. Takes no props.

- [ ] **Step 1: Create the component**

Create `components/plainChat.tsx` with exactly this content (tabs for indentation):

```tsx
"use client";
import { useEffect } from "react";

// This is the Plain Chat app id. Swap this for your own Chat app id
// (Settings → Chat in Plain) if you fork this example.
const PLAIN_CHAT_APP_ID = "liveChatApp_01KWFTY91VR19R7MHGJ69P86HA";

declare global {
	interface Window {
		Plain?: {
			init: (options: {
				appId: string;
				requireAuthentication?: boolean;
			}) => void;
		};
	}
}

export function PlainChat() {
	useEffect(() => {
		// Guard against double-injection (React strict mode in dev, client-side
		// navigation). The widget should only ever load once.
		if (document.getElementById("plain-chat-script")) {
			return;
		}

		const script = document.createElement("script");
		script.id = "plain-chat-script";
		script.async = false;
		script.src = "https://chat.cdn-plain.com/index.js";
		script.onload = () => {
			window.Plain?.init({
				appId: PLAIN_CHAT_APP_ID,
				requireAuthentication: true,
			});
		};
		script.onerror = () => {
			console.warn("Failed to load Plain chat widget");
		};
		document.head.appendChild(script);
	}, []);

	return null;
}
```

- [ ] **Step 2: Mount it globally in the layout**

In `app/layout.tsx`, add the import after the existing `Toaster` import:

```tsx
import { PlainChat } from "@/components/plainChat";
```

Then render `<PlainChat />` inside the existing fragment, after `<Toaster />`:

```tsx
			<body className={inter.className}>
				<>
					{children}
					<Toaster />
					<PlainChat />
				</>
			</body>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit 0). Confirms the `declare global` types and `window.Plain?.init` call satisfy strict mode.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build completes with no type or lint errors; `/`, `/thread/new`, and `/thread/[threadId]` all compile.

- [ ] **Step 5: Manual runtime verification**

Run: `PLAIN_API_KEY=$(grep '^PLAIN_API_KEY=' .env.local | cut -d= -f2-) npm run dev` (or just `npm run dev` if `.env.local` is loaded), then open http://localhost:3000.
Expected:
- A floating chat launcher appears bottom-right.
- The launcher also appears on `/thread/new` and on a thread detail page (confirms global mount, single launcher — no duplicates).
- Opening the launcher shows Plain's email-verification prompt (from `requireAuthentication: true`).
- Asking a question returns an Ask AI answer sourced from published knowledge base articles (requires at least one published article to be useful).

- [ ] **Step 6: Commit**

```bash
git add components/plainChat.tsx app/layout.tsx
git commit -m "feat: embed Plain chat widget on all pages"
```

---

## Self-Review

**Spec coverage:**
- Anonymous + `requireAuthentication: true` → Step 1 `Plain.init` call. ✓
- Floating launcher on all pages via global mount → Step 2 layout render. ✓
- Dedicated `"use client"` component, `appId` hardcoded constant with comment → Step 1. ✓
- Double-injection guard, `script.async = false`, `onerror` warning, SSR-safe (`useEffect` only) → Step 1. ✓
- Keep `/thread/new`, home list, `contact-form` untouched → enforced in Global Constraints; only two files touched. ✓
- Verification = typecheck + build + manual runtime → Steps 3–5. ✓
- Out-of-scope (no customer identity / tenant) → Global Constraints forbid `customerDetails`/`tenantIdentifier`. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; all code shown in full. ✓

**Type consistency:** `PlainChat` named export used identically in component and layout import; `window.Plain?.init` signature matches the `declare global` block. ✓
