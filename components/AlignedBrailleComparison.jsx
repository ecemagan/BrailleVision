"use client";

import { useMemo, useState } from "react";
import { buildAlignedBrailleRows } from "@/lib/alignedBrailleRows";
import { formatOriginalLineForDisplay } from "@/lib/mathDisplayFormatting";

function Token({ value, isActive, onEnter, onLeave, onClick, interactive, className, trailingSpace = false }) {
  if (!value) {
    return <span className="inline-block min-w-6 opacity-30">&nbsp;</span>;
  }

  if (!interactive) {
    return (
      <span className={className}>
        {value}
        {trailingSpace ? " " : ""}
      </span>
    );
  }

  return (
    <span className="inline">
      <button
        type="button"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
        onClick={onClick}
        className={[
          className,
          "inline rounded-xl text-left align-baseline outline-none transition duration-200",
          isActive
            ? "bg-amber-100 text-slate-950 ring-2 ring-amber-300 shadow-[0_10px_24px_rgba(245,158,11,0.18)]"
            : "hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:ring-2 focus-visible:ring-amber-300",
        ].join(" ")}
      >
        {value}
      </button>
      {trailingSpace ? " " : ""}
    </span>
  );
}

function NotesPanel({ title, notes }) {
  if (!notes.length) {
    return null;
  }

  return (
    <div className="rounded-[28px] border border-violet-200 bg-[linear-gradient(135deg,rgba(245,243,255,0.92),rgba(255,255,255,0.98))] p-5">
      <p className="section-kicker">{title}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {notes.map((note) => (
          <div key={note} className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-[0_10px_24px_rgba(148,163,184,0.08)]">
            <p className="text-sm leading-7 text-slate-700">{note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlignedBrailleComparison({
  originalText,
  brailleText,
  originalLabel,
  brailleLabel,
  notesTitle,
  notes = [],
  wordsPerRow = 10,
  interactive = true,
  compact = false,
  mode = "line_preserved",
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [pinnedIndex, setPinnedIndex] = useState(null);
  const rows = useMemo(
    () => buildAlignedBrailleRows(originalText, brailleText, { wordsPerRow }),
    [brailleText, originalText, wordsPerRow],
  );
  const activeIndex = pinnedIndex ?? hoveredIndex;
  const isParagraphLike = mode !== "line_preserved";

  function handleEnter(index) {
    if (pinnedIndex === null) {
      setHoveredIndex(index);
    }
  }

  function handleLeave() {
    if (pinnedIndex === null) {
      setHoveredIndex(null);
    }
  }

  function handleClick(index) {
    if (!interactive) {
      return;
    }

    setPinnedIndex((current) => (current === index ? null : index));
    setHoveredIndex(null);
  }

  return (
    <section className="space-y-4">
      <NotesPanel title={notesTitle} notes={notes} />

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-[0_18px_46px_rgba(148,163,184,0.12)]">
        <div className="hidden grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)] border-b border-slate-200 bg-slate-50/90 lg:grid">
          <div className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Row</div>
          <div className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{originalLabel}</div>
          <div className="border-l border-slate-200 bg-amber-50/70 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-900">{brailleLabel}</div>
        </div>

        <div className="divide-y divide-slate-200">
          {rows.map((row) => (
            <div key={row.id} className="grid lg:grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 lg:justify-center lg:border-b-0">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                  {String(row.rowNumber).padStart(2, "0")}
                </span>
                <div className="grid gap-1 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 lg:hidden">
                  <span>{originalLabel}</span>
                  <span className="text-amber-800">{brailleLabel}</span>
                </div>
              </div>

              <div className="border-b border-slate-200 bg-white px-4 py-4 lg:border-b-0 lg:px-5">
                <div className="overflow-x-auto">
                  {(() => {
                    const formattedOriginalLines = formatOriginalLineForDisplay(row.originalText);

                    if (formattedOriginalLines.length > 1) {
                      return (
                        <div
                          className={
                            compact
                              ? "min-w-0 whitespace-pre-wrap break-words font-mono text-sm leading-7 text-slate-700"
                              : "min-w-0 whitespace-pre-wrap break-words font-mono text-base leading-8 text-slate-800"
                          }
                        >
                          {formattedOriginalLines.map((displayLine, lineIndex) => (
                            <div key={`${row.id}_display_${lineIndex + 1}`}>{displayLine || " "}</div>
                          ))}
                        </div>
                      );
                    }

                    return (
                      <div
                        className={
                          compact
                            ? `min-w-0 text-sm leading-7 text-slate-700 ${isParagraphLike ? "whitespace-normal break-words" : ""}`
                            : `min-w-0 text-base leading-8 text-slate-800 ${isParagraphLike ? "whitespace-normal break-words" : ""}`
                        }
                      >
                        {row.tokenPairs.map((pair, index) => (
                          <Token
                            key={`original_${pair.id}`}
                            value={pair.original}
                            interactive={interactive}
                            isActive={activeIndex === pair.index}
                            onEnter={() => handleEnter(pair.index)}
                            onLeave={handleLeave}
                            onClick={() => handleClick(pair.index)}
                            trailingSpace={index < row.tokenPairs.length - 1}
                            className="px-0.5 py-0.5 font-medium"
                          />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="border-t border-amber-100 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,247,237,0.98))] px-4 py-4 lg:border-l lg:border-t-0 lg:border-amber-200 lg:px-5">
                <div className="overflow-x-auto">
                  <div
                    className={
                      compact
                        ? isParagraphLike
                          ? "min-w-0 text-lg leading-8 text-slate-950 whitespace-normal break-words"
                          : "flex min-w-max gap-2 text-lg leading-8 text-slate-950"
                        : isParagraphLike
                          ? "min-w-0 text-[1.5rem] leading-10 text-slate-950 whitespace-normal break-words"
                          : "flex min-w-max gap-3 text-[1.5rem] leading-10 text-slate-950"
                    }
                  >
                    {row.tokenPairs.map((pair, index) => (
                      <Token
                        key={`braille_${pair.id}`}
                        value={pair.braille}
                        interactive={interactive}
                        isActive={activeIndex === pair.index}
                        onEnter={() => handleEnter(pair.index)}
                        onLeave={handleLeave}
                        onClick={() => handleClick(pair.index)}
                        trailingSpace={isParagraphLike && index < row.tokenPairs.length - 1}
                        className="font-semibold tracking-[0.08em]"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
