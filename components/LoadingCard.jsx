export function LoadingCard({ title, description }) {
  return (
    <main className="page-shell flex items-center justify-center">
      <section className="surface-card w-full max-w-xl rounded-2xl p-8">
        <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-violet-50">
          <span className="block h-6 w-6 animate-spin rounded-full border-[3px] border-violet-200 border-t-violet-600" />
        </span>
        <h1 className="font-display text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 max-w-lg text-slate-600">{description}</p>
      </section>
    </main>
  );
}
