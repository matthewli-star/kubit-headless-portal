import { PlainClient } from "@team-plain/typescript-sdk";
import { inspect } from "util";

// One-off script to create the demo data this example needs (README "Step 2").
// Run with: PLAIN_API_KEY=<your_key> npx tsx scripts/seed-demo-data.ts

const apiKey = process.env.PLAIN_API_KEY;
if (!apiKey) {
	throw new Error("Please set the `PLAIN_API_KEY` environment variable");
}

const client = new PlainClient({ apiKey });

// These match the values hardcoded in the app.
const tenantExternalId = "abcd1234";
const customerName = "Bob Smith";
const customerEmail = "bob.smith@example.com";

function logError(label: string, error: unknown): never {
	console.error(
		`\n❌ ${label}:`,
		inspect(error, { showHidden: false, depth: null, colors: true }),
	);
	process.exit(1);
}

async function main() {
	// 1. Create (upsert) the tenant with external id `abcd1234`.
	const tenantRes = await client.upsertTenant({
		identifier: { externalId: tenantExternalId },
		externalId: tenantExternalId,
		name: "Acme Inc",
		url: { value: null },
	});
	if (tenantRes.error) logError("Failed to upsert tenant", tenantRes.error);
	console.log(`✅ Tenant ready: ${tenantRes.data.id} (externalId: ${tenantExternalId})`);

	// 2. Create (upsert) a customer and add them to the tenant.
	const customerRes = await client.upsertCustomer({
		identifier: { emailAddress: customerEmail },
		onCreate: {
			fullName: customerName,
			email: { email: customerEmail, isVerified: true },
			tenantIdentifiers: [{ externalId: tenantExternalId }],
		},
		onUpdate: {},
	});
	if (customerRes.error) logError("Failed to upsert customer", customerRes.error);
	console.log(`✅ Customer ready: ${customerRes.data.customer.id} (${customerEmail})`);

	// Ensure an existing customer is also linked to the tenant (no-op if already linked).
	const addRes = await client.addCustomerToTenants({
		customerIdentifier: { customerId: customerRes.data.customer.id },
		tenantIdentifiers: [{ externalId: tenantExternalId }],
	});
	if (addRes.error) logError("Failed to add customer to tenant", addRes.error);

	console.log("\n🎉 Demo data created. You can now run `npm run dev`.");
}

main();
