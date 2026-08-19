import React, { useEffect, useRef, useState } from 'react';

export default function AudioCallModal({ 
  isOpen, 
  onClose, 
  callerName, 
  callStatus, 
  localStream, 
  remoteStream, 
  onAccept, 
  onReject 
}) {
  const remoteAudioRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(err => console.warn("Audio autoplay blocked:", err));
    }
  }, [remoteStream]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center space-y-6">
        
        {/* Caller Avatar / Pulse Animation */}
        <div className="relative">
          <div className="absolute -inset-4 bg-indigo-500/20 rounded-full animate-ping"></div>
          <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            🎙️
          </div>
        </div>

        <div className="text-center space-y-1">
          <h3 className="text-base font-bold text-white">{callerName || "Voice Call"}</h3>
          <p className="text-xs font-mono text-indigo-400">
            {callStatus === 'CALLING' ? 'Calling...' : callStatus === 'CONNECTED' ? 'Connected 🟢' : 'Incoming Voice Call...'}
          </p>
        </div>

        {/* Call Action Controls */}
        <div className="flex items-center gap-4 w-full justify-center pt-2">
          {callStatus === 'CONNECTED' ? (
            <>
              <button 
                onClick={toggleMute}
                className={`p-4 rounded-2xl font-bold text-sm transition-all cursor-pointer ${isMuted ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isMuted ? "🔇 Unmute" : "🎙️ Mute"}
              </button>
              <button 
                onClick={onClose}
                className="px-6 py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl text-xs transition-all cursor-pointer shadow-lg shadow-rose-600/30"
              >
                End Call ☎️
              </button>
            </>
          ) : (
            <>
              {onAccept && (
                <button 
                  onClick={onAccept}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-2xl text-xs transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  Accept Call 📞
                </button>
              )}
              <button 
                onClick={onReject || onClose}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3.5 rounded-2xl text-xs transition-all cursor-pointer shadow-lg shadow-rose-600/20"
              >
                Decline ✕
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}