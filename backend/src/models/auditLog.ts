import { Schema, model, type InferSchemaType } from 'mongoose';

export const AUDIT_ACTIONS = ['create', 'update', 'delete'] as const;
export const AUDIT_ENTITIES = ['transaction', 'member'] as const;

// Append-only history of changes to transactions and members. Never updated or deleted.
const auditLogSchema = new Schema(
  {
    splitterId: { type: Schema.Types.ObjectId, ref: 'Splitter', required: true },
    // What changed. Entries written before DAN-37 have no entity and are all transactions.
    entity: { type: String, enum: AUDIT_ENTITIES, default: 'transaction' },
    // Set when entity is transaction.
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    // Set when entity is member: the member added, renamed or removed (DAN-37).
    targetMemberId: { type: Schema.Types.ObjectId, ref: 'Member' },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    // Member acting, and the device they acted from.
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    // Required for transactions, whose edit rights are bound to a device. Member changes are made
    // by the signed-in admin, whose request may come without a device id (another app's API call).
    deviceId: { type: String },
    // Plain snapshots. before is null on create, after is null on delete.
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.pre('validate', function () {
  if (this.entity === 'transaction' && (!this.transactionId || !this.deviceId)) {
    this.invalidate('transactionId', 'transaction entries need transactionId and deviceId');
  }
  if (this.entity === 'member' && !this.targetMemberId) {
    this.invalidate('targetMemberId', 'member entries need targetMemberId');
  }
});

auditLogSchema.index({ transactionId: 1, createdAt: 1 });
auditLogSchema.index({ targetMemberId: 1, createdAt: 1 });
auditLogSchema.index({ splitterId: 1, createdAt: -1 });

export type AuditLog = InferSchemaType<typeof auditLogSchema>;
export const AuditLogModel = model('AuditLog', auditLogSchema);
