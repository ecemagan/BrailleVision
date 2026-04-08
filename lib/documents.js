export async function saveDocumentRecord({
  supabase,
  userId,
  fileName,
  originalText,
  brailleText,
  sourceType = "manual",
  conversionMode = "text",
}) {
  if (!supabase || !userId) {
    throw new Error("A signed-in user is required to save document history.");
  }

  const { error } = await supabase.from("documents").insert({
    user_id: userId,
    file_name: fileName,
    original_text: originalText,
    braille_text: brailleText,
    source_type: sourceType,
    conversion_mode: conversionMode,
  });

  if (error) {
    throw error;
  }
}
