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
