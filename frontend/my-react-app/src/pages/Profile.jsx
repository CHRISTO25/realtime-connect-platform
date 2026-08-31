import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setUserProfile } from '../store/userSlice';
import { userApi } from '../services/api/client';

export default function Profile() {
  const dispatch = useDispatch();
  const reduxUser = useSelector((state) => state.user);

  // ⚡ Robust User ID resolution: Redux -> LocalStorage -> Decoded JWT Access Token
  const currentLoggedInUserId = useMemo(() => {
    if (reduxUser?.id) return reduxUser.id;
    const localId = localStorage.getItem('user_id');
    if (localId && localId !== 'undefined' && localId !== 'null') return localId;

    try {
      const token = localStorage.getItem('access_token');
      if (!token) return null;
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      const payload = JSON.parse(decodeURIComponent(escape(window.atob(base64))));
      return payload.user_id || payload.id || null;
    } catch (e) {
      console.error('Failed to parse fallback token in Profile:', e);
      return null;
    }
  }, [reduxUser?.id]);

  const [profile, setProfile] = useState({
    displayName: reduxUser?.displayName || localStorage.getItem('display_name') || '',
    bio: '',
    location: '',
    avatarUrl: reduxUser?.avatarUrl || localStorage.getItem('avatar_url') || '',
    coverUrl: '',
    caption: '',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // File Upload & Cropper States
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedRawImage, setSelectedRawImage] = useState(null);
  const [uploadType, setUploadType] = useState('avatar');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const canvasRef = useRef(null);

  const showNotification = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  // Fetch initial profile from GET /profile/:id
  const fetchProfileData = useCallback(async () => {
    if (!currentLoggedInUserId) {
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    try {
      const res = await userApi.get(`/profile/${currentLoggedInUserId}`);
      if (res.data && res.data.success) {
        const data = res.data.data;
        const profileData = {
          displayName: data.display_name || '',
          bio: data.bio || '',
          location: data.location || '',
          avatarUrl: data.avatar_url || '',
          coverUrl: data.cover_url || '',
          caption: data.caption || '',
        };
        setProfile(profileData);

        // Sync Redux & LocalStorage
        if (profileData.displayName) localStorage.setItem('display_name', profileData.displayName);
        if (profileData.avatarUrl) localStorage.setItem('avatar_url', profileData.avatarUrl);

        dispatch(
          setUserProfile({
            id: currentLoggedInUserId,
            displayName: profileData.displayName,
            avatarUrl: profileData.avatarUrl,
          })
        );
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      showNotification('Failed to load profile parameters.', 'error');
    } finally {
      setLoadingProfile(false);
    }
  }, [currentLoggedInUserId, dispatch]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  // Submit Text Profile Changes: PUT /profile
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await userApi.put('/profile', {
        display_name: profile.displayName.trim(),
        bio: profile.bio.trim(),
        location: profile.location.trim(),
        avatar_url: profile.avatarUrl,
        cover_url: profile.coverUrl,
        caption: profile.caption.trim(),
      });

      if (res.data && res.data.success) {
        showNotification('Profile updated successfully!', 'success');
        setIsEditing(false);

        localStorage.setItem('display_name', profile.displayName.trim());
        dispatch(
          setUserProfile({
            id: currentLoggedInUserId,
            displayName: profile.displayName.trim(),
            avatarUrl: profile.avatarUrl,
          })
        );
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Profile update failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Select File for Crop
  const handleFileSelect = (e, type) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setUploadType(type);
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedRawImage(reader.result);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Canvas Drag Handling
  const handleStart = (clientX, clientY) => {
    setIsDragging(true);
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handleMove = (clientX, clientY) => {
    if (!isDragging) return;
    setOffset({ x: clientX - dragStart.x, y: clientY - dragStart.y });
  };

  const handleEnd = () => setIsDragging(false);

  // Render Image onto Canvas
  useEffect(() => {
    if (!cropModalOpen || !selectedRawImage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = selectedRawImage;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const aspect = uploadType === 'avatar' ? 1 : 16 / 9;
      const targetWidth = uploadType === 'avatar' ? 320 : 640;
      const targetHeight = targetWidth / aspect;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawWidth = img.width * zoom;
      const drawHeight = img.height * zoom;
      const centerX = (canvas.width - drawWidth) / 2 + offset.x;
      const centerY = (canvas.height - drawHeight) / 2 + offset.y;

      ctx.drawImage(img, centerX, centerY, drawWidth, drawHeight);
      ctx.restore();
    };
  }, [cropModalOpen, selectedRawImage, zoom, offset, uploadType]);

  // Apply Crop & Upload Media
  const handleApplyCropAndUpload = async () => {
    if (!canvasRef.current) return;
    setIsUploadingMedia(true);

    canvasRef.current.toBlob(
      async (blob) => {
        if (!blob) {
          setIsUploadingMedia(false);
          return;
        }

        const formData = new FormData();
        const fieldName = uploadType === 'avatar' ? 'avatar' : 'cover';
        const endpoint = uploadType === 'avatar' ? '/profile/avatar' : '/profile/cover';
        formData.append(fieldName, blob, `${fieldName}.jpg`);

        try {
          const res = await userApi.post(endpoint, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          if (res.data && res.data.success) {
            const updatedData = res.data.data;
            const newUrl = uploadType === 'avatar' ? updatedData.avatar_url : updatedData.cover_url;

            if (uploadType === 'avatar') {
              setProfile((prev) => ({ ...prev, avatarUrl: newUrl }));
              localStorage.setItem('avatar_url', newUrl);
              dispatch(
                setUserProfile({
                  id: currentLoggedInUserId,
                  displayName: profile.displayName,
                  avatarUrl: newUrl,
                })
              );
            } else {
              setProfile((prev) => ({ ...prev, coverUrl: newUrl }));
            }

            showNotification(`${uploadType === 'avatar' ? 'Avatar photo' : 'Cover banner'} updated successfully!`, 'success');
            setCropModalOpen(false);
          }
        } catch (err) {
          showNotification('Media upload failed. Please try again.', 'error');
        } finally {
          setIsUploadingMedia(false);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  return (
    <div className="w-full flex-1 bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-16">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={avatarInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e, 'avatar')}
      />
      <input
        type="file"
        ref={coverInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e, 'cover')}
      />

      {/* 1. COVER BANNER */}
      <div className="relative h-40 sm:h-56 md:h-72 w-full bg-slate-900 border-b border-slate-800/80 overflow-hidden group">
        {profile.coverUrl ? (
          <img
            src={profile.coverUrl}
            alt="Cover"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-950 flex flex-col items-center justify-center gap-2 opacity-90">
            <span className="text-2xl sm:text-3xl">🖼️</span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-mono uppercase tracking-widest">
              No Background Cover
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/40" />

        {/* Change Cover Button */}
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          className="absolute top-3 right-3 sm:top-5 sm:right-5 z-10 bg-slate-900/80 hover:bg-slate-900 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold backdrop-blur-xl border border-slate-700/80 shadow-2xl flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <span>📷</span> <span>Change Cover</span>
        </button>
      </div>

      {/* 2. MAIN CONTAINER */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-14 sm:-mt-16 mb-6 gap-4">
          
          {/* Avatar Profile Ring */}
          <div className="relative z-10 self-start">
            <div className="p-1 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-2xl inline-block">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="h-24 w-24 sm:h-32 sm:w-32 rounded-xl sm:rounded-2xl object-cover border-4 border-slate-950 bg-slate-950 shadow-inner"
                />
              ) : (
                <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-xl sm:rounded-2xl border-4 border-slate-950 bg-slate-900 flex items-center justify-center text-2xl sm:text-3xl font-black text-slate-300">
                  {profile.displayName ? profile.displayName.substring(0, 2).toUpperCase() : 'ME'}
                </div>
              )}
            </div>

            {/* Change Avatar Button */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 z-20 bg-indigo-600 hover:bg-indigo-500 text-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border-2 border-slate-950 shadow-xl transition-transform hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer"
              title="Change Profile Photo"
            >
              📷
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-slate-100 transition-all border border-slate-800 shadow-lg active:scale-95 cursor-pointer font-mono text-center"
              >
                ✏️ Edit Profile
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-rose-950/80 text-rose-300 hover:bg-rose-900/80 transition-all border border-rose-800/50 shadow-lg cursor-pointer font-mono text-center"
              >
                ✕ Cancel
              </button>
            )}
          </div>
        </div>

        {/* FEEDBACK ALERT */}
        {message.text && (
          <div
            className={`mb-6 p-3.5 sm:p-4 rounded-2xl text-xs font-semibold border backdrop-blur-xl transition-all duration-300 ${
              message.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* SKELETON / CONTENT */}
        {loadingProfile ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-slate-900 rounded-xl w-48 sm:w-64"></div>
            <div className="h-4 bg-slate-900 rounded-xl w-32 sm:w-40"></div>
            <div className="h-24 bg-slate-900 rounded-2xl w-full max-w-2xl"></div>
          </div>
        ) : !isEditing ? (
          /* DISPLAY MODE */
          <div className="space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                {profile.displayName || 'Unnamed Operator'}
              </h1>
              {profile.caption && (
                <p className="text-xs text-indigo-400 font-mono italic break-words">
                  "{profile.caption}"
                </p>
              )}
              <p className="text-xs font-mono text-slate-400 pt-1">
                📍 {profile.location || 'Location Not Specified'}
              </p>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl max-w-3xl">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
                About / Biography
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line break-words">
                {profile.bio || 'No profile biography specified yet. Click "Edit Profile" to introduce yourself.'}
              </p>
            </div>
          </div>
        ) : (
          /* EDIT FORM MODE */
          <form
            onSubmit={handleUpdateSubmit}
            className="space-y-4 sm:space-y-5 bg-slate-900/50 p-4 sm:p-7 rounded-2xl sm:rounded-3xl border border-slate-800/80 backdrop-blur-xl shadow-2xl max-w-3xl"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 font-mono">
                  Display Name
                </label>
                <input
                  type="text"
                  value={profile.displayName}
                  onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                  required
                  placeholder="e.g. Commander Alice"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-indigo-500 shadow-inner"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 font-mono">
                  Location
                </label>
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  placeholder="e.g. San Francisco, CA"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-indigo-500 shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 font-mono">
                Status Caption
              </label>
              <input
                type="text"
                value={profile.caption}
                onChange={(e) => setProfile({ ...profile, caption: e.target.value })}
                placeholder="e.g. Building distributed networks 🚀"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-indigo-500 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 font-mono">
                Biography ({profile.bio.length}/500)
              </label>
              <textarea
                value={profile.bio}
                maxLength={500}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                rows={4}
                placeholder="Write a brief overview about yourself..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-indigo-500 resize-none shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl sm:rounded-2xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50 mt-2"
            >
              {isSubmitting ? 'Committing Changes...' : 'Save Profile Changes 💾'}
            </button>
          </form>
        )}
      </main>

      {/* CROPPER MODAL */}
      {cropModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl max-w-sm sm:max-w-md w-full p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-white font-mono">
                Crop {uploadType === 'avatar' ? 'Profile Avatar' : 'Cover Banner'}
              </h4>
              <button onClick={() => setCropModalOpen(false)} className="text-slate-400 hover:text-white text-xs cursor-pointer p-1">
                ✕
              </button>
            </div>

            <div
              className="relative overflow-hidden rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center cursor-move touch-none shadow-inner select-none max-h-[220px] sm:max-h-[260px]"
              onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
              onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
              onMouseUp={handleEnd}
              onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchEnd={handleEnd}
            >
              <canvas ref={canvasRef} className="max-w-full max-h-full object-contain pointer-events-none" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Scale Zoom</span>
                <span>{zoom.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCropModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCropAndUpload}
                disabled={isUploadingMedia}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {isUploadingMedia ? 'Uploading...' : 'Save & Upload 🚀'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}