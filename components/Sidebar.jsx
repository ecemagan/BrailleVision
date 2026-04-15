"use client";

import Link from "next/link";

const navigationItems = [
  { key: "overview", label: "Overview" },
  { key: "upload", label: "Convert" },
  { key: "documents", label: "Library" },
  { key: "settings", label: "Settings" },
];

export function Sidebar({
  activeTab,
  onLogout,
  userEmail,
  profile,
  density = "comfortable",
}) {
  const isCompact = density === "compact";

  return (
    <aside
      className={`surface-card ${isCompact ? "rounded-[24px] p-4 md:p-5" : "rounded-[28px] p-5 md:p-6"} md:sticky md:top-6 md:h-[calc(100vh-48px)]`}
    >
      <div className="border-b border-slate-200 pb-5">
        <p className="section-kicker">Braille Vision</p>
        <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">Workspace</h2>
        <p className="mt-3 text-sm font-semibold text-slate-900">{profile?.display_name || userEmail}</p>
        <p className="mt-1 text-sm text-slate-600">{userEmail}</p>
      </div>

      <nav className="mt-6 space-y-2">
        {navigationItems.map((item) => {
          const isActive = activeTab === item.key;

          return (
            <Link
              key={item.key}
              href={`/dashboard?tab=${item.key}`}
              className={`block rounded-[20px] px-4 py-3 transition ${
                isActive ? "button-primary text-white" : "panel-subtle text-slate-800 hover:border-violet-200"
              }`}
            >
              <p className="text-sm font-semibold">{item.label}</p>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className="button-secondary mt-6 w-full rounded-[20px] px-4 py-3 text-left text-sm font-semibold transition"
      >
        Logout
      </button>
    </aside>
  );
}
