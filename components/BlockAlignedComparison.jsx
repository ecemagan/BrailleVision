"use client";

import { useMemo, useState } from "react";
import { createAlignedTokenMapping, decorateInteractiveTokens } from "@/lib/blockTokenMapping";
import { buildDisplaySegments } from "@/lib/blockDisplayModel";
import { PAGE_BLOCK_TYPES, isMathBlockType, isTextBlockType } from "@/lib/pageBlocks";

function typeToTab(type) {
  if (!type) return "All";
  if (type === PAGE_BLOCK_TYPES.GRAPH || type === PAGE_BLOCK_TYPES.GRAPH_PLACEHOLDER) return "Graph";
  if (type === PAGE_BLOCK_TYPES.TABLE || type === PAGE_BLOCK_TYPES.TABLE_PLACEHOLDER) return "Table";
  if (type === PAGE_BLOCK_TYPES.EXAMPLE) return "Example";
  if (isMathBlockType(type)) return "Math";
  if (isTextBlockType(type)) return "Text";
  return "All";
}

function getBlockTypeLabel(type) {
  switch (type) {
    case PAGE_BLOCK_TYPES.CHAPTER_HEADER:
      return "CHAPTER";
    case PAGE_BLOCK_TYPES.SECTION_HEADER:
      return "SECTION";
    case PAGE_BLOCK_TYPES.PARAGRAPH:
      return "TEXT";
    case PAGE_BLOCK_TYPES.THEOREM:
      return "THEOREM";
    case PAGE_BLOCK_TYPES.EXAMPLE:
      return "EXAMPLE";
    case PAGE_BLOCK_TYPES.EQUATION_GROUP:
      return "MATH";
    case "equation_step":
      return "STEP";
    case PAGE_BLOCK_TYPES.SIDEBAR_NOTE:
      return "NOTE";
    case PAGE_BLOCK_TYPES.GRAPH_PLACEHOLDER:
    case PAGE_BLOCK_TYPES.GRAPH:
      return "GRAPH";
    case PAGE_BLOCK_TYPES.TABLE_PLACEHOLDER:
    case PAGE_BLOCK_TYPES.TABLE:
      return "TABLE";
    default:
      return String(type || "block")
        .replace(/_/g, " ")
        .trim()
        .toUpperCase();
  }
}

function NotesPanel({ title, notes }) {
  if (!notes?.length) {
    return null;
  }

  return (
    <div className="rounded-[28px] border border-violet-200 bg-[linear-gradient(135deg,rgba(245,243,255,0.92),rgba(255,255,255,0.98))] p-5">
      <p className="section-kicker">{title}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {notes.map((note) => (
          <div
            key={note}
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-[0_10px_24px_rgba(148,163,184,0.08)]"
          >
            <p className="text-sm leading-7 text-slate-700">{note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-4 py-2 text-sm font-semibold transition",
        active ? "button-primary" : "button-secondary",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function normalizeDisplayText(text) {
  return String(text || "").replace(/(\p{L})-\s+(\p{L})/gu, "$1$2");
}

function shouldUseMathAwareTokenization(type, originalText, brailleText) {
  if (
    type === PAGE_BLOCK_TYPES.EQUATION_GROUP ||
    type === PAGE_BLOCK_TYPES.RULE_ITEM ||
    type === "example_item" ||
    type === "equation_step"
  ) {
    return true;
  }

  return /lim|√|∫|∑|→|=|\^|\/|\+|-/u.test(`${originalText || ""} ${brailleText || ""}`);
}

function buildInteractiveTokens(alignment, side, blockId, segmentId) {
  const tokens = side === "original" ? alignment.originalTokens : alignment.brailleTokens;
  return decorateInteractiveTokens(tokens, {
    blockId,
    side,
    segmentId,
  });
}

function InteractiveTokenText({
  text,
  tokens = [],
  blockId,
  side,
  segmentId,
  activeToken,
  onHover,
  onLeave,
  onToggleLock,
  tone = "original",
}) {
  const tokenClassName =
    tone === "braille"
      ? "font-mono text-[1.08rem] leading-10 tracking-[0.22em] text-slate-950"
      : "text-sm leading-7 text-slate-800";

  return (
    <div
      className={[
        "whitespace-pre-wrap break-words",
        tone === "braille" ? "rounded-2xl bg-white/70 px-3 py-3" : "",
      ].join(" ")}
    >
      {(
        tokens.length
          ? tokens
          : [
              {
                text,
                isWhitespace: false,
                tokenIndex: null,
                tokenKey: `${blockId}::${segmentId}::fallback`,
                interactionKey: null,
                counterpartKey: null,
              },
            ]
      ).map((token, index) => {
        if (token.isWhitespace || token.interactionKey === null) {
          return (
            <span key={token.tokenKey || `${segmentId}-space-${index}`} className={tokenClassName}>
              {token.text}
            </span>
          );
        }

        const isActive =
          activeToken?.blockId === blockId &&
          activeToken?.segmentId === segmentId &&
          (activeToken?.interactionKey === token.interactionKey || activeToken?.counterpartKey === token.interactionKey);
        const interaction = {
          blockId,
          side,
          segmentId,
          tokenIndex: token.tokenIndex,
          tokenKey: token.tokenKey,
          interactionKey: token.interactionKey,
          counterpartKey: token.counterpartKey,
        };

        return (
          <span
            key={token.tokenKey}
            role="button"
            tabIndex={0}
            onMouseEnter={() => onHover(interaction)}
            onMouseLeave={onLeave}
            onClick={() => onToggleLock(interaction)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggleLock(interaction);
              }
            }}
            className={[
              tokenClassName,
              "cursor-pointer rounded-md px-1 py-0.5 transition",
              isActive
                ? tone === "braille"
                  ? "bg-amber-200 shadow-[0_0_0_1px_rgba(217,119,6,0.18)]"
                  : "bg-violet-100 shadow-[0_0_0_1px_rgba(124,58,237,0.12)]"
                : tone === "braille"
                  ? "hover:bg-amber-100"
                  : "hover:bg-slate-100",
            ].join(" ")}
          >
            {token.text}
          </span>
        );
      })}
    </div>
  );
}

function SegmentPanel({
  blockId,
  segments,
  activeToken,
  onHover,
  onLeave,
  onToggleLock,
  side,
  displayMode = "default",
  paneLabel,
}) {
  if (displayMode === PAGE_BLOCK_TYPES.THEOREM) {
    const segment = segments[0];
    const childItems = segment?.children || [];
    const fallbackAlignment = createAlignedTokenMapping(
      normalizeDisplayText(segment?.original),
      normalizeDisplayText(segment?.braille),
      {
        isMath: shouldUseMathAwareTokenization(
          segment?.type,
          normalizeDisplayText(segment?.original),
          normalizeDisplayText(segment?.braille),
        ),
      },
    );
    const fallbackTokens = buildInteractiveTokens(fallbackAlignment, side, blockId, segment?.id || "theorem-fallback");

    return (
      <div
        className={[
          "rounded-2xl border px-3 py-3",
          side === "braille"
            ? "border-amber-200/80 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
            : "border-slate-200/80 bg-slate-50/70",
        ].join(" ")}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {getBlockTypeLabel(PAGE_BLOCK_TYPES.THEOREM)}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 lg:hidden">
            {paneLabel}
          </span>
        </div>

        <div className="space-y-3">
          {!childItems.length ? (
            <div className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-3">
              <InteractiveTokenText
                text={normalizeDisplayText(side === "original" ? segment?.original : segment?.braille)}
                tokens={fallbackTokens}
                blockId={blockId}
                side={side}
                segmentId={segment?.id || "theorem-fallback"}
                activeToken={activeToken}
                onHover={onHover}
                onLeave={onLeave}
                onToggleLock={onToggleLock}
                tone={side === "original" ? "original" : "braille"}
              />
            </div>
          ) : null}

          {childItems.map((child) => {
            if (child.type === PAGE_BLOCK_TYPES.EQUATION_GROUP) {
              return (
                <div
                  key={child.id}
                  className={[
                    "rounded-xl px-2 py-2",
                    side === "braille" ? "bg-amber-50/70" : "bg-white/80",
                  ].join(" ")}
                >
                  <div className="space-y-1.5 overflow-x-auto">
                    {(child.lines || []).map((line) => {
                      const alignment = createAlignedTokenMapping(
                        normalizeDisplayText(line.original),
                        normalizeDisplayText(line.braille),
                        {
                          isMath: shouldUseMathAwareTokenization(
                            child.type,
                            normalizeDisplayText(line.original),
                            normalizeDisplayText(line.braille),
                          ),
                        },
                      );
                      const tokens = buildInteractiveTokens(alignment, side, blockId, line.id);

                      return (
                        <div key={line.id} className="min-w-max rounded-lg px-1 py-1">
                          <InteractiveTokenText
                            text={normalizeDisplayText(side === "original" ? line.original : line.braille)}
                            tokens={tokens}
                            blockId={blockId}
                            side={side}
                            segmentId={line.id}
                            activeToken={activeToken}
                            onHover={onHover}
                            onLeave={onLeave}
                            onToggleLock={onToggleLock}
                            tone="braille"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const alignment = createAlignedTokenMapping(
              normalizeDisplayText(child.original),
              normalizeDisplayText(child.braille),
              {
                isMath: shouldUseMathAwareTokenization(
                  child.type,
                  normalizeDisplayText(child.original),
                  normalizeDisplayText(child.braille),
                ),
              },
            );
            const tokens = buildInteractiveTokens(alignment, side, blockId, child.id);

            return (
              <div
                key={child.id}
                className={[
                  "rounded-xl border px-3 py-3",
                  side === "braille" ? "border-amber-100 bg-white/80" : "border-slate-200/70 bg-white/80",
                ].join(" ")}
              >
                <span className="mb-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {getBlockTypeLabel(child.type)}
                </span>
                <InteractiveTokenText
                  text={normalizeDisplayText(side === "original" ? child.original : child.braille)}
                  tokens={tokens}
                  blockId={blockId}
                  side={side}
                  segmentId={child.id}
                  activeToken={activeToken}
                  onHover={onHover}
                  onLeave={onLeave}
                  onToggleLock={onToggleLock}
                  tone={side === "original" ? "original" : "braille"}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (displayMode === PAGE_BLOCK_TYPES.EQUATION_GROUP) {
    const segment = segments[0];
    const lineItems = segment?.lines || [];
    const equationContainerClassName =
      side === "braille"
        ? "rounded-2xl border border-amber-200/80 bg-white/70 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
        : "rounded-2xl border border-slate-200/80 bg-slate-50/75 px-3 py-3";

    return (
      <div className={equationContainerClassName}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {getBlockTypeLabel(PAGE_BLOCK_TYPES.EQUATION_GROUP)}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 lg:hidden">
            {paneLabel}
          </span>
        </div>

        <div className="space-y-1.5 overflow-x-auto">
          {lineItems.map((line) => {
            const alignment = createAlignedTokenMapping(
              normalizeDisplayText(line.original),
              normalizeDisplayText(line.braille),
              {
                isMath: shouldUseMathAwareTokenization(
                  PAGE_BLOCK_TYPES.EQUATION_GROUP,
                  normalizeDisplayText(line.original),
                  normalizeDisplayText(line.braille),
                ),
              },
            );
            const tokens = buildInteractiveTokens(alignment, side, blockId, line.id);
            const tone = "braille";

            return (
              <div
                key={line.id}
                className={[
                  "min-w-max rounded-xl px-2 py-1.5",
                  side === "braille" ? "bg-amber-50/70" : "bg-white/75",
                ].join(" ")}
              >
                <InteractiveTokenText
                  text={normalizeDisplayText(side === "original" ? line.original : line.braille)}
                  tokens={tokens}
                  blockId={blockId}
                  side={side}
                  segmentId={line.id}
                  activeToken={activeToken}
                  onHover={onHover}
                  onLeave={onLeave}
                  onToggleLock={onToggleLock}
                  tone={tone}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {segments.map((segment) => {
        const alignment = createAlignedTokenMapping(
          normalizeDisplayText(segment.original),
          normalizeDisplayText(segment.braille),
          {
            isMath: shouldUseMathAwareTokenization(
              segment.type,
              normalizeDisplayText(segment.original),
              normalizeDisplayText(segment.braille),
            ),
          },
        );
        const tokens = buildInteractiveTokens(alignment, side, blockId, segment.id);
        const tone = side === "original" ? "original" : "braille";

        return (
          <div key={segment.id} className="rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              {segments.length > 1 ? (
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {getBlockTypeLabel(segment.type)}
                </span>
              ) : (
                <span />
              )}
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 lg:hidden">
                {paneLabel}
              </span>
            </div>

            <InteractiveTokenText
              text={normalizeDisplayText(side === "original" ? segment.original : segment.braille)}
              tokens={tokens}
              blockId={blockId}
              side={side}
              segmentId={segment.id}
              activeToken={activeToken}
              onHover={onHover}
              onLeave={onLeave}
              onToggleLock={onToggleLock}
              tone={tone}
            />
          </div>
        );
      })}
    </div>
  );
}

export function BlockAlignedComparison({
  blocks = [],
  originalLabel,
  brailleLabel,
  notesTitle,
  notes = [],
}) {
  const [activeTab, setActiveTab] = useState("All");
  const [hoveredToken, setHoveredToken] = useState(null);
  const [lockedToken, setLockedToken] = useState(null);

  const pairs = useMemo(
    () =>
      (blocks || []).map((block, index) => ({
        id: block?.id || `block-${index}`,
        index,
        type: block?.type || "paragraph",
        tab: typeToTab(block?.type),
        segments: buildDisplaySegments(block),
      })),
    [blocks],
  );

  const visiblePairs = useMemo(
    () => (activeTab === "All" ? pairs : pairs.filter((pair) => pair.tab === activeTab)),
    [activeTab, pairs],
  );

  const activeToken = lockedToken || hoveredToken;

  function handleHover(nextToken) {
    if (lockedToken) {
      return;
    }
    setHoveredToken(nextToken);
  }

  function handleLeave() {
    if (!lockedToken) {
      setHoveredToken(null);
    }
  }

  function handleToggleLock(nextToken) {
    setLockedToken((current) =>
      current?.interactionKey === nextToken.interactionKey ? null : nextToken,
    );
    setHoveredToken(null);
  }

  return (
    <section className="space-y-4">
      <NotesPanel title={notesTitle} notes={notes} />

      <div className="surface-card rounded-2xl p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-kicker">Blocks</p>
            <p className="mt-2 text-sm text-slate-600">Aligned by block order with token hover sync.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["All", "Text", "Math", "Graph", "Example", "Table"].map((label) => (
              <TabButton key={label} label={label} active={activeTab === label} onClick={() => setActiveTab(label)} />
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-[0_18px_46px_rgba(148,163,184,0.12)]">
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-b border-slate-200 bg-slate-50/90 lg:grid">
          <div className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{originalLabel}</div>
          <div className="border-l border-slate-200 bg-amber-50/70 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-900">{brailleLabel}</div>
        </div>

        <div className="divide-y divide-slate-200">
          {visiblePairs.map((pair) => (
            <div key={pair.id} className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.9))] px-4 py-3 lg:col-span-2 lg:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-[0_6px_18px_rgba(148,163,184,0.08)]">
                    {String(pair.index + 1).padStart(2, "0")}
                  </span>
                  <span className="info-chip rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    {getBlockTypeLabel(pair.type)}
                  </span>
                </div>
              </div>

              <div className="border-b border-slate-200 bg-white px-4 py-4 lg:border-b-0 lg:px-5">
                <SegmentPanel
                  blockId={pair.id}
                  segments={pair.segments}
                  activeToken={activeToken}
                  onHover={handleHover}
                  onLeave={handleLeave}
                  onToggleLock={handleToggleLock}
                  side="original"
                  displayMode={pair.type}
                  paneLabel={originalLabel}
                />
              </div>

              <div className="border-t border-amber-100 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,247,237,0.98))] px-4 py-4 lg:border-l lg:border-t-0 lg:border-amber-200 lg:px-5">
                <SegmentPanel
                  blockId={pair.id}
                  segments={pair.segments}
                  activeToken={activeToken}
                  onHover={handleHover}
                  onLeave={handleLeave}
                  onToggleLock={handleToggleLock}
                  side="braille"
                  displayMode={pair.type}
                  paneLabel={brailleLabel}
                />
              </div>
            </div>
          ))}

          {!visiblePairs.length ? <div className="p-8 text-center text-sm text-slate-600">No blocks in this view.</div> : null}
        </div>
      </div>
    </section>
  );
}
