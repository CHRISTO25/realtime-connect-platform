import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { userApi } from '../services/api/client';
import ActiveFriendsBar from '../components/ActiveFriendsBar';
import UserStatusBadge from '../components/UserStatusBadge';

const GLOBAL_ROOM_ID = "00000000-0000-0000-0000-000000000001";

function generateValidRoomUUID(userId1, userId2) {
  if (!userId1 || !userId2) return GLOBAL_ROOM_ID;
  const clean1 = String(userId1).replace(/-/g, '').padEnd(16, '0').substring(0, 16);
  const clean2 = String(userId2).replace(/-/g, '').padEnd(16, '0').substring(0, 16);
  const raw = (clean1 + clean2).padEnd(32, '0').substring(0, 32);
  return `${raw.substring(0, 8)}-${raw.substring(8, 12)}-4${raw.substring(13, 16)}-a${raw.substring(17, 20)}-${raw.substring(20, 32)}`;
}

export default function ChatDashboard() {
  const { isConnected, connectionStatus, messages: wsMessages, sendMessage } = useWebSocket();

  const [friends, setFriends] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeTarget, setActiveTarget] = useState({ 
    id: GLOBAL_ROOM_ID, 
    name: "Global Lounge", 
    type: "GLOBAL",
    isOnline: true 
  });
  const [chatHistory, setChatHistory] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);

  // Group Modal States
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  const currentUserId = localStorage.getItem('user_id');
  const chatBottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(false);

  // 1. Sync Friends & Custom Joined Rooms
  const syncData = useCallback(async () => {
    try {
      const [friendsRes, roomsRes] = await Promise.allSettled([
        userApi.get('/friends/list'),
        userApi.get(`http://localhost:8003/api/v1/chat/rooms/${currentUserId}`)
      ]);

      if (friendsRes.status === 'fulfilled' && friendsRes.value.data?.success) {
        setFriends(friendsRes.value.data.data || []);
      }
      if (roomsRes.status === 'fulfilled' && roomsRes.value.data?.success) {
        setRooms(roomsRes.value.data.data || []);
      }
    } catch (err) {
      console.warn("Silent sync warning:", err);
    } finally {
      setLoadingFriends(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    syncData();
    const interval = setInterval(syncData, 3000);
    return () => clearInterval(interval);
  }, [syncData]);

  // 2. Fetch Chat History Window
  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      setIsTyping(false);
      try {
        const roomId = activeTarget.id;
        const res = await userApi.get(`http://localhost:8003/api/v1/chat/history/${roomId}`);
        if (res.data && res.data.success && Array.isArray(res.data.data)) {
          setChatHistory(res.data.data.map(m => ({ ...m, status: 'READ' })));
        } else {
          setChatHistory([]);
        }
      } catch (err) {
        console.error("Failed to load history:", err);
        setChatHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [activeTarget.id]);

  // 3. Handle Inbound WebSocket Frames
  useEffect(() => {
    if (!wsMessages || wsMessages.length === 0) return;
    const latestFrame = wsMessages[wsMessages.length - 1];

    if (latestFrame.type === 'NEW_MESSAGE') {
      const targetRoomId = latestFrame.room_id || GLOBAL_ROOM_ID;
      if (targetRoomId === activeTarget.id) {
        setChatHistory((prev) => {
          if (latestFrame.id && prev.some((msg) => msg.id === latestFrame.id)) return prev;
          return [...prev, { ...latestFrame, status: 'DELIVERED' }];
        });
        if (String(latestFrame.sender_id) !== String(currentUserId)) {
          setIsTyping(false);
        }
      }
    } else if (latestFrame.type === 'TYPING_START') {
      if (latestFrame.room_id === activeTarget.id && String(latestFrame.sender_id) !== String(currentUserId)) {
        setIsTyping(true);
      }
    } else if (latestFrame.type === 'TYPING_STOP') {
      if (latestFrame.room_id === activeTarget.id && String(latestFrame.sender_id) !== String(currentUserId)) {
        setIsTyping(false);
      }
    }
  }, [wsMessages, activeTarget.id, currentUserId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  // 4. Create Group Room Submission Handler
  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedMembers.length === 0) return;

    try {
      const payload = {
        name: groupName.trim(),
        member_ids: [...selectedMembers, currentUserId]
      };
      const res = await userApi.post('http://localhost:8003/api/v1/chat/rooms', payload);
      if (res.data && res.data.success) {
        setIsGroupModalOpen(false);
        setGroupName('');
        setSelectedMembers([]);
        syncData();
      }
    } catch (err) {
      console.error("Failed to create group room:", err);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const messageContent = inputText.trim();
    if (!messageContent || !isConnected) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (lastTypingSentRef.current) {
      sendMessage({ type: "TYPING_STOP", room_id: activeTarget.id, content: "" });
      lastTypingSentRef.current = false;
    }

    sendMessage({
      type: "SEND_MESSAGE",
      room_id: activeTarget.id,
      content: messageContent,
    });

    setChatHistory((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        room_id: activeTarget.id,
        sender_id: currentUserId,
        content: messageContent,
        created_at: new Date().toISOString(),
        status: 'SENT',
      },
    ]);
    setInputText('');
  };

  const selectFriendChat = useCallback((friend) => {
    const friendId = String(friend.user_id || friend.id);
    const friendName = friend.display_name || friend.name || "Friend";
    const ids = [String(currentUserId), friendId].sort();
    const directRoomUUID = generateValidRoomUUID(ids[0], ids[1]);

    setActiveTarget({
      id: directRoomUUID,
      name: friendName,
      type: "DIRECT",
      friendId: friendId,
      avatarUrl: friend.avatar_url,
      isOnline: friend.is_online === true,
    });
  }, [currentUserId]);

  const selectGroupChat = (room) => {
    setActiveTarget({
      id: room.id,
      name: room.name,
      type: "GROUP",
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12 flex flex-col items-center relative">
      
      {/* ⚡ GROUP CREATION MODAL OVERLAY */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">👥 Create Group Chat</h3>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-white font-bold text-xs cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Engineering Squad..."
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">Select Members ({friends.length})</label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                  {friends.map((friend) => {
                    const fId = String(friend.user_id || friend.id);
                    const isChecked = selectedMembers.includes(fId);
                    return (
                      <div
                        key={fId}
                        onClick={() => {
                          setSelectedMembers(prev => isChecked ? prev.filter(id => id !== fId) : [...prev, fId]);
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all ${isChecked ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-200' : 'bg-slate-950/40 border border-slate-800/60 text-slate-300 hover:bg-slate-800/40'}`}
                      >
                        <span className="font-bold">{friend.display_name || friend.name || 'Friend'}</span>
                        <input type="checkbox" checked={isChecked} onChange={() => {}} className="rounded bg-slate-950 border-slate-700 text-indigo-600" />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!groupName.trim() || selectedMembers.length === 0}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-indigo-500/20"
                >
                  Launch Group 🚀
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ActiveFriendsBar friends={friends} onSelectFriend={selectFriendChat} />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[80vh]">
        
        {/* Sidebar */}
        <section className="lg:col-span-4 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between backdrop-blur-xl shadow-2xl h-full overflow-hidden">
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-300">💬 Conversations</h3>
              <button
                onClick={() => setIsGroupModalOpen(true)}
                className="text-[10px] font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                + New Group
              </button>
            </div>

            <button
              onClick={() => setActiveTarget({ id: GLOBAL_ROOM_ID, name: "Global Lounge", type: "GLOBAL", isOnline: true })}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTarget.id === GLOBAL_ROOM_ID
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                  : "bg-slate-950/60 border border-slate-800/80 text-slate-300 hover:text-white"
              }`}
            >
              <div className="h-9 w-9 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-base">🌐</div>
              <div className="text-left truncate">
                <p className="truncate font-bold">Global Lounge</p>
                <p className="text-[10px] text-slate-400 font-normal">Public Chatroom</p>
              </div>
            </button>

            {/* Custom Group Rooms List */}
            {rooms.filter(r => r.type === 'GROUP').length > 0 && (
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 font-mono">Groups</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1 scrollbar-thin">
                  {rooms.filter(r => r.type === 'GROUP').map(room => (
                    <button
                      key={room.id}
                      onClick={() => selectGroupChat(room)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        activeTarget.id === room.id ? "bg-purple-600/20 border border-purple-500/40 text-purple-200" : "bg-slate-950/40 hover:bg-slate-800/40 text-slate-300"
                      }`}
                    >
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-purple-500 to-pink-600 flex items-center justify-center font-bold text-white text-xs">👥</div>
                      <span className="truncate font-bold">{room.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <hr className="border-slate-800/80" />

            <div className="flex-1 flex flex-col min-h-0 space-y-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 font-mono">Direct Messages</h4>
              <div className="overflow-y-auto flex-1 space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {loadingFriends ? (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3].map((n) => <div key={n} className="h-12 rounded-xl bg-slate-800/40 animate-pulse" />)}
                  </div>
                ) : friends.length === 0 ? (
                  <div className="text-center py-10 px-4 text-xs font-mono text-slate-500 border border-dashed border-slate-800/80 rounded-xl bg-slate-950/30">
                    No friends connected yet.
                  </div>
                ) : (
                  friends.map((friend) => {
                    const friendId = String(friend.user_id || friend.id);
                    const isSelected = activeTarget.friendId === friendId;
                    const online = friend.is_online === true;

                    return (
                      <button
                        key={friendId}
                        onClick={() => selectFriendChat(friend)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          isSelected ? "bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 shadow-md" : "bg-slate-950/40 hover:bg-slate-800/40 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <div className="relative shrink-0">
                            {friend.avatar_url ? (
                              <img src={friend.avatar_url} alt={friend.display_name} className="h-9 w-9 rounded-lg object-cover border border-slate-800" />
                            ) : (
                              <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">
                                {(friend.display_name || 'F').substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 ${online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                          </div>
                          <div className="text-left truncate">
                            <p className="font-bold text-white truncate">{friend.display_name || friend.name || 'Friend'}</p>
                            <p className="text-[10px] text-slate-500 font-mono">1-on-1 Chat</p>
                          </div>
                        </div>
                        <UserStatusBadge isOnline={online} />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Pipeline:</span>
            <span className={`font-bold ${isConnected ? "text-emerald-400" : "text-rose-400"}`}>{connectionStatus}</span>
          </div>
        </section>

        {/* Chat Window Viewport */}
        <section className="lg:col-span-8 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 sm:p-6 backdrop-blur-xl flex flex-col justify-between shadow-2xl h-full">
          <div className="pb-4 border-b border-slate-800/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-base font-bold shadow-md">
                {activeTarget.type === "GLOBAL" ? "🌐" : activeTarget.type === "GROUP" ? "👥" : activeTarget.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  {activeTarget.name}
                  {activeTarget.type === "DIRECT" && <UserStatusBadge isOnline={activeTarget.isOnline} />}
                </h2>
                <p className="text-[10px] text-slate-500 font-mono truncate max-w-xs">Room UUID: {activeTarget.id}</p>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto space-y-3 my-4 pr-2 scrollbar-thin scrollbar-thumb-slate-800 flex-1 relative">
            {loadingHistory ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono py-24">
                <span>Loading room history...</span>
              </div>
            ) : chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs font-mono py-24 space-y-1">
                <span>No messages in this room yet.</span>
                <span>Type a message below to start the conversation!</span>
              </div>
            ) : (
              chatHistory.map((msg, index) => {
                const isMe = String(msg.sender_id) === String(currentUserId);
                const status = msg.status || 'READ';

                return (
                  <div key={msg.id || index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[75%] p-3 rounded-2xl text-xs font-sans shadow-md ${isMe ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none' : 'bg-slate-800/90 border border-slate-700/80 text-slate-200 rounded-bl-none'}`}>
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>

                    <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-mono mt-1 px-1">
                      <span>{isMe ? 'You' : `Sender: ${String(msg.sender_id).substring(0, 8)}...`}</span>
                      <span>•</span>
                      <span>{new Date(msg.created_at || msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && (
                        <span className="ml-1 font-bold text-xs">
                          {status === 'SENT' && <span className="text-slate-400">✓</span>}
                          {status === 'DELIVERED' && <span className="text-slate-300">✓✓</span>}
                          {status === 'READ' && <span className="text-cyan-400">✓✓</span>}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {isTyping && (
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-mono py-1 animate-pulse">
                <div className="flex space-x-1 bg-slate-900 border border-indigo-500/30 px-3 py-2 rounded-2xl">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  <span className="ml-2 text-[11px] text-slate-300 font-sans">Someone is typing...</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          <form onSubmit={handleSendMessage} className="pt-3 border-t border-slate-800/80 flex gap-2 shrink-0">
            <input
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (isConnected && e.target.value.trim().length > 0 && !lastTypingSentRef.current) {
                  sendMessage({ type: "TYPING_START", room_id: activeTarget.id, content: "typing..." });
                  lastTypingSentRef.current = true;
                }
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => {
                  if (lastTypingSentRef.current) {
                    sendMessage({ type: "TYPING_STOP", room_id: activeTarget.id, content: "" });
                    lastTypingSentRef.current = false;
                  }
                }, 1500);
              }}
              placeholder={isConnected ? `Message ${activeTarget.name}...` : "WebSocket offline..."}
              disabled={!isConnected}
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500/50 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 outline-none transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!isConnected || !inputText.trim()}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold px-6 py-3 rounded-xl text-xs transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
            >
              Send ⚡
            </button>
          </form>
        </section>

      </main>
    </div>
  );
}