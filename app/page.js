"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

const featureCards = [
  {
    icon: "⠿",
    titleKey: "landing.features.smart.title",
    descriptionKey: "landing.features.smart.description",
  },
  {
    icon: "⠳",
    titleKey: "landing.features.search.title",
    descriptionKey: "landing.features.search.description",
  },
  {
    icon: "⠧",
    titleKey: "landing.features.dashboard.title",
    descriptionKey: "landing.features.dashboard.description",
  },
];

const nemethPreviewCells = [
  { token: "x", braille: "⠭", dots: [1, 3, 4, 6] },
  { token: "sup", braille: "⠘", dots: [4, 5] },
  { token: "num", braille: "⠼", dots: [3, 4, 5, 6] },
  { token: "2", braille: "⠃", dots: [1, 2] },
  { token: "+", braille: "⠬", dots: [3, 4, 6] },
  { token: "y", braille: "⠽", dots: [1, 3, 4, 5, 6] },
];

function NemethCell({ symbol, dots }) {
  return (
    <div className="glass-card rounded-xl p-2.5">
      <div className="grid grid-cols-2 gap-1">
        {[1, 2, 3, 4, 5, 6].map((dot) => (
          <span
            key={`${symbol}-${dot}`}
            className={`h-2.5 w-2.5 rounded-full ${
              dots.includes(dot) ? "bg-purple-600 shadow-[0_0_0_3px_rgba(147,51,234,0.14)]" : "bg-purple-200/45"
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-xs font-semibold text-purple-700">{symbol}</p>
    </div>
  );
}

export default function HomePage() {
  const { t } = useI18n();

  return (
    <main className="page-shell flex items-center justify-center">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-stretch">
        <section className="surface-card hero-wash rounded-[32px] p-8 md:p-12">
          <div className="mb-6 inline-flex rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
            {t("landing.badge")}
          </div>
          <h1 className="font-display max-w-3xl text-4xl font-bold tracking-tight leading-[1.02] text-slate-950 md:text-6xl">
            {t("landing.headline")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            {t("landing.subheadline")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="button-primary rounded-full bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700"
            >
              {t("landing.createAccount")}
            </Link>
            <Link
              href="/login"
              className="button-secondary rounded-full border-2 border-purple-600 bg-transparent px-6 py-3 font-semibold text-purple-600 hover:border-purple-700 hover:text-purple-700"
            >
              {t("landing.login")}
            </Link>
          </div>

          <div className="glass-card mt-7 rounded-2xl bg-white/75 p-5 backdrop-blur-md">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{t("landing.preview.title")}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_1.35fr] md:items-start">
              <div className="rounded-xl border border-purple-200/70 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("landing.preview.input")}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">x^2 + y</p>
              </div>

              <div className="rounded-xl border border-purple-200/70 bg-white/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("landing.preview.output")}</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">⠭ ⠘ ⠼⠃ ⠬ ⠽</p>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {nemethPreviewCells.map((cell) => (
                    <NemethCell key={`${cell.token}-${cell.braille}`} symbol={cell.braille} dots={cell.dots} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:h-full lg:grid-rows-3">
          {featureCards.map((card) => (
            <article key={card.titleKey} className="surface-card surface-soft flex h-full flex-col rounded-2xl p-5 md:p-6">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-purple-200/70 bg-white text-xl font-semibold text-purple-700">
                  {card.icon}
                </span>
                <div>
                  <p className="accent-label text-[11px] font-semibold uppercase tracking-[0.2em]">{t("landing.featureLabel")}</p>
                  <h2 className="font-display mt-1 text-xl font-bold leading-tight text-slate-950">{t(card.titleKey)}</h2>
                </div>
              </div>
              <p className="mt-4 text-[15px] leading-7 text-slate-600">{t(card.descriptionKey)}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
