// Single source of truth for the demo customer identity.
// In a real implementation, read these from validated auth claims
// (e.g. verify an auth token and take values from its claims) instead of
// hardcoding them here.
export const customerIdentity = {
	email: "matthew.li@kubit.co",
	fullName: "Matthew Li",
	tenantExternalId: "abcd1234",
};

// Stable, deterministic per-user external id for the user's ongoing ARI chat.
// A returning user always resumes the same chat conversation by this id.
export function chatExternalId(email: string): string {
	return `ari-chat:${email}`;
}
