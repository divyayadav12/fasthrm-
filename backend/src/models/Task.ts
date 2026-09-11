import mongoose, { Document, Schema } from 'mongoose';

export interface ITask extends Document {
  title: string;
  description?: string;
  restartReason?: string;
  projectId?: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'NOT_STARTED' | 'WORKING' | 'IN_REVIEW' | 'ON_HOLD' | 'BLOCKED' | 'PENDING' | 'COMPLETED';
  progress: number;
  deadline?: Date;
  completedAt?: Date;
}

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    description: { type: String },
    restartReason: { type: String },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['NOT_STARTED', 'WORKING', 'IN_REVIEW', 'ON_HOLD', 'BLOCKED', 'PENDING', 'COMPLETED'],
      default: 'NOT_STARTED',
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    deadline: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

const Task = mongoose.model<ITask>('Task', taskSchema);
export default Task;
