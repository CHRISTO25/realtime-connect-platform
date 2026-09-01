import React, { useMemo } from 'react';
import { useWebSocket } from '../context/WebsocketContext';
import AudioCallModal from './AudioCallModal';
import VideoCallModal from './VideoCallModal';
import { useWebRTC } from '../hooks/useWebRTC';

export default function GlobalCallHandler() {
  const { incomingCall, setIncomingCall, messages, sendMessage } = useWebSocket();
  const currentUserId = useMemo(() => localStorage.getItem('user_id'), []);

  const targetRoomId = incomingCall?.roomID || "00000000-0000-0000-0000-000000000001";
  const targetPeerId = incomingCall?.callerId || null;

  const { 
    localStream, 
    remoteStream, 
    callStatus, 
    incomingOffer,
    acceptIncomingCall, 
    declineIncomingCall, 
    endCall 
  } = useWebRTC(
    targetRoomId,
    currentUserId,
    targetPeerId,
    sendMessage,
    messages
  );

  const isCallActive = incomingCall !== null || ['RINGING_OUTGOING', 'RINGING_INCOMING', 'CONNECTED'].includes(callStatus);
  if (!isCallActive) return null;

  // Derive call type strictly from the signaling envelope
  const isVideo = incomingOffer?.callType === 'video' || incomingCall?.type === 'video';
  const callerDisplayName = targetPeerId ? `User (${targetPeerId.substring(0, 6)}...)` : 'Peer';

  const handleEnd = () => {
    endCall(true);
    setIncomingCall(null);
  };

  const handleReject = () => {
    if (callStatus === 'RINGING_INCOMING') {
      declineIncomingCall();
    } else {
      endCall(true);
    }
    setIncomingCall(null);
  };

  return (
    <>
      {!isVideo ? (
        <AudioCallModal
          isOpen={true}
          onClose={handleEnd}
          callerName={callerDisplayName}
          callStatus={callStatus}
          localStream={localStream}
          remoteStream={remoteStream}
          onAccept={callStatus === 'RINGING_INCOMING' ? async () => await acceptIncomingCall(false) : null}
          onReject={handleReject}
        />
      ) : (
        <VideoCallModal
          isOpen={true}
          onClose={handleEnd}
          callerName={callerDisplayName}
          callStatus={callStatus}
          localStream={localStream}
          remoteStream={remoteStream}
          onAccept={callStatus === 'RINGING_INCOMING' ? async () => await acceptIncomingCall(true) : null}
          onReject={handleReject}
        />
      )}
    </>
  );
}