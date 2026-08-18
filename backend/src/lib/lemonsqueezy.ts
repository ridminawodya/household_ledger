const API_BASE = "https://api.lemonsqueezy.com/v1";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export interface CreateCheckoutParams {
  userId: string;
  userEmail: string;
}

export async function createCheckoutUrl({ userId, userEmail }: CreateCheckoutParams): Promise<string> {
  const apiKey = getEnv("LEMONSQUEEZY_API_KEY");
  const storeId = getEnv("LEMONSQUEEZY_STORE_ID");
  const variantId = getEnv("LEMONSQUEEZY_PREMIUM_VARIANT_ID");

  const res = await fetch(`${API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: userEmail,
            custom: { user_id: userId },
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Lemon Squeezy checkout creation failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as { data: { attributes: { url: string } } };
  return json.data.attributes.url;
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const apiKey = getEnv("LEMONSQUEEZY_API_KEY");

  const res = await fetch(`${API_BASE}/subscriptions/${subscriptionId}`, {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Lemon Squeezy subscription cancellation failed (${res.status}): ${body}`);
  }
}
