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
			open: () => void;
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
