import { Schema, model, type InferSchemaType } from 'mongoose';
import { isPositiveVndAmount, vndValidator } from './money.js';

export const TRANSACTION_TYPES = ['expense', 'income', 'fund_contribution', 'transfer'] as const;
export const SPLIT_METHODS = ['equal', 'exact', 'shares'] as const;

const participantSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    // Number of shares for the "shares" method (e.g. 2 for someone who brought a partner).
    shares: { type: Number, min: 1, validate: Number.isSafeInteger },
    // Resolved amount in VND for every method, so balances never re-run the split.
    amount: { type: Number, required: true, validate: vndValidator },
  },
  { _id: false },
);

const splitSchema = new Schema(
  {
    method: { type: String, enum: SPLIT_METHODS, required: true },
    participants: { type: [participantSchema], required: true },
  },
  { _id: false },
);

const transactionSchema = new Schema(
  {
    splitterId: { type: Schema.Types.ObjectId, ref: 'Splitter', required: true },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    amount: {
      type: Number,
      required: true,
      validate: { validator: isPositiveVndAmount, message: 'amount must be a positive whole VND' },
    },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    category: { type: String, trim: true, maxlength: 50 },
    date: { type: Date, required: true, default: Date.now },
    // Who handed over the money: expense payer, fund contributor, or transfer sender.
    paidByMemberId: { type: Schema.Types.ObjectId, ref: 'Member' },
    // Who got the money: income receiver or transfer recipient.
    receivedByMemberId: { type: Schema.Types.ObjectId, ref: 'Member' },
    // Expense paid out of the initial fund instead of by a member.
    paidFromFund: { type: Boolean, default: false },
    // Who the expense or income is shared between. Not used by fund contributions or transfers.
    split: { type: splitSchema },
    createdByMemberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    // Edit rights are bound to this device (see docs/data-model.md).
    createdByDeviceId: { type: String, required: true },
    // Soft delete, so balances can drop it while the audit log keeps the history.
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Type-specific rules that a flat schema cannot express.
transactionSchema.pre('validate', function () {
  const errors: string[] = [];
  const participants = this.split?.participants ?? [];
  const hasSplit = participants.length > 0;

  switch (this.type) {
    case 'expense':
      if (this.paidFromFund === Boolean(this.paidByMemberId)) {
        errors.push('expense needs either paidByMemberId or paidFromFund, not both');
      }
      if (!hasSplit) errors.push('expense needs a split');
      break;
    case 'income':
      if (!this.receivedByMemberId) errors.push('income needs receivedByMemberId');
      if (!hasSplit) errors.push('income needs a split');
      break;
    case 'fund_contribution':
      if (!this.paidByMemberId) errors.push('fund_contribution needs paidByMemberId');
      if (hasSplit) errors.push('fund_contribution cannot have a split');
      break;
    case 'transfer':
      if (!this.paidByMemberId || !this.receivedByMemberId) {
        errors.push('transfer needs paidByMemberId and receivedByMemberId');
      } else if (this.paidByMemberId.equals(this.receivedByMemberId)) {
        errors.push('transfer cannot be to the same member');
      }
      if (hasSplit) errors.push('transfer cannot have a split');
      break;
  }
  if (this.type !== 'expense' && this.paidFromFund)
    errors.push('only expenses can be paidFromFund');
  if (this.type === 'income' && this.paidByMemberId)
    errors.push('income cannot have paidByMemberId');

  if (hasSplit) {
    const ids = participants.map((p) => p.memberId.toString());
    if (new Set(ids).size !== ids.length) errors.push('split has duplicate participants');
    const total = participants.reduce((sum, p) => sum + p.amount, 0);
    if (total !== this.amount)
      errors.push(`split amounts sum to ${total}, expected ${this.amount}`);
    if (this.split?.method === 'shares' && participants.some((p) => !p.shares)) {
      errors.push('shares split needs shares for every participant');
    }
  }

  if (errors.length > 0) this.invalidate('type', errors.join('; '));
});

transactionSchema.index({ splitterId: 1, deletedAt: 1, date: -1 });
transactionSchema.index({ splitterId: 1, createdByMemberId: 1 });
transactionSchema.index({ createdByDeviceId: 1 });

export type Transaction = InferSchemaType<typeof transactionSchema>;
export const TransactionModel = model('Transaction', transactionSchema);
