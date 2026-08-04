import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { settleGroup } from "../lib/settleUp";

const router = Router();
router.use(requireAuth);

async function assertMember(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
}

function splitEvenly(totalCents: number, userIds: string[]): number[] {
  const base = Math.floor(totalCents / userIds.length);
  const remainder = totalCents - base * userIds.length;
  return userIds.map((_, i) => base + (i < remainder ? 1 : 0));
}

const createExpenseSchema = z.object({
  groupId: z.string().min(1),
  description: z.string().trim().min(1, "Description is required"),
  amountCents: z.number().int().positive("Amount must be a positive integer number of cents"),
  category: z.string().trim().min(1, "Category is required"),
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { groupId, description, amountCents, category } = parsed.data;

  const membership = await assertMember(groupId, req.userId!);
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const members = await prisma.groupMember.findMany({ where: { groupId } });
  const shares = splitEvenly(amountCents, members.map((m) => m.userId));

  const expense = await prisma.expense.create({
    data: {
      groupId,
      paidById: req.userId!,
      description,
      amountCents,
      category,
      shares: {
        create: members.map((m, i) => ({
          userId: m.userId,
          amountCents: shares[i],
        })),
      },
    },
    include: { shares: true },
  });

  res.status(201).json(expense);
});

router.get("/group/:groupId", async (req: AuthedRequest, res) => {
  const membership = await assertMember(req.params.groupId, req.userId!);
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const expenses = await prisma.expense.findMany({
    where: { groupId: req.params.groupId },
    include: {
      shares: true,
      paidBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(expenses);
});

router.get("/group/:groupId/settle", async (req: AuthedRequest, res) => {
  const membership = await assertMember(req.params.groupId, req.userId!);
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const expenses = await prisma.expense.findMany({
    where: { groupId: req.params.groupId },
    select: { id: true, paidById: true, amountCents: true },
  });
  const shares = await prisma.expenseShare.findMany({
    where: { expense: { groupId: req.params.groupId } },
    select: { expenseId: true, userId: true, amountCents: true },
  });

  const transactions = settleGroup(expenses, shares);
  res.json(transactions);
});

export default router;
