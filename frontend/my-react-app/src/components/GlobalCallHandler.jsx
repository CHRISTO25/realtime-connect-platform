import React, { useMemo } from 'react';
import { useWebSocket } from '../context/WebsocketContext';
import AudioCallModal from './AudioCallModal';
import VideoCallModal from './VideoCallModal';
import { useWebRTC } from '../hooks/useWebRTC';

export default function GlobalCallHandler() {
  const { messages, sendMessage } = useWebSocket();
  const currentUserId = useMemo(() => localStorage.getItem('user_id'), []);

  const { 
    localStream, 
    remoteStream, 
    callStatus, 
    activeCallEnvelope,
    acceptIncomingCall, 
    declineIncomingCall, 
    endCall 
  } = useWebRTC(
    "00000000-0000-0000-0000-000000000001",
    currentUserId,
    null,
    sendMessage,
    messages
  );

  // Determine whether any modal should render
  const isCallActive = ['RINGING_OUTGOING', 'RINGING_INCOMING', 'CONNECTED'].includes(callStatus);
  if (!isCallActive) return null;

  const isVideo = activeCallEnvelope?.callType === 'video';
  const targetId = activeCallEnvelope?.callerId || 'Peer';
  const callerDisplayName = `User (${String(targetId).substring(0, 6)}...)`;

  return (
    <>
      {!isVideo ? (
        <AudioCallModal
          isOpen={true}
          onClose={() => endCall(true)}
          callerName={callerDisplayName}
          callStatus={callStatus}
          localStream={localStream}
          remoteStream={remoteStream}
          onAccept={callStatus === 'RINGING_INCOMING' ? acceptIncomingCall : null}
          onReject={callStatus === 'RINGING_INCOMING' ? declineIncomingCall : () => endCall(true)}
        />
      ) : (
        <VideoCallModal
          isOpen={true}
          onClose={() => endCall(true)}
          callerName={callerDisplayName}
          callStatus={callStatus}
          localStream={localStream}
          remoteStream={remoteStream}
          onAccept={callStatus === 'RINGING_INCOMING' ? acceptIncomingCall : null}
          onReject={callStatus === 'RINGING_INCOMING' ? declineIncomingCall : () => endCall(true)}
        />
      )}
    </>
  );
}