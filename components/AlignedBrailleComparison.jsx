"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { buildAlignedBrailleRows } from "@/lib/alignedBrailleRows";
import { formatOriginalLineForDisplay } from "@/lib/mathDisplayFormatting";
import { convertToBraille } from "@/lib/convertToBraille";

// ─── Sentence splitter ───────────────────────────────────────────────────────
function splitIntoSentences(text) {
  if (!text?.trim()) return [];
  // Split on . ! ? followed by whitespace or end-of-string,
  // but not on decimal numbers (3.14) or abbreviations (R.+, 1S)
  const raw = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  // Simple but effective: split after terminal punctuation that is followed by
  // a space + capital letter, or end-of-string.
  const parts = raw.split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜA-Z\d])/u);
  return parts
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Tooltip portal ──────────────────────────────────────────────────────────
function BrailleTooltip({ braille, anchorRect }) {
  if (!braille || !anchorRect) return null;
  const style = {
    position: "fixed",
    top:  anchorRect.top - 8,
    left: anchorRect.left + anchorRect.width / 2,
    transform: "translate(-50%, -100%)",
    zIndex: 9999,
    pointerEvents: "none",
  };
  return createPortal(
    <div style={style} role="tooltip" aria-live="polite">
      <div className="flex flex-col items-center gap-1">
        <div className="rounded-xl bg-slate-900 px-3 py-2 text-[1.25rem] leading-none tracking-[0.18em] text-amber-300 shadow-[0_8px_32px_rgba(0,0,0,0.28)] max-w-xs break-words">
          {braille}
        </div>
        <div className="h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-slate-900" />
      </div>
    </div>,
    document.body,
  );
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────
function ModeSwitch({ sentenceMode, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={sentenceMode}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200",
        sentenceMode
          ? "border-violet-400 bg-violet-600 text-white shadow-[0_4px_18px_rgba(124,58,237,0.28)]"
          : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-600",
      ].join(" ")}
    >
      {/* Track */}
      <span
        className={[
          "relative inline-block h-4 w-7 rounded-full transition-colors duration-200",
          sentenceMode ? "bg-white/30" : "bg-slate-200",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all duration-200",
            sentenceMode ? "left-3.5" : "left-0.5",
          ].join(" ")}
        />
      </span>
      Sentence Mode
    </button>
  );
}

// ─── Single word token ───────────────────────────────────────────────────────
function Token({ value, brailleValue, isActive, onEnter, onLeave, onClick, interactive, className, trailingSpace = false }) {
  if (!value) return <span className="inline-block min-w-6 opacity-30">&nbsp;</span>;

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
        aria-label={brailleValue ? `${value} → Braille: ${brailleValue}` : value}
        className={[
          className,
          "inline rounded-xl text-left align-baseline outline-none transition duration-200",
          isActive
            ? "bg-amber-100 text-slate-950 ring-2 ring-amber-400 shadow-[0_10px_24px_rgba(245,158,11,0.22)]"
            : "hover:bg-violet-50 focus-visible:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-300",
        ].join(" ")}
      >
        {value}
      </button>
      {trailingSpace ? " " : ""}
    </span>
  );
}

// ─── Notes panel ─────────────────────────────────────────────────────────────
function NotesPanel({ title, notes }) {
  if (!notes.length) return null;
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

// ─── Per-word tokeniser for sentence mode ────────────────────────────────────
function tokeniseSentence(sentence) {
  // Split preserving spaces so we can rejoin correctly
  const parts = sentence.split(/(\s+)/);
  const tokens = [];
  for (const part of parts) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      tokens.push({ word: part, braille: " ", isSpace: true });
    } else {
      tokens.push({ word: part, braille: convertToBraille(part), isSpace: false });
    }
  }
  return tokens;
}

// ─── Sentence-mode row (with cross-side word highlighting) ──────────────────
function SentenceRow({ index, sentence, braille, isHighlighted, onHover, onLeave, onClick, onWordTooltip, onWordLeave }) {
  const tokens = useMemo(() => tokeniseSentence(sentence), [sentence]);
  const wordTokens    = useMemo(() => tokens.filter((t) => !t.isSpace), [tokens]);
  const brailleTokens = useMemo(() => tokens.filter((t) => !t.isSpace), [tokens]);

  // Index of the word hovered on EITHER side (-1 = none)
  const [activeWordIdx, setActiveWordIdx] = useState(-1);

  function activateWord(wordIdx, anchorEl) {
    setActiveWordIdx(wordIdx);
    onHover(index);
    const tok = wordTokens[wordIdx];
    if (tok?.braille?.trim() && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      onWordTooltip({ braille: tok.braille, anchorRect: rect });
    }
  }

  function deactivateWord() {
    setActiveWordIdx(-1);
    onLeave();
    onWordLeave();
  }

  return (
    <div
      className={[
        "grid lg:grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)] transition-colors duration-150",
        isHighlighted ? "bg-violet-50/60" : "",
      ].join(" ")}
    >
      {/* Number */}
      <div className="flex items-start justify-center px-3 py-4 pt-5">
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-400">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      {/* ── Original sentence — word-level tokens ── */}
      <div
        className={[
          "border-b border-slate-100 px-4 py-4 text-sm leading-7 text-slate-800 lg:border-b-0 lg:px-5",
          isHighlighted ? "bg-violet-50/40" : "bg-white",
        ].join(" ")}
        onMouseLeave={deactivateWord}
      >
        <span>
          {(() => {
            let wordCounter = -1;
            return tokens.map((tok, ti) => {
              if (tok.isSpace) return <span key={`sp-${ti}`}>{tok.word}</span>;
              wordCounter += 1;
              const wi = wordCounter;
              const isWordActive = activeWordIdx === wi;
              return (
                <button
                  key={`w-${ti}`}
                  type="button"
                  onMouseEnter={(e) => activateWord(wi, e.currentTarget)}
                  onMouseLeave={deactivateWord}
                  onClick={() => onClick(index)}
                  className={[
                    "inline rounded-md px-0.5 py-0.5 font-medium transition duration-150 cursor-pointer focus-visible:outline-none",
                    isWordActive
                      ? "bg-violet-200 text-violet-900 ring-1 ring-violet-400"
                      : "text-slate-800 hover:bg-violet-100 hover:text-violet-900",
                  ].join(" ")}
                >
                  {tok.word}
                </button>
              );
            });
          })()}
        </span>
      </div>

      {/* ── Braille side — word-level tokens, cross-highlighted ── */}
      <div
        className={[
          "px-4 py-4 lg:border-l lg:border-amber-200 lg:px-5",
          isHighlighted
            ? "bg-amber-100/60"
            : "bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,247,237,0.98))]",
        ].join(" ")}
        onMouseLeave={deactivateWord}
      >
        <p className="min-w-0 whitespace-normal break-words text-[1.25rem] leading-9 tracking-[0.1em] text-slate-950">
          {brailleTokens.length === 0 ? (
            <span className="text-sm italic text-slate-400">—</span>
          ) : (
            brailleTokens.map((tok, wi) => {
              const isWordActive = activeWordIdx === wi;
              return (
                <span key={`bt-${wi}`}>
                  <button
                    type="button"
                    onMouseEnter={(e) => activateWord(wi, e.currentTarget)}
                    onMouseLeave={deactivateWord}
                    className={[
                      "inline rounded-md px-0.5 py-0.5 font-semibold tracking-[0.08em] transition duration-150 cursor-pointer",
                      isWordActive
                        ? "bg-amber-300 text-slate-900 ring-1 ring-amber-500 shadow-sm"
                        : "hover:bg-amber-200",
                    ].join(" ")}
                  >
                    {tok.braille}
                  </button>
                  {wi < brailleTokens.length - 1 ? " " : ""}
                </span>
              );
            })
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
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
  const [sentenceMode, setSentenceMode] = useState(false);
  const [hoveredIndex, setHoveredIndex]   = useState(null);
  const [pinnedIndex, setPinnedIndex]     = useState(null);
  const [tooltipData, setTooltipData]     = useState(null);

  // ── Paragraph mode data ───────────────────────────────────────────────────
  const rows = useMemo(
    () => buildAlignedBrailleRows(originalText, brailleText, { wordsPerRow }),
    [brailleText, originalText, wordsPerRow],
  );

  const brailleByIndex = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      for (const pair of row.tokenPairs) {
        if (pair.braille) map.set(pair.index, pair.braille);
      }
    }
    return map;
  }, [rows]);

  // ── Sentence mode data ────────────────────────────────────────────────────
  const sentencePairs = useMemo(() => {
    if (!sentenceMode) return [];
    const sentences = splitIntoSentences(originalText);
    return sentences.map((sentence, i) => ({
      id: `sent_${i}`,
      sentence,
      braille: convertToBraille(sentence),
    }));
  }, [sentenceMode, originalText]);

  // ── Interaction helpers ───────────────────────────────────────────────────
  const activeIndex = pinnedIndex ?? hoveredIndex;
  const isParagraphLike = mode !== "line_preserved";

  function handleEnter(index, event) {
    if (pinnedIndex === null) setHoveredIndex(index);
    const rect = event?.currentTarget?.getBoundingClientRect?.();
    const braille = brailleByIndex.get(index);
    if (rect && braille) setTooltipData({ braille, anchorRect: rect });
  }

  function handleLeave() {
    if (pinnedIndex === null) setHoveredIndex(null);
    setTooltipData(null);
  }

  function handleClick(index) {
    if (!interactive) return;
    setPinnedIndex((current) => {
      const next = current === index ? null : index;
      if (next === null) setTooltipData(null);
      return next;
    });
    setHoveredIndex(null);
  }

  // ── Sentence mode word-level tooltip ────────────────────────────────────────
  const [sentenceWordTooltip, setSentenceWordTooltip] = useState(null);

  const [hoveredSentence, setHoveredSentence] = useState(null);
  const [pinnedSentence, setPinnedSentence]   = useState(null);
  const activeSentence = pinnedSentence ?? hoveredSentence;

  function handleSentenceHover(i)  { if (pinnedSentence === null) setHoveredSentence(i); }
  function handleSentenceLeave()   { if (pinnedSentence === null) setHoveredSentence(null); }
  function handleSentenceClick(i)  { setPinnedSentence((c) => (c === i ? null : i)); setHoveredSentence(null); }

  return (
    <section className="space-y-4">
      {/* Paragraph mode word tooltip */}
      {tooltipData && !sentenceMode && (
        <BrailleTooltip braille={tooltipData.braille} anchorRect={tooltipData.anchorRect} />
      )}
      {/* Sentence mode word tooltip */}
      {sentenceWordTooltip && sentenceMode && (
        <BrailleTooltip braille={sentenceWordTooltip.braille} anchorRect={sentenceWordTooltip.anchorRect} />
      )}


      <NotesPanel title={notesTitle} notes={notes} />

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        <ModeSwitch sentenceMode={sentenceMode} onToggle={() => { setSentenceMode((v) => !v); setPinnedSentence(null); setHoveredSentence(null); }} />
        {!sentenceMode && interactive && (
          <p className="text-xs text-slate-400">💡 Hover any word to see its Braille. Click to pin.</p>
        )}
        {sentenceMode && (
          <p className="text-xs text-slate-400">💡 Hover or click a sentence to highlight its Braille pair.</p>
        )}
      </div>

      {/* ══════════════════════ SENTENCE MODE ══════════════════════════════ */}
      {sentenceMode ? (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-[0_18px_46px_rgba(148,163,184,0.12)]">
          {/* Header */}
          <div className="hidden grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)] border-b border-slate-200 bg-slate-50/90 lg:grid">
            <div className="px-3 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">#</div>
            <div className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{originalLabel}</div>
            <div className="border-l border-slate-200 bg-amber-50/70 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-900">{brailleLabel}</div>
          </div>

          <div className="divide-y divide-slate-100">
            {sentencePairs.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No sentences found.</p>
            ) : (
              sentencePairs.map((pair, i) => (
                <SentenceRow
                  key={pair.id}
                  index={i}
                  sentence={pair.sentence}
                  braille={pair.braille}
                  isHighlighted={activeSentence === i}
                  onHover={handleSentenceHover}
                  onLeave={handleSentenceLeave}
                  onClick={handleSentenceClick}
                  onWordTooltip={setSentenceWordTooltip}
                  onWordLeave={() => setSentenceWordTooltip(null)}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        /* ══════════════════════ PARAGRAPH MODE ═══════════════════════════ */
        <>
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-[0_18px_46px_rgba(148,163,184,0.12)]">
            {/* Column headers */}
            <div className="hidden grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)] border-b border-slate-200 bg-slate-50/90 lg:grid">
              <div className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Block</div>
              <div className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{originalLabel}</div>
              <div className="border-l border-slate-200 bg-amber-50/70 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-900">{brailleLabel}</div>
            </div>

            <div className="divide-y divide-slate-200">
              {rows.map((row) => (
                <div key={row.id} className="grid lg:grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)]">
                  {/* Row number */}
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 lg:justify-center lg:border-b-0">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                      {String(row.rowNumber).padStart(2, "0")}
                    </span>
                    <div className="grid gap-1 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 lg:hidden">
                      <span>{originalLabel}</span>
                      <span className="text-amber-800">{brailleLabel}</span>
                    </div>
                  </div>

                  {/* Original text */}
                  <div className="border-b border-slate-200 bg-white px-4 py-4 lg:border-b-0 lg:px-5">
                    <div>
                      {(() => {
                        const formattedOriginalLines = formatOriginalLineForDisplay(row.originalText);
                        if (formattedOriginalLines.length > 1) {
                          return (
                            <div className={compact
                              ? "min-w-0 whitespace-pre-wrap break-words font-mono text-sm leading-7 text-slate-700"
                              : "min-w-0 whitespace-pre-wrap break-words font-mono text-base leading-8 text-slate-800"
                            }>
                              {formattedOriginalLines.map((displayLine, lineIndex) => (
                                <div key={`${row.id}_display_${lineIndex + 1}`}>{displayLine || " "}</div>
                              ))}
                            </div>
                          );
                        }
                        return (
                          <div className={compact
                            ? `min-w-0 text-sm leading-7 text-slate-700 ${isParagraphLike ? "whitespace-normal break-words" : ""}`
                            : `min-w-0 text-base leading-8 text-slate-800 ${isParagraphLike ? "whitespace-normal break-words" : ""}`
                          }>
                            {row.tokenPairs.map((pair, index) => (
                              <Token
                                key={`original_${pair.id}`}
                                value={pair.original}
                                brailleValue={pair.braille}
                                interactive={interactive}
                                isActive={activeIndex === pair.index}
                                onEnter={(e) => handleEnter(pair.index, e)}
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

                  {/* Braille output */}
                  <div className="border-t border-amber-100 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,247,237,0.98))] px-4 py-4 lg:border-l lg:border-t-0 lg:border-amber-200 lg:px-5">
                    <div>
                      <div className={compact
                        ? "min-w-0 text-lg leading-8 text-slate-950 whitespace-normal break-words"
                        : "min-w-0 text-[1.5rem] leading-10 text-slate-950 whitespace-normal break-words"
                      }>
                        {row.tokenPairs.map((pair, index) => (
                          <Token
                            key={`braille_${pair.id}`}
                            value={pair.braille}
                            brailleValue={pair.braille}
                            interactive={interactive}
                            isActive={activeIndex === pair.index}
                            onEnter={(e) => handleEnter(pair.index, e)}
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

          {/* Pinned token info bar */}
          {pinnedIndex !== null && brailleByIndex.has(pinnedIndex) && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-700">
              <span className="text-[1.4rem] tracking-[0.18em] text-amber-800">
                {brailleByIndex.get(pinnedIndex)}
              </span>
              <span className="text-slate-500">— pinned Braille character(s)</span>
              <button
                type="button"
                onClick={() => { setPinnedIndex(null); setTooltipData(null); }}
                className="ml-auto rounded-full px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-amber-100 transition"
              >
                ✕ Unpin
              </button>
            </div>
          )}
        </>
      )}

      {/* Pinned sentence info bar (sentence mode) */}
      {sentenceMode && pinnedSentence !== null && sentencePairs[pinnedSentence] && (
        <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-slate-700">
          <span className="mt-0.5 shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-500">Pinned</span>
          <div className="min-w-0 space-y-1">
            <p className="text-slate-700">{sentencePairs[pinnedSentence].sentence}</p>
            <p className="tracking-[0.1em] text-slate-900">{sentencePairs[pinnedSentence].braille}</p>
          </div>
          <button
            type="button"
            onClick={() => setPinnedSentence(null)}
            className="ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-violet-100 transition"
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}
