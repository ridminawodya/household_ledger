import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { isPremiumPlan } from "../lib/plans";

const router = Router();
router.use(requireAuth);

const parseExpenseSchema = z.object({
  groupId: z.string().min(1),
  text: z.string().trim().min(1, "Text is required"),
});

const parsedExpenseSchema = z.object({
  description: z.string().min(1),
  amountCents: z.number().int().positive(),
  category: z.string().min(1),
});

router.post("/parse-expense", async (req: AuthedRequest, res) => {
  const parsed = parseExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { groupId, text } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!isPremiumPlan(user.plan)) {
    return res.status(403).json({
      error: "AI expense parsing is a premium feature. Upgrade to premium to use it.",
      code: "PLAN_LIMIT_AI",
    });
  }

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.userId!, groupId } },
  });
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this group" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "AI parsing is not configured on this server" });
  }

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: { select: { name: true } } },
  });
  const memberNames = members.map((m) => m.user.name).join(", ");

  const client = new Anthropic({ apiKey });

  let raw: string;
  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      system: `You extract structured expense data from a free-text message written by a member of a shared household group. Group members: ${memberNames}.

Respond with ONLY a JSON object, no prose, no markdown code fences. The JSON must have exactly these fields:
{"description": string, "amountCents": integer, "category": string}

"amountCents" is the total dollar amount converted to integer cents (e.g. $85 -> 8500, $12.50 -> 1250). "category" should be a short lowercase word like "groceries", "food", "utilities", "rent", "transport", or "other". If no dollar amount can be found in the text, respond with exactly: {"error": "No amount found in the message"}`,
      messages: [{ role: "user", content: text }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return res.status(502).json({ error: "AI did not return a text response" });
    }
    raw = textBlock.text.trim();
  } catch {
    return res.status(502).json({ error: "Failed to reach the AI service" });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return res.status(502).json({ error: "AI returned invalid JSON" });
  }

  if (
    json &&
    typeof json === "object" &&
    "error" in json &&
    typeof (json as { error: unknown }).error === "string"
  ) {
    return res.status(422).json({ error: (json as { error: string }).error });
  }

  const expenseParsed = parsedExpenseSchema.safeParse(json);
  if (!expenseParsed.success) {
    return res.status(502).json({ error: "AI response did not match the expected format" });
  }

  res.json(expenseParsed.data);
});

export default router;
