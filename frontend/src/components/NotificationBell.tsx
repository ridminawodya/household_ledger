import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Notification } from "../lib/api";
import { formatCents } from "../lib/money";

const POLL_INTERVAL_MS = 30000;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function notificationText(n: Notification): string {
  switch (n.type) {
    case "expense_added":
      return `${n.actorName} added an expense: ${n.message}`;
    case "chore_assigned":
      return `${n.message} was assigned to you`;
    case "chore_completed":
      return `${n.actorName} completed: ${n.message}`;
    default:
      return n.message;
  }
}

function notificationDotColor(type: Notification["type"]): string {
  switch (type) {
    case "expense_added":
      return "bg-orange-400";
    case "chore_completed":
      return "bg-green-500";
    case "chore_assigned":
    default:
      return "bg-navy-400";
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function refreshCount() {
      api.getUnreadNotificationCount().then((r) => setUnreadCount(r.count)).catch(() => {});
    }
    refreshCount();
    const interval = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      api.listNotifications().then(setNotifications).catch(() => setNotifications([]));
    }
  }

  async function handleMarkAllRead() {
    await api.markAllNotificationsRead();
    setUnreadCount(0);
    setNotifications((prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null);
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.readAt) {
      await api.markNotificationRead(n.id);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? null
      );
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative text-gray-600 transition-colors hover:text-gray-900"
        aria-label="Notifications"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-semibold text-white animate-pop">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-lg shadow-xl border border-gray-100 z-30 animate-scale-in origin-top-right">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-navy-600 transition-colors hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications === null && <p className="px-4 py-6 text-sm text-gray-500 text-center">Loading…</p>}
            {notifications !== null && notifications.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-500 text-center">No notifications yet.</p>
            )}
            {notifications?.map((n) => (
              <Link
                key={n.id}
                to={`/groups/${n.groupId}`}
                onClick={() => handleNotificationClick(n)}
                className={`flex items-start gap-2.5 px-4 py-2.5 border-b border-gray-50 last:border-0 transition-colors hover:bg-gray-50 ${
                  !n.readAt ? "bg-navy-50/50" : ""
                }`}
              >
                <span
                  className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${notificationDotColor(n.type)}`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm text-gray-900">
                    {notificationText(n)}
                    {n.amountCents !== null && (
                      <span className="font-medium"> ({formatCents(n.amountCents)})</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {n.group.name} · {formatTimestamp(n.createdAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
