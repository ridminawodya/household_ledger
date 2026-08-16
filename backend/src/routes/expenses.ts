import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { settleGroup } from "../lib/settleUp";
import { uploadReceipt } from "../lib/supabaseStorage";
import { addRecurrenceInterval, isRecurrenceFrequency, RECURRENCE_FREQUENCIES } from "../lib/recurrence";

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

async function assertMember(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
}

const NOT_DELETED = { deletedAt: null } as const;

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
  recurrenceFrequency: z.enum(RECURRENCE_FREQUENCIES).optional(),
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { groupId, description, amountCents, category, recurrenceFrequency } = parsed.data;

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
      recurrenceFrequency,
      nextOccurrenceAt: recurrenceFrequency
        ? addRecurrenceInterval(new Date(), recurrenceFrequency)
        : undefined,
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

// Creates any recurring expense's next instance(s) that have come due,
// checked lazily on read rather than via a background job (see schema
// comment on Expense.nextOccurrenceAt for why).
async function materializeDueRecurringExpenses(groupId: string): Promise<void> {
  const now = new Date();
  const dueTemplates = await prisma.expense.findMany({
    where: {
      groupId,
      ...NOT_DELETED,
      recurrenceFrequency: { not: null },
      nextOccurrenceAt: { lte: now },
    },
    include: { shares: true },
  });

  for (const template of dueTemplates) {
    if (!template.recurrenceFrequency || !isRecurrenceFrequency(template.recurrenceFrequency)) continue;

    let cursor = template.nextOccurrenceAt ?? now;
    const members = await prisma.groupMember.findMany({ where: { groupId } });
    const shares = splitEvenly(template.amountCents, members.map((m) => m.userId));

    // Catch up on every missed occurrence (e.g. nobody opened the app for
    // two months of a monthly expense), not just the most recent one.
    while (cursor <= now) {
      await prisma.expense.create({
        data: {
          groupId,
          paidById: template.paidById,
          description: template.description,
          amountCents: template.amountCents,
          category: template.category,
          createdAt: cursor,
          recurrenceSourceId: template.id,
          shares: {
            create: members.map((m, i) => ({ userId: m.userId, amountCents: shares[i] })),
          },
        },
      });
      cursor = addRecurrenceInterval(cursor, template.recurrenceFrequency);
    }

    await prisma.expense.update({
      where: { id: template.id },
      data: { nextOccurrenceAt: cursor },
    });
  }
}

const updateExpenseSchema = z.object({
  description: z.string().trim().min(1, "Description is required").optional(),
  amountCents: z.number().int().positive("Amount must be a positive integer number of cents").optional(),
  category: z.string().trim().min(1, "Category is required").optional(),
});

router.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = updateExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense || expense.deletedAt) {
    return res.status(404).json({ error: "Expense not found" });
  }
  if (expense.paidById !== req.userId) {
    return res.status(403).json({ error: "Only the person who paid can edit this expense" });
  }

  const nextAmountCents = parsed.data.amountCents ?? expense.amountCents;

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.amountCents !== undefined) {
      const members = await tx.groupMember.findMany({ where: { groupId: expense.groupId } });
      const shares = splitEvenly(nextAmountCents, members.map((m) => m.userId));
      await tx.expenseShare.deleteMany({ where: { expenseId: expense.id } });
      await tx.expenseShare.createMany({
        data: members.map((m, i) => ({ expenseId: expense.id, userId: m.userId, amountCents: shares[i] })),
      });
    }

    return tx.expense.update({
      where: { id: expense.id },
      data: {
        description: parsed.data.description,
        amountCents: parsed.data.amountCents,
        category: parsed.data.category,
      },
      include: {
        shares: true,
        paidBy: { select: { id: true, name: true, email: true } },
      },
    });
  });

  res.json(updated);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense || expense.deletedAt) {
    return res.status(404).json({ error: "Expense not found" });
  }
  if (expense.paidById !== req.userId) {
    return res.status(403).json({ error: "Only the person who paid can delete this expense" });
  }

  await prisma.expense.update({
    where: { id: expense.id },
    data: { deletedAt: new Date() },
  });

  res.status(204).send();
});

router.post("/:id/receipt", upload.single("receipt"), async (req: AuthedRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file was uploaded" });
  }

  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense || expense.deletedAt) {
    return res.status(404).json({ error: "Expense not found" });
  }
  const membership = await assertMember(expense.groupId, req.userId!);
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  let receiptUrl: string;
  try {
    receiptUrl = await uploadReceipt(expense.groupId, {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "Failed to upload receipt image" });
  }

  const updated = await prisma.expense.update({
    where: { id: expense.id },
    data: { receiptUrl },
    include: {
      shares: true,
      paidBy: { select: { id: true, name: true, email: true } },
    },
  });

  res.json(updated);
});

router.get("/group/:groupId", async (req: AuthedRequest, res) => {
  const membership = await assertMember(req.params.groupId, req.userId!);
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  await materializeDueRecurringExpenses(req.params.groupId);

  const expenses = await prisma.expense.findMany({
    where: { groupId: req.params.groupId, ...NOT_DELETED },
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

  await materializeDueRecurringExpenses(req.params.groupId);

  const expenses = await prisma.expense.findMany({
    where: { groupId: req.params.groupId, ...NOT_DELETED },
    select: { id: true, paidById: true, amountCents: true },
  });
  const shares = await prisma.expenseShare.findMany({
    where: { expense: { groupId: req.params.groupId, ...NOT_DELETED } },
    select: { expenseId: true, userId: true, amountCents: true },
  });
  const settlements = await prisma.settlement.findMany({
    where: { groupId: req.params.groupId },
    select: { fromUserId: true, toUserId: true, amountCents: true },
  });

  const transactions = settleGroup(expenses, shares, settlements);
  res.json(transactions);
});

const recordSettlementSchema = z.object({
  groupId: z.string().min(1),
  toUserId: z.string().min(1),
  amountCents: z.number().int().positive("Amount must be a positive integer number of cents"),
});

router.post("/settlements", async (req: AuthedRequest, res) => {
  const parsed = recordSettlementSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { groupId, toUserId, amountCents } = parsed.data;

  const membership = await assertMember(groupId, req.userId!);
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }
  const payeeMembership = await assertMember(groupId, toUserId);
  if (!payeeMembership) {
    return res.status(400).json({ error: "Recipient is not a member of this group" });
  }
  if (toUserId === req.userId) {
    return res.status(400).json({ error: "You cannot record a payment to yourself" });
  }

  const settlement = await prisma.settlement.create({
    data: { groupId, fromUserId: req.userId!, toUserId, amountCents },
    include: {
      fromUser: { select: { id: true, name: true, email: true } },
      toUser: { select: { id: true, name: true, email: true } },
    },
  });

  res.status(201).json(settlement);
});

router.get("/group/:groupId/settlements", async (req: AuthedRequest, res) => {
  const membership = await assertMember(req.params.groupId, req.userId!);
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const settlements = await prisma.settlement.findMany({
    where: { groupId: req.params.groupId },
    include: {
      fromUser: { select: { id: true, name: true, email: true } },
      toUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(settlements);
});

export default router;
