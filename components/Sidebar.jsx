"use client";

import Link from "next/link";

const navigationItems = [
  { key: "overview", label: "Dashboard" },
  { key: "upload", label: "Upload Document" },
  { key: "documents", label: "My Documents" },
];

export function Sidebar({ activeTab, onLogout, userEmail, profile }) {
  return (
    <aside className="surface-card rounded-[28px] p-4 md:sticky md:top-6 md:h-[calc(100vh-48px)] md:p-6">
      <div className="mb-6">
        <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Braille Vision</p>
        <h2 className="font-display mt-2 text-2xl font-bold text-slate-950">Dashboard</h2>
        <p className="mt-2 text-sm font-semibold text-slate-800">{profile?.display_name || userEmail}</p>
        <p className="mt-1 text-sm text-slate-600">{userEmail}</p>
      </div>

      <div className="mb-6 rounded-[24px] border border-violet-100 bg-violet-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Workspace profile</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            Role: {profile?.role || "member"}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            Density: {profile?.preferences?.dashboardDensity || "comfortable"}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            View: {profile?.preferences?.documentView || "library"}
          </span>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto md:flex-col">
        {navigationItems.map((item) => {
          const isActive = activeTab === item.key;

          return (
            <Link
              key={item.key}
              href={`/dashboard?tab=${item.key}`}
              className={`min-w-fit rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                isActive
                  ? "button-primary text-white"
                  : "button-secondary text-slate-700"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className="button-secondary mt-6 w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition"
      >
        Logout
      </button>
    </aside>
  );
}
