import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // View Toggle State: 'login' | 'forgot'
  const [viewMode, setViewMode] = useState('login');
  const [forgotEmail, setForgotEmail] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    if (!email || password.length < 8) {
      setError('Password must contain at least 8 characters');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await login(email, password);
      if (result && result.success) {
        window.location.href = '/dashboard';
      } else {
        setError(result?.error || 'Invalid credentials.');
        setIsSubmitting(false);
      }
    } catch (err) {
      setError('Authentication node unreachable.');
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    if (!forgotEmail) {
      setError('Please input a valid operator email address');
      setIsSubmitting(false);
      return;
    }

    try {
      // Simulate/Trigger API dispatch for recovery handshake
      // Replace with your actual auth recovery method if attached to AuthContext
      setTimeout(() => {
        setSuccessMessage('Handshake sequence transmitted. Check your email inbox.');
        setIsSubmitting(false);
      }, 1200);
    } catch (err) {
      setError('Recovery node failed to respond.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 transition-colors duration-200" 
         style={{ backgroundColor: 'var(--bg)' }}>
      
      {/* Premium Glassmorphism Cyber Card Container */}
      <div className="w-full max-w-md rounded-2xl border p-8 transition-all duration-300"
           style={{ 
             backgroundColor: 'var(--code-bg)', 
             borderColor: 'var(--border)', 
             boxShadow: 'var(--shadow)' 
           }}>
        
        {/* Top Branding Frame */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-md mb-4"
               style={{ background: 'linear-gradient(135deg, var(--accent), #7c3aed)' }}>
            ⚡
          </div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-h)' }}>
            {viewMode === 'login' ? 'Welcome Back' : 'Restore Access'}
          </h2>
          <p className="text-xs mt-1.5 font-mono uppercase tracking-wider opacity-60">
            {viewMode === 'login' ? 'Secure Gateway Access' : 'Identity Verification Pipeline'}
          </p>
        </div>

        {/* Global Notifications Desk */}
        {error && (
          <div className="mb-6 p-3.5 rounded-lg border flex items-center gap-2.5 text-xs font-semibold tracking-wide"
               style={{ 
                 borderColor: 'rgba(239, 68, 68, 0.4)', 
                 color: 'rgb(239, 68, 68)',
                 backgroundColor: 'rgba(239, 68, 68, 0.05)'
               }}>
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-3.5 rounded-lg border flex items-center gap-2.5 text-xs font-semibold tracking-wide"
               style={{ 
                 borderColor: 'rgba(16, 185, 129, 0.4)', 
                 color: 'rgb(16, 185, 129)',
                 backgroundColor: 'rgba(16, 185, 129, 0.05)'
               }}>
            <span>✓</span>
            <p>{successMessage}</p>
          </div>
        )}

        {/* Dynamic Inner-Form Component Mapping */}
        {viewMode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-5 text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 font-mono" 
                     style={{ color: 'var(--text-h)' }}>
                Operator Email
              </label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
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

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider font-mono" 
                       style={{ color: 'var(--text-h)' }}>
                  Security Key
                </label>
                <button
                  type="button"
                  onClick={() => { setViewMode('forgot'); setError(''); setSuccessMessage(''); }}
                  className="text-xs font-semibold tracking-wide transition-colors"
                  style={{ color: 'var(--accent)' }}
                >
                  Forgot Key?
                </button>
              </div>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                placeholder="••••••••••••"
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
                <span>Establish Session</span>
              )}
            </button>
          </form>
        ) : (
          /* Password Recovery Frame */
          <form onSubmit={handleForgotSubmit} className="space-y-5 text-left">
            <div>
              <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--text)' }}>
                Provide your account email coordinate below. If verified, the engine will dispatch an encrypted reset payload.
              </p>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 font-mono" 
                     style={{ color: 'var(--text-h)' }}>
                Registered Email
              </label>
              <input 
                type="email" 
                value={forgotEmail} 
                onChange={(e) => setForgotEmail(e.target.value)} 
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

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-bold tracking-wider uppercase transition-all duration-200 flex items-center justify-center space-x-2 text-white"
              style={{ backgroundColor: isSubmitting ? 'var(--border)' : '#4f46e5' }}
            >
              {isSubmitting ? (
                <div className="h-4 w-4 border-2 rounded-full animate-spin border-white border-t-transparent"></div>
              ) : (
                <span>Request Recovery Link</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setViewMode('login'); setError(''); setSuccessMessage(''); }}
              className="w-full text-center text-xs font-bold font-mono tracking-wider uppercase opacity-60 hover:opacity-100 transition-opacity mt-2"
              style={{ color: 'var(--text-h)' }}
            >
              ← Back to login
            </button>
          </form>
        )}

        {/* Registration Redirection Anchor Link */}
        <div className="mt-6 text-center text-xs font-medium">
          <span style={{ color: 'var(--text)' }}>New to the grid? </span>
          <Link to="/register" className="font-bold underline hover:opacity-80 transition-opacity" style={{ color: 'var(--accent)' }}>
            Initialize Operator Identity
          </Link>
        </div>

        {/* Footer Meta */}
        <div className="mt-8 pt-4 border-t flex justify-between items-center text-[10px] font-mono opacity-40" 
             style={{ borderColor: 'var(--border)' }}>
          <span>Encryption: AES-256</span>
          <span>Node status: Optimal</span>
        </div>

      </div>
    </div>
  );
}