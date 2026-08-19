import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function VideoCallModal({ 
  isOpen, 
  onClose, 
  callerName, 
  callStatus, 
  localStream, 
  remoteStream, 
  onAccept, 
  onReject 
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // ⚡ Bind Local Stream with autoplay error handling
  useEffect(() => {
    if (localVideoRef.current) {
      if (localStream) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(err => console.warn("Local video autoplay blocked:", err));
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [localStream]);

  // ⚡ Bind Remote Stream with autoplay error handling
  useEffect(() => {
    if (remoteVideoRef.current) {
      if (remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(err => console.warn("Remote video autoplay blocked:", err));
      } else {
        remoteVideoRef.current.srcObject = null;
      }
    }
  }, [remoteStream]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      });
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsVideoOff(!track.enabled);
      });
    }
  }, [localStream]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[80vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-6">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between z-10 bg-slate-950/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${callStatus === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping'}`}></div>
            <h3 className="text-xs sm:text-sm font-bold text-white tracking-wider uppercase font-mono">
              📹 Video Call with {callerName || "Peer"}
            </h3>
          </div>
          <span className="text-xs font-mono text-indigo-400 font-bold uppercase tracking-wider">
            {callStatus}
          </span>
        </div>

        {/* Video Viewports Grid */}
        <div className="relative flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 my-4 min-h-0">
          
          {/* Remote Peer Video Viewport */}
          <div className="relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            {!remoteStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 bg-slate-950/80 text-slate-400 font-mono text-xs">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Waiting for peer video stream...</span>
              </div>
            )}
            <span className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-mono px-3 py-1 rounded-lg border border-slate-700">
              {callerName || "Remote Peer"}
            </span>
          </div>

          {/* Local User Preview Viewport */}
          <div className="relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {(!localStream || isVideoOff) && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-slate-500 font-mono text-xs">
                {!localStream ? "Camera initializing..." : "Camera is off 🚫"}
              </div>
            )}
            <span className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-mono px-3 py-1 rounded-lg border border-slate-700">
              You (Local Preview)
            </span>
          </div>

        </div>

        {/* Control Bar */}
        <div className="flex items-center justify-center gap-4 z-10 bg-slate-950/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-800/80">
          {callStatus === 'CONNECTED' ? (
            <>
              <button 
                onClick={toggleMute}
                className={`px-4 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer ${isMuted ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}
              >
                {isMuted ? "🔇 Unmute" : "🎙️ Mute"}
              </button>

              <button 
                onClick={toggleVideo}
                className={`px-4 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer ${isVideoOff ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}
              >
                {isVideoOff ? "📹 Turn Cam On" : "📷 Stop Cam"}
              </button>

              <button 
                onClick={onClose}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl text-xs transition-all cursor-pointer shadow-lg shadow-rose-600/30"
              >
                End Call ☎️
              </button>
            </>
          ) : (
            <>
              {onAccept && (
                <button 
                  onClick={onAccept}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  Accept Video Call 📹
                </button>
              )}
              <button 
                onClick={onReject || onClose}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl text-xs transition-all cursor-pointer shadow-lg shadow-rose-600/20"
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