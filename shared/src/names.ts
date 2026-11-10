/**
 * Vietnamese name handling (DAN-32). "Phạm Đăng" can arrive in different Unicode forms
 * (precomposed from one keyboard, base letter + combining marks from another), with or
 * without accents, or with stray spaces pasted from a chat app. Names are stored as typed
 * but in NFC, and compared through a key with no accents and no case.
 */

// Zero-width characters that ride along when a name is copied from Zalo or Messenger.
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/g;

/** The name to store: NFC, invisible characters dropped, trimmed, single spaces. */
export function cleanName(name: string): string {
  return name.normalize('NFC').replace(INVISIBLE, '').trim().replace(/\s+/g, ' ');
}

/**
 * Case-, accent- and whitespace-insensitive key for duplicate checks and search:
 * "  Phạm  Đăng " and "pham dang" both give "pham dang". Old and new tone placement
 * ("Hòa" and "Hoà") give the same key too, since every mark is dropped.
 */
export function normalizeName(name: string): string {
  return (
    cleanName(name)
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      // đ has no decomposition. Ð (Icelandic eth) looks the same and is sometimes typed for it.
      .replace(/[đĐÐ]/g, 'd')
      .toLowerCase()
  );
}

/** Whether a name matches what was typed in a search box: "dang" finds "Phạm Đăng". */
export function nameMatches(name: string, query: string): boolean {
  const key = normalizeName(query);
  return key === '' || normalizeName(name).includes(key);
}

/** The first name that clashes with an earlier one in the list, or null when all differ. */
export function findSameName(names: string[]): { name: string; sameAs: string } | null {
  const seen = new Map<string, string>();
  for (const name of names) {
    const key = normalizeName(name);
    const first = seen.get(key);
    if (first !== undefined) return { name, sameAs: first };
    seen.set(key, name);
  }
  return null;
}
