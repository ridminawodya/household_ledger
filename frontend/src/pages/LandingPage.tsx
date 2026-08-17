import { Link } from "react-router-dom";

const FEATURES = [
  {
    title: "Split expenses, evenly and fairly",
    description:
      "Log what you paid — rent, groceries, utilities — and it's automatically split across everyone in the group. Attach a receipt photo, set it to repeat monthly, or edit it later — every amount is stored as integer cents, so there's never a rounding surprise.",
    icon: "💸",
  },
  {
    title: "Settle up in the fewest payments possible",
    description:
      "Not \"everyone pays everyone.\" A real debt-simplification algorithm nets every balance and greedily matches the largest creditor with the largest debtor, so N people settle in at most N−1 transactions — the mathematical minimum.",
    icon: "🧮",
  },
  {
    title: "Describe an expense in plain English",
    description:
      "Type \"paid $85 for groceries and pizza last night\" and Claude parses it into a structured entry — amount, category, description — for you to review and confirm before anything is saved. The AI never writes to your ledger on its own.",
    icon: "✨",
  },
  {
    title: "Chores that rotate themselves",
    description:
      "Assign chores with due dates, see whose turn it is at a glance, and mark things done. Turn on auto-assign and the next person in the household automatically gets the next cycle — no more \"whose turn is it to take out the trash\" arguments.",
    icon: "🧹",
  },
  {
    title: "Know when something happens",
    description:
      "In-app notifications when a roommate logs an expense or hands you a chore, so nothing sits unnoticed until settle-up day.",
    icon: "🔔",
  },
  {
    title: "A monthly paper trail",
    description:
      "Export a PDF of everything that happened in your household for any given month — every expense, every payment, every completed chore — in one download.",
    icon: "📄",
  },
];

const STEPS = [
  { step: "1", title: "Create or join a group", desc: "Start a household group, or join one with an invite code." },
  { step: "2", title: "Log an expense", desc: "Type it manually, or describe it in plain English and let AI fill in the details." },
  { step: "3", title: "Track chores", desc: "Assign chores with due dates and see whose turn it is." },
  { step: "4", title: "Settle up", desc: "See the minimum number of payments needed to clear every balance." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Hero */}
      <header className="relative z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Household Ledger</span>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-md bg-navy-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-navy-500 hover:shadow-md active:scale-95"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="relative">
        {/* Ambient gradient blobs */}
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden">
          <div className="absolute left-1/2 top-[-120px] h-[480px] w-[480px] -translate-x-[60%] rounded-full bg-navy-200/50 blur-3xl animate-fade-in" />
          <div
            className="absolute left-1/2 top-[-60px] h-[420px] w-[420px] translate-x-[10%] rounded-full bg-navy-200/40 blur-3xl animate-fade-in"
            style={{ animationDelay: "150ms" }}
          />
        </div>

        <section className="max-w-4xl mx-auto px-4 pt-16 pb-12 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight animate-slide-up">
            Split the bills.
            <br />
            <span className="bg-gradient-to-r from-navy-500 to-navy-800 bg-clip-text text-transparent">
              Split the chores.
            </span>
            <br />
            Skip the arguments.
          </h1>
          <p
            className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto animate-slide-up"
            style={{ animationDelay: "100ms" }}
          >
            A shared expense-and-chore tracker for roommates — combining money and
            chores in one place, with an AI assistant that turns "I paid $85 for
            groceries" into a structured entry, an algorithm that finds the
            fewest payments needed to settle up, and self-rotating chores so
            nobody has to remember whose turn it is.
          </p>
          <div
            className="mt-8 flex items-center justify-center gap-3 animate-slide-up"
            style={{ animationDelay: "200ms" }}
          >
            <Link
              to="/signup"
              className="rounded-md bg-navy-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-navy-500 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
            >
              Get started free
            </Link>
            <Link
              to="/login"
              className="rounded-md bg-white border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-900 transition-all hover:bg-gray-50 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
            >
              Log in
            </Link>
          </div>
        </section>

        {/* Feature grid */}
        <section className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="group bg-white rounded-lg shadow p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 animate-slide-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="text-2xl mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 inline-block">
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-10 animate-slide-up">
            How it works
          </h2>
          <div className="relative grid grid-cols-1 sm:grid-cols-4 gap-8 sm:gap-6">
            <div className="pointer-events-none absolute left-0 right-0 top-4.5 hidden sm:block h-px bg-gradient-to-r from-transparent via-navy-200 to-transparent" />
            {STEPS.map((s, i) => (
              <div
                key={s.step}
                className="relative text-center animate-slide-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-navy-600 text-sm font-semibold text-white shadow-sm ring-4 ring-gray-50 transition-transform duration-300 hover:scale-110">
                  {s.step}
                </div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">{s.title}</h4>
                <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-4xl mx-auto px-4 pb-20 text-center">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-navy-500 to-navy-800 px-6 py-12 sm:px-12 shadow-lg animate-scale-in">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -left-6 -bottom-10 h-32 w-32 rounded-full bg-white/10" />
            <h2 className="text-2xl font-semibold text-white">
              Ready to stop splitting bills in your head?
            </h2>
            <p className="mt-2 text-sm text-navy-100">
              It takes about a minute to create an account and your first group.
            </p>
            <Link
              to="/signup"
              className="mt-6 inline-block rounded-md bg-white px-5 py-3 text-sm font-semibold text-navy-600 shadow-sm transition-all hover:bg-navy-50 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
            >
              Create your account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-6">
        <p className="text-center text-xs text-gray-400">Household Ledger</p>
      </footer>
    </div>
  );
}
