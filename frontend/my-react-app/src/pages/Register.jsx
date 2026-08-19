import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../services/api/client'; // ⚡ Route through API Gateway (:8080)

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Toggle states for password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    if (formData.username.trim().length < 3 || formData.username.length > 32) {
      setError('Username must be between 3 and 32 characters.');
      setIsSubmitting(false);
      return;
    }

    if (formData.password.length < 6 || formData.password.length > 72) {
      setError('Password must be between 6 and 72 characters.');
      setIsSubmitting(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Password and Confirm Password do not match.');
      setIsSubmitting(false);
      return;
    }

    try {
      // ⚡ Clean routing through API Gateway via authApi client
      const response = await authApi.post('/api/v1/auth/register', {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      const data = response.data;

      if (!response.status === 200 && !data.success) {
        throw new Error(data.error || data.message || 'Registration failed');
      }

      setSuccess(data.message || 'Registration structural handshake verified! Check inbox for OTP verification.');
      
      const registeredEmail = formData.email.trim();
      setFormData({ username: '', email: '', password: '', confirmPassword: '' });
      
      // Redirect to the OTP verification screen passing email state
      setTimeout(() => {
        navigate('/verify-email', { state: { email: registeredEmail } });
      }, 1500);

    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Internal pipeline connection error');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 transition-colors duration-200" 
         style={{ backgroundColor: 'var(--bg)' }}>
      
      {/* Premium Glassmorphism Cyber Card Container */}
      <div className="w-full max-w-md rounded-2xl border p-8 transition-all duration-300 shadow-xl"
           style={{ 
             backgroundColor: 'var(--code-bg)', 
             borderColor: 'var(--border)', 
             boxShadow: 'var(--shadow)' 
           }}>
        
        {/* Top Header Identity Layout */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl items-center justify-center font-bold text-white text-xl shadow-md mb-4"
               style={{ background: 'linear-gradient(135deg, var(--accent), #7c3aed)' }}>
            ⚙️
          </div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-h)' }}>
            Create Account
          </h2>
          <p className="text-xs mt-1.5 font-mono uppercase tracking-wider opacity-60">
            Initialize Operator Credentials
          </p>
        </div>

        {/* Global Pipeline Response Messages */}
        {error && (
          <div className="mb-6 p-3.5 rounded-lg border flex items-center gap-2.5 text-xs font-semibold tracking-wide text-rose-500"
               style={{ borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-3.5 rounded-lg border flex items-center gap-2.5 text-xs font-semibold tracking-wide text-emerald-500"
               style={{ borderColor: 'rgba(16, 185, 129, 0.4)', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
            <span>✓</span>
            <p>{success}</p>
          </div>
        )}

        {/* Interactive Data Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          
          {/* Username Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 font-mono" 
                   style={{ color: 'var(--text-h)' }}>
              Operator Username
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="e.g., cyber_operator"
              className="w-full px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 outline-none bg-transparent"
              style={{ borderColor: 'var(--border)', color: 'var(--text-h)' }}
            />
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 font-mono" 
                   style={{ color: 'var(--text-h)' }}>
              Network Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="name@company.com"
              className="w-full px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 outline-none bg-transparent"
              style={{ borderColor: 'var(--border)', color: 'var(--text-h)' }}
            />
          </div>

          {/* Password Field with See/Unsee Toggle */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 font-mono" 
                   style={{ color: 'var(--text-h)' }}>
              Access Security Key
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Min. 6 parameters"
                className="w-full px-4 py-3 pr-12 rounded-xl border text-sm font-medium transition-all duration-150 outline-none bg-transparent"
                style={{ borderColor: 'var(--border)', color: 'var(--text-h)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono opacity-60 hover:opacity-100 transition-opacity px-2 py-1"
                style={{ color: 'var(--text-h)' }}
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          {/* Confirm Password Field with See/Unsee Toggle */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 font-mono" 
                   style={{ color: 'var(--text-h)' }}>
              Confirm Security Key
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Re-enter security key"
                className="w-full px-4 py-3 pr-12 rounded-xl border text-sm font-medium transition-all duration-150 outline-none bg-transparent"
                style={{ borderColor: 'var(--border)', color: 'var(--text-h)' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono opacity-60 hover:opacity-100 transition-opacity px-2 py-1"
                style={{ color: 'var(--text-h)' }}
              >
                {showConfirmPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          {/* Premium Registration Form Button */}
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full mt-3 py-3.5 px-4 rounded-xl text-sm font-bold tracking-wider uppercase transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer"
            style={{ 
              backgroundColor: isSubmitting ? 'var(--border)' : 'var(--accent)', 
              color: isSubmitting ? 'var(--text)' : 'var(--bg)',
              boxShadow: isSubmitting ? 'none' : '0 4px 14px rgba(170, 59, 255, 0.3)' 
            }}
          >
            {isSubmitting ? (
              <div className="h-4 w-4 border-2 rounded-full animate-spin border-current border-t-transparent"></div>
            ) : (
              <span>Provision Account</span>
            )}
          </button>
        </form>

        {/* Dynamic Back-routing Section Footer */}
        <div className="mt-6 text-center text-xs font-medium">
          <span style={{ color: 'var(--text)' }}>Already configured? </span>
          <Link to="/login" className="font-bold underline hover:opacity-80 transition-opacity" style={{ color: 'var(--accent)' }}>
            Authenticate Operator Session
          </Link>
        </div>

        {/* Core Metadata Block Footer */}
        <div className="mt-8 pt-4 border-t flex justify-between items-center text-[10px] font-mono opacity-40" 
             style={{ borderColor: 'var(--border)' }}>
          <span>Encryption: Argon2id / Bcrypt</span>
          <span>Gateway: Secure Node</span>
        </div>

      </div>
    </div>
  );
}

export default Register;