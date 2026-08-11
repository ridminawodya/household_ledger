export default function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-dot-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black_10%,transparent_70%)]" />

      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-navy-200/50 blur-3xl animate-fade-in" />
      <div
        className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-navy-200/40 blur-3xl animate-fade-in"
        style={{ animationDelay: "150ms" }}
      />
      <div
        className="absolute bottom-[-6rem] left-1/4 h-64 w-64 rounded-full bg-navy-100/60 blur-3xl animate-fade-in"
        style={{ animationDelay: "300ms" }}
      />

      <div
        className="absolute left-[8%] top-[18%] flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-2xl shadow-sm ring-1 ring-black/5 backdrop-blur-sm animate-float-slow"
        aria-hidden="true"
      >
        💸
      </div>
      <div
        className="absolute right-[10%] top-[22%] flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-xl shadow-sm ring-1 ring-black/5 backdrop-blur-sm animate-float-slower"
        style={{ animationDelay: "1.5s" }}
        aria-hidden="true"
      >
        🧹
      </div>
      <div
        className="absolute left-[12%] bottom-[16%] flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-xl shadow-sm ring-1 ring-black/5 backdrop-blur-sm animate-float-slower"
        style={{ animationDelay: "0.7s" }}
        aria-hidden="true"
      >
        🧮
      </div>
      <div
        className="absolute right-[14%] bottom-[20%] flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-2xl shadow-sm ring-1 ring-black/5 backdrop-blur-sm animate-float-slow"
        style={{ animationDelay: "2.2s" }}
        aria-hidden="true"
      >
        ✨
      </div>
    </div>
  );
}
