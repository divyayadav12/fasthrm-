import mongoose, { Document, Schema } from 'mongoose';

export interface IStudentInquiry extends Document {
  inquiryId: string;
  studentName: string;
  mobileNumber: string;
  alternateNumber?: string;
  email?: string;
  callType: 'Enquiry' | 'Tech Issue' | 'Dispatch Related' | 'Purchases' | 'Others';
  subject?: string;
  details: string;
  remark?: string;
  status: 'Solved' | 'Follow Up' | 'Purchases' | 'Pending' | 'Others';
  addedBy: mongoose.Types.ObjectId;
  addedByName: string;
  addedByEmail?: string;
  addedByDepartment?: string;
  previousInquiryId?: string;
  previousInquiryRef?: mongoose.Types.ObjectId;
  followUpDate?: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const studentInquirySchema = new Schema<IStudentInquiry>(
  {
    inquiryId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      index: true,
    },
    alternateNumber: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      default: '',
    },
    callType: {
      type: String,
      enum: ['Enquiry', 'Tech Issue', 'Dispatch Related', 'Purchases', 'Others'],
      default: 'Enquiry',
      required: true,
    },
    subject: {
      type: String,
      trim: true,
      default: '',
    },
    details: {
      type: String,
      required: [true, 'Inquiry details are required'],
      trim: true,
    },
    remark: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Solved', 'Follow Up', 'Purchases', 'Pending', 'Others'],
      default: 'Follow Up',
      required: true,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    addedByName: {
      type: String,
      required: true,
    },
    addedByEmail: {
      type: String,
      default: '',
    },
    addedByDepartment: {
      type: String,
      default: '',
    },
    previousInquiryId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    previousInquiryRef: {
      type: Schema.Types.ObjectId,
      ref: 'StudentInquiry',
    },
    followUpDate: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup
studentInquirySchema.index({ mobileNumber: 1, createdAt: -1 });
studentInquirySchema.index({ studentName: 'text', details: 'text', subject: 'text' });

const StudentInquiry = mongoose.model<IStudentInquiry>('StudentInquiry', studentInquirySchema);
export default StudentInquiry;
