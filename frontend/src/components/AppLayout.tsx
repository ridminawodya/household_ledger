import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { api, GROUPS_CHANGED_EVENT, type Group } from "../lib/api";

const groupNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
    isActive
      ? "bg-navy-100 text-navy-700"
      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
  }`;

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { groupId } = useParams<{ groupId: string }>();

  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    function refresh() {
      api.listGroups().then(setGroups).catch(() => setGroups([]));
    }
    refresh();
    window.addEventListener(GROUPS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(GROUPS_CHANGED_EVENT, refresh);
  }, [location.pathname]);

  function handleSwitchGroup(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value) navigate(`/groups/${e.target.value}`);
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/groups"
            className="text-sm font-semibold text-gray-900 transition-opacity hover:opacity-70"
          >
            Household Ledger
          </Link>
          <div className="flex items-center gap-3">
            {groups.length > 0 && (
              <select
                value={groupId ?? ""}
                onChange={handleSwitchGroup}
                className="animate-scale-in rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 outline-none transition-all focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
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
            {user?.isAdmin && (
              <Link
                to="/admin"
                className="text-xs text-gray-600 transition-colors hover:text-gray-900"
              >
                Admin
              </Link>
            )}
            <Link
              to="/billing"
              className={
                user?.plan === "premium"
                  ? "text-xs font-medium text-navy-700 bg-navy-50 rounded-full px-2 py-0.5 transition-colors hover:bg-navy-100"
                  : "text-xs text-gray-600 transition-colors hover:text-gray-900"
              }
            >
              {user?.plan === "premium" ? "Premium" : "Upgrade"}
            </Link>
            <span className="text-xs text-gray-500 hidden sm:inline">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-600 transition-colors hover:text-gray-900"
            >
              Log out
            </button>
          </div>
        </div>

        {groupId && (
          <nav className="max-w-2xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
            <NavLink to={`/groups/${groupId}`} end className={groupNavLinkClass}>
              Overview
            </NavLink>
            <NavLink to={`/groups/${groupId}/expenses`} className={groupNavLinkClass}>
              Expenses
            </NavLink>
            <NavLink to={`/groups/${groupId}/settle-up`} className={groupNavLinkClass}>
              Settle Up
            </NavLink>
            <NavLink to={`/groups/${groupId}/chores`} className={groupNavLinkClass}>
              Chores
            </NavLink>
          </nav>
        )}
      </header>

      <div key={location.pathname} className="animate-fade-in">
        <Outlet />
      </div>
    </div>
  );
}
