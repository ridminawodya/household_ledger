import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword, signToken, isAdminEmail } from "../lib/auth";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

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

router.get("/google", (_req, res) => {
  let client: OAuth2Client;
  try {
    client = getGoogleClient();
  } catch {
    return res.status(500).json({ error: "Google sign-in is not configured on this server" });
  }

  const url = client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });
  res.redirect(url);
});

router.get("/google/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent("Google sign-in was cancelled")}`);
  }

  let client: OAuth2Client;
  try {
    client = getGoogleClient();
  } catch {
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent("Google sign-in is not configured")}`);
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
    res.redirect(`${FRONTEND_URL}/auth/google/callback?token=${encodeURIComponent(token)}`);
  } catch {
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent("Google sign-in failed")}`);
  }
});

export default router;
