"use client";

import { useMemo, useState } from "react";

const REGION_LABELS = {
  main: "Main",
  sidebar_left: "Sidebar Left",
  sidebar_right: "Sidebar Right",
};

const TYPE_STROKES = {
  paragraph: "#0f172a",
  equation_group: "#0f766e",
  example: "#c2410c",
  sidebar_note: "#7c3aed",
  graph_placeholder: "#1d4ed8",
  table_placeholder: "#1d4ed8",
};

function formatBBox(bbox) {
  if (!bbox) {
    return "no bbox";
  }

  return `x:${Math.round(bbox.x0)}-${Math.round(bbox.x1)} y:${Math.round(bbox.y0)}-${Math.round(bbox.y1)}`;
}

function typeStroke(type) {
  return TYPE_STROKES[type] || "#475569";
}

function PageMiniMap({ page }) {
  const width = page?.debug?.pageWidth || page?.layout?.width || 0;
  const height = page?.debug?.pageHeight || page?.layout?.height || 0;

  if (!width || !height) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        Bounding-box preview is only available for layout-backed PDF pages.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full bg-[radial-gradient(circle_at_top,rgba(241,245,249,0.9),rgba(255,255,255,1))]">
        <rect x="0" y="0" width={width} height={height} fill="white" />

        {page.debug?.orderedLines?.map((line) =>
          line.bbox ? (
            <rect
              key={line.id}
              x={line.bbox.x0}
              y={height - line.bbox.y1}
              width={Math.max(1, line.bbox.x1 - line.bbox.x0)}
              height={Math.max(1, line.bbox.y1 - line.bbox.y0)}
              fill={line.regionKind === "main" ? "rgba(148,163,184,0.18)" : "rgba(196,181,253,0.28)"}
              stroke="none"
            />
          ) : null,
        )}

        {page.debug?.blocks?.map((block) =>
          block.bbox ? (
            <g key={block.id}>
              <rect
                x={block.bbox.x0}
                y={height - block.bbox.y1}
                width={Math.max(1, block.bbox.x1 - block.bbox.x0)}
                height={Math.max(1, block.bbox.y1 - block.bbox.y0)}
                fill="none"
                stroke={typeStroke(block.type)}
                strokeWidth="2"
                rx="4"
              />
              <text
                x={block.bbox.x0 + 4}
                y={Math.max(12, height - block.bbox.y1 + 12)}
                fontSize="11"
                fill={typeStroke(block.type)}
              >
                {block.order + 1}
              </text>
            </g>
          ) : null,
        )}
      </svg>
    </div>
  );
}

function BlockCard({ block }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(148,163,184,0.08)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {String(block.order + 1).padStart(2, "0")}
        </span>
        <span className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white" style={{ backgroundColor: typeStroke(block.type) }}>
          {block.type}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
          {REGION_LABELS[block.regionKind] || block.regionKind}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
          {Math.round((block.confidence || 0) * 100)}%
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-500">
        <p>{formatBBox(block.bbox)}</p>
        <p>Source lines: {(block.sourceLineIds || []).join(", ") || "n/a"}</p>
      </div>

      <pre className="mt-3 whitespace-pre-wrap break-words rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800">
        {block.originalContent}
      </pre>

      {block.children?.length ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Children</p>
          <div className="mt-2 grid gap-2">
            {block.children.map((child) => (
              <div key={child.id} className="rounded-xl border border-white bg-white px-3 py-2 text-sm text-slate-700">
                <span className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{child.type}</span>
                {child.originalContent}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PageSegmentationDebugPanel({ pages = [] }) {
  const [activePageNumber, setActivePageNumber] = useState(null);

  const currentPage = useMemo(() => {
    if (!pages.length) {
      return null;
    }

    return pages.find((page) => page.pageNumber === activePageNumber) || pages[0];
  }, [activePageNumber, pages]);

  if (!pages.length || !currentPage?.debug) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="surface-card rounded-[28px] p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="section-kicker">Developer Debug</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Page segmentation inspector</h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Compare ordered layout lines, detected regions, and final block order on representative PDF pages.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {pages.map((page) => {
              const active = currentPage.pageNumber === page.pageNumber;
              return (
                <button
                  key={page.pageNumber}
                  type="button"
                  onClick={() => setActivePageNumber(page.pageNumber)}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    active ? "button-primary" : "button-secondary",
                  ].join(" ")}
                >
                  {`Page ${page.pageNumber}`}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="info-chip rounded-full px-3 py-1 text-xs font-semibold">
            {currentPage.debug.orderedLines?.length || 0} ordered lines
          </span>
          <span className="info-chip rounded-full px-3 py-1 text-xs font-semibold">
            {currentPage.debug.blocks?.length || 0} blocks
          </span>
          <span className="info-chip rounded-full px-3 py-1 text-xs font-semibold">
            {currentPage.debug.regions?.length || 0} regions
          </span>
        </div>
      </div>

      <PageMiniMap page={currentPage} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-3">
          <div className="surface-card rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Detected Blocks</p>
          </div>
          {currentPage.debug.blocks.map((block) => (
            <BlockCard key={block.id} block={block} />
          ))}
        </div>

        <div className="space-y-3">
          <div className="surface-card rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ordered Layout Lines</p>
          </div>
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_32px_rgba(148,163,184,0.08)]">
            <div className="divide-y divide-slate-200">
              {currentPage.debug.orderedLines.map((line) => (
                <div key={line.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                      {line.id}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                      {REGION_LABELS[line.regionKind] || line.regionKind}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                      {formatBBox(line.bbox)}
                    </span>
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">{line.text}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
