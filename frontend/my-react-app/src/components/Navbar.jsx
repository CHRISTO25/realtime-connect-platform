import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebsocketContext";
import FriendControl from "./FriendControl";
import BlockedList from "./BlockedList";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth(); 
  
  const { isConnected, connectionStatus, connect } = useWebSocket();
  
  const navbarRef = useRef(null);
  const dropdownRef = useRef(null);
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [invitesModalOpen, setInvitesModalOpen] = useState(false);
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);

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

  // Auto-close open menus on route transitions
  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  }, [location.pathname]);

  // Click-outside listener for menus
  useEffect(() => {
    function handleClickOutside(event) {
      if (navbarRef.current && !navbarRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchend", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchend", handleClickOutside);
    };
  }, []);

  const handleNavClick = (path) => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
    navigate(path);
  };

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
    <>
      <nav 
        ref={navbarRef}
        className="w-full bg-slate-950/95 border-b border-slate-800/80 backdrop-blur-2xl sticky top-0 z-[100] px-4 sm:px-8 py-3 text-slate-100 font-sans select-none relative"
      >
        <div className="flex items-center justify-between">
          
          {/* BRAND LOGO */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group" 
            onClick={() => handleNavClick('/dashboard')}
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
            <button
              type="button"
              onClick={() => handleNavClick("/dashboard")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                isActive("/dashboard")
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/60"
              }`}
            >
              <span>🏠</span> Dashboard
            </button>

            <button
              type="button"
              onClick={() => handleNavClick("/chat-test")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative cursor-pointer ${
                isActive("/chat-test")
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/60"
              }`}
            >
              <span>💬</span> WS Chat
              {currentStatus === 'CONNECTED' && (
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick("/profile")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                isActive("/profile")
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/60"
              }`}
            >
              <span>👤</span> Profile
            </button>
          </div>

          {/* RIGHT ACTION CONTROLS */}
          <div className="flex items-center space-x-2 sm:space-x-3">

            {/* DESKTOP INVITES BUTTON */}
            <button
              type="button"
              onClick={() => setInvitesModalOpen(true)}
              className="hidden sm:flex px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-all items-center gap-1.5 cursor-pointer"
              title="Friend Requests"
            >
              <span>📬</span>
              <span>Invites</span>
            </button>

            {/* DESKTOP BLOCKED BUTTON */}
            <button
              type="button"
              onClick={() => setBlockedModalOpen(true)}
              className="hidden sm:flex px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-all items-center gap-1.5 cursor-pointer"
              title="Blocked Accounts"
            >
              <span>🚫</span>
              <span>Blocked</span>
            </button>

            {/* REALTIME SOCKET STATUS */}
            <div className="hidden lg:flex items-center">
              {currentStatus === 'CONNECTED' ? (
                <div className="flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono gap-2 text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold">ONLINE</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={connect}
                  className="flex items-center px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono gap-2 text-slate-400 hover:text-white"
                >
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <span>OFFLINE</span>
                </button>
              )}
            </div>

            {/* DESKTOP AVATAR DROPDOWN */}
            <div className="relative hidden md:block" ref={dropdownRef}>
              <button
                type="button"
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
                <span className="text-[10px] text-slate-500">{dropdownOpen ? '▲' : '▼'}</span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-slate-800 bg-slate-900/95 backdrop-blur-xl p-2 shadow-2xl z-[110] space-y-1">
                  <div className="px-3 py-2.5 border-b border-slate-800/80 mb-1">
                    <p className="text-sm font-bold text-white truncate">{displayName}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">
                      ID: {userId ? `${userId.substring(0, 10)}...` : 'Guest'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleNavClick('/profile')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <span>⚙️ Account Settings</span>
                    <span className="text-slate-600">→</span>
                  </button>

                  <div className="pt-1 border-t border-slate-800/80">
                    <button
                      type="button"
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
            <div className="md:hidden flex items-center">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="p-2 rounded-xl text-slate-300 hover:text-white bg-slate-900 border border-slate-800 transition-all flex items-center justify-center"
                aria-label="Toggle Menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* 📱 MOBILE FLOATING DRAWER (With Invites & Blocked Support) */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute right-4 top-16 w-72 bg-slate-900/95 border border-slate-800 backdrop-blur-2xl rounded-2xl p-3 shadow-2xl z-[120] space-y-1 animate-in fade-in slide-in-from-top-3 duration-200">
            
            {/* User Profile Header */}
            <div className="px-3 py-2 bg-slate-950/60 rounded-xl border border-slate-800/60 flex items-center gap-2.5 mb-2">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-8 w-8 rounded-lg object-cover border border-indigo-500/40 shrink-0" />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
                  {displayName.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">{displayName}</p>
                <div className="flex items-center gap-1.5 font-mono text-[9px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${currentStatus === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="text-slate-400">{currentStatus === 'CONNECTED' ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            </div>

            {/* Primary Routes */}
            <button
              type="button"
              onClick={() => handleNavClick("/dashboard")}
              className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between ${
                isActive("/dashboard") ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40" : "text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              <span className="flex items-center gap-2"><span>🏠</span> Dashboard</span>
              <span className="text-slate-500 text-xs">→</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick("/chat-test")}
              className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between ${
                isActive("/chat-test") ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40" : "text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              <span className="flex items-center gap-2"><span>💬</span> WS Chat</span>
              <span className="text-slate-500 text-xs">→</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick("/profile")}
              className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between ${
                isActive("/profile") ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40" : "text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              <span className="flex items-center gap-2"><span>👤</span> Profile</span>
              <span className="text-slate-500 text-xs">→</span>
            </button>

            {/* ⚡ Mobile-only Invites & Blocked Controls */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setInvitesModalOpen(true);
                }}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800/60 transition-all flex items-center justify-between"
              >
                <span className="flex items-center gap-2"><span>📬</span> Pending Invites</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">VIEW</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setBlockedModalOpen(true);
                }}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800/60 transition-all flex items-center justify-between"
              >
                <span className="flex items-center gap-2"><span>🚫</span> Blocked Users</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">VIEW</span>
              </button>
            </div>

            {/* Sign Out */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center justify-between"
              >
                <span className="flex items-center gap-2"><span>🚪</span> Sign Out</span>
                <span className="text-xs font-mono">⎋</span>
              </button>
            </div>

          </div>
        )}
      </nav>

      {/* ⚡ PENDING INVITES MODAL */}
      {invitesModalOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 max-w-md w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider font-mono text-slate-200 flex items-center gap-2">
                <span>📬</span> Friend Requests
              </h3>
              <button
                type="button"
                onClick={() => setInvitesModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono px-2 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800"
              >
                ✕ CLOSE
              </button>
            </div>
            <div className="overflow-y-auto flex-1 pr-1">
              <FriendControl />
            </div>
          </div>
        </div>
      )}

      {/* ⚡ BLOCKED ACCOUNTS MODAL */}
      {blockedModalOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 max-w-md w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider font-mono text-slate-200 flex items-center gap-2">
                <span>🚫</span> Blocked Accounts
              </h3>
              <button
                type="button"
                onClick={() => setBlockedModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono px-2 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800"
              >
                ✕ CLOSE
              </button>
            </div>
            <div className="overflow-y-auto flex-1 pr-1">
              <BlockedList />
            </div>
          </div>
        </div>
      )}
    </>
  );
}