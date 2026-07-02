import { createHmac } from "crypto";
import { customerIdentity } from "@/lib/customerIdentity";

export type ChatIdentityResponse = {
	email: string;
	fullName: string;
	emailHash: string;
};

export async function GET() {
	const secret = process.env.PLAIN_CHAT_SECRET;
	if (!secret) {
		console.error("Please set the `PLAIN_CHAT_SECRET` environment variable");
		return new Response("PLAIN_CHAT_SECRET not set", { status: 500 });
	}

	const { email, fullName } = customerIdentity;
	const emailHash = createHmac("sha256", secret).update(email).digest("hex");

	const body: ChatIdentityResponse = {
		email,
		fullName,
		emailHash,
	};

	return Response.json(body);
}
