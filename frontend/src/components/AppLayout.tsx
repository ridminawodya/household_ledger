import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { api, GROUPS_CHANGED_EVENT, type Group } from "../lib/api";
import NotificationBell from "./NotificationBell";

function GroupsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75V21a1 1 0 01-1 1h-4.5a1 1 0 01-1-1v-4.5a1 1 0 00-1-1h-3a1 1 0 00-1 1V21a1 1 0 01-1 1H4a1 1 0 01-1-1V9.75z" />
    </svg>
  );
}

function ExpensesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m4-9.5c0-1.38-1.79-2.5-4-2.5s-4 1.12-4 2.5S9.79 11 12 11s4 1.12 4 2.5-1.79 2.5-4 2.5-4-1.12-4-2.5" />
    </svg>
  );
}

function SettleUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10l-4 4m0 0l4 4m-4-4h16M17 6l4 4m0 0l-4 4m4-4H5" />
    </svg>
  );
}

function ChoresIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11l3 3L22 4M5 12l3 3L9 12M2 12l3 3" />
    </svg>
  );
}

const TABS = [
  { to: "", label: "Overview", icon: GroupsIcon, end: true },
  { to: "/expenses", label: "Expenses", icon: ExpensesIcon, end: false },
  { to: "/settle-up", label: "Settle Up", icon: SettleUpIcon, end: false },
  { to: "/chores", label: "Chores", icon: ChoresIcon, end: false },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { groupId } = useParams<{ groupId: string }>();

  const [groups, setGroups] = useState<Group[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function refresh() {
      api.listGroups().then(setGroups).catch(() => setGroups([]));
    }
    refresh();
    window.addEventListener(GROUPS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(GROUPS_CHANGED_EVENT, refresh);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function handleSwitchGroup(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value) navigate(`/groups/${e.target.value}`);
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <header
        className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur-sm"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-2.5">
          <Link to="/groups" className="flex items-center gap-2 transition-opacity hover:opacity-70">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-600 text-sm shadow-sm">
              🏠
            </span>
            <span className="hidden text-sm font-semibold text-gray-900 sm:inline">
              Household Ledger
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            {groups.length > 0 && (
              <select
                value={groupId ?? ""}
                onChange={handleSwitchGroup}
                aria-label="Switch group"
                className="max-w-[9rem] animate-scale-in rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none transition-all focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
              >
                <option value="" disabled>
                  Switch group…
                </option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}

            {!user?.isAdmin && <NotificationBell />}

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Account menu"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-50 text-sm font-semibold text-navy-700 transition-colors hover:bg-navy-100"
              >
                {user?.name?.[0]?.toUpperCase() ?? "?"}
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-30 mt-2 w-52 origin-top-right animate-scale-in rounded-lg border border-gray-100 bg-white py-1.5 shadow-xl">
                  <div className="border-b border-gray-50 px-4 py-2">
                    <p className="truncate text-sm font-medium text-gray-900">{user?.name}</p>
                  </div>
                  {user?.isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Admin dashboard
                    </Link>
                  )}
                  {!user?.isAdmin && (
                    <Link
                      to="/billing"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Billing
                      {user?.plan === "premium" && (
                        <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-700">
                          Premium
                        </span>
                      )}
                    </Link>
                  )}
                  {!user?.isAdmin && (
                    <Link
                      to="/account"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Account
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div
        key={location.pathname}
        className="animate-fade-in"
        style={{ paddingBottom: groupId ? "calc(4rem + env(safe-area-inset-bottom))" : undefined }}
      >
        <Outlet />
      </div>

      {groupId && (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur-sm"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex max-w-2xl">
            {TABS.map((tab) => (
              <NavLink
                key={tab.label}
                to={`/groups/${groupId}${tab.to}`}
                end={tab.end}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                    isActive ? "text-navy-600" : "text-gray-400 hover:text-gray-600"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <tab.icon className={`h-6 w-6 transition-transform ${isActive ? "scale-105" : ""}`} />
                    {tab.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
