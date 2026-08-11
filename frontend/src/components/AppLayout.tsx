import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { api, GROUPS_CHANGED_EVENT, type Group } from "../lib/api";

const groupNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 text-sm font-medium rounded-md ${
    isActive ? "bg-indigo-100 text-indigo-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
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
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/groups" className="text-sm font-semibold text-gray-900">
            Household Ledger
          </Link>
          <div className="flex items-center gap-3">
            {groups.length > 0 && (
              <select
                value={groupId ?? ""}
                onChange={handleSwitchGroup}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <span className="text-xs text-gray-500 hidden sm:inline">{user?.name}</span>
            <button onClick={handleLogout} className="text-xs text-gray-600 hover:text-gray-900">
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

      <Outlet />
    </div>
  );
}
