import { Schema, model, type InferSchemaType } from 'mongoose';

// Personal API keys that let an AI agent or bot call /mcp as the user who made them (DAN-125).
// Only the SHA-256 hash is stored; the raw key is shown once, when it is created.
const apiKeySchema = new Schema(
  {
    // Clerk user id of the owner.
    userId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    hash: { type: String, required: true },
    // First characters of the key, so people can tell their keys apart.
    prefix: { type: String, required: true },
    lastUsedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

apiKeySchema.index({ hash: 1 }, { unique: true });
apiKeySchema.index({ userId: 1, createdAt: -1 });

export type ApiKey = InferSchemaType<typeof apiKeySchema>;
export const ApiKeyModel = model('ApiKey', apiKeySchema);
