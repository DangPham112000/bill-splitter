import { Schema, model, type InferSchemaType } from 'mongoose';

export const AUDIT_ACTIONS = ['create', 'update', 'delete'] as const;

// Append-only history of transaction changes. Never updated or deleted.
const auditLogSchema = new Schema(
  {
    splitterId: { type: Schema.Types.ObjectId, ref: 'Splitter', required: true },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    // Member acting, and the device they acted from.
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    deviceId: { type: String, required: true },
    // Plain snapshots of the transaction. before is null on create, after is null on delete.
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ transactionId: 1, createdAt: 1 });
auditLogSchema.index({ splitterId: 1, createdAt: -1 });

export type AuditLog = InferSchemaType<typeof auditLogSchema>;
export const AuditLogModel = model('AuditLog', auditLogSchema);
