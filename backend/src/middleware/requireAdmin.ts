import type { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { isAdminEmail } from "../lib/auth";
import type { AuthedRequest } from "./requireAuth";

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { email: true },
  });

  if (!user || !isAdminEmail(user.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}
