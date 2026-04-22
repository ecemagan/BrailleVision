"use client";

export function GraphUploadCard({
  t,
  previewUrl,
  selectedImageName,
  isDragging,
  isAnalyzing,
  onSelectFile,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  return (
    <section className="surface-card overflow-hidden rounded-[28px]">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 md:px-8">
        <div>
          <p className="section-kicker">{t("graphs.previewEyebrow")}</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-950">{t("graphs.previewTitle")}</h3>
        </div>
        {selectedImageName ? (
          <span className="max-w-[16rem] truncate rounded-full border border-amber-200 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-800">
            {selectedImageName}
          </span>
        ) : null}
      </div>

      <div className="p-4 md:p-6">
        <label
          className={`flex min-h-[34rem] cursor-pointer flex-col overflow-hidden rounded-[28px] border-2 border-dashed transition ${
            isDragging ? "border-amber-400 bg-amber-50/80" : "border-amber-200 bg-white/80 hover:border-amber-300"
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
          />

          {previewUrl ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-5 py-4">
                <p className="truncate text-sm font-semibold text-slate-900">{selectedImageName}</p>
                <span className="button-secondary inline-flex rounded-full px-4 py-2 text-sm font-semibold">
                  {t("graphs.changeImage")}
                </span>
              </div>
              <div className="relative flex-1 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_58%),linear-gradient(180deg,#0f172a,#111827)] p-4 md:p-6">
                <img
                  src={previewUrl}
                  alt={t("graphs.previewAlt")}
                  className="h-full min-h-[28rem] w-full rounded-[22px] object-contain"
                />
                {isAnalyzing ? (
                  <div className="absolute inset-4 rounded-[24px] bg-slate-950/55 backdrop-blur-sm md:inset-6">
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-white">
                      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
                      <p className="text-base font-semibold">{t("graphs.analyzing")}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-1 flex-col items-center justify-center px-8 py-10 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[24px] border border-amber-200 bg-amber-50 text-3xl text-amber-700">
                ∿
              </div>
              <p className="mt-6 text-2xl font-bold text-slate-950">{t("graphs.dropzoneTitle")}</p>
              <p className="mt-3 max-w-xl text-base leading-8 text-slate-600">{t("graphs.dropzoneDescription")}</p>
              <span className="button-primary mt-6 inline-flex rounded-full px-6 py-3 text-sm font-semibold">
                {t("graphs.chooseImage")}
              </span>
            </div>
          )}
        </label>
      </div>
    </section>
  );
}
