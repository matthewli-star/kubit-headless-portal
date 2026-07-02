"use client";
import { useEffect } from "react";
import type { ChatIdentityResponse } from "@/app/api/chat-identity/route";

// This is the Plain Chat app id. Swap this for your own Chat app id
// (Settings → Chat in Plain) if you fork this example.
const PLAIN_CHAT_APP_ID = "liveChatApp_01KWFTY91VR19R7MHGJ69P86HA";

declare global {
	interface Window {
		Plain?: {
			init: (options: {
				appId: string;
				requireAuthentication?: boolean;
				customerDetails?: {
					email: string;
					emailHash: string;
					fullName?: string;
					shortName?: string;
					chatAvatarUrl?: string;
				};
				threadDetails?: {
					externalId?: string;
				};
				entryPoint?: {
					type?: "default" | "chat";
					externalId?: string;
					singleChatMode?: boolean;
				};
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
		script.onload = async () => {
			try {
				const res = await fetch("/api/chat-identity");
				if (!res.ok) {
					throw new Error(`chat-identity responded ${res.status}`);
				}
				const identity = (await res.json()) as ChatIdentityResponse;
				// Known-user auth: skips the email one-time-code flow and attributes
				// chats to the real customer, so Ari responds. entryPoint "chat" opens
				// into the customer's last conversation; without singleChatMode the
				// header back button leads to the intro screen, which lists their past
				// conversations (and lets them start a new one).
				window.Plain?.init({
					appId: PLAIN_CHAT_APP_ID,
					customerDetails: {
						email: identity.email,
						emailHash: identity.emailHash,
						fullName: identity.fullName,
					},
					entryPoint: {
						type: "chat",
					},
				});
			} catch (error) {
				// Fall back to the built-in email-verification flow so chat still
				// works even if the identity route/secret is unavailable.
				console.warn("Falling back to email-verification chat auth:", error);
				window.Plain?.init({
					appId: PLAIN_CHAT_APP_ID,
					requireAuthentication: true,
				});
			}
		};
		script.onerror = () => {
			console.warn("Failed to load Plain chat widget");
		};
		document.head.appendChild(script);
	}, []);

	return null;
}
