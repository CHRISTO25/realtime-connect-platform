import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../services/api/client';
import FriendControl from '../components/FriendControl';
import BlockedList from '../components/BlockedList';
import UserCard from '../components/UserCard';
import ActiveFriendsBar from '../components/ActiveFriendsBar';

// Custom Debounce Hook to avoid API spam on fast typing
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
  const userId = localStorage.getItem('user_id');

  // Search Inputs
  const [searchName, setSearchName] = useState('');
  const [searchLocation, setSearchLocation] = useState('');

  // Debounced Search Strings
  const debouncedQuery = useDebounce(searchName, 300);
  const debouncedLocation = useDebounce(searchLocation, 300);

  // Core Data States
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState(new Set());

  // Infinite Scroll & Pagination States
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isFetchingUI, setIsFetchingUI] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // ⚡ Ref to maintain stable fetch status without breaking useCallback dependencies
  const isFetchingRef = useRef(false);

  // UI Control & Refresh Signals
  const [actionUserId, setActionUserId] = useState(null);
  const [toast, setToast] = useState(null);
  const [blockRefreshKey, setBlockRefreshKey] = useState(0);

  // IntersectionObserver Ref for Infinite Scrolling
  const observerTarget = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ⚡ SERVER-SIDE SEARCH ENGINE QUERY (/api/v1/users/search)
  const fetchSearchResults = useCallback(
    async (pageNum, query, location, isReset = false) => {
      if (isFetchingRef.current && !isReset) return;
      isFetchingRef.current = true;
      setIsFetchingUI(true);

      try {
        const res = await userApi.get(
          `/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(
            location
          )}&page=${pageNum}&limit=10`
        );

        if (res.data && res.data.success) {
          const payload = res.data.data;
          const freshProfiles = payload.users || [];

          setHasNext(payload.has_next);

          if (isReset) {
            setUsers(freshProfiles);
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

  // ⚡ FAST AUXILIARY DATA SYNC (Friends, Pending Invites & Live Card Online Badges)
  const syncFriendsAndPending = useCallback(async () => {
    try {
      const [friendsRes, pendingRes] = await Promise.allSettled([
        userApi.get('/friends/list'),
        userApi.get('/friends/pending'),
      ]);

      if (friendsRes.status === 'fulfilled' && friendsRes.value.data?.success) {
        const freshFriends = friendsRes.value.data.data || [];
        setFriends(freshFriends);

        // ⚡ Map friend online status directly to feed cards
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
      console.warn('Silent sync error:', err);
    }
  }, []);

  // Initial Auth & Polling Setup (Fast 1.5s background polling for live presence)
  useEffect(() => {
    if (!localStorage.getItem('access_token') || !userId) {
      navigate('/login');
      return;
    }

    syncFriendsAndPending();

    const interval = setInterval(() => {
      syncFriendsAndPending();
    }, 1500);

    return () => clearInterval(interval);
  }, [userId, navigate, syncFriendsAndPending]);

  // ⚡ DEBOUNCED SEARCH TRIGGER (Resets feed when typing)
  useEffect(() => {
    setPage(1);
    fetchSearchResults(1, debouncedQuery, debouncedLocation, true);
  }, [debouncedQuery, debouncedLocation, fetchSearchResults]);

  // ⚡ INFINITE SCROLL OBSERVER
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

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
      { threshold: 0.8 }
    );

    observer.observe(target);
    return () => observer.unobserve(target);
  }, [hasNext, debouncedQuery, debouncedLocation, fetchSearchResults]);

  // ⚡ FAST O(1) LOOKUP HASH SETS
  const friendSet = useMemo(() => new Set(friends.map((f) => String(f.user_id || f.id))), [friends]);
  const pendingSet = useMemo(() => new Set(pendingRequests.map((p) => String(p.sender_id))), [pendingRequests]);

  // ⚡ INSTANT OPTIMISTIC ACTION HANDLERS
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
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans pb-20 relative selection:bg-indigo-500 selection:text-white">
      
      {/* TOAST NOTIFICATIONS */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-center gap-3 text-xs font-bold font-mono tracking-wide ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
                : toast.type === 'error'
                ? 'bg-red-950/90 border-red-500/50 text-red-300'
                : 'bg-indigo-950/90 border-indigo-500/50 text-indigo-300'
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-current animate-ping" />
            {toast.message}
          </div>
        </div>
      )}

      {/* MEMOIZED ACTIVE FRIENDS CAROUSEL */}
      <ActiveFriendsBar friends={friends} />

      {/* MAIN LAYOUT */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* LEFT COLUMN: SEARCH + CONTROL CENTERS */}
        <section className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl p-5 flex flex-col h-fit shadow-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200 flex items-center justify-between pb-2 border-b border-slate-800">
              <span>🔍 Real-Time Search Engine</span>
              {isFetchingUI && <span className="text-[10px] text-indigo-400 animate-pulse font-bold">Querying...</span>}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 font-mono text-slate-400">
                  Search Name / Bio
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="Type name to query..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-all"
                  />
                  {searchName && (
                    <button onClick={() => setSearchName('')} className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-white font-bold">✕</button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 font-mono text-slate-400">
                  Filter By Location
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    placeholder="City, region..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-all"
                  />
                  {searchLocation && (
                    <button onClick={() => setSearchLocation('')} className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-white font-bold">✕</button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <FriendControl
            pendingRequests={pendingRequests}
            setPendingRequests={setPendingRequests}
            onRequestProcessed={syncFriendsAndPending}
          />

          <BlockedList
            refreshKey={blockRefreshKey}
            onUnblocked={() => {
              setBlockRefreshKey((prev) => prev + 1);
              fetchSearchResults(1, debouncedQuery, debouncedLocation, true);
            }}
          />
        </section>

        {/* RIGHT COLUMN: PAGINATED USER DIRECTORY FEED */}
        <section className="lg:col-span-8 flex flex-col space-y-4">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl px-5 py-3.5 flex items-center justify-between shadow-lg">
            <h2 className="text-xs font-black uppercase tracking-wider font-mono text-slate-200">
              Community Feed ({users.length})
            </h2>
            <span className="text-[10px] font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
              PAGE {page}
            </span>
          </div>

          {/* SKELETON LOADING */}
          {initialLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-60 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse p-5" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {users.length > 0 ? (
                  users.map((user) => (
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
                  ))
                ) : (
                  <div className="col-span-full py-16 rounded-2xl border border-dashed border-slate-800 text-center font-mono text-xs text-slate-500 bg-slate-900/20">
                    No members match your search criteria.
                  </div>
                )}
              </div>

              {/* INFINITE SCROLL OBSERVER TARGET */}
              <div ref={observerTarget} className="py-6 flex justify-center items-center">
                {isFetchingUI && page > 1 && (
                  <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 animate-pulse">
                    <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    Loading next page...
                  </div>
                )}
              </div>
            </>
          )}
        </section>

      </main>
    </div>
  );
}