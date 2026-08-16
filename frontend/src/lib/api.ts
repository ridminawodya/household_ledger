const API_URL = import.meta.env.VITE_API_URL as string;

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "Something went wrong", data.code);
  }

  return data as T;
}

export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  plan: "free" | "premium";
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
}

export interface GroupMember {
  id: string;
  userId: string;
  groupId: string;
  joinedAt: string;
  user: User;
}

export interface GroupDetail extends Group {
  members: GroupMember[];
}

export interface ExpenseShare {
  id: string;
  expenseId: string;
  userId: string;
  amountCents: number;
}

export interface Expense {
  id: string;
  groupId: string;
  paidById: string;
  description: string;
  amountCents: number;
  category: string;
  createdAt: string;
  shares: ExpenseShare[];
  paidBy?: User;
}

export interface SettleTransaction {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  createdAt: string;
  fromUser: User;
  toUser: User;
}

export interface MonthlyReport {
  groupName: string;
  month: string;
  expenses: {
    id: string;
    description: string;
    amountCents: number;
    category: string;
    createdAt: string;
    paidBy: { id: string; name: string };
    shares: { userId: string; userName: string; amountCents: number }[];
  }[];
  settlements: {
    id: string;
    amountCents: number;
    createdAt: string;
    fromUser: { id: string; name: string };
    toUser: { id: string; name: string };
  }[];
  completedChores: {
    id: string;
    choreTitle: string;
    frequency: string;
    completedAt: string;
    user: { id: string; name: string };
  }[];
}

export interface ChoreAssignment {
  id: string;
  choreId: string;
  userId: string;
  dueDate: string;
  completedAt: string | null;
  createdAt: string;
  user?: User;
}

export interface Chore {
  id: string;
  groupId: string;
  title: string;
  frequency: string;
  createdAt: string;
  assignments: ChoreAssignment[];
}

export interface ParsedExpense {
  description: string;
  amountCents: number;
  category: string;
}

export interface AdminOverview {
  userCount: number;
  groupCount: number;
  choreCount: number;
  choreCompletedCount: number;
  newUsersLast7Days: number;
  expenseCount: number;
  expenseTotalCents: number;
  premiumUserCount: number;
}

export interface AdminTrends {
  signups: { date: string; count: number }[];
  expenses: { date: string; totalCents: number }[];
  choresCompleted: { date: string; count: number }[];
}

export interface AdminExpenseCategory {
  category: string;
  expenseCount: number;
  totalCents: number;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  plan: "free" | "premium";
  createdAt: string;
  authMethod: "google" | "password";
  groupCount: number;
}

export interface AdminGroupRow {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  expenseCount: number;
  choreCount: number;
}

export interface AdminUsersPage {
  users: AdminUserRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminGroupsPage {
  groups: AdminGroupRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminActivityItem {
  type: "expense" | "chore" | "settlement";
  timestamp: string;
  description: string;
  amountCents?: number;
  userName: string;
  groupName: string;
}

export interface AdminTopGroup {
  groupId: string;
  groupName: string;
  expenseCount: number;
  totalCents: number;
}

export interface AdminTopUser {
  userId: string;
  userName: string;
  expenseCount: number;
  totalCents: number;
}

export const GROUPS_CHANGED_EVENT = "household-ledger:groups-changed";

function notifyGroupsChanged() {
  window.dispatchEvent(new Event(GROUPS_CHANGED_EVENT));
}

export const api = {
  signup: (email: string, password: string, name: string) =>
    request<AuthResponse>("/auth/signup", { method: "POST", body: { email, password, name }, auth: false }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: { email, password }, auth: false }),

  getMe: () => request<{ user: User }>("/auth/me"),

  googleLoginUrl: () => `${API_URL}/auth/google`,

  createGroup: (name: string) =>
    request<Group>("/groups", { method: "POST", body: { name } }).then((g) => {
      notifyGroupsChanged();
      return g;
    }),

  joinGroup: (inviteCode: string) =>
    request<Group>("/groups/join", { method: "POST", body: { inviteCode } }).then((g) => {
      notifyGroupsChanged();
      return g;
    }),

  listGroups: () => request<Group[]>("/groups"),

  getGroup: (groupId: string) => request<GroupDetail>(`/groups/${groupId}`),

  getMonthlyReport: (groupId: string, month: string) =>
    request<MonthlyReport>(`/groups/${groupId}/report?month=${month}`),

  createExpense: (groupId: string, description: string, amountCents: number, category: string) =>
    request<Expense>("/expenses", { method: "POST", body: { groupId, description, amountCents, category } }),

  listExpenses: (groupId: string) => request<Expense[]>(`/expenses/group/${groupId}`),

  getSettleUp: (groupId: string) => request<SettleTransaction[]>(`/expenses/group/${groupId}/settle`),

  recordSettlement: (groupId: string, toUserId: string, amountCents: number) =>
    request<Settlement>("/expenses/settlements", { method: "POST", body: { groupId, toUserId, amountCents } }),

  listSettlements: (groupId: string) => request<Settlement[]>(`/expenses/group/${groupId}/settlements`),

  createChore: (groupId: string, title: string, frequency: string) =>
    request<Chore>("/chores", { method: "POST", body: { groupId, title, frequency } }),

  listChores: (groupId: string) => request<Chore[]>(`/chores/group/${groupId}`),

  assignChore: (choreId: string, userId: string, dueDate: string) =>
    request<ChoreAssignment>(`/chores/${choreId}/assignments`, { method: "POST", body: { userId, dueDate } }),

  completeChoreAssignment: (assignmentId: string) =>
    request<ChoreAssignment>(`/chores/assignments/${assignmentId}/complete`, { method: "POST" }),

  parseExpense: (groupId: string, text: string) =>
    request<ParsedExpense>("/ai/parse-expense", { method: "POST", body: { groupId, text } }),

  getAdminOverview: () => request<AdminOverview>("/admin/overview"),

  getAdminTrends: () => request<AdminTrends>("/admin/trends"),

  getAdminActivity: () => request<AdminActivityItem[]>("/admin/activity"),

  getAdminTopGroups: () => request<AdminTopGroup[]>("/admin/top-groups"),

  getAdminTopUsers: () => request<AdminTopUser[]>("/admin/top-users"),

  getAdminExpenseCategories: () => request<AdminExpenseCategory[]>("/admin/expense-categories"),

  getAdminUsers: (page = 1) => request<AdminUsersPage>(`/admin/users?page=${page}`),

  getAdminGroups: (page = 1) => request<AdminGroupsPage>(`/admin/groups?page=${page}`),

  createCheckout: () => request<{ url: string }>("/billing/checkout", { method: "POST" }),
};
