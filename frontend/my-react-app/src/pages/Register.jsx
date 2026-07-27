import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
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

    try {
      const response = await fetch('http://localhost:8001/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Registration failed');
      }

      // If registration returns access tokens instantly, handle persistence:
      if (data.data?.access_token && data.data?.user_id) {
        localStorage.setItem('access_token', data.data.access_token);
        localStorage.setItem('refresh_token', data.data.refresh_token);
        localStorage.setItem('user_id', data.data.user_id);
      }

      setSuccess(data.message || 'Registration structural handshake verified! Welcome aboard.');
      setFormData({ username: '', email: '', password: '' });
      
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);

    } catch (err) {
      setError(err.message || 'Internal pipeline connection error');
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
          <div className="inline-flex h-12 w-12 rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-md mb-4"
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
               style={{ 
                 borderColor: 'rgba(239, 68, 68, 0.4)', 
                 backgroundColor: 'rgba(239, 68, 68, 0.05)'
               }}>
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-3.5 rounded-lg border flex items-center gap-2.5 text-xs font-semibold tracking-wide text-emerald-500"
               style={{ 
                 borderColor: 'rgba(16, 185, 129, 0.4)', 
                 backgroundColor: 'rgba(16, 185, 129, 0.05)'
               }}>
            <span>✓</span>
            <p>{success}</p>
          </div>
        )}

        {/* Interactive Data Form */}
        <form onSubmit={handleSubmit} className="space-y-5 text-left">
          
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
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent)';
                e.target.style.boxShadow = '0 0 0 2px var(--accent-bg)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'none';
              }}
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
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent)';
                e.target.style.boxShadow = '0 0 0 2px var(--accent-bg)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 font-mono" 
                   style={{ color: 'var(--text-h)' }}>
              Access Security Key
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Min. 6 parameters"
              className="w-full px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 outline-none bg-transparent"
              style={{ borderColor: 'var(--border)', color: 'var(--text-h)' }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent)';
                e.target.style.boxShadow = '0 0 0 2px var(--accent-bg)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Premium Registration Form Button */}
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full mt-2 py-3.5 px-4 rounded-xl text-sm font-bold tracking-wider uppercase transition-all duration-200 flex items-center justify-center space-x-2"
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
          <span>Encryption: Argon2id</span>
          <span>Gateway: Secure Node</span>
        </div>

      </div>
    </div>
  );
}

export default Register;