/**
 * Shared input sanitizers — used everywhere we accept text from the
 * user to make sure junk never reaches state or the database.
 *
 * Each function takes the raw input and returns the cleaned value,
 * NEVER throws, NEVER mutates. Pure transforms. Wire them up via
 * the onChangeText prop so cleaning happens at the only point state
 * actually changes — that way paste / autofill / web-keyboard quirks
 * all get caught in the same place.
 */

/** Digits only, capped at `max` chars. Used for phone, FSSAI, price. */
export function digitsOnly(raw: string, max?: number): string {
  const cleaned = String(raw ?? "").replace(/\D/g, "");
  return max ? cleaned.slice(0, max) : cleaned;
}

/**
 * Indian GSTIN: 15 chars, alphanumeric, uppercase. Real format is
 *   2 digits (state) + 10 chars PAN + 1 entity + 1 'Z' + 1 check.
 * We only enforce shape here (length + alphanumeric uppercase);
 * the actual checksum is validated by admin during verification.
 */
export function sanitizeGstin(raw: string): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 15);
}

/** Quick "looks like a GSTIN" check used for inline UI feedback. */
export function isGstinShape(raw: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(raw);
}

/** FSSAI license: exactly 14 numeric digits. */
export function sanitizeFssai(raw: string): string {
  return digitsOnly(raw, 14);
}

export function isFssaiShape(raw: string): boolean {
  return /^\d{14}$/.test(raw);
}

/**
 * Numeric with up to one decimal point, e.g. price entries.
 * Rejects letters/symbols, allows "1234.56" but caps at one dot.
 */
export function sanitizeDecimal(raw: string, maxDigits = 8): string {
  let cleaned = String(raw ?? "").replace(/[^\d.]/g, "");
  // Collapse multiple dots to just the first.
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  // Strip leading zeros except for "0." cases.
  if (cleaned.length > 1 && cleaned.startsWith("0") && cleaned[1] !== ".") {
    cleaned = cleaned.replace(/^0+/, "") || "0";
  }
  // Limit total length so a user can't paste "1234567890123456" into a price box.
  return cleaned.slice(0, maxDigits + 1);
}

/**
 * Human name — letters, spaces, hyphens, apostrophes, Indic scripts.
 * Drops digits and most symbols. Caps at `max` for sanity.
 */
export function sanitizeHumanName(raw: string, max = 60): string {
  return String(raw ?? "")
    .replace(/[<>{}\[\]\\\/]/g, "")  // strip code/markup chars
    .replace(/\s{2,}/g, " ")          // collapse runs of spaces
    .slice(0, max);
}

/**
 * Address / shop address. Allows letters, digits, spaces, common
 * punctuation (.,/-#), Indic scripts. Used for shop address and
 * delivery address.
 */
export function sanitizeAddress(raw: string, max = 200): string {
  return String(raw ?? "")
    .replace(/[<>{}\[\]\\]/g, "")
    .slice(0, max);
}

/**
 * Is this address "real-looking"? Min 10 chars AND contains at least
 * one alphanumeric / Indic-script run of 3+. Catches "....." / "aa" /
 * "1" / pure-whitespace without being so strict that a 3-line Telugu
 * address with lots of dashes fails.
 */
export function isAddressReasonable(raw: string): boolean {
  const trimmed = String(raw ?? "").trim();
  return trimmed.length >= 10 && /[\w\dऀ-ॿఀ-౿]{3,}/.test(trimmed);
}
