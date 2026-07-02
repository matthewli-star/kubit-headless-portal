import { plainClient } from "@/lib/plainClient";
import { inspect } from "util";
import { customerIdentity } from "@/lib/customerIdentity";

export type RequestBody = {
	title: string;
	message: string;
};

export type ContactFormResponse = {
	threadId: string;
};

const { email, fullName: name, tenantExternalId } = customerIdentity;

export async function POST(request: Request) {
	// In production validation of the request body might be necessary.
	const body = await request.json();

	const upsertCustomerRes = await plainClient.upsertCustomer({
		identifier: {
			emailAddress: email,
		},
		onCreate: {
			fullName: name,
			email: {
				email: email,
				isVerified: true,
			},
			tenantIdentifiers: [{ externalId: tenantExternalId }],
		},
		onUpdate: {},
	});

	if (upsertCustomerRes.error) {
		console.error(
			inspect(upsertCustomerRes.error, {
				showHidden: false,
				depth: null,
				colors: true,
			}),
		);
		return new Response(upsertCustomerRes.error.message, { status: 500 });
	}

	console.log(`Customer upserted ${upsertCustomerRes.data.customer.id}`);

	const createThreadRes = await plainClient.createThread({
		customerIdentifier: {
			customerId: upsertCustomerRes.data.customer.id,
		},
		title: body.title,
		tenantIdentifier: { externalId: tenantExternalId },
		components: [
			{
				componentText: {
					text: body.message,
				},
			},
		],
	});

	if (createThreadRes.error) {
		console.error(
			inspect(createThreadRes.error, {
				showHidden: false,
				depth: null,
				colors: true,
			}),
		);
		return new Response(createThreadRes.error.message, { status: 500 });
	}

	console.log(`Thread created ${createThreadRes.data.id}.`);
	const responseBody: ContactFormResponse = { threadId: createThreadRes.data.id };
	return Response.json(responseBody);
}
