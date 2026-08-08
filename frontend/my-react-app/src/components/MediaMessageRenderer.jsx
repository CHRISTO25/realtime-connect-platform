import React, { useState } from 'react';

export default function MediaMessageRenderer({ content }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);

  // Extract Cloudinary attachment links using regex
  const mediaRegex = /\[Media Attachment: (https?:\/\/[^\s]+)\]/g;
  const matches = [...content.matchAll(mediaRegex)];
  const cleanText = content.replace(mediaRegex, '').trim();

  const isImageUrl = (url) => {
    return /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(url) || url.includes('cloudinary.com');
  };

  return (
    <div className="space-y-2">
      {cleanText && <p className="whitespace-pre-wrap break-words leading-relaxed">{cleanText}</p>}

      {matches.map((match, idx) => {
        const url = match[1];
        const isImage = isImageUrl(url);

        return (
          <div key={idx} className="mt-2 relative group">
            {isImage ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-950/40 shadow-md max-w-sm">
                {!imageLoaded && (
                  <div className="h-40 w-full flex items-center justify-center bg-slate-900 animate-pulse text-indigo-400 text-xs font-mono">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading media asset...</span>
                    </div>
                  </div>
                )}
                <img 
                  src={url} 
                  alt="Attachment Preview" 
                  onLoad={() => setImageLoaded(true)}
                  onClick={() => {
                    setSelectedImage(url);
                    setLightboxOpen(true);
                  }}
                  className={`max-h-64 w-full object-cover cursor-pointer hover:scale-105 transition-all duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
                <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <span className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-mono px-3 py-1.5 rounded-full shadow-lg border border-slate-700">🔍 Click to Expand</span>
                </div>
              </div>
            ) : (
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-3 p-3.5 bg-slate-950/80 border border-slate-700/60 rounded-2xl hover:bg-slate-950 hover:border-indigo-500/50 transition-all text-xs font-mono text-indigo-300 shadow-md"
              >
                <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-sm shrink-0">📎</div>
                <div className="truncate">
                  <p className="font-bold text-white truncate">Shared Document File</p>
                  <p className="text-[10px] text-slate-400 truncate underline">Open secure asset URL</p>
                </div>
              </a>
            )}
          </div>
        );
      })}

      {/* FULLSCREEN LIGHTBOX MODAL */}
      {lightboxOpen && (
        <div 
          onClick={() => setLightboxOpen(false)} 
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200 cursor-zoom-out"
        >
          <div className="relative max-w-7xl max-h-[92vh] flex flex-col items-center">
            <img src={selectedImage} alt="Full Resolution Lightbox" className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-slate-800" />
            <div className="mt-3 flex items-center gap-4">
              <a 
                href={selectedImage} 
                target="_blank" 
                rel="noopener noreferrer" 
                onClick={(e) => e.stopPropagation()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-500/30"
              >
                Download Original 📥
              </a>
              <button 
                onClick={() => setLightboxOpen(false)} 
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Close Viewer ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}