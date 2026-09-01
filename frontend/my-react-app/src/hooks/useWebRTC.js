import { useEffect, useRef, useState, useCallback } from 'react';
import { soundEffects } from '../utils/soundEffects';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export function useWebRTC(activeRoomId, currentUserId, recipientUserId, sendMessage, wsMessages) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState('IDLE'); // IDLE | RINGING_OUTGOING | RINGING_INCOMING | CONNECTED | DECLINED
  const [activeCallEnvelope, setActiveCallEnvelope] = useState(null); // { callType, sdp, callerId }

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const iceCandidatesQueue = useRef([]);
  const activePeerIdRef = useRef(recipientUserId);

  useEffect(() => {
    activePeerIdRef.current = recipientUserId;
  }, [recipientUserId]);

  const cleanupMedia = useCallback(() => {
    try {
      soundEffects.stopRingtone();
    } catch (_) {}

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
      setRemoteStream(null);
    }
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    iceCandidatesQueue.current = [];
  }, []);

  const endCall = useCallback((notifyRemote = true, reason = 'CALL_END') => {
    cleanupMedia();
    setCallStatus(reason === 'DECLINED' ? 'DECLINED' : 'IDLE');
    setActiveCallEnvelope(null);

    const target = activePeerIdRef.current;
    if (notifyRemote && target) {
      sendMessage({
        type: reason,
        room_id: activeRoomId,
        target_id: target,
        content: 'hangup',
      });
    }
  }, [cleanupMedia, activeRoomId, sendMessage]);

  const drainIceCandidates = async () => {
    if (!pcRef.current || !pcRef.current.remoteDescription) return;
    while (iceCandidatesQueue.current.length > 0) {
      const candidate = iceCandidatesQueue.current.shift();
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('⚠️ Buffered ICE candidate error:', e);
      }
    }
  };

  const initPeerConnection = useCallback((targetId) => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate && targetId) {
        sendMessage({
          type: 'ICE_CANDIDATE',
          room_id: activeRoomId,
          target_id: targetId,
          content: JSON.stringify(event.candidate),
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('🟢 [WebRTC Track Received]:', event.track.kind);
      try {
        soundEffects.stopRingtone();
      } catch (_) {}

      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        setRemoteStream(event.streams[0]);
      } else {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        remoteStreamRef.current.addTrack(event.track);
        setRemoteStream(remoteStreamRef.current);
      }
      setCallStatus('CONNECTED');
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallStatus('CONNECTED');
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        cleanupMedia();
        setCallStatus('IDLE');
      }
    };

    pcRef.current = pc;
    return pc;
  }, [activeRoomId, sendMessage, cleanupMedia]);

  // 1️⃣ Outgoing Call Trigger
  const startCall = async (targetId, callType = 'audio') => {
    cleanupMedia();
    activePeerIdRef.current = targetId;

    try {
      const isVideo = callType === 'video';
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = initPeerConnection(targetId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      });
      await pc.setLocalDescription(offer);

      setActiveCallEnvelope({ callType, sdp: offer, callerId: currentUserId });
      setCallStatus('RINGING_OUTGOING');
      try {
        soundEffects.playRingbackTone();
      } catch (_) {}

      sendMessage({
        type: 'CALL_OFFER',
        room_id: activeRoomId,
        target_id: targetId,
        content: JSON.stringify({
          callType,
          sdp: offer,
        }),
      });
    } catch (err) {
      console.error('❌ Failed to start call:', err);
      alert(`Could not access media devices: ${err.message}`);
      cleanupMedia();
      setCallStatus('IDLE');
    }
  };

  // 2️⃣ Incoming Call Accept Trigger
  const acceptIncomingCall = async () => {
    if (!activeCallEnvelope) return;
    try {
      soundEffects.stopRingtone();
    } catch (_) {}

    const isVideo = activeCallEnvelope.callType === 'video';
    const targetId = activeCallEnvelope.callerId || activePeerIdRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = initPeerConnection(targetId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offerSdp = activeCallEnvelope.sdp || activeCallEnvelope;
      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
      await drainIceCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      setCallStatus('CONNECTED');

      sendMessage({
        type: 'CALL_ANSWER',
        room_id: activeRoomId,
        target_id: targetId,
        content: JSON.stringify(answer),
      });
    } catch (err) {
      console.error('❌ Failed to accept call:', err);
      endCall(false);
    }
  };

  // 3️⃣ Decline Incoming Call
  const declineIncomingCall = () => {
    try {
      soundEffects.stopRingtone();
    } catch (_) {}
    setCallStatus('DECLINED');
    const target = activeCallEnvelope?.callerId || activePeerIdRef.current;
    sendMessage({
      type: 'CALL_DECLINED',
      room_id: activeRoomId,
      target_id: target,
      content: 'declined',
    });
    endCall(false, 'DECLINED');
  };

  // 4️⃣ WebSocket Signaling Processor
  useEffect(() => {
    if (!wsMessages || wsMessages.length === 0) return;
    const latest = wsMessages[wsMessages.length - 1];

    if (String(latest.sender_id) === String(currentUserId)) return;

    const handleSignaling = async () => {
      const senderId = latest.sender_id;

      if (latest.type === 'CALL_OFFER') {
        let envelope;
        try {
          envelope = typeof latest.content === 'string' ? JSON.parse(latest.content) : latest.content;
        } catch {
          envelope = { callType: 'audio', sdp: latest.content };
        }

        envelope.callerId = senderId;
        activePeerIdRef.current = senderId;
        setActiveCallEnvelope(envelope);
        setCallStatus('RINGING_INCOMING');
        try {
          soundEffects.playRingbackTone();
        } catch (_) {}
      } else if (latest.type === 'CALL_ANSWER') {
        try {
          soundEffects.stopRingtone();
        } catch (_) {}

        const pc = initPeerConnection(senderId);
        const answer = typeof latest.content === 'string' ? JSON.parse(latest.content) : latest.content;

        if (pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await drainIceCandidates();
          setCallStatus('CONNECTED');
        }
      } else if (latest.type === 'ICE_CANDIDATE') {
        const candidateData = typeof latest.content === 'string' ? JSON.parse(latest.content) : latest.content;
        const pc = pcRef.current;

        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidateData));
          } catch (e) {
            console.warn('ICE candidate addition error:', e);
          }
        } else {
          iceCandidatesQueue.current.push(candidateData);
        }
      } else if (latest.type === 'CALL_DECLINED') {
        try {
          soundEffects.stopRingtone();
        } catch (_) {}
        setCallStatus('DECLINED');
        setTimeout(() => endCall(false, 'DECLINED'), 1200);
      } else if (latest.type === 'CALL_END') {
        endCall(false, 'ENDED');
      }
    };

    if (['CALL_OFFER', 'CALL_ANSWER', 'ICE_CANDIDATE', 'CALL_DECLINED', 'CALL_END'].includes(latest.type)) {
      handleSignaling();
    }
  }, [wsMessages, currentUserId, initPeerConnection, endCall]);

  return {
    localStream,
    remoteStream,
    callStatus,
    activeCallEnvelope,
    startCall,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
  };
}