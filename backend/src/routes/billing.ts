import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { createCheckoutUrl, cancelSubscription } from "../lib/lemonsqueezy";

const router = Router();
router.use(requireAuth);

router.post("/checkout", async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  try {
    const url = await createCheckoutUrl({ userId: user.id, userEmail: user.email });
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Failed to create checkout session" });
  }
});

router.post("/cancel", async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  if (user.plan !== "premium" || !user.lemonSqueezySubscriptionId) {
    return res.status(409).json({ error: "No active subscription to cancel" });
  }

  try {
    await cancelSubscription(user.lemonSqueezySubscriptionId);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "Failed to cancel subscription" });
  }

  // The webhook will flip the plan back to free once Lemon Squeezy processes
  // the cancellation, but we also update it here so the UI reflects it immediately.
  await prisma.user.update({
    where: { id: user.id },
    data: { plan: "free", premiumSince: null, lemonSqueezySubscriptionId: null },
  });

  res.json({ message: "Subscription cancelled" });
});

export default router;
