const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'EMPLOYEE' },
  adminScope: { type: String, default: 'ALL' },
  isActive: { type: Boolean, default: true }
});

const bcrypt = require('bcryptjs');
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

const User = mongoose.model('User', userSchema);

const seedAdmins = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workpulse');
  
  const admins = [
    {
      name: 'Ritesh Sir',
      email: 'linkritesh@gmail.com',
      password: 'Fast@123',
      role: 'ADMIN',
      adminScope: 'ONLY_FAST_CAREERS',
      isActive: true
    },
    {
      name: 'Pravin Sir',
      email: 'fast.pravinjain@gmail.com',
      password: 'Fast@123',
      role: 'ADMIN',
      adminScope: 'EXCLUDE_FAST_CAREERS',
      isActive: true
    }
  ];

  for (const adminData of admins) {
    const existing = await User.findOne({ email: adminData.email });
    if (existing) {
      existing.adminScope = adminData.adminScope;
      existing.role = adminData.role;
      existing.password = adminData.password;
      await existing.save();
      console.log(`Updated existing admin: ${adminData.email}`);
    } else {
      await User.create(adminData);
      console.log(`Created new admin: ${adminData.email}`);
    }
  }

  process.exit();
};

seedAdmins();
