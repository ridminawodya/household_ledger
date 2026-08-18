import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const SLIDES = [
  {
    icon: "💸",
    title: "Split expenses, evenly and fairly",
    description:
      "Log what you paid and it's automatically split across the group. Every amount is stored as integer cents, so there's never a rounding surprise.",
  },
  {
    icon: "🧮",
    title: "Settle up in the fewest payments",
    description:
      "Not \"everyone pays everyone.\" A debt-simplification algorithm nets every balance so the group settles in the minimum number of transactions.",
  },
  {
    icon: "✨",
    title: "Describe an expense in plain English",
    description:
      "Type \"paid $85 for groceries last night\" and AI turns it into a structured entry for you to review before anything is saved.",
  },
  {
    icon: "🧹",
    title: "Chores that rotate themselves",
    description:
      "Assign chores with due dates. Turn on auto-assign and the next person automatically gets the next cycle.",
  },
];

const AUTOPLAY_INTERVAL_MS = 3500;
const AUTOPLAY_RESUME_DELAY_MS = 6000;

export default function LandingPage() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);
  const resumeTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      if (isProgrammaticScroll.current) return;
      const index = Math.round(el.scrollLeft / el.clientWidth);
      setActive((prev) => (prev === index ? prev : index));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function goTo(index: number) {
    const el = trackRef.current;
    if (!el) return;
    isProgrammaticScroll.current = true;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    setActive(index);
    window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 400);
  }

  // Auto-advance slides, pausing whenever the user swipes/drags manually.
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % SLIDES.length;
        goTo(next);
        return next;
      });
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  function pauseThenResume() {
    setPaused(true);
    window.clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = window.setTimeout(() => {
      setPaused(false);
    }, AUTOPLAY_RESUME_DELAY_MS);
  }

  useEffect(() => {
    return () => window.clearTimeout(resumeTimeoutRef.current);
  }, []);

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-gradient-to-b from-navy-50 via-white to-white">
      {/* Ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-dot-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black_10%,transparent_65%)]" />
        <div className="absolute left-1/2 top-[-140px] h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-navy-200/50 blur-3xl animate-fade-in" />
      </div>

      {/* Top bar: brand only, no site nav */}
      <div
        className="flex items-center justify-center px-6 pb-2"
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-navy-600 text-base shadow-sm">
            🏠
          </span>
          <span className="text-sm font-semibold text-gray-900">Household Ledger</span>
        </div>
      </div>

      {/* Headline */}
      <div className="px-6 pt-6 text-center animate-slide-up">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
          Split the bills.
          <br />
          <span className="bg-gradient-to-r from-navy-500 to-navy-800 bg-clip-text text-transparent">
            Split the chores.
          </span>
          <br />
          Skip the arguments.
        </h1>
      </div>

      {/* Swipeable feature carousel fills remaining space */}
      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <div
          ref={trackRef}
          onPointerDown={pauseThenResume}
          className="flex flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SLIDES.map((s) => (
            <div
              key={s.title}
              className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-8 text-center"
            >
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-4xl shadow-sm ring-1 ring-black/5">
                {s.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{s.title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-500">
                {s.description}
              </p>
            </div>
          ))}
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 py-4">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => {
                pauseThenResume();
                goTo(i);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-6 bg-navy-600" : "w-1.5 bg-navy-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Bottom-anchored CTAs, native-app style */}
      <div
        className="px-6 pb-6 pt-2"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <Link
          to="/signup"
          className="flex w-full items-center justify-center rounded-full bg-navy-600 px-5 py-3.5 text-base font-semibold text-white shadow-sm transition-all active:scale-[0.98] active:bg-navy-700"
        >
          Get started free
        </Link>
        <Link
          to="/login"
          className="mt-3 flex w-full items-center justify-center rounded-full bg-transparent px-5 py-3.5 text-base font-semibold text-navy-700 transition-all active:scale-[0.98] active:bg-navy-50"
        >
          I already have an account
        </Link>
      </div>
    </div>
  );
}
