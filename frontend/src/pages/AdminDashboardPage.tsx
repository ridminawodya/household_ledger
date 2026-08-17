import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api";
import type {
  AdminActivityItem,
  AdminExpenseCategory,
  AdminGroupRow,
  AdminOverview,
  AdminTopGroup,
  AdminTopUser,
  AdminTrends,
  AdminUserRow,
} from "../lib/api";
import { formatCents } from "../lib/money";

const GRID = "#e1e0d9";
const AXIS_TEXT = "#898781";

// Validated categorical palette (dataviz skill) — fixed order, never cycled.
const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const AQUA = "#1baf7a";
const YELLOW = "#eda100";
const MAGENTA = "#e87ba4";
const GREEN = "#008300";
const VIOLET = "#4a3aa7";
const RED = "#e34948";
const CATEGORY_COLORS = [BLUE, ORANGE, AQUA, YELLOW, MAGENTA, GREEN, VIOLET, RED];

function formatShortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border-l-4" style={{ borderLeftColor: accent }}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function PaginationControls({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <p className="text-gray-500">
        Page {page} of {pageCount} · {total.toLocaleString()} total
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
  staggerIndex,
}: {
  title: string;
  children: React.ReactNode;
  staggerIndex?: number;
}) {
  return (
    <div
      className="bg-white rounded-lg shadow p-6 animate-slide-up stagger-item"
      style={staggerIndex !== undefined ? ({ "--stagger-index": staggerIndex } as React.CSSProperties) : undefined}
    >
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{title}</h2>
      <div style={{ width: "100%", height: 220 }}>{children}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [trends, setTrends] = useState<AdminTrends | null>(null);
  const [activity, setActivity] = useState<AdminActivityItem[]>([]);
  const [topGroups, setTopGroups] = useState<AdminTopGroup[]>([]);
  const [topUsers, setTopUsers] = useState<AdminTopUser[]>([]);
  const [categories, setCategories] = useState<AdminExpenseCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [directoryTab, setDirectoryTab] = useState<"users" | "groups">("users");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [groups, setGroups] = useState<AdminGroupRow[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [groupsPage, setGroupsPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [groupsTotal, setGroupsTotal] = useState(0);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function load(): Promise<void> {
      return Promise.all([
        api.getAdminOverview(),
        api.getAdminTrends(),
        api.getAdminActivity(),
        api.getAdminTopGroups(),
        api.getAdminTopUsers(),
        api.getAdminExpenseCategories(),
      ]).then(([ov, tr, act, groups, users, cats]) => {
        if (cancelled) return;
        setOverview(ov);
        setTrends(tr);
        setActivity(act);
        setTopGroups(groups);
        setTopUsers(users);
        setCategories(cats);
      });
    }

    // A free-tier backend instance can 502 a request while cold-starting;
    // one retry after a short delay covers that without a manual reload.
    load()
      .catch(() => new Promise((resolve) => setTimeout(resolve, 1500)).then(load))
      .catch(() => {
        if (!cancelled) setError("Failed to load admin dashboard data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (directoryTab !== "users") return;
    setDirectoryLoading(true);
    api
      .getAdminUsers(usersPage)
      .then((res) => {
        setUsers(res.users);
        setUsersTotal(res.total);
      })
      .finally(() => setDirectoryLoading(false));
  }, [directoryTab, usersPage]);

  useEffect(() => {
    if (directoryTab !== "groups") return;
    setDirectoryLoading(true);
    api
      .getAdminGroups(groupsPage)
      .then((res) => {
        setGroups(res.groups);
        setGroupsTotal(res.total);
      })
      .finally(() => setDirectoryLoading(false));
  }, [directoryTab, groupsPage]);

  const DIRECTORY_PAGE_SIZE = 20;

  if (loading) {
    return (
      <div className="px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm text-gray-500">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (error || !overview || !trends) {
    return (
      <div className="px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm text-red-600">{error ?? "Something went wrong"}</p>
        </div>
      </div>
    );
  }

  const choreCompletionRate =
    overview.choreCount > 0 ? Math.round((overview.choreCompletedCount / overview.choreCount) * 100) : 0;
  const premiumRate =
    overview.userCount > 0 ? Math.round((overview.premiumUserCount / overview.userCount) * 100) : 0;

  return (
    <div className="px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">Full system overview across all households</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatTile
            label="Total users"
            value={overview.userCount.toLocaleString()}
            sub={`+${overview.newUsersLast7Days} this week`}
            accent={BLUE}
          />
          <StatTile label="Total groups" value={overview.groupCount.toLocaleString()} accent={VIOLET} />
          <StatTile
            label="Expense volume"
            value={formatCents(overview.expenseTotalCents)}
            sub={`${overview.expenseCount.toLocaleString()} expenses`}
            accent={ORANGE}
          />
          <StatTile label="Total chores" value={overview.choreCount.toLocaleString()} accent={AQUA} />
          <StatTile
            label="Chore completion"
            value={`${choreCompletionRate}%`}
            sub={`${overview.choreCompletedCount} completed`}
            accent={GREEN}
          />
          <StatTile
            label="Premium users"
            value={overview.premiumUserCount.toLocaleString()}
            sub={`${premiumRate}% of total`}
            accent={MAGENTA}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard title="Signups (last 30 days)" staggerIndex={0}>
            <ResponsiveContainer>
              <LineChart data={trends.signups} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fontSize: 11, fill: AXIS_TEXT }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS_TEXT }} axisLine={false} tickLine={false} />
                <Tooltip
                  labelFormatter={(v) => formatShortDate(String(v))}
                  formatter={(value) => [Number(value), "Signups"]}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={BLUE}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Expense volume (last 30 days)" staggerIndex={1}>
            <ResponsiveContainer>
              <BarChart data={trends.expenses} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fontSize: 11, fill: AXIS_TEXT }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => formatCents(v)}
                  tick={{ fontSize: 11, fill: AXIS_TEXT }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip
                  labelFormatter={(v) => formatShortDate(String(v))}
                  formatter={(value) => [formatCents(Number(value)), "Volume"]}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                  cursor={{ fill: "rgba(235, 104, 52, 0.08)" }}
                />
                <Bar
                  dataKey="totalCents"
                  fill={ORANGE}
                  radius={[4, 4, 0, 0]}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Chores completed (last 30 days)" staggerIndex={2}>
            <ResponsiveContainer>
              <BarChart data={trends.choresCompleted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fontSize: 11, fill: AXIS_TEXT }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS_TEXT }} axisLine={false} tickLine={false} />
                <Tooltip
                  labelFormatter={(v) => formatShortDate(String(v))}
                  formatter={(value) => [Number(value), "Completed"]}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                  cursor={{ fill: "rgba(27, 175, 122, 0.08)" }}
                />
                <Bar
                  dataKey="count"
                  fill={AQUA}
                  radius={[4, 4, 0, 0]}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Expense breakdown by category</h2>
          {categories.length === 0 ? (
            <p className="text-sm text-gray-500">No expenses yet</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div style={{ width: 160, height: 160 }} className="shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="totalCents"
                      nameKey="category"
                      innerRadius={40}
                      outerRadius={78}
                      paddingAngle={2}
                      animationDuration={600}
                      animationEasing="ease-out"
                    >
                      {categories.map((c, i) => (
                        <Cell key={c.category} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, _name, item) => [formatCents(Number(value)), item.payload.category]}
                      contentStyle={{ fontSize: 12, borderRadius: 6 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 min-w-0 w-full grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {categories.map((c, i) => (
                  <li key={c.category} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0 text-gray-700">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      />
                      <span className="truncate">{c.category}</span>
                    </span>
                    <span className="shrink-0 font-medium text-gray-900">{formatCents(c.totalCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Top groups by spend</h2>
            {topGroups.length === 0 ? (
              <p className="text-sm text-gray-500">No expenses yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="font-medium pb-2">Group</th>
                    <th className="font-medium pb-2 text-right">Expenses</th>
                    <th className="font-medium pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topGroups.map((g) => (
                    <tr key={g.groupId} className="transition-colors hover:bg-gray-50">
                      <td className="py-2 text-gray-900">
                        <Link
                          to={`/groups/${g.groupId}`}
                          className="text-navy-700 transition-colors hover:text-navy-500 hover:underline"
                        >
                          {g.groupName}
                        </Link>
                      </td>
                      <td className="py-2 text-right text-gray-500">{g.expenseCount}</td>
                      <td className="py-2 text-right font-medium text-gray-900">{formatCents(g.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Top users by spend</h2>
            {topUsers.length === 0 ? (
              <p className="text-sm text-gray-500">No expenses yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="font-medium pb-2">User</th>
                    <th className="font-medium pb-2 text-right">Expenses</th>
                    <th className="font-medium pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topUsers.map((u) => (
                    <tr key={u.userId} className="transition-colors hover:bg-gray-50">
                      <td className="py-2 text-gray-900">{u.userName}</td>
                      <td className="py-2 text-right text-gray-500">{u.expenseCount}</td>
                      <td className="py-2 text-right font-medium text-gray-900">{formatCents(u.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-500">No activity yet</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {activity.map((item, i) => (
                <li key={i} className="py-2.5 flex items-center gap-3">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        item.type === "expense" ? ORANGE : item.type === "settlement" ? GREEN : AQUA,
                    }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">
                        <span className="font-medium">{item.userName}</span>{" "}
                        {item.type === "expense"
                          ? "logged an expense"
                          : item.type === "settlement"
                            ? item.description
                            : "completed a chore"}
                        {item.type !== "settlement" && (
                          <>
                            {" — "}
                            {item.description}
                          </>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.groupName} · {formatTimestamp(item.timestamp)}
                      </p>
                    </div>
                    {item.amountCents !== undefined && (
                      <span className="shrink-0 text-sm font-medium text-gray-900">
                        {formatCents(item.amountCents)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-1 mb-3">
            <button
              type="button"
              onClick={() => setDirectoryTab("users")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                directoryTab === "users" ? "bg-navy-50 text-navy-700" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Users
            </button>
            <button
              type="button"
              onClick={() => setDirectoryTab("groups")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                directoryTab === "groups" ? "bg-navy-50 text-navy-700" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Groups
            </button>
          </div>

          {directoryTab === "users" ? (
            <>
              {directoryLoading ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : users.length === 0 ? (
                <p className="text-sm text-gray-500">No users yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="font-medium pb-2">Name</th>
                      <th className="font-medium pb-2">Email</th>
                      <th className="font-medium pb-2">Plan</th>
                      <th className="font-medium pb-2">Signed up</th>
                      <th className="font-medium pb-2">Auth</th>
                      <th className="font-medium pb-2 text-right">Groups</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((u) => (
                      <tr key={u.id} className="transition-colors hover:bg-gray-50">
                        <td className="py-2 text-gray-900">{u.name}</td>
                        <td className="py-2 text-gray-500">{u.email}</td>
                        <td className="py-2">
                          {u.plan === "premium" ? (
                            <span className="text-xs font-medium text-navy-700 bg-navy-50 rounded-full px-2 py-0.5">
                              Premium
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">Free</span>
                          )}
                        </td>
                        <td className="py-2 text-gray-500">{formatShortDate(u.createdAt.slice(0, 10))}</td>
                        <td className="py-2 text-gray-500 capitalize">{u.authMethod}</td>
                        <td className="py-2 text-right text-gray-900">{u.groupCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <PaginationControls
                page={usersPage}
                total={usersTotal}
                pageSize={DIRECTORY_PAGE_SIZE}
                onChange={setUsersPage}
              />
            </>
          ) : (
            <>
              {directoryLoading ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : groups.length === 0 ? (
                <p className="text-sm text-gray-500">No groups yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="font-medium pb-2">Name</th>
                      <th className="font-medium pb-2">Created</th>
                      <th className="font-medium pb-2 text-right">Members</th>
                      <th className="font-medium pb-2 text-right">Expenses</th>
                      <th className="font-medium pb-2 text-right">Chores</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groups.map((g) => (
                      <tr key={g.id} className="transition-colors hover:bg-gray-50">
                        <td className="py-2 text-gray-900">
                          <Link
                            to={`/groups/${g.id}`}
                            className="text-navy-700 transition-colors hover:text-navy-500 hover:underline"
                          >
                            {g.name}
                          </Link>
                        </td>
                        <td className="py-2 text-gray-500">{formatShortDate(g.createdAt.slice(0, 10))}</td>
                        <td className="py-2 text-right text-gray-900">{g.memberCount}</td>
                        <td className="py-2 text-right text-gray-900">{g.expenseCount}</td>
                        <td className="py-2 text-right text-gray-900">{g.choreCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <PaginationControls
                page={groupsPage}
                total={groupsTotal}
                pageSize={DIRECTORY_PAGE_SIZE}
                onChange={setGroupsPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
