"use client";

export function GraphResultCard({ eyebrow, title, actions = null, children, className = "" }) {
  return (
    <article className={`surface-card rounded-[28px] p-6 md:p-7 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow ? <p className="section-kicker">{eyebrow}</p> : null}
          <h3 className="mt-2 text-3xl font-bold text-slate-950">{title}</h3>
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </article>
  );
}
