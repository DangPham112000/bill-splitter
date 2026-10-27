/**
 * Device identity (DAN-30). A random id this browser keeps in localStorage and sends with every
 * request as X-Device-Id. The server also keeps it in an httpOnly cookie and hands it back if
 * localStorage gets cleared (see registerDevice). Private browsing, clearing site data, or
 * opening the link in another app's browser (Zalo, Facebook) still makes a new device.
 */

const STORAGE_KEY = 'bill-splitter.deviceId';

// Kept in memory too, for browsers that block localStorage: the id then lasts for this page load,
// and the cookie still brings the device back on the next one.
let current: string | null = null;

function randomUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Older browsers: a version 4 UUID from getRandomValues.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** This browser's deviceId, created on first use. */
export function getDeviceId(): string {
  if (current) return current;
  const stored = readStored();
  current = stored && /^[0-9a-f-]{36}$/i.test(stored) ? stored : randomUuid();
  if (current !== stored) setDeviceId(current);
  return current;
}

/** Keep the id the server settled on (it may restore an older one from the cookie). */
export function setDeviceId(id: string) {
  current = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage blocked: the in-memory id and the server's cookie still work for now.
  }
}

/** A readable name for this browser, such as "iPhone · Safari" or "Windows · Chrome". */
export function deviceLabel(
  ua: string = navigator.userAgent,
  touchPoints: number = navigator.maxTouchPoints ?? 0,
): string {
  return `${osName(ua, touchPoints)} · ${browserName(ua)}`;
}

function osName(ua: string, touchPoints: number): string {
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  // iPadOS 13+ reports itself as a Mac; only the touch screen gives it away.
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
  if (/CrOS/.test(ua)) return 'Chromebook';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown device';
}

// Order matters: in-app browsers and Chromium forks also say "Chrome" and "Safari".
const BROWSERS: [RegExp, string][] = [
  [/Zalo/i, 'Zalo'],
  [/FBAN|FBAV|FB_IAB/, 'Facebook'],
  [/Messenger|FBMessenger/i, 'Messenger'],
  [/Instagram/, 'Instagram'],
  [/Line\//, 'LINE'],
  [/TikTok|musical_ly|BytedanceWebview/i, 'TikTok'],
  [/coc_coc_browser/i, 'Cốc Cốc'],
  [/SamsungBrowser/, 'Samsung Internet'],
  [/EdgA?\/|EdgiOS/, 'Edge'],
  [/OPR\/|OPiOS|Opera/, 'Opera'],
  [/Firefox|FxiOS/, 'Firefox'],
  [/Chrome|CriOS|Chromium/, 'Chrome'],
  [/Safari/, 'Safari'],
];

function browserName(ua: string): string {
  return BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? 'Browser';
}
