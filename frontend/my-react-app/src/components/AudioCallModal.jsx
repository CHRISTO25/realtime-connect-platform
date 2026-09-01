import React, { useEffect, useRef, useState, useMemo } from 'react';

export default function AudioCallModal({
  isOpen,
  onClose,
  callerName,
  callStatus,
  localStream,
  remoteStream,
  onAccept,
  onReject,
}) {
  const remoteAudioRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);

  // ⏱️ 1. Call duration timer when connected
  useEffect(() => {
    let interval = null;
    if (callStatus === 'CONNECTED') {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

  const formattedTime = useMemo(() => {
    const mins = Math.floor(callDuration / 60);
    const secs = callDuration % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [callDuration]);

  // 🔊 2. Professional Remote Stream Binding with Safe Playback
  useEffect(() => {
    const audioElement = remoteAudioRef.current;
    if (!audioElement || !remoteStream) return;

    audioElement.srcObject = remoteStream;

    const playAudio = async () => {
      try {
        await audioElement.play();
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('⚠️ Audio play prevented by browser policy:', err);
        }
      }
    };

    playAudio();

    // 🎙️ Simple Voice Activity Detection (VAD) via Web Audio API
    let audioCtx;
    let analyser;
    let animFrame;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && remoteStream.getAudioTracks().length > 0) {
        audioCtx = new AudioContextClass();
        const source = audioCtx.createMediaStreamSource(remoteStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkVolume = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          setIsRemoteSpeaking(avg > 25);
          animFrame = requestAnimationFrame(checkVolume);
        };
        checkVolume();
      }
    } catch (e) {
      console.warn('AudioContext visualization initialization skipped:', e);
    }

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [remoteStream]);

  // 🎙️ 3. Microphone Mute / Unmute Toggle
  const toggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !audioTracks[0].enabled;
        audioTracks.forEach((track) => {
          track.enabled = nextState;
        });
        setIsMuted(!nextState);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Invisible HTML5 Audio Receiver */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-8 shadow-2xl flex flex-col items-center space-y-6 relative overflow-hidden">
        
        {/* Background Ambient Glow */}
        <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          callStatus === 'CONNECTED' ? 'bg-emerald-500/20' : 'bg-indigo-500/20'
        }`} />

        {/* Dynamic Caller Avatar / Pulse Ring */}
        <div className="relative mt-2">
          {callStatus === 'CONNECTED' && isRemoteSpeaking && (
            <div className="absolute -inset-3 bg-emerald-500/30 rounded-full animate-ping pointer-events-none" />
          )}
          {callStatus !== 'CONNECTED' && (
            <div className="absolute -inset-4 bg-indigo-500/20 rounded-full animate-pulse pointer-events-none" />
          )}
          
          <div className={`relative h-24 w-24 rounded-3xl flex items-center justify-center text-white text-3xl font-bold shadow-xl transition-all duration-300 ${
            callStatus === 'CONNECTED'
              ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 ring-4 ring-emerald-500/30'
              : 'bg-gradient-to-tr from-indigo-600 to-violet-600 ring-4 ring-indigo-500/30'
          }`}>
            🎙️
          </div>
        </div>

        {/* User & Call Metadata */}
        <div className="text-center space-y-1.5 z-10">
          <h3 className="text-lg font-bold text-white tracking-wide font-sans">
            {callerName || "Voice Call"}
          </h3>
          
          {callStatus === 'CONNECTED' ? (
            <div className="flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <p className="text-xs font-mono font-bold text-emerald-400">
                {formattedTime}
              </p>
            </div>
          ) : (
            <p className="text-xs font-mono font-medium text-indigo-300">
              {callStatus === 'RINGING_OUTGOING' || callStatus === 'CALLING' 
                ? 'Calling peer...' 
                : callStatus === 'RINGING_INCOMING' 
                ? 'Incoming Voice Call...' 
                : callStatus === 'DECLINED'
                ? 'Call Declined'
                : 'Connecting secure stream...'}
            </p>
          )}
        </div>

        {/* Call Controls */}
        <div className="flex items-center gap-4 w-full justify-center pt-2 z-10">
          {callStatus === 'CONNECTED' ? (
            <>
              <button
                onClick={toggleMute}
                className={`p-4 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                <span>{isMuted ? "🔇" : "🎙️"}</span>
                <span>{isMuted ? "Muted" : "Mute"}</span>
              </button>

              <button
                onClick={onClose}
                className="px-6 py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl text-xs transition-all cursor-pointer shadow-lg shadow-rose-600/30 active:scale-95"
              >
                End Call ☎️
              </button>
            </>
          ) : (
            <>
              {onAccept && (
                <button
                  onClick={onAccept}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-2xl text-xs transition-all cursor-pointer shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>📞</span>
                  <span>Accept</span>
                </button>
              )}
              <button
                onClick={onReject || onClose}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3.5 rounded-2xl text-xs transition-all cursor-pointer shadow-lg shadow-rose-600/20 active:scale-95 flex items-center justify-center gap-2"
              >
                <span>✕</span>
                <span>Decline</span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}