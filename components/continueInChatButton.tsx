"use client";
import styles from "./button.module.css";

export function ContinueInChatButton() {
	return (
		<button
			type="button"
			className={styles.button}
			onClick={() => window.Plain?.open()}
		>
			💬 Chat live with ARI
		</button>
	);
}
