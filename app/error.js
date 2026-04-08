"use client";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body className="page-shell flex items-center justify-center">
        <div className="surface-card w-full max-w-xl rounded-[28px] p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-700">Application error</p>
          <h2 className="font-display mt-3 text-3xl font-bold text-slate-950">Something went wrong.</h2>
          <p className="mt-4 text-slate-600">{error?.message || "An unexpected error occurred."}</p>
          <button
            type="button"
            onClick={() => reset()}
            className="button-primary mt-6 rounded-full px-5 py-3 font-semibold transition"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
