import { create } from 'zustand';

const GLOBAL_ROOM_ID = "00000000-0000-0000-0000-000000000001";

export const useChatStore = create((set) => ({
  activeTarget: {
    id: GLOBAL_ROOM_ID,
    name: "Global Lounge",
    type: "GLOBAL",
    isOnline: true,
  },
  setActiveTarget: (target) => set({ activeTarget: target }),

  friends: [],
  rooms: [],
  setFriends: (friends) => set({ friends }),
  setRooms: (rooms) => set({ rooms }),

  messagesByRoom: {},
  setRoomMessages: (roomID, messages) => 
    set((state) => ({
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomID]: messages,
      },
    })),
  
 appendMessageToRoom: (roomID, message, currentUserId) =>
    set((state) => {
      const currentMessages = state.messagesByRoom[roomID] || [];
      if (message.id && currentMessages.some((m) => m.id === message.id)) {
        return state;
      }
      
      const isFromMe = String(message.sender_id) === String(currentUserId);
      // ⚡ OUTGOING MESSAGES FROM YOU MUST ALWAYS START AT 'SENT' (✓)
      // They ONLY upgrade to 'DELIVERED' (✓✓) when a live DELIVERED_ACK frame arrives from the recipient socket.
      const status = message.status || (isFromMe ? 'SENT' : 'DELIVERED');
      
      const enrichedMsg = { ...message, status };
      const updated = [...currentMessages, enrichedMsg];
      const capped = updated.length > 100 ? updated.slice(updated.length - 100) : updated;

      return {
        messagesByRoom: {
          ...state.messagesByRoom,
          [roomID]: capped,
        },
      };
    }),

  updateMessageStatus: (roomID, messageId, newStatus) =>
    set((state) => {
      const currentMessages = state.messagesByRoom[roomID] || [];
      const updated = currentMessages.map((msg) =>
        msg.id === messageId ? { ...msg, status: newStatus } : msg
      );
      return {
        messagesByRoom: {
          ...state.messagesByRoom,
          [roomID]: updated,
        },
      };
    }),

  typingStatusByRoom: {},
  setTypingStatus: (roomID, isTyping) =>
    set((state) => ({
      typingStatusByRoom: {
        ...state.typingStatusByRoom,
        [roomID]: isTyping,
      },
    })),
}));