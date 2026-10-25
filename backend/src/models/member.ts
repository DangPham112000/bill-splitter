import { Schema, model, type InferSchemaType } from 'mongoose';

export const MEMBER_ROLES = ['admin', 'treasurer', 'member'] as const;

/** Case-, accent- and whitespace-insensitive form used to detect duplicate names. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

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
  if (this.displayName) this.normalizedName = normalizeName(this.displayName);
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
