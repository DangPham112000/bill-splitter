import { Schema, model, type InferSchemaType } from 'mongoose';

const deviceSchema = new Schema({
  // Random id generated and stored by the client (e.g. crypto.randomUUID in localStorage).
  deviceId: { type: String, required: true },
  // Derived from the user agent, e.g. "iPhone · Safari".
  label: { type: String, required: true, maxlength: 100 },
  // Optional name the user gives this device, e.g. "Dang's phone".
  nickname: { type: String, trim: true, maxlength: 50 },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
});

deviceSchema.index({ deviceId: 1 }, { unique: true });

export type Device = InferSchemaType<typeof deviceSchema>;
export const DeviceModel = model('Device', deviceSchema);
