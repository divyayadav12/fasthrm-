import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff, KeyRound, Mail, CheckCircle2, ArrowLeft, ShieldCheck, Lock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://fasthrm.onrender.com/api';

const ForgotPassword = () => {
  const navigate = useNavigate();

  // Steps: 'EMAIL' | 'OTP' | 'PASSWORD' | 'SUCCESS'
  const [step, setStep] = useState<'EMAIL' | 'OTP' | 'PASSWORD' | 'SUCCESS'>('EMAIL');

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // Step 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/auth/forgot-password`, { email: email.trim() });
      setSuccessMsg(res.data.message || 'OTP generated successfully.');
      if (res.data.devOtp) {
        setDevOtp(res.data.devOtp);
      }
      setStep('OTP');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (otp.trim().length !== 6) {
      setError('Please enter a valid 6-digit OTP code.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/verify-otp`, {
        email: email.trim(),
        otp: otp.trim(),
      });
      setSuccessMsg(res.data.message || 'OTP verified successfully.');
      setStep('PASSWORD');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/reset-password`, {
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });
      setSuccessMsg(res.data.message || 'Password has been reset successfully.');
      setStep('SUCCESS');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-6 sm:p-10 rounded-2xl shadow-lg border border-gray-100">
        
        {/* Header */}
        <div className="text-center">
          <img src="/logo.png" alt="FAST Logo" className="mx-auto h-16 w-auto object-contain mb-3" />
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            {step === 'SUCCESS' ? 'Password Reset Complete' : 'Reset Password'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {step === 'EMAIL' && 'Enter your registered email to receive a verification OTP'}
            {step === 'OTP' && 'Enter the 6-digit verification code sent to your email / admin'}
            {step === 'PASSWORD' && 'Create a secure new password for your account'}
            {step === 'SUCCESS' && 'Your password has been changed successfully'}
          </p>
        </div>

        {/* Step Indicator */}
        {step !== 'SUCCESS' && (
          <div className="flex items-center justify-center space-x-2 py-2">
            <div className={`h-2 rounded-full transition-all duration-300 ${step === 'EMAIL' ? 'w-8 bg-indigo-600' : 'w-2 bg-indigo-200'}`} />
            <div className={`h-2 rounded-full transition-all duration-300 ${step === 'OTP' ? 'w-8 bg-indigo-600' : 'w-2 bg-indigo-200'}`} />
            <div className={`h-2 rounded-full transition-all duration-300 ${step === 'PASSWORD' ? 'w-8 bg-indigo-600' : 'w-2 bg-indigo-200'}`} />
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm rounded-xl text-center">
            {error}
          </div>
        )}

        {/* Success Alert */}
        {successMsg && step !== 'SUCCESS' && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs sm:text-sm rounded-xl text-center">
            {successMsg}
          </div>
        )}

        {/* Dev OTP Box for quick helper */}
        {devOtp && step === 'OTP' && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-center justify-between">
            <span><strong>Testing OTP Code:</strong> <span className="font-mono text-sm tracking-widest font-bold text-indigo-700">{devOtp}</span></span>
            <button
              type="button"
              onClick={() => setOtp(devOtp)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline"
            >
              Auto Fill
            </button>
          </div>
        )}

        {/* STEP 1: Enter Email */}
        {step === 'EMAIL' && (
          <form className="mt-6 space-y-5" onSubmit={handleRequestOtp}>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Registered Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  className="block w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl bg-white placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm shadow-2xs"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
            >
              {loading ? 'Sending OTP...' : 'Send Verification OTP'}
            </button>

            <div className="text-center pt-2">
              <Link to="/login" className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Sign In
              </Link>
            </div>
          </form>
        )}

        {/* STEP 2: Enter OTP */}
        {step === 'OTP' && (
          <form className="mt-6 space-y-5" onSubmit={handleVerifyOtp}>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  6-Digit OTP Code
                </label>
                <button
                  type="button"
                  onClick={() => { setStep('EMAIL'); setError(''); setSuccessMsg(''); }}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Change Email
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  required
                  className="block w-full pl-10 pr-3.5 py-3 border border-gray-300 rounded-xl bg-white placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center font-mono text-xl tracking-[0.4em] font-bold shadow-2xs"
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
                <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
              </div>
              <p className="text-[11px] text-gray-500 mt-1 text-center">
                OTP valid for 15 minutes. Check your registered inbox or ask Admin.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
            >
              {loading ? 'Verifying...' : 'Verify OTP Code'}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={loading}
                className="text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                Resend OTP
              </button>
              <Link to="/login" className="text-gray-500 hover:text-gray-700">
                Cancel
              </Link>
            </div>
          </form>
        )}

        {/* STEP 3: Create New Password */}
        {step === 'PASSWORD' && (
          <form className="mt-6 space-y-4" onSubmit={handleResetPassword}>
            <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center space-x-2 text-xs text-indigo-800">
              <ShieldCheck className="h-4 w-4 text-indigo-600 flex-shrink-0" />
              <span className="truncate">Verified identity for <strong>{email}</strong></span>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl bg-white placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm shadow-2xs"
                  placeholder="Enter new password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl bg-white placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm shadow-2xs"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all shadow-md hover:shadow-lg mt-2"
            >
              {loading ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        )}

        {/* STEP 4: Success */}
        {step === 'SUCCESS' && (
          <div className="mt-6 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <p className="text-sm text-gray-600">
              Your password has been successfully updated. You can now use your new password to sign into your Fast HRM account.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md hover:shadow-lg transition-all"
            >
              Back to Sign In
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ForgotPassword;
