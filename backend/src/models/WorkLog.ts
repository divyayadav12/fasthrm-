import mongoose, { Document, Schema } from 'mongoose';

export interface IWorkLog extends Document {
  employeeId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  taskId?: mongoose.Types.ObjectId;
  customTaskTitle?: string;
  status: 'NOT_STARTED' | 'WORKING' | 'IN_REVIEW' | 'ON_HOLD' | 'BLOCKED' | 'PENDING' | 'COMPLETED';
  progress: number;
  description?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // duration in minutes
}

const workLogSchema = new Schema<IWorkLog>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
    customTaskTitle: { type: String },
    status: {
      type: String,
      enum: ['NOT_STARTED', 'WORKING', 'IN_REVIEW', 'ON_HOLD', 'BLOCKED', 'PENDING', 'COMPLETED'],
      required: true,
    },
    progress: { type: Number, required: true },
    description: { type: String },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    duration: { type: Number },
  },
  { timestamps: true }
);

// Indexes to speed up queries by history filters
workLogSchema.index({ employeeId: 1, createdAt: -1 });
workLogSchema.index({ projectId: 1 });
workLogSchema.index({ taskId: 1 });
workLogSchema.index({ projectId: 1, taskId: 1 });
workLogSchema.index({ status: 1 });

const WorkLog = mongoose.model<IWorkLog>('WorkLog', workLogSchema);
export default WorkLog;
