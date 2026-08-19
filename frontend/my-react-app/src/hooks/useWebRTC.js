import { useEffect, useRef, useState, useCallback } from 'react';
import { soundEffects } from '../utils/soundEffects';

const STUN_SERVER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function useWebRTC(activeRoomId, currentUserId, recipientUserId, sendMessage, wsMessages) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState('IDLE');
  const [incomingOffer, setIncomingOffer] = useState(null);

  const peerConnectionRef = useRef(null);
  const activePeerIdRef = useRef(recipientUserId);

  useEffect(() => {
    activePeerIdRef.current = recipientUserId;
  }, [recipientUserId]);

  const endCall = useCallback((notifyRemote = true, reason = 'CALL_END') => {
    soundEffects.stopRingtone();

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setCallStatus(reason === 'DECLINED' ? 'DECLINED' : 'IDLE');
    setIncomingOffer(null);

    const target = activePeerIdRef.current;
    if (notifyRemote && target) {
      sendMessage({
        type: reason,
        room_id: activeRoomId,
        target_id: target,
        content: 'hangup'
      });
    }
  }, [localStream, remoteStream, activeRoomId, sendMessage]);

  const createPeerConnection = useCallback((targetId) => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const pc = new RTCPeerConnection(STUN_SERVER_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate && targetId) {
        sendMessage({
          type: 'ICE_CANDIDATE',
          room_id: activeRoomId,
          target_id: targetId,
          content: JSON.stringify(event.candidate)
        });
      }
    };

    pc.ontrack = (event) => {
      soundEffects.stopRingtone();
      console.log("🟢 [WebRTC Media Stream Synchronized]:", event.streams[0]);
      setRemoteStream(event.streams[0]);
      setCallStatus('CONNECTED');
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [activeRoomId, sendMessage]);

  // ⚡ Upgraded startCall supporting explicit video/audio payload mapping
  const startCall = async (stream, callType = 'audio') => {
    setLocalStream(stream);
    const target = activePeerIdRef.current;
    const pc = createPeerConnection(target);
    
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video'
      });
      await pc.setLocalDescription(offer);
      setCallStatus('RINGING_OUTGOING');
      soundEffects.playRingbackTone();

      // Wrap offer and call type together so receiver knows it's a video call
      const envelope = {
        callType: callType,
        sdp: offer
      };

      sendMessage({
        type: 'CALL_OFFER',
        room_id: activeRoomId,
        target_id: target,
        content: JSON.stringify(envelope)
      });
      console.log(`🟢 [WebRTC ${callType.toUpperCase()} Offer Dispatched to Target:`, target, "]");
    } catch (err) {
      console.error("❌ Failed to create offer:", err);
      endCall(false);
    }
  };

  const acceptIncomingCall = async (isVideo) => {
    if (!incomingOffer) return;
    soundEffects.stopRingtone();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false 
      });
      setLocalStream(stream);
      const target = activePeerIdRef.current;
      const pc = createPeerConnection(target);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const actualOffer = incomingOffer.sdp || incomingOffer;
      await pc.setRemoteDescription(new RTCSessionDescription(actualOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      setCallStatus('CONNECTED');

      sendMessage({
        type: 'CALL_ANSWER',
        room_id: activeRoomId,
        target_id: target,
        content: JSON.stringify(answer)
      });
    } catch (err) {
      console.error("❌ Failed to accept call:", err);
      endCall(false);
    }
  };

  const declineIncomingCall = () => {
    soundEffects.stopRingtone();
    setCallStatus('DECLINED');
    const target = activePeerIdRef.current;
    sendMessage({
      type: 'CALL_DECLINED',
      room_id: activeRoomId,
      target_id: target,
      content: 'declined'
    });
    endCall(false, 'DECLINED');
  };

  useEffect(() => {
    if (!wsMessages || wsMessages.length === 0) return;
    const latest = wsMessages[wsMessages.length - 1];

    if (String(latest.sender_id) === String(currentUserId)) return;

    const handleSignaling = async () => {
      const senderId = latest.sender_id;
      const pc = createPeerConnection(senderId);

      if (latest.type === 'CALL_OFFER') {
        let parsed;
        try {
          parsed = JSON.parse(latest.content);
        } catch {
          parsed = { callType: 'audio', sdp: JSON.parse(latest.content) };
        }
        setIncomingOffer(parsed);
        setCallStatus('RINGING_INCOMING');
        soundEffects.playRingbackTone();
      } 
      else if (latest.type === 'CALL_ANSWER') {
        soundEffects.stopRingtone();
        const answer = JSON.parse(latest.content);
        if (pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          setCallStatus('CONNECTED');
        }
      } 
      else if (latest.type === 'ICE_CANDIDATE') {
        const candidate = JSON.parse(latest.content);
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
      else if (latest.type === 'CALL_DECLINED') {
        soundEffects.stopRingtone();
        setCallStatus('DECLINED');
        setTimeout(() => endCall(false, 'DECLINED'), 1500);
      }
      else if (latest.type === 'CALL_END') {
        endCall(false, 'ENDED');
      }
    };

    if (['CALL_OFFER', 'CALL_ANSWER', 'ICE_CANDIDATE', 'CALL_DECLINED', 'CALL_END'].includes(latest.type)) {
      handleSignaling();
    }
  }, [wsMessages, currentUserId, createPeerConnection, endCall]);

  return { localStream, remoteStream, callStatus, startCall, acceptIncomingCall, declineIncomingCall, endCall };
}