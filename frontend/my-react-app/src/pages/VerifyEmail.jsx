import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api/client';

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // ⏱️ Countdown Timer State (10 minutes = 600 seconds)
  const [timeLeft, setTimeLeft] = useState(600);

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Format seconds into MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const response = await authApi.post('/api/v1/auth/verify-email', {
        email: email.trim(),
        code: code.trim(),
      });

      if (response.data.success || response.status === 200) {
        setSuccessMsg('Email verified successfully! Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Invalid or expired verification code');
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend / Re-registration trigger to generate a fresh OTP
  const handleResendCode = async () => {
    if (!email) {
      setError('Please provide a valid email address first.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setResending(true);

    try {
      // Re-invokes registration backend route to refresh OTP and extend 10-minute timer
      await authApi.post('/api/v1/auth/register', {
        username: email.split('@')[0], // fallback username assignment
        email: email.trim(),
        password: 'TemporaryPassword123!', // backend updates code without harming actual password hash if desired, or handle via dedicated resend endpoint
      });

      setSuccessMsg('A fresh verification code has been dispatched to your email.');
      setTimeLeft(600); // Reset timer back to 10 minutes
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend confirmation code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 border border-slate-700 rounded-xl bg-slate-900 text-slate-100 shadow-2xl">
      <h2 className="text-2xl font-bold text-center mb-2">🔐 Email Verification</h2>
      <p className="text-sm text-slate-400 text-center mb-4">
        Enter the 6-digit confirmation code sent to your inbox.
      </p>

      {/* ⏱️ Live Countdown Badge */}
      <div className="flex justify-center items-center mb-6">
        <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider border ${
          timeLeft > 60 ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse'
        }`}>
          ⏳ Code expires in: {timeLeft > 0 ? formatTime(timeLeft) : 'EXPIRED'}
        </span>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500 text-red-300 p-3 rounded-md text-sm mb-4 text-center">⚠️ {error}</div>}
      {successMsg && <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-300 p-3 rounded-md text-sm mb-4 text-center">✅ {successMsg}</div>}

      <form onSubmit={handleVerify}>
        <div className="mb-4">
          <label className="block mb-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">Email Address</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            className="w-full px-3 py-2 rounded-md border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500" 
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">6-Digit OTP Code</label>
          <input 
            type="text" 
            maxLength="6"
            placeholder="123456"
            value={code} 
            onChange={(e) => setCode(e.target.value)} 
            required 
            className="w-full py-3 rounded-md border border-slate-700 bg-slate-800 text-white text-xl text-center tracking-[0.5em] font-bold focus:outline-none focus:border-indigo-500" 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading || timeLeft <= 0}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-md transition duration-200 disabled:opacity-50 cursor-pointer mb-4"
        >
          {loading ? 'Verifying Code...' : 'Verify Account'}
        </button>

        {/* Resend Code Action */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={resending}
            className="text-xs font-mono text-indigo-400 hover:text-indigo-300 underline cursor-pointer disabled:opacity-50"
          >
            {resending ? 'Generating new code...' : "Didn't receive code? Resend Code"}
          </button>
        </div>
      </form>
    </div>
  );
}