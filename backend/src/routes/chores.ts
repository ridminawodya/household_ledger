import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";

const router = Router();
router.use(requireAuth);

async function assertMember(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
}

async function assertChoreGroupMember(choreId: string, userId: string) {
  const chore = await prisma.chore.findUnique({ where: { id: choreId } });
  if (!chore) return { chore: null, membership: null };
  const membership = await assertMember(chore.groupId, userId);
  return { chore, membership };
}

const createChoreSchema = z.object({
  groupId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required"),
  frequency: z.string().trim().min(1, "Frequency is required"),
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = createChoreSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { groupId, title, frequency } = parsed.data;

  const membership = await assertMember(groupId, req.userId!);
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const chore = await prisma.chore.create({
    data: { groupId, title, frequency },
  });

  res.status(201).json(chore);
});

router.get("/group/:groupId", async (req: AuthedRequest, res) => {
  const membership = await assertMember(req.params.groupId, req.userId!);
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const chores = await prisma.chore.findMany({
    where: { groupId: req.params.groupId },
    include: {
      assignments: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { dueDate: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(chores);
});

const assignChoreSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  dueDate: z.coerce.date({ errorMap: () => ({ message: "A valid dueDate is required" }) }),
});

router.post("/:choreId/assignments", async (req: AuthedRequest, res) => {
  const parsed = assignChoreSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { chore, membership } = await assertChoreGroupMember(req.params.choreId, req.userId!);
  if (!chore) {
    return res.status(404).json({ error: "Chore not found" });
  }
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const assigneeMembership = await assertMember(chore.groupId, parsed.data.userId);
  if (!assigneeMembership) {
    return res.status(400).json({ error: "Assigned user is not a member of this group" });
  }

  const assignment = await prisma.choreAssignment.create({
    data: {
      choreId: chore.id,
      userId: parsed.data.userId,
      dueDate: parsed.data.dueDate,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  res.status(201).json(assignment);
});

router.post("/assignments/:assignmentId/complete", async (req: AuthedRequest, res) => {
  const assignment = await prisma.choreAssignment.findUnique({
    where: { id: req.params.assignmentId },
    include: { chore: true },
  });
  if (!assignment) {
    return res.status(404).json({ error: "Assignment not found" });
  }

  const membership = await assertMember(assignment.chore.groupId, req.userId!);
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const updated = await prisma.choreAssignment.update({
    where: { id: req.params.assignmentId },
    data: { completedAt: new Date() },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  res.json(updated);
});

export default router;
