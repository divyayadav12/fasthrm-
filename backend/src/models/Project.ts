import mongoose, { Document, Schema } from 'mongoose';

export interface IProject extends Document {
  name: string;
  description?: string;
  projectManager: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  startDate?: Date;
  deadline?: Date;
  status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true },
    description: { type: String },
    projectManager: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    startDate: { type: Date },
    deadline: { type: Date },
    status: {
      type: String,
      enum: ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
      default: 'ACTIVE',
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
  },
  { timestamps: true }
);

const Project = mongoose.model<IProject>('Project', projectSchema);
export default Project;
