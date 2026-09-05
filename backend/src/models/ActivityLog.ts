import mongoose, { Document, Schema } from 'mongoose';

export interface IActivityLog extends Document {
  employeeId: mongoose.Types.ObjectId;
  action: string;
  projectId?: mongoose.Types.ObjectId;
  taskId?: mongoose.Types.ObjectId;
  metadata?: any;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
export default ActivityLog;
