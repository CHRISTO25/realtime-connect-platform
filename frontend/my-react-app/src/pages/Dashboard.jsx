import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../services/api/client';
import { useAuth } from '../context/AuthContext';
import FriendControl from '../components/FriendControl';
import BlockedList from '../components/BlockedList';
import UserCard from '../components/UserCard';
import ActiveFriendsBar from '../components/ActiveFriendsBar';

function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { token, userId: authUserId, isInitializing } = useAuth();

  const activeUserId = useMemo(() => {
    if (authUserId) return authUserId;
    const localId = localStorage.getItem('user_id');
    if (localId && localId !== 'undefined' && localId !== 'null') return localId;

    try {
      const activeToken = token || localStorage.getItem('access_token');
      if (!activeToken) return null;
      const base64Url = activeToken.split('.')[1];
      if (!base64Url) return null;
      let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      const payload = JSON.parse(decodeURIComponent(escape(window.atob(base64))));
      return payload.user_id || payload.id || null;
    } catch (e) {
      console.error('Failed to parse token fallback in Dashboard:', e);
      return null;
    }
  }, [authUserId, token]);

  // Search Inputs
  const [searchName, setSearchName] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const debouncedQuery = useDebounce(searchName, 300);
  const debouncedLocation = useDebounce(searchLocation, 300);

  // Core Data States
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState(new Set());

  // Infinite Scroll & Pagination (Locked to 4 cards per batch)
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
  const [blockRefreshKey, setBlockRefreshKey] = useState(0);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ⚡ SERVER FETCH: limit=4 ensures 4 users load per request
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

  // Auxiliary Sync
  const syncFriendsAndPending = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const [friendsRes, pendingRes] = await Promise.allSettled([
        userApi.get('/friends/list'),
        userApi.get('/friends/pending'),
      ]);

      if (friendsRes.status === 'fulfilled' && friendsRes.value.data?.success) {
        const freshFriends = friendsRes.value.data.data || [];
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

      if (pendingRes.status === 'fulfilled' && pendingRes.value.data?.success) {
        setPendingRequests(pendingRes.value.data.data || []);
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

    syncFriendsAndPending();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncFriendsAndPending();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [token, isInitializing, navigate, syncFriendsAndPending]);

  // Search Debounce Trigger
  useEffect(() => {
    setPage(1);
    fetchSearchResults(1, debouncedQuery, debouncedLocation, true);
  }, [debouncedQuery, debouncedLocation, fetchSearchResults]);

  // Infinite Scroll Observer bound strictly to the inner card scroll container
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
  const pendingSet = useMemo(() => new Set(pendingRequests.map((p) => String(p.sender_id))), [pendingRequests]);

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
      syncFriendsAndPending();
    } finally {
      setActionUserId(null);
    }
  }, [showToast, syncFriendsAndPending]);

  const handleBlockUser = useCallback(async (targetId, name) => {
    if (!window.confirm(`Are you sure you want to block ${name || 'this user'}?`)) return;

    setActionUserId(targetId);
    setUsers((prev) => prev.filter((u) => String(u.user_id) !== String(targetId)));
    setFriends((prev) => prev.filter((f) => String(f.user_id || f.id) !== String(targetId)));
    setPendingRequests((prev) => prev.filter((p) => String(p.sender_id) !== String(targetId)));
    setBlockRefreshKey((prev) => prev + 1);

    try {
      const res = await userApi.post(`/block/${targetId}`);
      if (res.data && res.data.success) {
        showToast(`Blocked ${name || 'user'}.`, 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to block user', 'error');
      fetchSearchResults(1, debouncedQuery, debouncedLocation, true);
    } finally {
      setActionUserId(null);
    }
  }, [debouncedQuery, debouncedLocation, fetchSearchResults, showToast]);

  return (
    // Viewport-locked container: never extends past screen height
    <div className="h-[calc(100vh-64px)] w-full bg-slate-950 text-slate-100 font-sans flex flex-col overflow-hidden">
      
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
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
      <div className="w-full shrink-0 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <ActiveFriendsBar friends={friends} />
      </div>

      {/* Workspace Grid */}
      <main className="max-w-[1600px] w-full mx-auto px-4 py-4 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-hidden">
        
        {/* Left Control Column: Fixed Height with Internal Scroll */}
        <section className="lg:col-span-4 h-full flex flex-col min-h-0 overflow-y-auto pr-1 space-y-4">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-xl p-4 shadow-xl space-y-3 shrink-0">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-300 flex items-center gap-2">
                <span>⚡</span> Discovery Filter
              </span>
              {isFetchingUI && (
                <span className="text-[10px] font-mono text-indigo-400 font-bold animate-pulse">
                  Querying...
                </span>
              )}
            </div>

            <div className="space-y-3">
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
                    className="w-full pl-3.5 pr-8 py-2 rounded-2xl border border-slate-800 bg-slate-950/80 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-all"
                  />
                  {searchName && (
                    <button
                      onClick={() => setSearchName('')}
                      className="absolute right-3 top-2 text-xs text-slate-500 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 font-mono text-slate-400">
                  Location
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    placeholder="City, region..."
                    className="w-full pl-3.5 pr-8 py-2 rounded-2xl border border-slate-800 bg-slate-950/80 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-all"
                  />
                  {searchLocation && (
                    <button
                      onClick={() => setSearchLocation('')}
                      className="absolute right-3 top-2 text-xs text-slate-500 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <FriendControl
              pendingRequests={pendingRequests}
              setPendingRequests={setPendingRequests}
              onRequestProcessed={syncFriendsAndPending}
            />
          </div>

          <div className="shrink-0 pb-2">
            <BlockedList
              refreshKey={blockRefreshKey}
              onUnblocked={() => {
                setBlockRefreshKey((prev) => prev + 1);
                fetchSearchResults(1, debouncedQuery, debouncedLocation, true);
              }}
            />
          </div>
        </section>

        {/* Right Community Column: Locked viewport with internal scroll */}
        <section className="lg:col-span-8 h-full flex flex-col min-h-0 bg-slate-900/30 border border-slate-800/80 rounded-3xl backdrop-blur-2xl shadow-2xl overflow-hidden">
          
          {/* Header (Pinned) */}
          <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <h2 className="text-xs font-black uppercase tracking-wider font-mono text-slate-200">
                Community Feed
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {users.length} loaded
              </span>
            </div>

            <span className="text-[10px] font-mono text-indigo-400 font-bold bg-indigo-500/10 px-3 py-0.5 rounded-full border border-indigo-500/20">
              PAGE {page}
            </span>
          </div>

          {/* ⚡ THE SCROLL CONTAINER: Only this box scrolls */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#334155 transparent',
            }}
          >
            {initialLoading ? (
              // 4 clean skeleton placeholders
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-44 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse p-4"
                  />
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/40 p-6 text-center">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  No Members Found
                </h3>
              </div>
            ) : (
              <>
                {/* 2-column grid showing 4 user cards per screen height */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {users.map((user) => (
                    <UserCard
                      key={user.user_id}
                      user={user}
                      isFriend={friendSet.has(String(user.user_id))}
                      hasInboundReq={pendingSet.has(String(user.user_id))}
                      hasSentReq={sentRequests.has(String(user.user_id))}
                      actionUserId={actionUserId}
                      onSendRequest={handleSendRequest}
                      onUnfriend={handleUnfriend}
                      onBlockUser={handleBlockUser}
                    />
                  ))}
                </div>

                {/* Sentinel element to trigger next 4 users when scrolled to bottom */}
                <div ref={observerTarget} className="py-4 flex justify-center items-center">
                  {isFetchingUI && page > 1 && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-indigo-400">
                      <div className="h-3 w-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      Loading more...
                    </div>
                  )}
                  {!hasNext && users.length > 0 && (
                    <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">
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