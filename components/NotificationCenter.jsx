"use client";

import { useI18n } from "@/components/I18nProvider";

function getNotificationStyles(type) {
  if (type === "error") {
    return "border-rose-200 bg-rose-50/95 text-rose-700";
  }

  if (type === "warning") {
    return "border-amber-200 bg-amber-50/95 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50/95 text-emerald-700";
}

export function NotificationCenter({ notifications, onDismiss }) {
  const { t } = useI18n();

  function getNotificationTypeLabel(type) {
    if (type === "error") {
      return t("notifications.error");
    }

    if (type === "warning") {
      return t("notifications.warning");
    }

    return t("notifications.success");
  }

  if (!notifications.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(100%,380px)] flex-col gap-3">
      {notifications.map((notification) => (
        <article
          key={notification.id}
          className={`pointer-events-auto rounded-[20px] border px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm ${getNotificationStyles(notification.type)}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em]">{getNotificationTypeLabel(notification.type)}</p>
              <h3 className="mt-2 text-sm font-bold">{notification.title}</h3>
              <p className="mt-1 text-sm leading-6">{notification.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(notification.id)}
              className="rounded-full border border-current/20 px-2 py-1 text-xs font-semibold"
            >
              {t("notifications.close")}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
