import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebsocketContext";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth(); 
  
  const { isConnected, connectionStatus, connect } = useWebSocket();
  
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState("User");
  const [avatarUrl, setAvatarUrl] = useState("");
  
  const userId = localStorage.getItem('user_id');
  const isActive = (path) => location.pathname === path;

  const currentStatus = connectionStatus || (isConnected ? 'CONNECTED' : 'DISCONNECTED');

  useEffect(() => {
    const savedName = localStorage.getItem('display_name'); 
    const savedAvatar = localStorage.getItem('avatar_url'); 
    if (savedName) setDisplayName(savedName);
    if (savedAvatar) setAvatarUrl(savedAvatar);
  }, [location]);

  // Close menus on navigation change
  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  }, [location.pathname]);

  // Handle outside clicks for desktop dropdown and mobile menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    if (logout) {
      await logout();
    } else {
      localStorage.clear();
    }
    navigate('/login');
  };

  return (
    <nav className="w-full bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-xl sticky top-0 z-50 px-4 sm:px-8 py-3 text-slate-100 font-sans transition-colors duration-300">
      <div className="flex items-center justify-between">
        
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

          <Link
            to="/chat-test"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative ${
              isActive("/chat-test")
                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-900/60"
            }`}
          >
            <span>💬</span> WS Chat

            {currentStatus === 'CONNECTED' && (
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="Connected"></span>
            )}
            {currentStatus === 'CONNECTING' && (
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" title="Connecting"></span>
            )}
            {currentStatus === 'DISCONNECTED' && (
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" title="Disconnected"></span>
            )}
          </Link>

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
        <div className="flex items-center space-x-2 sm:space-x-3">

          {/* LIVE REALTIME SOCKET STATUS BADGE (Desktop) */}
          <div className="hidden sm:flex items-center">
            {currentStatus === 'CONNECTED' && (
              <div className="flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono gap-2 text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-bold">WS ONLINE</span>
              </div>
            )}

            {currentStatus === 'DISCONNECTED' && (
              <button
                onClick={connect}
                className="flex items-center px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-[10px] font-mono gap-2 text-slate-400 hover:text-white transition-all cursor-pointer"
                title="Click to reconnect"
              >
                <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                <span>WS OFFLINE (RETRY)</span>
              </button>
            )}
          </div>

          {/* USER AVATAR & DROPDOWN MENU */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-2 focus:outline-none p-1 rounded-xl transition-all hover:bg-slate-900 border border-transparent hover:border-slate-800 cursor-pointer"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-8 w-8 rounded-lg object-cover border border-indigo-500/50" />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">
                  {displayName.substring(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-[10px] text-slate-500 hidden sm:inline">{dropdownOpen ? '▲' : '▼'}</span>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-slate-800 bg-slate-900/95 backdrop-blur-xl p-2 shadow-2xl z-50 space-y-1">
                <div className="px-3 py-2.5 border-b border-slate-800/80 mb-1">
                  <p className="text-sm font-bold text-white truncate">{displayName}</p>
                  <p className="text-[10px] text-slate-500 font-mono truncate">
                    ID: {userId ? `${userId.substring(0, 10)}...` : 'Guest'}
                  </p>
                </div>

                <button
                  onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>⚙️ Account Settings</span>
                  <span className="text-slate-600">→</span>
                </button>

                <div className="pt-1 border-t border-slate-800/80">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Sign Out</span>
                    <span>⎋</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* MOBILE HAMBURGER BUTTON */}
          <div className="md:hidden" ref={mobileMenuRef}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 focus:outline-none transition-all cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? (
                // Close Icon (X)
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                // Hamburger Menu Icon
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* MOBILE COLLAPSIBLE MENU DRAWER */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 pt-3 border-t border-slate-800/80 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
          <Link
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
              isActive("/dashboard")
                ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                : "text-slate-300 hover:bg-slate-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span>🏠</span>
              <span>Dashboard</span>
            </div>
            <span className="text-slate-600 text-xs">→</span>
          </Link>

          <Link
            to="/chat-test"
            onClick={() => setMobileMenuOpen(false)}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
              isActive("/chat-test")
                ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                : "text-slate-300 hover:bg-slate-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span>💬</span>
              <span>WS Chat</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              {currentStatus === 'CONNECTED' && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  ONLINE
                </span>
              )}
              {currentStatus === 'CONNECTING' && (
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
                  CONNECTING
                </span>
              )}
              {currentStatus === 'DISCONNECTED' && (
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  OFFLINE
                </span>
              )}
            </div>
          </Link>

          <Link
            to="/profile"
            onClick={() => setMobileMenuOpen(false)}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
              isActive("/profile")
                ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                : "text-slate-300 hover:bg-slate-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span>👤</span>
              <span>Profile</span>
            </div>
            <span className="text-slate-600 text-xs">→</span>
          </Link>
        </div>
      )}
    </nav>
  );
}