export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove non-word chars except dash
    .replace(/[\s_-]+/g, "-")  // collapse whitespace and underscores to dash
    .replace(/^-+|-+$/g, "");   // trim leading/trailing dashes
}

export function generateRandomSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function slugifyOrRandom(slugInput?: string, nameFallback?: string): string {
  if (slugInput && slugInput.trim().length > 0) {
    const cleaned = sanitizeSlug(slugInput);
    if (cleaned) return cleaned;
  }
  if (nameFallback && nameFallback.trim().length > 0) {
    const fromName = sanitizeSlug(nameFallback);
    if (fromName) {
      return `${fromName}-${generateRandomSlug().slice(0, 4)}`;
    }
  }
  return generateRandomSlug();
}
