import { Router } from "express";
import { prisma } from "../lib/prisma";
import { verifyLemonSqueezySignature } from "../lib/webhookSignature";

const router = Router();

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "on_trial", "past_due"]);

router.post("/webhook", async (req, res) => {
  const rawBody = req.body as Buffer;
  const signature = req.header("X-Signature");

  if (!verifyLemonSqueezySignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  let payload: {
    meta: { event_name: string; custom_data?: { user_id?: string } };
    data: { id: string; attributes: { status: string; user_email: string } };
  };
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  const eventName = payload.meta?.event_name;
  const userId = payload.meta?.custom_data?.user_id;
  const status = payload.data?.attributes?.status;

  if (!eventName || !eventName.startsWith("subscription_")) {
    return res.json({ received: true });
  }

  const userEmail = payload.data?.attributes?.user_email;
  const user =
    (userId ? await prisma.user.findUnique({ where: { id: userId } }) : null) ??
    (userEmail ? await prisma.user.findUnique({ where: { email: userEmail } }) : null);

  if (!user) {
    // Nothing to update locally; still acknowledge so Lemon Squeezy doesn't retry forever.
    return res.json({ received: true });
  }

  const isActive = ACTIVE_SUBSCRIPTION_STATUSES.has(status);
  const subscriptionId = payload.data?.id ?? null;

  await prisma.user.update({
    where: { id: user.id },
    data: isActive
      ? {
          plan: "premium",
          premiumSince: user.premiumSince ?? new Date(),
          lemonSqueezySubscriptionId: subscriptionId ?? user.lemonSqueezySubscriptionId,
        }
      : { plan: "free", premiumSince: null, lemonSqueezySubscriptionId: null },
  });

  res.json({ received: true });
});

export default router;
