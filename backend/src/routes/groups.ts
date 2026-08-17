import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { FREE_GROUP_LIMIT, FREE_MEMBER_LIMIT, isPremiumPlan } from "../lib/plans";
import { computeBalances } from "../lib/settleUp";

const router = Router();
router.use(requireAuth);

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

const DEFAULT_CATEGORIES = ["groceries", "food", "utilities", "rent", "transport", "other"];

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
      categories: {
        create: DEFAULT_CATEGORIES.map((name) => ({ name })),
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

async function getMemberBalanceCents(groupId: string, userId: string): Promise<number> {
  const [expenses, shares, settlements] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId, deletedAt: null },
      select: { id: true, paidById: true, amountCents: true },
    }),
    prisma.expenseShare.findMany({
      where: { expense: { groupId, deletedAt: null } },
      select: { expenseId: true, userId: true, amountCents: true },
    }),
    prisma.settlement.findMany({
      where: { groupId },
      select: { fromUserId: true, toUserId: true, amountCents: true },
    }),
  ]);

  const balances = computeBalances(expenses, shares, settlements);
  return balances.find((b) => b.userId === userId)?.amountCents ?? 0;
}

async function removeMemberOrError(
  groupId: string,
  userId: string
): Promise<{ error: string } | null> {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return { error: "Group not found" };
  }
  if (group.createdById === userId) {
    return { error: "The group creator can't leave the group. Delete the group instead." };
  }

  const balanceCents = await getMemberBalanceCents(groupId, userId);
  if (balanceCents !== 0) {
    return { error: "This member has an unsettled balance in this group. Settle up before leaving." };
  }

  await prisma.$transaction([
    prisma.choreAssignment.deleteMany({
      where: { userId, chore: { groupId }, completedAt: null },
    }),
    prisma.groupMember.delete({
      where: { userId_groupId: { userId, groupId } },
    }),
  ]);

  return null;
}

router.post("/:id/leave", async (req: AuthedRequest, res) => {
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.userId!, groupId: req.params.id } },
  });
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const result = await removeMemberOrError(req.params.id, req.userId!);
  if (result) {
    return res.status(409).json(result);
  }

  res.status(204).send();
});

router.delete("/:id/members/:userId", async (req: AuthedRequest, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }
  if (group.createdById !== req.userId) {
    return res.status(403).json({ error: "Only the group creator can remove members" });
  }
  if (req.params.userId === req.userId) {
    return res.status(400).json({ error: "Use leave instead of removing yourself" });
  }

  const targetMembership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.params.userId, groupId: req.params.id } },
  });
  if (!targetMembership) {
    return res.status(404).json({ error: "That user is not a member of this group" });
  }

  const result = await removeMemberOrError(req.params.id, req.params.userId);
  if (result) {
    return res.status(409).json(result);
  }

  res.status(204).send();
});

const renameGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required"),
});

router.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = renameGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }
  if (group.createdById !== req.userId) {
    return res.status(403).json({ error: "Only the group creator can rename the group" });
  }

  const updated = await prisma.group.update({
    where: { id: group.id },
    data: { name: parsed.data.name },
  });

  res.json(updated);
});

router.post("/:id/regenerate-invite", async (req: AuthedRequest, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }
  if (group.createdById !== req.userId) {
    return res.status(403).json({ error: "Only the group creator can regenerate the invite code" });
  }

  let inviteCode = generateInviteCode();
  for (let attempts = 0; attempts < 5; attempts++) {
    const existing = await prisma.group.findUnique({ where: { inviteCode } });
    if (!existing) break;
    inviteCode = generateInviteCode();
  }

  const updated = await prisma.group.update({
    where: { id: group.id },
    data: { inviteCode },
  });

  res.json(updated);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }
  if (group.createdById !== req.userId) {
    return res.status(403).json({ error: "Only the group creator can delete the group" });
  }

  await prisma.group.delete({ where: { id: group.id } });

  res.status(204).send();
});

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").toLowerCase(),
});

router.get("/:id/categories", async (req: AuthedRequest, res) => {
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.userId!, groupId: req.params.id } },
  });
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const categories = await prisma.groupCategory.findMany({
    where: { groupId: req.params.id },
    orderBy: { name: "asc" },
  });

  res.json(categories);
});

router.post("/:id/categories", async (req: AuthedRequest, res) => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.userId!, groupId: req.params.id } },
  });
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  try {
    const category = await prisma.groupCategory.create({
      data: { groupId: req.params.id, name: parsed.data.name },
    });
    res.status(201).json(category);
  } catch {
    res.status(409).json({ error: "This category already exists" });
  }
});

router.delete("/:id/categories/:categoryId", async (req: AuthedRequest, res) => {
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.userId!, groupId: req.params.id } },
  });
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const category = await prisma.groupCategory.findUnique({ where: { id: req.params.categoryId } });
  if (!category || category.groupId !== req.params.id) {
    return res.status(404).json({ error: "Category not found" });
  }

  await prisma.groupCategory.delete({ where: { id: category.id } });

  res.status(204).send();
});

const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be in YYYY-MM format"),
});

router.get("/:id/report", async (req: AuthedRequest, res) => {
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.userId!, groupId: req.params.id } },
  });
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const parsed = monthQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }

  const [year, month] = parsed.data.month.split("-").map(Number);
  const rangeStart = new Date(Date.UTC(year, month - 1, 1));
  const rangeEnd = new Date(Date.UTC(year, month, 1));

  const [expenses, settlements, completedChores] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId: group.id, createdAt: { gte: rangeStart, lt: rangeEnd } },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        shares: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.settlement.findMany({
      where: { groupId: group.id, createdAt: { gte: rangeStart, lt: rangeEnd } },
      include: {
        fromUser: { select: { id: true, name: true, email: true } },
        toUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.choreAssignment.findMany({
      where: {
        chore: { groupId: group.id },
        completedAt: { gte: rangeStart, lt: rangeEnd },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        chore: { select: { id: true, title: true, frequency: true } },
      },
      orderBy: { completedAt: "asc" },
    }),
  ]);

  res.json({
    groupName: group.name,
    month: parsed.data.month,
    expenses: expenses.map((e) => ({
      id: e.id,
      description: e.description,
      amountCents: e.amountCents,
      category: e.category,
      createdAt: e.createdAt.toISOString(),
      paidBy: { id: e.paidBy.id, name: e.paidBy.name },
      shares: e.shares.map((s) => ({ userId: s.userId, userName: s.user.name, amountCents: s.amountCents })),
    })),
    settlements: settlements.map((s) => ({
      id: s.id,
      amountCents: s.amountCents,
      createdAt: s.createdAt.toISOString(),
      fromUser: { id: s.fromUser.id, name: s.fromUser.name },
      toUser: { id: s.toUser.id, name: s.toUser.name },
    })),
    completedChores: completedChores.map((c) => ({
      id: c.id,
      choreTitle: c.chore.title,
      frequency: c.chore.frequency,
      completedAt: c.completedAt!.toISOString(),
      user: { id: c.user.id, name: c.user.name },
    })),
  });
});

export default router;
