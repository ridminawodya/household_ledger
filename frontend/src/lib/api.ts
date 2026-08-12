const API_URL = import.meta.env.VITE_API_URL as string;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
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
    throw new ApiError(res.status, data.error ?? "Something went wrong");
  }

  return data as T;
}

export interface User {
  id: string;
  email: string;
  name: string;
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

  createExpense: (groupId: string, description: string, amountCents: number, category: string) =>
    request<Expense>("/expenses", { method: "POST", body: { groupId, description, amountCents, category } }),

  listExpenses: (groupId: string) => request<Expense[]>(`/expenses/group/${groupId}`),

  getSettleUp: (groupId: string) => request<SettleTransaction[]>(`/expenses/group/${groupId}/settle`),

  createChore: (groupId: string, title: string, frequency: string) =>
    request<Chore>("/chores", { method: "POST", body: { groupId, title, frequency } }),

  listChores: (groupId: string) => request<Chore[]>(`/chores/group/${groupId}`),

  assignChore: (choreId: string, userId: string, dueDate: string) =>
    request<ChoreAssignment>(`/chores/${choreId}/assignments`, { method: "POST", body: { userId, dueDate } }),

  completeChoreAssignment: (assignmentId: string) =>
    request<ChoreAssignment>(`/chores/assignments/${assignmentId}/complete`, { method: "POST" }),

  parseExpense: (groupId: string, text: string) =>
    request<ParsedExpense>("/ai/parse-expense", { method: "POST", body: { groupId, text } }),
};
