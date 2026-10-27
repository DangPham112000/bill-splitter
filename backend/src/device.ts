import type { Request, Response } from 'express';
import { GraphQLError } from 'graphql';
import { DeviceModel } from './models/index.js';

/**
 * Device identity (DAN-30). Members don't sign in, so edit rights are bound to the browser that
 * created an entry. The browser keeps a random deviceId in localStorage and sends it with every
 * request; the server also keeps it in an httpOnly cookie, which survives a cleared localStorage
 * (Safari wipes localStorage after 7 days without a visit, but not server-set cookies).
 *
 * A deviceId works like a password for that device's entries: never return another device's id.
 */

export const DEVICE_HEADER = 'x-device-id';
const DEVICE_COOKIE = 'bs_device';
// Chrome caps cookie lifetime at 400 days.
const COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isDeviceId = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);

/** The deviceId the client sent in the X-Device-Id header, or null if missing or malformed. */
export function deviceIdFromHeader(req: Request): string | null {
  const value = req.headers[DEVICE_HEADER];
  return isDeviceId(value) ? value.toLowerCase() : null;
}

/** The deviceId kept in the httpOnly cookie, or null. */
export function deviceIdFromCookie(req: Request): string | null {
  for (const part of req.headers.cookie?.split(';') ?? []) {
    const [name, ...rest] = part.trim().split('=');
    if (name === DEVICE_COOKIE) {
      const value = decodeURIComponent(rest.join('='));
      return isDeviceId(value) ? value.toLowerCase() : null;
    }
  }
  return null;
}

export function setDeviceCookie(res: Response, deviceId: string) {
  res.cookie(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    // The app is served over HTTPS (Cloudflare); browsers also accept Secure cookies on localhost.
    secure: true,
    sameSite: 'lax',
    path: '/graphql',
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

/**
 * Which deviceId to keep when the browser registers. Normally the one it sent. If the browser
 * sent a brand-new id but its cookie points at a device we already know, localStorage was
 * cleared: give the old id back so the person keeps their edit rights.
 */
export async function resolveDeviceId(sent: string, cookie: string | null): Promise<string> {
  if (!cookie || cookie === sent) return sent;
  const [sentKnown, cookieKnown] = await Promise.all([
    DeviceModel.exists({ deviceId: sent }),
    DeviceModel.exists({ deviceId: cookie }),
  ]);
  return !sentKnown && cookieKnown ? cookie : sent;
}

/** A label for display only; the client builds it from the user agent. */
export function cleanLabel(label: string): string {
  return label.replace(/\s+/g, ' ').trim().slice(0, 100) || 'Unknown device';
}

/** The registered device this request comes from; throws if the browser has none. */
export async function requireDevice(deviceId: string | null) {
  const device = deviceId ? await DeviceModel.findOne({ deviceId }) : null;
  if (!device) {
    throw new GraphQLError('This browser is not registered as a device yet. Reload the page.', {
      extensions: { code: 'DEVICE_REQUIRED' },
    });
  }
  return device;
}
