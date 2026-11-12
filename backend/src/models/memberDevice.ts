import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * A name picked on a device through the join link (DAN-41). Members don't sign in, so this is what
 * lets a device open a splitter, and which member it acts as there: the row used most recently.
 * Older rows stay, so the join screen can mark names "used on this device" (and DAN-42 can switch).
 */
const memberDeviceSchema = new Schema({
  splitterId: { type: Schema.Types.ObjectId, ref: 'Splitter', required: true },
  memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
  deviceId: { type: String, required: true },
  firstUsedAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now },
});

memberDeviceSchema.index({ splitterId: 1, deviceId: 1, memberId: 1 }, { unique: true });
memberDeviceSchema.index({ splitterId: 1, deviceId: 1, lastUsedAt: -1 });
memberDeviceSchema.index({ memberId: 1 });

export type MemberDevice = InferSchemaType<typeof memberDeviceSchema>;
export const MemberDeviceModel = model('MemberDevice', memberDeviceSchema);
