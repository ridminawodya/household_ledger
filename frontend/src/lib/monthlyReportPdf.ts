import jsPDF from "jspdf";
import type { MonthlyReport } from "./api";
import { formatCents } from "./money";

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function downloadMonthlyReportPdf(report: MonthlyReport): void {
  const doc = new jsPDF();
  const marginX = 14;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 18;

  function ensureRoom(lines = 1) {
    if (y + lines * 6 > pageHeight - 14) {
      doc.addPage();
      y = 18;
    }
  }

  function heading(text: string) {
    ensureRoom(2);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(text, marginX, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  }

  function line(text: string) {
    ensureRoom();
    doc.text(text, marginX, y);
    y += 6;
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(report.groupName, marginX, y);
  y += 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Monthly report — ${formatMonthLabel(report.month)}`, marginX, y);
  y += 10;

  const expenseTotal = report.expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const settlementTotal = report.settlements.reduce((sum, s) => sum + s.amountCents, 0);

  heading("Summary");
  line(`Expenses logged: ${report.expenses.length}  (${formatCents(expenseTotal)} total)`);
  line(`Payments settled: ${report.settlements.length}  (${formatCents(settlementTotal)} total)`);
  line(`Chores completed: ${report.completedChores.length}`);
  y += 4;

  heading("Expenses");
  if (report.expenses.length === 0) {
    line("No expenses logged this month.");
  } else {
    for (const e of report.expenses) {
      ensureRoom(2);
      line(`${formatDate(e.createdAt)} — ${e.description} (${e.category})`);
      line(`   Paid by ${e.paidBy.name} — ${formatCents(e.amountCents)}`);
    }
  }
  y += 4;

  heading("Payments (settle-up)");
  if (report.settlements.length === 0) {
    line("No payments recorded this month.");
  } else {
    for (const s of report.settlements) {
      line(`${formatDate(s.createdAt)} — ${s.fromUser.name} paid ${s.toUser.name} ${formatCents(s.amountCents)}`);
    }
  }
  y += 4;

  heading("Chores completed");
  if (report.completedChores.length === 0) {
    line("No chores completed this month.");
  } else {
    for (const c of report.completedChores) {
      line(`${formatDate(c.completedAt)} — ${c.choreTitle} (${c.frequency}) — ${c.user.name}`);
    }
  }

  const fileMonth = report.month;
  const fileGroup = report.groupName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`${fileGroup}-${fileMonth}-report.pdf`);
}
