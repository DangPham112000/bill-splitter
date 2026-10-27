import { GraphQLError } from 'graphql';
import type { Context } from '../auth.js';
import {
  cleanLabel,
  isDeviceId,
  requireDevice,
  resolveDeviceId,
  setDeviceCookie,
} from '../device.js';
import { DeviceModel, type Device } from '../models/index.js';

const badInput = (message: string) =>
  new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });

/** Only ever the caller's own device: its deviceId is returned, so never resolve another one. */
const thisDevice = (device: Device) => ({
  deviceId: device.deviceId,
  label: device.label,
  nickname: device.nickname || null,
  firstSeenAt: device.firstSeenAt.toISOString(),
});

export const deviceResolvers = {
  Query: {
    thisDevice: async (_parent: unknown, _args: unknown, context: Context) => {
      if (!context.deviceId) return null;
      const device = await DeviceModel.findOne({ deviceId: context.deviceId });
      return device && thisDevice(device);
    },
  },

  Mutation: {
    registerDevice: async (
      _parent: unknown,
      { deviceId, label }: { deviceId: string; label: string },
      context: Context,
    ) => {
      if (!isDeviceId(deviceId)) throw badInput('deviceId must be a UUID');
      const id = await resolveDeviceId(deviceId.toLowerCase(), context.cookieDeviceId);
      const now = new Date();
      const device = await DeviceModel.findOneAndUpdate(
        { deviceId: id },
        { $set: { label: cleanLabel(label), lastSeenAt: now }, $setOnInsert: { firstSeenAt: now } },
        { upsert: true, returnDocument: 'after', runValidators: true },
      );
      setDeviceCookie(context.res, id);
      return thisDevice(device);
    },

    setDeviceNickname: async (
      _parent: unknown,
      { nickname }: { nickname?: string | null },
      context: Context,
    ) => {
      const device = await requireDevice(context.deviceId);
      const clean = nickname?.replace(/\s+/g, ' ').trim() ?? '';
      if (clean.length > 50) throw badInput('Keep the nickname under 50 characters');
      device.nickname = clean || undefined;
      await device.save();
      return thisDevice(device);
    },
  },
};
