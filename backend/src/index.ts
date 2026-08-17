import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import groupsRouter from "./routes/groups";
import expensesRouter from "./routes/expenses";
import choresRouter from "./routes/chores";
import aiRouter from "./routes/ai";
import adminRouter from "./routes/admin";
import billingRouter from "./routes/billing";
import billingWebhookRouter from "./routes/billingWebhook";
import notificationsRouter from "./routes/notifications";

const app = express();

app.use(cors());

// Mounted before express.json() — webhook signature verification needs the
// raw request body, which a prior JSON-parsing middleware would discard.
app.use("/billing", express.raw({ type: "application/json" }), billingWebhookRouter);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/groups", groupsRouter);
app.use("/expenses", expensesRouter);
app.use("/chores", choresRouter);
app.use("/ai", aiRouter);
app.use("/admin", adminRouter);
app.use("/billing", billingRouter);
app.use("/notifications", notificationsRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
