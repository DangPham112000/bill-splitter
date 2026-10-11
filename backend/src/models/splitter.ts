import { Schema, model, type InferSchemaType } from 'mongoose';
import { DEFAULT_CURRENCY, currencyValidator } from './money.js';

export const SPLITTER_TYPES = ['trip', 'party', 'project', 'other'] as const;
export const SPLITTER_STATUSES = ['open', 'locked'] as const;

const splitterSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    type: { type: String, enum: SPLITTER_TYPES, default: 'trip' },
    startDate: { type: Date },
    endDate: { type: Date },
    // Currency every balance is computed in, e.g. THB for a Bangkok trip. Chosen at creation;
    // changing it later would mean converting every transaction.
    currency: {
      type: String,
      uppercase: true,
      default: DEFAULT_CURRENCY,
      validate: currencyValidator,
    },
    // Secret part of the join link. Regenerating it invalidates old links.
    inviteToken: { type: String, required: true },
    hasInitialFund: { type: Boolean, default: false },
    // "locked" freezes transactions once the group has settled up.
    status: { type: String, enum: SPLITTER_STATUSES, default: 'open' },
    // Auth provider user id of the signed-in creator.
    adminUserId: { type: String, required: true },
  },
  { timestamps: true },
);

splitterSchema.pre('validate', function () {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'endDate must not be before startDate');
  }
});

splitterSchema.index({ inviteToken: 1 }, { unique: true });
splitterSchema.index({ adminUserId: 1, createdAt: -1 });

export type Splitter = InferSchemaType<typeof splitterSchema>;
export const SplitterModel = model('Splitter', splitterSchema);
