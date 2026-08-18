import { Router } from "express";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword, signToken, isAdminEmail } from "../lib/auth";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { sendPasswordResetEmail } from "../lib/email";
import { cancelSubscription } from "../lib/lemonsqueezy";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
const APP_URL_SCHEME = "householdledger://auth/callback";

function getGoogleClient(): OAuth2Client {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error("Google OAuth is not configured on this server");
  }
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1, "Name is required"),
});

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  });

  const token = signToken({ userId: user.id });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, isAdmin: isAdminEmail(user.email), plan: user.plan },
  });
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required"),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({ userId: user.id });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, isAdmin: isAdminEmail(user.email), plan: user.plan },
  });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({
    user: { id: user.id, email: user.email, name: user.name, isAdmin: isAdminEmail(user.email), plan: user.plan },
  });
});

router.get("/google", (req, res) => {
  let client: OAuth2Client;
  try {
    client = getGoogleClient();
  } catch {
    return res.status(500).json({ error: "Google sign-in is not configured on this server" });
  }

  // The Android app opens this in the system browser (Google blocks embedded
  // WebViews) and passes ?native=1 so the callback redirects back into the
  // app via a custom URL scheme instead of the web frontend.
  const isNative = req.query.native === "1";

  const url = client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    state: isNative ? "native" : undefined,
  });
  res.redirect(url);
});

router.get("/google/callback", async (req, res) => {
  const isNative = req.query.state === "native";
  const errorRedirectBase = isNative ? APP_URL_SCHEME : `${FRONTEND_URL}/login`;

  const code = typeof req.query.code === "string" ? req.query.code : null;
  if (!code) {
    return res.redirect(`${errorRedirectBase}?error=${encodeURIComponent("Google sign-in was cancelled")}`);
  }

  let client: OAuth2Client;
  try {
    client = getGoogleClient();
  } catch {
    return res.redirect(`${errorRedirectBase}?error=${encodeURIComponent("Google sign-in is not configured")}`);
  }

  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      throw new Error("No ID token returned from Google");
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new Error("Incomplete Google profile");
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = payload.name ?? email;

    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      // No account linked to this Google ID yet -- check if the email is
      // already registered (e.g. via password signup) and link instead of
      // creating a duplicate account.
      const existingByEmail = await prisma.user.findUnique({ where: { email } });
      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { googleId },
        });
      } else {
        user = await prisma.user.create({
          data: { email, name, googleId },
        });
      }
    }

    const token = signToken({ userId: user.id });
    if (isNative) {
      res.redirect(`${APP_URL_SCHEME}?token=${encodeURIComponent(token)}`);
    } else {
      res.redirect(`${FRONTEND_URL}/auth/google/callback?token=${encodeURIComponent(token)}`);
    }
  } catch {
    res.redirect(`${errorRedirectBase}?error=${encodeURIComponent("Google sign-in failed")}`);
  }
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

router.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Always respond the same way whether or not the account exists, and
  // whether or not it has a password (Google-only accounts can't reset a
  // password that doesn't exist) -- avoids leaking which emails are registered.
  if (user && user.passwordHash) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (err) {
      console.error("Failed to send password reset email:", err);
      return res.status(502).json({ error: "Email sending is not configured on this server" });
    }
  }

  res.json({ message: "If an account exists for that email, a reset link has been sent." });
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

router.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const tokenHash = hashResetToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return res.status(400).json({ error: "This reset link is invalid or has expired" });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);

  res.json({ message: "Password updated. You can now log in." });
});

router.delete("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const createdGroups = await prisma.group.count({ where: { createdById: user.id } });
  if (createdGroups > 0) {
    return res.status(409).json({
      error: "Delete or transfer the groups you created before deleting your account.",
    });
  }

  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    select: { groupId: true },
  });
  for (const { groupId } of memberships) {
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
    const { computeBalances } = await import("../lib/settleUp");
    const balance = computeBalances(expenses, shares, settlements).find((b) => b.userId === user.id);
    if (balance && balance.amountCents !== 0) {
      return res.status(409).json({
        error: "You have an unsettled balance in one of your groups. Settle up before deleting your account.",
      });
    }
  }

  if (user.plan === "premium" && user.lemonSqueezySubscriptionId) {
    try {
      await cancelSubscription(user.lemonSqueezySubscriptionId);
    } catch (err) {
      console.error("Failed to cancel subscription during account deletion:", err);
    }
  }

  await prisma.user.delete({ where: { id: user.id } });
  res.status(204).send();
});

export default router;
