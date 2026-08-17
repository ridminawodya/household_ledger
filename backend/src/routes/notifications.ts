import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId! },
    include: { group: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json(notifications);
});

router.get("/unread-count", async (req: AuthedRequest, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.userId!, readAt: null },
  });

  res.json({ count });
});

router.post("/read-all", async (req: AuthedRequest, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId!, readAt: null },
    data: { readAt: new Date() },
  });

  res.status(204).send();
});

router.post("/:id/read", async (req: AuthedRequest, res) => {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notification || notification.userId !== req.userId) {
    return res.status(404).json({ error: "Notification not found" });
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: new Date() },
  });

  res.status(204).send();
});

export default router;
