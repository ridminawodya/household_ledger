export interface ExpenseInput {
  id: string;
  paidById: string;
  amountCents: number;
}

export interface ExpenseShareInput {
  expenseId: string;
  userId: string;
  amountCents: number;
}

export interface Balance {
  userId: string;
  amountCents: number;
}

export interface Transaction {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

export function computeBalances(
  expenses: ExpenseInput[],
  shares: ExpenseShareInput[]
): Balance[] {
  const balances = new Map<string, number>();

  const add = (userId: string, delta: number) => {
    balances.set(userId, (balances.get(userId) ?? 0) + delta);
  };

  for (const expense of expenses) {
    add(expense.paidById, expense.amountCents);
  }
  for (const share of shares) {
    add(share.userId, -share.amountCents);
  }

  return Array.from(balances.entries())
    .map(([userId, amountCents]) => ({ userId, amountCents }))
    .filter((b) => b.amountCents !== 0);
}

export function simplifyDebts(balances: Balance[]): Transaction[] {
  const creditors = balances
    .filter((b) => b.amountCents > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.amountCents - a.amountCents);
  const debtors = balances
    .filter((b) => b.amountCents < 0)
    .map((b) => ({ userId: b.userId, amountCents: -b.amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);

  const transactions: Transaction[] = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const settled = Math.min(creditor.amountCents, debtor.amountCents);

    if (settled > 0) {
      transactions.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amountCents: settled,
      });
    }

    creditor.amountCents -= settled;
    debtor.amountCents -= settled;

    if (creditor.amountCents === 0) i++;
    if (debtor.amountCents === 0) j++;
  }

  return transactions;
}

export function settleGroup(
  expenses: ExpenseInput[],
  shares: ExpenseShareInput[]
): Transaction[] {
  return simplifyDebts(computeBalances(expenses, shares));
}
