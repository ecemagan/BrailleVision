import Link from "next/link";

const featureCards = [
  {
    title: "Smart conversion workspace",
    description: "Paste text directly or upload .txt, .pdf, and image files with readability suggestions before saving.",
  },
  {
    title: "Search, tags, and bulk actions",
    description: "Filter by archive, favorite, date, source, and mode, then tag, export, or archive documents in bulk.",
  },
  {
    title: "Personalized dashboard",
    description: "Choose dark or light mode, theme accent, default view, and card density for your own Braille workspace.",
  },
];

export default function HomePage() {
  return (
    <main className="page-shell flex items-center justify-center">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.3fr_0.9fr]">
        <section className="surface-card hero-wash rounded-[32px] p-8 md:p-12">
          <div className="mb-6 inline-flex rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
            Braille Vision Dashboard
          </div>
          <h1 className="font-display max-w-3xl text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
            A focused workspace for converting text into Braille and saving every result.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Sign in with Supabase Auth, upload text, documents, or photos, generate Braille output for text and math,
            and keep a searchable personal archive with stats, exports, and keyboard shortcuts inside the dashboard.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="button-primary rounded-full px-6 py-3 font-semibold transition"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="button-secondary rounded-full px-6 py-3 font-semibold transition"
            >
              Log in
            </Link>
          </div>
        </section>

        <section className="grid gap-4">
          {featureCards.map((card) => (
            <article key={card.title} className="surface-card surface-soft rounded-[28px] p-6">
              <p className="accent-label text-sm font-semibold uppercase tracking-[0.22em]">Feature</p>
              <h2 className="font-display mt-3 text-2xl font-bold text-slate-950">{card.title}</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">{card.description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
