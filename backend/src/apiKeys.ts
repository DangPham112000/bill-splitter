import { createHash, randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { ApiKeyModel, DeviceModel } from './models/index.js';

/**
 * Personal API keys for AI agents and bots that cannot sign in through OAuth (DAN-125), like
 * Event Manager's `emk_` and News' `nwk_` keys. A key acts as the account that created it.
 */
export const API_KEY_PREFIX = 'bsk_';

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

type ApiKeyDoc = InstanceType<typeof ApiKeyModel>;

export const apiKeyInfo = (doc: ApiKeyDoc) => ({
  id: doc._id.toString(),
  name: doc.name,
  prefix: doc.prefix,
  createdAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
  lastUsedAt: doc.lastUsedAt?.toISOString() ?? null,
});

/** Create a key. The raw key is returned only here. */
export async function createApiKey(clerkId: string, name: string) {
  const key = API_KEY_PREFIX + randomBytes(32).toString('base64url');
  const doc = await ApiKeyModel.create({
    userId: clerkId,
    name: name.replace(/\s+/g, ' ').trim().slice(0, 100) || 'AI agent',
    hash: hashKey(key),
    prefix: key.slice(0, API_KEY_PREFIX.length + 6),
  });
  return { key, apiKey: apiKeyInfo(doc) };
}

export const listApiKeys = async (clerkId: string) =>
  (await ApiKeyModel.find({ userId: clerkId }).sort({ createdAt: -1 })).map(apiKeyInfo);

export async function revokeApiKey(clerkId: string, id: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(id)) return false;
  const result = await ApiKeyModel.deleteOne({ _id: id, userId: clerkId });
  return result.deletedCount === 1;
}

/** The Clerk id of a raw key's owner, or null when the key is unknown or revoked. */
export async function clerkIdFromApiKey(key: string): Promise<string | null> {
  if (!key.startsWith(API_KEY_PREFIX)) return null;
  const doc = await ApiKeyModel.findOneAndUpdate(
    { hash: hashKey(key) },
    { $set: { lastUsedAt: new Date() } },
  );
  return doc?.userId ?? null;
}

/**
 * The device an account's AI agents act from (DAN-125). Transactions are bound to the device
 * that added them (DAN-47), and an agent has no browser, so each account gets one server-side
 * device labelled "AI agent". Its deviceId is never sent anywhere, so a browser cannot claim it.
 */
export async function agentDeviceId(clerkId: string): Promise<string> {
  const now = new Date();
  try {
    const device = await DeviceModel.findOneAndUpdate(
      { agentUserId: clerkId },
      {
        $set: { lastSeenAt: now },
        $setOnInsert: { deviceId: randomUUID(), label: 'AI agent', firstSeenAt: now },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return device.deviceId;
  } catch (error) {
    // Two first requests at once: the other one created it.
    if ((error as { code?: number }).code !== 11000) throw error;
    const device = await DeviceModel.findOne({ agentUserId: clerkId });
    if (!device) throw error;
    return device.deviceId;
  }
}
