import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useWebSocket } from '../context/WebsocketContext';
import { userApi } from '../services/api/client';
import { useChatStore } from '../store/useChatStore';
import ActiveFriendsBar from '../components/ActiveFriendsBar';
import UserStatusBadge from '../components/UserStatusBadge';
import ChatContextPanel from '../components/ChatContextPanel';
import MediaMessageRenderer from '../components/MediaMessageRenderer';
import AudioCallModal from '../components/AudioCallModal';
import VideoCallModal from '../components/VideoCallModal';
import { useWebRTC } from '../hooks/useWebRTC';

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

  const {
    activeTarget,
    setActiveTarget,
    friends,
    setFriends,
    rooms,
    setRooms,
    messagesByRoom,
    setRoomMessages,
    appendMessageToRoom,
    updateMessageStatus,
    typingStatusByRoom,
    setTypingStatus,
  } = useChatStore();

  // ⚡ Robust User ID resolution: LocalStorage -> Fallback JWT decoding
  const currentUserId = useMemo(() => {
    const localId = localStorage.getItem('user_id');
    if (localId && localId !== 'undefined' && localId !== 'null') return localId;

    try {
      const token = localStorage.getItem('access_token');
      if (!token) return null;
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      const payload = JSON.parse(decodeURIComponent(escape(window.atob(base64))));
      return payload.user_id || payload.id || null;
    } catch (e) {
      console.error('Failed to parse token fallback in ChatDashboard:', e);
      return null;
    }
  }, []);

  const [inputText, setInputText] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [isDegradedMode, setIsDegradedMode] = useState(false);

  // File Attachment & Progress
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Calling States
  const [activeCallType, setActiveCallType] = useState('audio');

  const chatBottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(false);
  const isSyncingRef = useRef(false);
  const processedAcksRef = useRef(new Set());

  const currentRoomMessages = useMemo(() => messagesByRoom[activeTarget.id] || [], [messagesByRoom, activeTarget.id]);
  const isCurrentRoomTyping = typingStatusByRoom[activeTarget.id] || false;
  const recipientId = activeTarget.friendId || null;

  // WebRTC Hook
  const { 
    localStream, 
    remoteStream, 
    callStatus, 
    startCall, 
    endCall 
  } = useWebRTC(
    activeTarget.id,
    currentUserId,
    recipientId,
    sendMessage,
    wsMessages
  );

  const isAudioActive = activeCallType === 'audio' && (callStatus === 'RINGING_OUTGOING' || callStatus === 'CONNECTED');
  const isVideoActive = activeCallType === 'video' && (callStatus === 'RINGING_OUTGOING' || callStatus === 'CONNECTED');

  // Background Data Sync
  const syncData = useCallback(async () => {
    if (isSyncingRef.current || !currentUserId) return;
    isSyncingRef.current = true;
    try {
      const [friendsRes, roomsRes] = await Promise.allSettled([
        userApi.get('/friends/list'),
        userApi.get(`/api/v1/chat/rooms/${currentUserId}`)
      ]);

      if (friendsRes.status === 'fulfilled' && friendsRes.value.data?.success) {
        setFriends(friendsRes.value.data.data || []);
      }
      if (roomsRes.status === 'fulfilled' && roomsRes.value.data?.success) {
        setRooms(roomsRes.value.data.data || []);
      }
    } catch (err) {
      console.warn("Background sync warning:", err);
    } finally {
      setLoadingFriends(false);
      isSyncingRef.current = false;
    }
  }, [currentUserId, setFriends, setRooms]);

  useEffect(() => {
    syncData();
    const interval = setInterval(syncData, 4000);
    return () => clearInterval(interval);
  }, [syncData]);

  // Load Room History & Check Service Health
  useEffect(() => {
    let isCancelled = false;
    const fetchRoomAndHistory = async () => {
      setLoadingHistory(true);
      setTypingStatus(activeTarget.id, false);

      try {
        const roomId = activeTarget.id;
        
        if (activeTarget.type === 'DIRECT' && activeTarget.friendId) {
          try {
            const roomMetaRes = await userApi.get(`/api/v1/chat/room/${activeTarget.friendId}`);
            if (!isCancelled && roomMetaRes.data?.success) {
              setIsDegradedMode(Boolean(roomMetaRes.data.data?.degraded));
            }
          } catch {
            if (!isCancelled) setIsDegradedMode(true);
          }
        } else {
          if (!isCancelled) setIsDegradedMode(false);
        }

        const res = await userApi.get(`/api/v1/chat/history/${roomId}`);
        if (!isCancelled && res.data?.success && Array.isArray(res.data.data)) {
          const historical = res.data.data.map(m => {
            const isMe = String(m.sender_id) === String(currentUserId);
            return { ...m, status: isMe ? 'DELIVERED' : 'READ' };
          });
          setRoomMessages(roomId, historical);

          historical.forEach(m => {
            if (String(m.sender_id) !== String(currentUserId) && !processedAcksRef.current.has(m.id)) {
              processedAcksRef.current.add(m.id);
              sendMessage({ type: "DELIVERED_ACK", room_id: roomId, content: m.id });
              sendMessage({ type: "READ_ACK", room_id: roomId, content: m.id });
            }
          });
        } else if (!isCancelled) {
          setRoomMessages(roomId, []);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Failed to load room stream history:", err);
          setRoomMessages(activeTarget.id, []);
        }
      } finally {
        if (!isCancelled) setLoadingHistory(false);
      }
    };

    fetchRoomAndHistory();

    return () => {
      isCancelled = true;
    };
  }, [activeTarget.id, activeTarget.type, activeTarget.friendId, currentUserId, setRoomMessages, setTypingStatus, sendMessage]);

  // WebSocket Inbound Frame Listener
  useEffect(() => {
    if (!wsMessages || wsMessages.length === 0) return;
    const latestFrame = wsMessages[wsMessages.length - 1];

    switch (latestFrame.type) {
      case 'NEW_MESSAGE': {
        const targetRoomId = latestFrame.room_id || GLOBAL_ROOM_ID;
        if (targetRoomId === activeTarget.id) {
          const isFromMe = String(latestFrame.sender_id) === String(currentUserId);
          appendMessageToRoom(targetRoomId, latestFrame, currentUserId);

          if (!isFromMe) {
            setTypingStatus(targetRoomId, false);
            sendMessage({ type: "DELIVERED_ACK", room_id: targetRoomId, content: latestFrame.id });
            sendMessage({ type: "READ_ACK", room_id: targetRoomId, content: latestFrame.id });
          }
        }
        break;
      }
      case 'DELIVERED_ACK': {
        const msgId = latestFrame.id || latestFrame.content;
        if (latestFrame.room_id === activeTarget.id && msgId) {
          updateMessageStatus(activeTarget.id, msgId, 'DELIVERED');
        }
        break;
      }
      case 'READ_ACK': {
        const msgId = latestFrame.id || latestFrame.content;
        if (latestFrame.room_id === activeTarget.id && msgId) {
          updateMessageStatus(activeTarget.id, msgId, 'READ');
        }
        break;
      }
      case 'TYPING_START': {
        if (latestFrame.room_id === activeTarget.id && String(latestFrame.sender_id) !== String(currentUserId)) {
          setTypingStatus(activeTarget.id, true);
        }
        break;
      }
      case 'TYPING_STOP': {
        if (latestFrame.room_id === activeTarget.id && String(latestFrame.sender_id) !== String(currentUserId)) {
          setTypingStatus(activeTarget.id, false);
        }
        break;
      }
      case 'CALL_OFFER': {
        if (latestFrame.room_id === activeTarget.id && String(latestFrame.sender_id) !== String(currentUserId)) {
          setActiveCallType(latestFrame.content?.includes('video') ? 'video' : 'audio');
        }
        break;
      }
      default:
        break;
    }
  }, [wsMessages, activeTarget.id, currentUserId, appendMessageToRoom, updateMessageStatus, setTypingStatus, sendMessage]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentRoomMessages, isCurrentRoomTyping]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearSelectedFile = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
  }, [previewUrl]);

  const handleInitiateAudioCall = async () => {
    if (!recipientId) return alert("Select a direct friend to initiate a voice call.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setActiveCallType('audio');
      await startCall(stream, 'audio');
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Microphone permissions required for voice calls.");
    }
  };

  const handleInitiateVideoCall = async () => {
    if (!recipientId) return alert("Select a direct friend to initiate a video call.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } 
      });
      setActiveCallType('video');
      await startCall(stream, 'video');
    } catch (err) {
      console.error("Camera Permission Error:", err);
      alert("Camera & Microphone permissions required for video calls.");
    }
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedMembers.length === 0 || isCreatingGroup || !currentUserId) return;

    setIsCreatingGroup(true);
    try {
      const payload = {
        name: groupName.trim(),
        member_ids: [...selectedMembers, currentUserId]
      };
      const res = await userApi.post('/api/v1/chat/rooms', payload);
      if (res.data?.success) {
        setIsGroupModalOpen(false);
        setGroupName('');
        setSelectedMembers([]);
        syncData();
      }
    } catch (err) {
      console.error("Failed to create group room:", err);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const textContent = inputText.trim();
    if ((!textContent && !selectedFile) || !isConnected) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (lastTypingSentRef.current) {
      sendMessage({ type: "TYPING_STOP", room_id: activeTarget.id, content: "" });
      lastTypingSentRef.current = false;
    }

    let mediaUrl = "";

    if (selectedFile) {
      setIsUploading(true);
      setUploadProgress(10);
      const formData = new FormData();
      formData.append("file", selectedFile);

      try {
        const uploadRes = await userApi.post('/api/v1/chat/upload', formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 90) / progressEvent.total);
            setUploadProgress(Math.max(10, percent));
          }
        });
        if (uploadRes.data?.success) {
          mediaUrl = uploadRes.data.data.file_url;
          setUploadProgress(100);
        }
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setIsUploading(false);
        clearSelectedFile();
      }
    }

    const finalContent = mediaUrl 
      ? `${textContent ? textContent + "\n" : ""}[Media Attachment: ${mediaUrl}]` 
      : textContent;

    if (!finalContent) return;

    sendMessage({
      type: "SEND_MESSAGE",
      room_id: activeTarget.id,
      content: finalContent,
    });

    setInputText('');
  };

  const selectFriendChat = useCallback((friend) => {
    const friendId = String(friend.user_id || friend.id);
    const friendName = friend.display_name || friend.name || "Friend";
    const ids = [String(currentUserId || '0'), friendId].sort();
    const directRoomUUID = generateValidRoomUUID(ids[0], ids[1]);

    setActiveTarget({
      id: directRoomUUID,
      name: friendName,
      type: "DIRECT",
      friendId: friendId,
      avatarUrl: friend.avatar_url,
      isOnline: friend.is_online === true,
    });
    setMobileShowChat(true);
  }, [currentUserId, setActiveTarget]);

  const selectGroupChat = useCallback((room) => {
    setActiveTarget({
      id: room.id,
      name: room.name,
      type: "GROUP",
    });
    setMobileShowChat(true);
  }, [setActiveTarget]);

  return (
    <div className="h-[calc(100dvh-64px)] w-full bg-slate-950 text-slate-100 font-sans flex flex-col items-center overflow-hidden selection:bg-indigo-500 selection:text-white">
      
      {/* GROUP CREATION MODAL */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl sm:rounded-3xl w-full max-w-md p-5 sm:p-7 shadow-2xl space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 sm:pb-4">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md">👥</div>
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase font-mono tracking-wider">Create Group Chat</h3>
              </div>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-white font-bold text-xs bg-slate-800/60 hover:bg-slate-700 h-7 w-7 rounded-full flex items-center justify-center transition-all cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Core Engineering Guild..."
                  required
                  className="w-full bg-slate-950 border border-slate-800/80 rounded-xl sm:rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs text-white outline-none focus:border-indigo-500 transition-all shadow-inner"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5">Select Members ({friends.length})</label>
                <div className="max-h-36 sm:max-h-48 overflow-y-auto space-y-1.5 sm:space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                  {friends.map((friend) => {
                    const fId = String(friend.user_id || friend.id);
                    const isChecked = selectedMembers.includes(fId);
                    return (
                      <div
                        key={fId}
                        onClick={() => setSelectedMembers(prev => isChecked ? prev.filter(id => id !== fId) : [...prev, fId])}
                        className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-xs cursor-pointer transition-all ${isChecked ? 'bg-indigo-600/20 border border-indigo-500/50 text-indigo-200 shadow-md shadow-indigo-500/10' : 'bg-slate-950/40 border border-slate-800/60 text-slate-300 hover:bg-slate-800/40'}`}
                      >
                        <span className="font-bold truncate">{friend.display_name || friend.name || 'Friend'}</span>
                        <input type="checkbox" checked={isChecked} readOnly className="rounded bg-slate-950 border-slate-700 text-indigo-600 pointer-events-none" />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  disabled={isCreatingGroup}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!groupName.trim() || selectedMembers.length === 0 || isCreatingGroup}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                >
                  {isCreatingGroup ? "Creating..." : "Create Group 🚀"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTIVE FRIENDS BAR (Visible only when not in full mobile chat view) */}
      <div className={`w-full shrink-0 ${mobileShowChat ? 'hidden sm:block' : 'block'}`}>
        <ActiveFriendsBar friends={friends} onSelectFriend={selectFriendChat} />
      </div>

      {/* MAIN CHAT GRID */}
      <main className="max-w-[1600px] w-full mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-3 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-6 min-h-0 overflow-hidden">
        
        {/* LEFT PANEL: SIDEBAR */}
        <section className={`lg:col-span-3 bg-slate-900/40 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col justify-between backdrop-blur-2xl shadow-2xl h-full overflow-hidden min-h-0 ${mobileShowChat ? 'hidden lg:flex' : 'flex'}`}>
          <div className="space-y-3 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between px-1 shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-300">💬 Conversations</h3>
              <button
                onClick={() => setIsGroupModalOpen(true)}
                className="text-[10px] font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-xl transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                + Group
              </button>
            </div>

            <button
              onClick={() => {
                setActiveTarget({ id: GLOBAL_ROOM_ID, name: "Global Lounge", type: "GLOBAL", isOnline: true });
                setMobileShowChat(true);
              }}
              className={`w-full flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeTarget.id === GLOBAL_ROOM_ID
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-slate-950/60 border border-slate-800/80 text-slate-300 hover:text-white hover:border-slate-700"
              }`}
            >
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-sm shrink-0">🌐</div>
              <div className="text-left truncate">
                <p className="truncate font-bold">Global Lounge</p>
                <p className="text-[10px] text-slate-400 font-normal">Broadcast Network</p>
              </div>
            </button>

            {rooms.filter(r => r.type === 'GROUP').length > 0 && (
              <div className="space-y-1 shrink-0">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 font-mono">Groups</h4>
                <div className="space-y-1 max-h-24 sm:max-h-28 overflow-y-auto pr-1 scrollbar-thin">
                  {rooms.filter(r => r.type === 'GROUP').map(room => (
                    <button
                      key={room.id}
                      onClick={() => selectGroupChat(room)}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        activeTarget.id === room.id ? "bg-purple-600/20 border border-purple-500/40 text-purple-200" : "bg-slate-950/40 hover:bg-slate-800/40 text-slate-300"
                      }`}
                    >
                      <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-purple-500 to-pink-600 flex items-center justify-center font-bold text-white text-xs shrink-0">👥</div>
                      <span className="truncate font-bold">{room.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <hr className="border-slate-800/80 shrink-0" />

            <div className="flex-1 flex flex-col min-h-0 space-y-1 overflow-hidden">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 font-mono shrink-0">Direct Messages</h4>
              <div className="overflow-y-auto flex-1 space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800 min-h-0">
                {loadingFriends ? (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3].map((n) => <div key={n} className="h-11 rounded-2xl bg-slate-800/40 animate-pulse" />)}
                  </div>
                ) : friends.length === 0 ? (
                  <div className="text-center py-6 px-4 text-xs font-mono text-slate-500 border border-dashed border-slate-800/80 rounded-2xl bg-slate-950/30">
                    No direct friends connected.
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
                        className={`w-full flex items-center justify-between p-2 sm:p-2.5 rounded-2xl text-xs font-medium transition-all cursor-pointer ${
                          isSelected ? "bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 shadow-md" : "bg-slate-950/40 hover:bg-slate-800/40 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="relative shrink-0">
                            {friend.avatar_url ? (
                              <img src={friend.avatar_url} alt={friend.display_name} className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl object-cover border border-slate-800" />
                            ) : (
                              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">
                                {(friend.display_name || 'F').substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 ${online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                          </div>
                          <div className="text-left truncate">
                            <p className="font-bold text-white truncate text-xs">{friend.display_name || friend.name || 'Friend'}</p>
                            <p className="text-[9px] text-slate-500 font-mono">1-on-1 Session</p>
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

          {/* Sidebar Footer Link Status */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] sm:text-[11px] font-mono shrink-0 mt-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-slate-400">Mesh Gateway:</span>
            </div>
            <span className={`font-bold ${isConnected ? "text-emerald-400" : "text-rose-400"}`}>{connectionStatus}</span>
          </div>
        </section>

        {/* CENTER PANEL: ACTIVE CONVERSATION FEED */}
        <section className={`lg:col-span-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-3 sm:p-5 backdrop-blur-2xl flex flex-col justify-between shadow-2xl h-full overflow-hidden min-h-0 ${mobileShowChat ? 'flex' : 'hidden lg:flex'}`}>
          
          {/* Header */}
          <div className="pb-2.5 sm:pb-3 border-b border-slate-800/80 flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 truncate">
                <button
                  onClick={() => setMobileShowChat(false)}
                  className="lg:hidden p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold shrink-0 cursor-pointer"
                  title="Back to conversations"
                >
                  ←
                </button>

                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xs sm:text-sm font-bold shadow-md shrink-0">
                  {activeTarget.type === "GLOBAL" ? "🌐" : activeTarget.type === "GROUP" ? "👥" : activeTarget.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="truncate">
                  <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                    <span className="truncate">{activeTarget.name}</span>
                    {activeTarget.type === "DIRECT" && <UserStatusBadge isOnline={activeTarget.isOnline} />}
                  </h2>
                  <p className="text-[8px] sm:text-[9px] text-slate-500 font-mono truncate">ID: {activeTarget.id.substring(0, 16)}...</p>
                </div>
              </div>

              {/* Action Calling Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleInitiateAudioCall}
                  className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-slate-800/80 hover:bg-emerald-600/20 text-slate-300 hover:text-emerald-400 text-xs font-mono transition-all cursor-pointer border border-slate-700/80 shadow-md"
                  title="Start Voice Call"
                >
                  🎙️
                </button>
                <button
                  onClick={handleInitiateVideoCall}
                  className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-slate-800/80 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-400 text-xs font-mono transition-all cursor-pointer border border-slate-700/80 shadow-md"
                  title="Start Video Call"
                >
                  📹
                </button>
              </div>
            </div>

            {/* Degradation Warning Badge */}
            {isDegradedMode && (
              <div className="bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-xl flex items-center justify-between animate-in fade-in">
                <div className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[9px] sm:text-[10px] font-mono text-amber-300">
                    Degraded Performance: Messaging operates via fallback.
                  </span>
                </div>
                <span className="text-[8px] sm:text-[9px] font-mono uppercase bg-amber-500/20 text-amber-200 px-1 py-0.5 rounded border border-amber-500/30">
                  Fallback
                </span>
              </div>
            )}
          </div>

          {/* MESSAGE STREAM */}
          <div className="overflow-y-auto space-y-2.5 sm:space-y-3.5 my-2 pr-1 sm:pr-2 scrollbar-thin scrollbar-thumb-slate-800 flex-1 min-h-0 relative">
            {loadingHistory ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                <span>Loading conversation stream...</span>
              </div>
            ) : currentRoomMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs font-mono space-y-1 text-center px-4">
                <span>No messages in this room yet.</span>
                <span>Type below to dispatch the first packet!</span>
              </div>
            ) : (
              currentRoomMessages.map((msg, index) => {
                const isMe = String(msg.sender_id) === String(currentUserId);
                const status = msg.status || 'SENT';

                return (
                  <div key={msg.id || index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[90%] sm:max-w-[75%] px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl sm:rounded-3xl text-xs font-sans shadow-lg break-words ${isMe ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-sm shadow-indigo-500/10' : 'bg-slate-800/90 border border-slate-700/80 text-slate-200 rounded-bl-sm'}`}>
                      <MediaMessageRenderer content={msg.content} />
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

            {isCurrentRoomTyping && (
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-mono py-1 animate-pulse">
                <div className="flex space-x-1.5 bg-slate-900 border border-indigo-500/30 px-3 py-2 rounded-2xl">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  <span className="ml-2 text-[10px] sm:text-[11px] text-slate-300 font-sans">Someone is typing...</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* FILE ATTACHMENT PREVIEW */}
          {selectedFile && (
            <div className="px-3 py-2 bg-slate-950 border border-slate-800/80 rounded-xl sm:rounded-2xl flex items-center justify-between mb-2 shrink-0 animate-in fade-in">
              <div className="flex items-center gap-2.5 truncate">
                {previewUrl && selectedFile.type.startsWith('image/') ? (
                  <img src={previewUrl} alt="Preview" className="h-9 w-9 rounded-lg object-cover border border-slate-800" />
                ) : (
                  <div className="h-9 w-9 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-sm">📎</div>
                )}
                <div className="truncate">
                  <p className="text-xs text-slate-200 font-bold truncate">{selectedFile.name}</p>
                  <p className="text-[9px] text-slate-500 font-mono">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>

              <button 
                onClick={clearSelectedFile}
                className="text-slate-400 hover:text-rose-400 text-xs font-bold h-6 w-6 rounded-full bg-slate-900 flex items-center justify-center cursor-pointer transition-all"
              >
                ✕
              </button>
            </div>
          )}

          {/* UPLOAD PROGRESS BAR */}
          {isUploading && (
            <div className="space-y-1 mb-2 shrink-0">
              <div className="flex justify-between text-[9px] font-mono text-indigo-400">
                <span>Uploading attachment...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* TEXT INPUT FORM */}
          <form onSubmit={handleSendMessage} className="pt-2 sm:pt-3 border-t border-slate-800/80 flex gap-1.5 sm:gap-2 shrink-0 items-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,application/pdf,.txt,.doc,.docx"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected || isUploading}
              title="Attach File"
              className="p-2.5 sm:p-3 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl sm:rounded-2xl text-slate-400 hover:text-white transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              📎
            </button>

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
              placeholder={isConnected ? (isUploading ? "Uploading..." : `Message ${activeTarget.name}...`) : "Gateway reconnecting..."}
              disabled={!isConnected || isUploading}
              className="flex-1 min-w-0 bg-slate-950 border border-slate-800 focus:border-indigo-500/50 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs text-white placeholder-slate-500 outline-none transition-all disabled:opacity-50 shadow-inner"
            />
            <button
              type="submit"
              disabled={!isConnected || (!inputText.trim() && !selectedFile) || isUploading}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 shrink-0"
            >
              {isUploading ? "..." : "Send ⚡"}
            </button>
          </form>
        </section>

        {/* RIGHT PANEL: CONTEXT METADATA (Desktop only) */}
        <div className="hidden lg:block lg:col-span-3 h-full overflow-hidden">
          <ChatContextPanel activeTarget={activeTarget} isOpen={isContextOpen} onClose={() => setIsContextOpen(false)} />
        </div>

      </main>

      {/* CALL MODALS */}
      <AudioCallModal 
        isOpen={isAudioActive}
        onClose={() => endCall(true)}
        callerName={activeTarget.name}
        callStatus={callStatus}
        localStream={localStream}
        remoteStream={remoteStream}
        onAccept={null}
        onReject={() => endCall(true)}
      />

      <VideoCallModal 
        isOpen={isVideoActive}
        onClose={() => endCall(true)}
        callerName={activeTarget.name}
        callStatus={callStatus}
        localStream={localStream}
        remoteStream={remoteStream}
        onAccept={null}
        onReject={() => endCall(true)}
      />

    </div>
  );
}