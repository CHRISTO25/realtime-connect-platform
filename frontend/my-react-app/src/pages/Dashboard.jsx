import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../services/api/client';
import { useAuth } from '../context/AuthContext';
import UserCard from '../components/UserCard';
import ActiveFriendsBar from '../components/ActiveFriendsBar';

function useDebounce(value, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { token, isInitializing } = useAuth();

  // Search Inputs
  const [searchName, setSearchName] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const debouncedQuery = useDebounce(searchName, 250);
  const debouncedLocation = useDebounce(searchLocation, 250);

  // Core Data States
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [sentRequests, setSentRequests] = useState(new Set());

  // Mobile Tap-To-Focus State
  const [focusedUserId, setFocusedUserId] = useState(null);

  // Infinite Scroll & Pagination (4 cards per batch)
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isFetchingUI, setIsFetchingUI] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const isFetchingRef = useRef(false);
  const isSyncingRef = useRef(false);
  const scrollContainerRef = useRef(null);
  const observerTarget = useRef(null);

  // UI States
  const [actionUserId, setActionUserId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Server Fetch: limit=4
  const fetchSearchResults = useCallback(
    async (pageNum, query, location, isReset = false) => {
      if (isFetchingRef.current && !isReset) return;
      isFetchingRef.current = true;
      setIsFetchingUI(true);

      try {
        const res = await userApi.get(
          `/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(
            location
          )}&page=${pageNum}&limit=4`
        );

        if (res.data && res.data.success) {
          const payload = res.data.data;
          const freshProfiles = payload.users || [];

          setHasNext(Boolean(payload.has_next));

          if (isReset) {
            setUsers(freshProfiles);
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = 0;
            }
          } else {
            setUsers((prev) => {
              const existingIds = new Set(prev.map((u) => u.user_id));
              const uniqueNew = freshProfiles.filter((u) => !existingIds.has(u.user_id));
              return [...prev, ...uniqueNew];
            });
          }
        }
      } catch (err) {
        console.error('Search API failure:', err);
      } finally {
        isFetchingRef.current = false;
        setIsFetchingUI(false);
        setInitialLoading(false);
      }
    },
    []
  );

  // Auxiliary Friends Sync
  const syncFriends = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const friendsRes = await userApi.get('/friends/list');
      if (friendsRes.data?.success) {
        const freshFriends = friendsRes.data.data || [];
        setFriends(freshFriends);

        const friendOnlineMap = new Map(
          freshFriends.map((f) => [String(f.user_id || f.id), f.is_online])
        );

        setUsers((prevUsers) =>
          prevUsers.map((u) => {
            const uId = String(u.user_id);
            if (friendOnlineMap.has(uId)) {
              return { ...u, is_online: friendOnlineMap.get(uId) };
            }
            return u;
          })
        );
      }
    } catch (err) {
      console.warn('Sync error:', err);
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // Auth Guard & Polling
  useEffect(() => {
    if (isInitializing) return;

    const currentToken = token || localStorage.getItem('access_token');
    if (!currentToken) {
      navigate('/login');
      return;
    }

    syncFriends();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncFriends();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [token, isInitializing, navigate, syncFriends]);

  // Search Debounce Trigger
  useEffect(() => {
    setPage(1);
    fetchSearchResults(1, debouncedQuery, debouncedLocation, true);
  }, [debouncedQuery, debouncedLocation, fetchSearchResults]);

  // Infinite Scroll Observer bound strictly to inner scroll container
  useEffect(() => {
    const target = observerTarget.current;
    const rootContainer = scrollContainerRef.current;
    if (!target || !rootContainer) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !isFetchingRef.current) {
          setPage((prevPage) => {
            const nextPage = prevPage + 1;
            fetchSearchResults(nextPage, debouncedQuery, debouncedLocation, false);
            return nextPage;
          });
        }
      },
      {
        root: rootContainer,
        threshold: 0.1,
      }
    );

    observer.observe(target);
    return () => observer.unobserve(target);
  }, [hasNext, debouncedQuery, debouncedLocation, fetchSearchResults]);

  const friendSet = useMemo(() => new Set(friends.map((f) => String(f.user_id || f.id))), [friends]);

  const handleSendRequest = useCallback(async (targetId, name) => {
    setSentRequests((prev) => new Set(prev).add(String(targetId)));
    setActionUserId(targetId);

    try {
      const res = await userApi.post('/friends/request', { receiver_id: targetId });
      if (res.data && res.data.success) {
        showToast(`Friend request sent to ${name || 'user'}!`, 'success');
      }
    } catch (err) {
      setSentRequests((prev) => {
        const next = new Set(prev);
        next.delete(String(targetId));
        return next;
      });
      showToast(err.response?.data?.message || 'Failed to send request', 'error');
    } finally {
      setActionUserId(null);
    }
  }, [showToast]);

  const handleUnfriend = useCallback(async (friendId, name) => {
    setActionUserId(friendId);
    setFriends((prev) => prev.filter((f) => String(f.user_id || f.id) !== String(friendId)));
    showToast(`Removed ${name || 'user'} from friends`, 'info');

    try {
      await userApi.post('/friends/unfriend', { friend_id: friendId });
    } catch (err) {
      showToast('Failed to unfriend', 'error');
      syncFriends();
    } finally {
      setActionUserId(null);
    }
  }, [showToast, syncFriends]);

  return (
    <div className="h-[calc(100vh-64px)] w-full bg-slate-950 text-slate-100 font-sans flex flex-col overflow-hidden select-none relative">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-bounce">
          <div
            className={`px-4 py-2.5 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-center gap-3 text-xs font-bold font-mono tracking-wide ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
                : toast.type === 'error'
                ? 'bg-red-950/90 border-red-500/50 text-red-300'
                : 'bg-indigo-950/90 border-indigo-500/50 text-indigo-300'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current animate-ping" />
            {toast.message}
          </div>
        </div>
      )}

      {/* Top Presence Bar */}
      <div className="w-full shrink-0 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md z-10">
        <ActiveFriendsBar friends={friends} />
      </div>

      {/* Main Responsive Grid Layout */}
      <main className="max-w-[1600px] w-full mx-auto px-3 sm:px-6 py-2.5 sm:py-4 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-6 min-h-0 overflow-hidden z-10">
        
        {/* Left Discovery Deck */}
        <section className="lg:col-span-4 h-fit rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-xl p-3 sm:p-5 shadow-xl space-y-2 sm:space-y-4 shrink-0">
          <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-slate-800/80">
            <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-300 flex items-center gap-2">
              <span className="text-indigo-400">⚡</span> Discovery Filter
            </span>
            {isFetchingUI && (
              <span className="text-[10px] font-mono text-indigo-400 font-bold animate-pulse">
                Querying...
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5 sm:gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 font-mono text-slate-400">
                Search Member
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="Search name, bio..."
                  className="w-full pl-3 pr-7 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-950/80 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-all shadow-inner"
                />
                {searchName && (
                  <button
                    onClick={() => setSearchName('')}
                    className="absolute right-2.5 top-2 text-xs text-slate-500 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 font-mono text-slate-400">
                Location Matrix
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  placeholder="City, region..."
                  className="w-full pl-3 pr-7 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-950/80 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-all shadow-inner"
                />
                {searchLocation && (
                  <button
                    onClick={() => setSearchLocation('')}
                    className="absolute right-2.5 top-2 text-xs text-slate-500 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Right Community Feed */}
        <section className="lg:col-span-8 flex-1 h-full flex flex-col min-h-0 bg-slate-900/30 border border-slate-800/80 rounded-2xl sm:rounded-3xl backdrop-blur-2xl shadow-2xl overflow-hidden">
          
          {/* Header */}
          <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <h2 className="text-xs font-black uppercase tracking-wider font-mono text-slate-200">
                Community Feed
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {users.length} loaded
              </span>
            </div>

            <span className="text-[10px] font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2.5 sm:px-3 py-0.5 rounded-full border border-indigo-500/20">
              PAGE {page}
            </span>
          </div>

          {/* Scroll Container */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-2.5 sm:p-5 min-h-0 space-y-2.5 sm:space-y-4"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#334155 transparent',
            }}
          >
            {initialLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-32 sm:h-52 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse p-4"
                  />
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="h-full min-h-[200px] flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/40 p-6 text-center">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  No Members Found
                </h3>
                <p className="text-[11px] font-mono text-slate-500 mt-1">
                  Adjust your search coordinates or location filters.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop & Tablet: Classic UserCard Component */}
                <div className="hidden md:grid grid-cols-2 gap-4">
                  {users.map((user) => (
                    <UserCard
                      key={user.user_id}
                      user={user}
                      isFriend={friendSet.has(String(user.user_id))}
                      hasInboundReq={false}
                      hasSentReq={sentRequests.has(String(user.user_id))}
                      actionUserId={actionUserId}
                      onSendRequest={handleSendRequest}
                      onUnfriend={handleUnfriend}
                      onBlockUser={() => {}}
                    />
                  ))}
                </div>

                {/* 
                  📱 Mobile: High-Impact Social Profile Cards
                  - Fits 3+ cards in standard viewport
                  - Tap-to-Focus Ambient Highlight Border
                  - Real cover image with glassmorphic overlay
                */}
                <div className="grid md:hidden grid-cols-1 gap-2.5">
                  {users.map((user) => {
                    const isFriend = friendSet.has(String(user.user_id));
                    const isSent = sentRequests.has(String(user.user_id));
                    const isProcessing = actionUserId === user.user_id;
                    const isFocused = focusedUserId === user.user_id;

                    return (
                      <div
                        key={user.user_id}
                        onClick={() => setFocusedUserId((prev) => (prev === user.user_id ? null : user.user_id))}
                        className={`group relative rounded-2xl overflow-hidden shadow-lg transition-all duration-300 cursor-pointer ${
                          isFocused
                            ? 'bg-slate-900/90 ring-2 ring-indigo-500 shadow-indigo-500/25 scale-[1.01]'
                            : 'bg-slate-950/70 border border-slate-800/80 active:scale-[0.99]'
                        }`}
                      >
                        {/* 1. Ambient Banner & Cover Slot */}
                        <div className="relative h-12 w-full bg-slate-900 overflow-hidden">
                          {user.cover_url ? (
                            <img
                              src={user.cover_url}
                              alt="Cover"
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 opacity-80" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
                          
                          {/* Live Presence Badge */}
                          <div className="absolute top-2 right-2.5 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800/80 flex items-center gap-1.5 shadow-sm">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                user.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                              }`}
                            />
                            <span className="text-[8px] font-mono font-bold text-slate-300">
                              {user.is_online ? 'ONLINE' : 'OFFLINE'}
                            </span>
                          </div>
                        </div>

                        {/* 2. Overlapping Avatar & Card Content */}
                        <div className="px-3 pb-2.5 pt-0 flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            
                            {/* Avatar with Status Ring */}
                            <div className="relative -mt-4 shrink-0">
                              {user.avatar_url ? (
                                <img
                                  src={user.avatar_url}
                                  alt={user.display_name}
                                  className={`h-11 w-11 rounded-xl object-cover border-2 shadow-md transition-colors ${
                                    isFocused ? 'border-indigo-500' : 'border-slate-950'
                                  }`}
                                />
                              ) : (
                                <div className={`h-11 w-11 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs shadow-md border-2 ${
                                  isFocused ? 'border-indigo-500' : 'border-slate-950'
                                }`}>
                                  {(user.display_name || user.username || 'U').substring(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>

                            {/* Name, Bio, Location */}
                            <div className="truncate flex-1 min-w-0 pt-1">
                              <div className="flex items-center gap-1">
                                <h4 className={`text-xs font-bold truncate transition-colors ${
                                  isFocused ? 'text-indigo-300' : 'text-white'
                                }`}>
                                  {user.display_name || user.username || 'Anonymous'}
                                </h4>
                                {user.is_verified && (
                                  <span className="text-cyan-400 text-[10px]" title="Verified">✓</span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 truncate">
                                {user.bio || 'Available on network'}
                              </p>
                              {user.location && (
                                <p className="text-[9px] font-mono text-slate-500 truncate flex items-center gap-0.5">
                                  <span>📍</span> {user.location}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Quick Connect Action */}
                          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            {isFriend ? (
                              <button
                                onClick={() => handleUnfriend(user.user_id, user.display_name)}
                                disabled={isProcessing}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-mono font-bold active:scale-95 transition-all"
                              >
                                {isProcessing ? '...' : 'Friend ✓'}
                              </button>
                            ) : isSent ? (
                              <span className="px-2.5 py-1.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-400 text-[10px] font-mono">
                                Pending
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSendRequest(user.user_id, user.display_name)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-mono font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                              >
                                {isProcessing ? '...' : '+ Connect'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sentinel Trigger */}
                <div ref={observerTarget} className="py-2.5 sm:py-4 flex justify-center items-center">
                  {isFetchingUI && page > 1 && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[10px] sm:text-[11px] font-mono text-indigo-400">
                      <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      Loading more...
                    </div>
                  )}
                  {!hasNext && users.length > 0 && (
                    <span className="text-[9px] sm:text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                      — End of Results —
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}