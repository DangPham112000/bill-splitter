import { Schema, model, type InferSchemaType } from 'mongoose';
// Shared with the frontend, so names match the same way on both sides (DAN-32).
import { cleanName, normalizeName } from '@bill-splitter/shared';

export const MEMBER_ROLES = ['admin', 'treasurer', 'member'] as const;

const memberSchema = new Schema(
  {
    splitterId: { type: Schema.Types.ObjectId, ref: 'Splitter', required: true },
    displayName: { type: String, required: true, trim: true, maxlength: 50 },
    normalizedName: { type: String, required: true },
    role: { type: String, enum: MEMBER_ROLES, default: 'member' },
    // Clerk user id, set when the member is linked to a signed-in account (required for the admin).
    userId: { type: String },
    // Device that created this name, so it can be offered again on that device.
    createdByDeviceId: { type: String },
    // Soft delete: removed members keep their history.
    removedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

memberSchema.pre('validate', function () {
  if (this.displayName) {
    this.displayName = cleanName(this.displayName);
    this.normalizedName = normalizeName(this.displayName);
  }
});

// One active member per name in a splitter. removedAt defaults to null, so $type matches it.
memberSchema.index(
  { splitterId: 1, normalizedName: 1 },
  { unique: true, partialFilterExpression: { removedAt: { $type: 'null' } } },
);
memberSchema.index({ splitterId: 1, role: 1 });
memberSchema.index({ userId: 1 }, { sparse: true });

export type Member = InferSchemaType<typeof memberSchema>;
export const MemberModel = model('Member', memberSchema);
