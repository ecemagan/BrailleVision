export const DEFAULT_PROFILE_PREFERENCES = {
  dashboardDensity: "comfortable",
  documentView: "library",
  themeAccent: "lilac",
};

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
      preferences,
    },
    { onConflict: "id" },
  );

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

  return data;
}
