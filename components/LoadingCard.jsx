export function LoadingCard({ title, description }) {
  return (
    <main className="page-shell flex items-center justify-center">
      <div className="surface-card w-full max-w-xl rounded-[28px] p-8">
        <div className="mb-5 h-10 w-10 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
        <h1 className="font-display text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-slate-600">{description}</p>
      </div>
    </main>
  );
}
