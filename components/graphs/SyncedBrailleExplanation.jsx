"use client";

import { useMemo, useState } from "react";

function SegmentButton({
  segment,
  activeSegmentId,
  onHover,
  onLeave,
  onPin,
  label,
  renderValue,
}) {
  const isActive = segment.is_interactive && activeSegmentId === segment.id;

  if (!segment.is_interactive) {
    return <span aria-hidden="true">{renderValue(segment)}</span>;
  }

  return (
    <button
      type="button"
      aria-label={label(segment)}
      aria-pressed={isActive}
      onMouseEnter={() => onHover(segment.id)}
      onMouseLeave={onLeave}
      onFocus={() => onHover(segment.id)}
      onBlur={onLeave}
      onClick={() => onPin(segment.id)}
      className={`inline rounded-xl px-1.5 py-0.5 text-left align-baseline outline-none transition duration-200 ${
        isActive
          ? "bg-violet-100 text-violet-950 ring-2 ring-violet-300 shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_10px_24px_rgba(139,92,246,0.12)]"
          : "hover:bg-violet-50 focus-visible:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-300"
      }`}
    >
      {renderValue(segment)}
    </button>
  );
}

function ExplanationColumn({
  title,
  titleClassName,
  panelClassName,
  contentClassName,
  segments,
  activeSegmentId,
  onHover,
  onLeave,
  onPin,
  label,
  renderValue,
}) {
  return (
    <article className={panelClassName}>
      <p className={titleClassName}>{title}</p>
      <div className={contentClassName}>
        {segments.map((segment) => (
          <SegmentButton
            key={segment.id}
            segment={segment}
            activeSegmentId={activeSegmentId}
            onHover={onHover}
            onLeave={onLeave}
            onPin={onPin}
            label={label}
            renderValue={renderValue}
          />
        ))}
      </div>
    </article>
  );
}

export function SyncedBrailleExplanation({ segments, t }) {
  const [hoveredSegmentId, setHoveredSegmentId] = useState("");
  const [pinnedSegmentId, setPinnedSegmentId] = useState("");

  const activeSegmentId = pinnedSegmentId || hoveredSegmentId;
  const hasInteractiveSegments = useMemo(
    () => segments.some((segment) => segment.is_interactive),
    [segments],
  );

  function handleHover(nextId) {
    if (!pinnedSegmentId) {
      setHoveredSegmentId(nextId);
    }
  }

  function handleLeave() {
    if (!pinnedSegmentId) {
      setHoveredSegmentId("");
    }
  }

  function handlePin(nextId) {
    setPinnedSegmentId((currentId) => (currentId === nextId ? "" : nextId));
    setHoveredSegmentId("");
  }

  function clearHighlight() {
    setHoveredSegmentId("");
    setPinnedSegmentId("");
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{t("graphs.syncHelper")}</p>
        {hasInteractiveSegments ? (
          <button
            type="button"
            onClick={clearHighlight}
            className="button-secondary rounded-full px-4 py-2 text-sm font-semibold"
          >
            {t("graphs.clearHighlight")}
          </button>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ExplanationColumn
          title={t("graphs.normalAlphabet")}
          titleClassName="section-kicker"
          panelClassName="rounded-[28px] border border-slate-200 bg-white/90 p-5"
          contentClassName="mt-4 whitespace-pre-wrap text-lg leading-9 text-slate-800"
          segments={segments}
          activeSegmentId={activeSegmentId}
          onHover={handleHover}
          onLeave={handleLeave}
          onPin={handlePin}
          label={(segment) => t("graphs.segmentTextAria", { text: segment.text })}
          renderValue={(segment) => segment.text}
        />

        <ExplanationColumn
          title={t("graphs.brailleAlphabet")}
          titleClassName="section-kicker"
          panelClassName="rounded-[28px] border border-slate-700/70 bg-slate-950 p-5 shadow-[inset_0_0_28px_rgba(15,23,42,0.82)]"
          contentClassName="mt-4 whitespace-pre-wrap break-all text-[1.8rem] leading-[2] text-amber-100 [text-shadow:0_0_10px_rgba(250,204,21,0.38)]"
          segments={segments}
          activeSegmentId={activeSegmentId}
          onHover={handleHover}
          onLeave={handleLeave}
          onPin={handlePin}
          label={(segment) => t("graphs.segmentBrailleAria", { text: segment.text })}
          renderValue={(segment) => segment.braille}
        />
      </div>
    </section>
  );
}
