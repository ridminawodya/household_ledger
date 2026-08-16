import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { FREE_GROUP_LIMIT, FREE_MEMBER_LIMIT, isPremiumPlan } from "../lib/plans";

const router = Router();
router.use(requireAuth);

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required"),
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (!isPremiumPlan(user.plan)) {
    const groupCount = await prisma.groupMember.count({ where: { userId: req.userId! } });
    if (groupCount >= FREE_GROUP_LIMIT) {
      return res.status(403).json({
        error: `Free plan is limited to ${FREE_GROUP_LIMIT} group. Upgrade to premium to create more.`,
        code: "PLAN_LIMIT_GROUPS",
      });
    }
  }

  let inviteCode = generateInviteCode();
  for (let attempts = 0; attempts < 5; attempts++) {
    const existing = await prisma.group.findUnique({ where: { inviteCode } });
    if (!existing) break;
    inviteCode = generateInviteCode();
  }

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      inviteCode,
      createdById: req.userId!,
      members: {
        create: { userId: req.userId! },
      },
    },
    include: { members: true },
  });

  res.status(201).json(group);
});

const joinGroupSchema = z.object({
  inviteCode: z.string().trim().min(1, "Invite code is required"),
});

router.post("/join", async (req: AuthedRequest, res) => {
  const parsed = joinGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const group = await prisma.group.findUnique({
    where: { inviteCode: parsed.data.inviteCode.toUpperCase() },
    include: { createdBy: true, _count: { select: { members: true } } },
  });
  if (!group) {
    return res.status(404).json({ error: "No group found with that invite code" });
  }

  const existingMembership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.userId!, groupId: group.id } },
  });
  if (existingMembership) {
    return res.status(409).json({ error: "You are already a member of this group" });
  }

  const creatorIsPremium = group.createdBy ? isPremiumPlan(group.createdBy.plan) : false;
  if (!creatorIsPremium && group._count.members >= FREE_MEMBER_LIMIT) {
    return res.status(403).json({
      error: `This group has reached the ${FREE_MEMBER_LIMIT}-member limit on the free plan.`,
      code: "PLAN_LIMIT_MEMBERS",
    });
  }

  await prisma.groupMember.create({
    data: { userId: req.userId!, groupId: group.id },
  });

  res.status(201).json(group);
});

router.get("/", async (req: AuthedRequest, res) => {
  const memberships = await prisma.groupMember.findMany({
    where: { userId: req.userId! },
    include: { group: true },
    orderBy: { joinedAt: "asc" },
  });

  res.json(memberships.map((m) => m.group));
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.userId!, groupId: req.params.id } },
  });
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const group = await prisma.group.findUnique({
    where: { id: req.params.id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }

  res.json(group);
});

export default router;
