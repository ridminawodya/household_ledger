import { prisma } from "./prisma";

interface NotificationContent {
  type: string;
  actorName: string;
  message: string;
  amountCents?: number;
}

export async function notifyGroupMembers(
  groupId: string,
  excludeUserId: string,
  content: NotificationContent
): Promise<void> {
  const members = await prisma.groupMember.findMany({
    where: { groupId, userId: { not: excludeUserId } },
    select: { userId: true },
  });
  if (members.length === 0) return;

  await prisma.notification.createMany({
    data: members.map((m) => ({ userId: m.userId, groupId, ...content })),
  });
}

export async function notifyUser(userId: string, groupId: string, content: NotificationContent): Promise<void> {
  await prisma.notification.create({ data: { userId, groupId, ...content } });
}
