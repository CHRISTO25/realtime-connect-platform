import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  
  // States for session data, dropdown, and mobile menu toggles
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState("User");
  const [avatarUrl, setAvatarUrl] = useState("");
  
  const userId = localStorage.getItem('user_id');
  const isActive = (path) => location.pathname === path;

  // Sync user profile details from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('display_name'); 
    const savedAvatar = localStorage.getItem('avatar_url'); 
    if (savedName) setDisplayName(savedName);
    if (savedAvatar) setAvatarUrl(savedAvatar);
  }, [location]);

  // Close dropdown menu if clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    localStorage.clear();
    navigate('/login');
  };

  return (
    <nav className="w-full bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-xl sticky top-0 z-50 px-4 sm:px-8 py-3 flex items-center justify-between text-slate-100 font-sans transition-colors duration-300">
      
      {/* BRAND LOGO */}
      <div 
        className="flex items-center space-x-3 cursor-pointer group" 
        onClick={() => navigate('/dashboard')}
      >
        <div className="h-9 w-9 rounded-xl flex items-center justify-center font-black text-white text-base shadow-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 group-hover:scale-105 transition-transform">
          ⚡
        </div>
        <span className="font-bold tracking-tight text-base sm:text-lg text-white">
          Nexus<span className="text-indigo-400">Social</span>
        </span>
      </div>

      {/* PRIMARY DESKTOP NAVIGATION */}
      <div className="hidden md:flex items-center space-x-1">
        
        {/* Dashboard Link */}
        <Link
          to="/dashboard"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            isActive("/dashboard")
              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900/60"
          }`}
        >
          <span>🏠</span> Dashboard
        </Link>

        {/* Chat Platform Link */}
        <Link
          to="/chat"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative ${
            isActive("/chat")
              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900/60"
          }`}
        >
          <span>💬</span> Messages & Calls
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </Link>

        {/* Profile Link */}
        <Link
          to="/profile"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            isActive("/profile")
              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900/60"
          }`}
        >
          <span>👤</span> Profile
        </Link>
      </div>

      {/* RIGHT ACTION CONTROLS */}
      <div className="flex items-center space-x-3">

        {/* CALL SHORTCUTS */}
        <div className="flex items-center space-x-1 bg-slate-900/80 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => navigate('/chat?action=voice')}
            className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 rounded-lg transition-all"
            title="Start Voice Call"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.826-1.47-5.11-3.754-6.58-6.58l1.293-.97c.362-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </button>
          
          <button
            onClick={() => navigate('/chat?action=video')}
            className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition-all"
            title="Start Video Call"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </button>
        </div>

        {/* USER AVATAR & NON-DUPLICATE DROPDOWN MENU */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 focus:outline-none p-1 rounded-xl transition-all hover:bg-slate-900 border border-transparent hover:border-slate-800"
          >
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="Profile" 
                className="h-8 w-8 rounded-lg object-cover border border-indigo-500/50"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">
                {displayName.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-[10px] text-slate-500">
              {dropdownOpen ? '▲' : '▼'}
            </span>
          </button>

          {/* STREAMLINED DROPDOWN (NO DUPLICATE LINKS) */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-slate-800 bg-slate-900/95 backdrop-blur-xl p-2 shadow-2xl z-50 space-y-1">
              
              {/* Profile Card Header */}
              <div className="px-3 py-2.5 border-b border-slate-800/80 mb-1">
                <p className="text-sm font-bold text-white truncate">{displayName}</p>
                <p className="text-[10px] text-slate-500 font-mono truncate">
                  User ID: {userId ? `${userId.substring(0, 10)}...` : 'Guest'}
                </p>
              </div>

              {/* Unique Quick Actions */}
              <button
                onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all flex items-center justify-between"
              >
                <span>⚙️ Account Settings</span>
                <span className="text-slate-600">→</span>
              </button>

              {/* Logout Button */}
              <div className="pt-1 border-t border-slate-800/80">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-between"
                >
                  <span>Sign Out</span>
                  <span>⎋</span>
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </nav>
  );
}