import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import groupsRouter from "./routes/groups";
import expensesRouter from "./routes/expenses";
import choresRouter from "./routes/chores";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/groups", groupsRouter);
app.use("/expenses", expensesRouter);
app.use("/chores", choresRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
