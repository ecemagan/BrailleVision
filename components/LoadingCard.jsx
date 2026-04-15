export function LoadingCard({ title, description }) {
  return (
    <main className="page-shell flex items-center justify-center">
      <div className="surface-card w-full max-w-xl rounded-[28px] p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-violet-50">
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-violet-200 border-t-violet-600" />
        </div>
        <h1 className="font-display text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 max-w-lg text-slate-600">{description}</p>
      </div>
    </main>
  );
}
