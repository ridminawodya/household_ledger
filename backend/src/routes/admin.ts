import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/overview", async (_req, res) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    userCount,
    groupCount,
    choreCount,
    choreCompletedCount,
    newUsersLast7Days,
    expenseAgg,
    premiumUserCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.group.count(),
    prisma.chore.count(),
    prisma.choreAssignment.count({ where: { completedAt: { not: null } } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.expense.aggregate({ _count: true, _sum: { amountCents: true } }),
    prisma.user.count({ where: { plan: "premium" } }),
  ]);

  res.json({
    userCount,
    groupCount,
    choreCount,
    choreCompletedCount,
    newUsersLast7Days,
    expenseCount: expenseAgg._count,
    expenseTotalCents: expenseAgg._sum.amountCents ?? 0,
    premiumUserCount,
  });
});

router.get("/trends", async (_req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [signups, expenses, chores] = await Promise.all([
    prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS date, COUNT(*)::bigint AS count
      FROM "User"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<{ date: Date; totalCents: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS date, SUM("amountCents")::bigint AS "totalCents"
      FROM "Expense"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT date_trunc('day', "completedAt") AS date, COUNT(*)::bigint AS count
      FROM "ChoreAssignment"
      WHERE "completedAt" >= ${thirtyDaysAgo}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  res.json({
    signups: signups.map((row) => ({ date: row.date.toISOString().slice(0, 10), count: Number(row.count) })),
    expenses: expenses.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      totalCents: Number(row.totalCents),
    })),
    choresCompleted: chores.map((row) => ({ date: row.date.toISOString().slice(0, 10), count: Number(row.count) })),
  });
});

router.get("/expense-categories", async (_req, res) => {
  const grouped = await prisma.expense.groupBy({
    by: ["category"],
    _sum: { amountCents: true },
    _count: true,
    orderBy: { _sum: { amountCents: "desc" } },
  });

  res.json(
    grouped.map((g) => ({
      category: g.category,
      expenseCount: g._count,
      totalCents: g._sum.amountCents ?? 0,
    }))
  );
});

router.get("/activity", async (_req, res) => {
  const [recentExpenses, recentCompletedChores, recentSettlements] = await Promise.all([
    prisma.expense.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true } },
      },
    }),
    prisma.choreAssignment.findMany({
      take: 20,
      where: { completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        chore: { select: { title: true, group: { select: { id: true, name: true } } } },
      },
    }),
    prisma.settlement.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        fromUser: { select: { id: true, name: true, email: true } },
        toUser: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true } },
      },
    }),
  ]);

  const activity = [
    ...recentExpenses.map((e) => ({
      type: "expense" as const,
      timestamp: e.createdAt.toISOString(),
      description: e.description,
      amountCents: e.amountCents,
      userName: e.paidBy.name,
      groupName: e.group.name,
    })),
    ...recentCompletedChores.map((c) => ({
      type: "chore" as const,
      timestamp: c.completedAt!.toISOString(),
      description: c.chore.title,
      userName: c.user.name,
      groupName: c.chore.group.name,
    })),
    ...recentSettlements.map((s) => ({
      type: "settlement" as const,
      timestamp: s.createdAt.toISOString(),
      description: `paid ${s.toUser.name}`,
      amountCents: s.amountCents,
      userName: s.fromUser.name,
      groupName: s.group.name,
    })),
  ]
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, 20);

  res.json(activity);
});

router.get("/top-groups", async (_req, res) => {
  const grouped = await prisma.expense.groupBy({
    by: ["groupId"],
    _sum: { amountCents: true },
    _count: true,
    orderBy: { _sum: { amountCents: "desc" } },
    take: 10,
  });

  const groups = await prisma.group.findMany({
    where: { id: { in: grouped.map((g) => g.groupId) } },
    select: { id: true, name: true },
  });
  const groupsById = new Map(groups.map((g) => [g.id, g]));

  res.json(
    grouped.map((g) => ({
      groupId: g.groupId,
      groupName: groupsById.get(g.groupId)?.name ?? "Unknown group",
      expenseCount: g._count,
      totalCents: g._sum.amountCents ?? 0,
    }))
  );
});

router.get("/top-users", async (_req, res) => {
  const grouped = await prisma.expense.groupBy({
    by: ["paidById"],
    _sum: { amountCents: true },
    _count: true,
    orderBy: { _sum: { amountCents: "desc" } },
    take: 10,
  });

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.paidById) } },
    select: { id: true, name: true, email: true },
  });
  const usersById = new Map(users.map((u) => [u.id, u]));

  res.json(
    grouped.map((g) => ({
      userId: g.paidById,
      userName: usersById.get(g.paidById)?.name ?? "Unknown user",
      expenseCount: g._count,
      totalCents: g._sum.amountCents ?? 0,
    }))
  );
});

function parsePage(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

const PAGE_SIZE = 20;

router.get("/users", async (req, res) => {
  const page = parsePage(req.query.page);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        googleId: true,
        plan: true,
        _count: { select: { memberships: true } },
      },
    }),
    prisma.user.count(),
  ]);

  res.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      plan: u.plan,
      createdAt: u.createdAt.toISOString(),
      authMethod: u.googleId ? "google" : "password",
      groupCount: u._count.memberships,
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
  });
});

router.get("/groups", async (req, res) => {
  const page = parsePage(req.query.page);

  const [groups, total] = await Promise.all([
    prisma.group.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { members: true, expenses: true, chores: true } },
      },
    }),
    prisma.group.count(),
  ]);

  res.json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      createdAt: g.createdAt.toISOString(),
      memberCount: g._count.members,
      expenseCount: g._count.expenses,
      choreCount: g._count.chores,
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
  });
});

export default router;
