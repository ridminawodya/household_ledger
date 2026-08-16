import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { createCheckoutUrl } from "../lib/lemonsqueezy";

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

export default router;
