import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!email || password.length < 6) {
      setError('Password must contain at least 6 characters');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await login(email, password);
      if (result && result.success) {
        const userRole = result.role || localStorage.getItem('user_role') || 'user';
        if (userRole === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        // ⚡ Gracefully catch ban/suspension or database error messages
        const rawErrorMsg = result?.error || result?.message || 'Invalid credentials or account suspended.';
        let finalErrorMsg = rawErrorMsg;

        if (
          rawErrorMsg.toLowerCase().includes('ban') || 
          rawErrorMsg.toLowerCase().includes('suspend') || 
          rawErrorMsg.toLowerCase().includes('denied')
        ) {
          finalErrorMsg = 'Access Denied: Your account has been suspended by an administrator.';
        } else if (rawErrorMsg.toLowerCase().includes('database') || rawErrorMsg.toLowerCase().includes('unexpected')) {
          // Fallback if an unexpected error occurs during a banned check login attempt
          finalErrorMsg = 'Access Denied: Your account has been suspended by an administrator.';
        }

        setError(finalErrorMsg);
        setIsSubmitting(false);
      }
    } catch (err) {
      const backendError = err.response?.data?.error || err.response?.data?.message || err.message || '';
      let finalErrorMsg = 'Authentication node unreachable.';

      if (
        backendError.toLowerCase().includes('ban') || 
        backendError.toLowerCase().includes('suspend') || 
        backendError.toLowerCase().includes('denied') ||
        backendError.toLowerCase().includes('database')
      ) {
        finalErrorMsg = 'Access Denied: Your account has been suspended by an administrator.';
      } else if (backendError !== '') {
        finalErrorMsg = backendError;
      }

      setError(finalErrorMsg);
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
        
        {/* Top Branding Frame */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl items-center justify-center font-bold text-white text-xl shadow-md mb-4"
               style={{ background: 'linear-gradient(135deg, var(--accent), #7c3aed)' }}>
            ⚡
          </div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-h)' }}>
            Welcome Back
          </h2>
          <p className="text-xs mt-1.5 font-mono uppercase tracking-wider opacity-60">
            Secure Gateway Access
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

        <form onSubmit={handleSubmit} className="space-y-5 text-left">
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
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider font-mono" 
                     style={{ color: 'var(--text-h)' }}>
                Security Key
              </label>
            </div>
            
            {/* Password Input with See/Unsee Toggle */}
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                placeholder="••••••••••••"
                className="w-full px-4 py-3 pr-12 rounded-xl border text-sm font-medium transition-all duration-150 outline-none bg-transparent"
                style={{ borderColor: 'var(--border)', color: 'var(--text-h)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono opacity-60 hover:opacity-100 transition-opacity px-2 py-1 cursor-pointer"
                style={{ color: 'var(--text-h)' }}
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full mt-2 py-3.5 px-4 rounded-xl text-sm font-bold tracking-wider uppercase transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer"
            style={{ 
              backgroundColor: isSubmitting ? 'var(--border)' : 'var(--accent)', 
              color: isSubmitting ? 'var(--text)' : 'var(--bg)',
              boxShadow: isSubmitting ? 'none' : '0 4px 14px rgba(170, 59, 255, 0.3)' 
            }}
          >
            {isSubmitting ? (
              <div className="h-4 w-4 border-2 rounded-full animate-spin border-current border-t-transparent"></div>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Registration Redirection Anchor Link */}
        <div className="mt-6 text-center text-xs font-medium">
          <span style={{ color: 'var(--text)' }}>New to the grid? </span>
          <Link to="/register" className="font-bold underline hover:opacity-80 transition-opacity" style={{ color: 'var(--accent)' }}>
            Register Account
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