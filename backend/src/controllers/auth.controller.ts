import { Request, Response } from 'express';
import User from '../models/User';
import Notification from '../models/Notification';
import generateToken from '../utils/generateToken';
import { sendEmail } from '../utils/sendEmail';
import { io } from '../index';

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Default to EMPLOYEE role for self-registered users, and save selected role as department
    const user = await User.create({
      name,
      email,
      password,
      role: 'EMPLOYEE',
      department: role || 'Editor DTP',
      designation: role || 'Editor DTP',
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        token: generateToken(user._id as any),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }

      // If a role was selected on login and user is not an ADMIN, update department & designation
      if (role && user.role !== 'ADMIN') {
        user.department = role;
        user.designation = role;
        await user.save();
      }

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        token: generateToken(user._id as any),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById((req as any).user._id).select('-password');
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout user (client side clears token, but can add blacklist here)
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = async (req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
};

// @desc    Request Password Reset OTP
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Please provide an email address' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account registered with this email address' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'This account is deactivated. Please contact your administrator.' });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry
    await user.save();

    // Send email via nodemailer
    const emailSent = await sendEmail({
      to: user.email,
      subject: 'Fast HRM - Password Reset OTP',
      text: `Hello ${user.name},\n\nYour Fast HRM password reset OTP is: ${otp}\nThis code will expire in 15 minutes.\n\nIf you did not make this request, please contact your administrator immediately.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #4f46e5; margin-bottom: 8px;">Fast HRM</h2>
          <h3 style="color: #1e293b; margin-top: 0;">Password Reset Request</h3>
          <p style="color: #475569; font-size: 15px;">Hello <strong>${user.name}</strong>,</p>
          <p style="color: #475569; font-size: 15px;">You requested to reset your password. Use the following 6-digit OTP code to verify your identity:</p>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #4f46e5;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 13px;">This OTP is valid for <strong>15 minutes</strong>.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">If you did not request this, please ignore this email or notify your system administrator.</p>
        </div>
      `,
    });

    // Create notifications for all Admins and broadcast via Socket.IO
    const adminUsers = await User.find({ role: 'ADMIN' });
    for (const admin of adminUsers) {
      await Notification.create({
        userId: admin._id,
        title: 'Password Reset Request',
        message: `Employee ${user.name} (${user.email}) requested a password reset. OTP: ${otp}`,
        type: 'WARNING',
      });
    }

    io.emit('admin_notification', {
      title: 'Password Reset Request',
      message: `Employee ${user.name} (${user.email}) requested a password reset OTP: ${otp}`,
      type: 'WARNING',
      email: user.email,
      otp,
      createdAt: new Date(),
    });

    res.json({
      message: emailSent
        ? 'OTP has been sent to your registered email.'
        : 'OTP generated and sent to Admin notification.',
      // Provide devOtp if SMTP not configured or for quick testing
      devOtp: process.env.SMTP_USER ? undefined : otp,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify Password Reset OTP
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const user = await User.findOne({
      email,
      resetPasswordOtp: otp,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    res.json({ message: 'OTP verified successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset Password with OTP
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const user = await User.findOne({
      email,
      resetPasswordOtp: otp,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Set new password (pre-save hook will hash it)
    user.password = newPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Broadcast success
    io.emit('admin_notification', {
      title: 'Password Reset Successful',
      message: `User ${user.name} (${user.email}) has successfully reset their password.`,
      type: 'SUCCESS',
      email: user.email,
      createdAt: new Date(),
    });

    res.json({ message: 'Password has been reset successfully. You can now login with your new password.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Active Password Reset Requests (Admin only)
// @route   GET /api/auth/reset-requests
// @access  Private (Admin)
export const getResetRequests = async (req: Request, res: Response) => {
  try {
    const requests = await User.find({
      resetPasswordOtp: { $exists: true, $ne: null },
      resetPasswordExpires: { $gt: new Date() },
    }).select('name email role department designation resetPasswordOtp resetPasswordExpires');

    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

