export const PROFILE_DENSITY_OPTIONS = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

export const PROFILE_THEME_MODE_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export const PROFILE_THEME_ACCENT_OPTIONS = [
  { value: "lilac", label: "Lilac" },
  { value: "ocean", label: "Ocean" },
  { value: "sunrise", label: "Sunrise" },
];

export const PROFILE_DEFAULT_VIEW_OPTIONS = [
  { value: "overview", label: "Overview" },
  { value: "documents", label: "Documents" },
  { value: "upload", label: "Upload" },
];

export const DEFAULT_PROFILE_PREFERENCES = {
  dashboardDensity: "comfortable",
  documentView: "documents",
  themeAccent: "lilac",
  themeMode: "light",
  onboardingCompleted: false,
  notificationsEnabled: true,
};

function sanitizePreferenceValue(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback;
}

export function normalizeProfilePreferences(preferences = {}) {
  const nextPreferences = {
    ...DEFAULT_PROFILE_PREFERENCES,
    ...(preferences || {}),
  };

  if (nextPreferences.documentView === "library") {
    nextPreferences.documentView = "documents";
  }

  return {
    dashboardDensity: sanitizePreferenceValue(
      nextPreferences.dashboardDensity,
      PROFILE_DENSITY_OPTIONS.map((option) => option.value),
      DEFAULT_PROFILE_PREFERENCES.dashboardDensity,
    ),
    documentView: sanitizePreferenceValue(
      nextPreferences.documentView,
      PROFILE_DEFAULT_VIEW_OPTIONS.map((option) => option.value),
      DEFAULT_PROFILE_PREFERENCES.documentView,
    ),
    themeAccent: sanitizePreferenceValue(
      nextPreferences.themeAccent,
      PROFILE_THEME_ACCENT_OPTIONS.map((option) => option.value),
      DEFAULT_PROFILE_PREFERENCES.themeAccent,
    ),
    themeMode: sanitizePreferenceValue(
      nextPreferences.themeMode,
      PROFILE_THEME_MODE_OPTIONS.map((option) => option.value),
      DEFAULT_PROFILE_PREFERENCES.themeMode,
    ),
    onboardingCompleted: Boolean(nextPreferences.onboardingCompleted),
    notificationsEnabled: nextPreferences.notificationsEnabled !== false,
  };
}

export function getDefaultDisplayName(email = "") {
  const localPart = email.split("@")[0] || "Braille Vision User";
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export async function upsertProfileRecord({
  supabase,
  userId,
  email,
  displayName,
  role = "member",
  preferences = DEFAULT_PROFILE_PREFERENCES,
}) {
  if (!supabase || !userId || !email) {
    throw new Error("A user session is required before syncing the profile.");
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      display_name: displayName || getDefaultDisplayName(email),
      role,
      preferences: normalizeProfilePreferences(preferences),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw error;
  }
}

export async function updateProfileRecord({
  supabase,
  userId,
  displayName,
  preferences,
}) {
  if (!supabase || !userId) {
    throw new Error("A user session is required before updating the profile.");
  }

  const updates = {};

  if (displayName) {
    updates.display_name = displayName.trim();
  }

  if (preferences) {
    updates.preferences = normalizeProfilePreferences(preferences);
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);

  if (error) {
    throw error;
  }
}

export async function getProfileRecord(supabase, userId) {
  if (!supabase || !userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, preferences, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    preferences: normalizeProfilePreferences(data.preferences),
  };
}
