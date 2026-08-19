import React from 'react';
import { useWebSocket } from '../context/WebsocketContext';
import AudioCallModal from './AudioCallModal';
import VideoCallModal from './VideoCallModal';
import { useWebRTC } from '../hooks/useWebRTC';

export default function GlobalCallHandler() {
  const { incomingCall, setIncomingCall, messages, sendMessage } = useWebSocket();
  const currentUserId = localStorage.getItem('user_id');

  const targetRoomId = incomingCall?.roomID || "00000000-0000-0000-0000-000000000001";
  const targetPeerId = incomingCall?.callerId || null;

  const { 
    localStream, 
    remoteStream, 
    callStatus, 
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

  // ⚡ Check if incoming call envelope specifies video or if active call status is video
  const isVideo = incomingCall?.type === 'video' || (incomingCall?.content && typeof incomingCall.content === 'string' && incomingCall.content.includes('video')) || callStatus === 'CONNECTED' || callStatus === 'RINGING_OUTGOING';

  return (
    <>
      {!isVideo ? (
        <AudioCallModal
          isOpen={true}
          onClose={() => { endCall(true); setIncomingCall(null); }}
          callerName={`User (${targetPeerId?.substring(0, 6) || 'Peer'}...)`}
          callStatus={callStatus}
          localStream={localStream}
          remoteStream={remoteStream}
          onAccept={callStatus === 'RINGING_INCOMING' ? async () => await acceptIncomingCall(false) : null}
          onReject={() => {
            if (callStatus === 'RINGING_INCOMING') declineIncomingCall();
            else endCall(true);
            setIncomingCall(null);
          }}
        />
      ) : (
        <VideoCallModal
          isOpen={true}
          onClose={() => { endCall(true); setIncomingCall(null); }}
          callerName={`User (${targetPeerId?.substring(0, 6) || 'Peer'}...)`}
          callStatus={callStatus}
          localStream={localStream}
          remoteStream={remoteStream}
          onAccept={callStatus === 'RINGING_INCOMING' ? async () => await acceptIncomingCall(true) : null}
          onReject={() => {
            if (callStatus === 'RINGING_INCOMING') declineIncomingCall();
            else endCall(true);
            setIncomingCall(null);
          }}
        />
      )}
    </>
  );
}