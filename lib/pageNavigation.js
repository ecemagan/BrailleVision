export function resolvePageJump(inputValue, totalPages) {
  const safeTotal = Math.max(0, Number(totalPages) || 0);
  const raw = String(inputValue || "").trim();

  if (!raw) {
    return {
      ok: false,
      error: "empty",
      pageIndex: null,
    };
  }

  if (!/^\d+$/.test(raw)) {
    return {
      ok: false,
      error: "invalid",
      pageIndex: null,
    };
  }

  const pageNumber = Number(raw);

  if (pageNumber < 1 || pageNumber > safeTotal) {
    return {
      ok: false,
      error: "out_of_range",
      pageIndex: null,
    };
  }

  return {
    ok: true,
    error: null,
    pageIndex: pageNumber - 1,
  };
}
