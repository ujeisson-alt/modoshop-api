import { Schema, model, InferSchemaType } from 'mongoose';

const activityLogSchema = new Schema(
  {
    userId: { type: Number, default: null, index: true },
    userRole: { type: String, enum: ['CUSTOMER', 'ADMIN', 'GUEST'], default: 'GUEST' },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: Number, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, collection: 'activity_logs' },
);

// Los logs se conservan 90 días
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export type ActivityLogDoc = InferSchemaType<typeof activityLogSchema>;
export const ActivityLog = model('ActivityLog', activityLogSchema);
