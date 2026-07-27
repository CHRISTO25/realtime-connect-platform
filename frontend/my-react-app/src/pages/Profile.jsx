import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setUserProfile } from '../store/userSlice';
import { userApi } from '../services/api/client';
import Navbar from '../components/Navbar';

export default function Profile() {
  const dispatch = useDispatch();
  const reduxUser = useSelector((state) => state.user);
  const currentLoggedInUserId = reduxUser?.id || localStorage.getItem('user_id');

  const [profile, setProfile] = useState({
    displayName: reduxUser?.displayName || '',
    bio: '',
    location: '',
    avatarUrl: reduxUser?.avatarUrl || '',
    coverUrl: '',
    caption: '',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // File Upload & Cropper States
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedRawImage, setSelectedRawImage] = useState(null);
  const [uploadType, setUploadType] = useState('avatar'); // 'avatar' | 'cover'
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (currentLoggedInUserId) {
      fetchProfileData();
    }
  }, [currentLoggedInUserId]);

  // Fetch initial profile from GET /api/v1/users/profile/:id
  const fetchProfileData = async () => {
    try {
      const res = await userApi.get(`/profile/${currentLoggedInUserId}`);
      if (res.data.success) {
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

        // Sync Redux Store
        dispatch(
          setUserProfile({
            id: currentLoggedInUserId,
            displayName: profileData.displayName,
            avatarUrl: profileData.avatarUrl,
          })
        );
      }
    } catch (err) {
      setMessage('Failed to load profile parameters.');
    }
  };

  // Submit Text Profile Changes: PUT /api/v1/users/profile
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setIsSubmitting(true);
    try {
      const res = await userApi.put('/profile', {
        display_name: profile.displayName,
        bio: profile.bio,
        location: profile.location,
        avatar_url: profile.avatarUrl,
        cover_url: profile.coverUrl,
        caption: profile.caption,
      });

      if (res.data.success) {
        setMessage('Profile updated successfully!');
        setIsEditing(false);

        dispatch(
          setUserProfile({
            id: currentLoggedInUserId,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          })
        );
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Update failed.');
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

  // Drag Controls for Canvas
  const handleStart = (clientX, clientY) => {
    setIsDragging(true);
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handleMove = (clientX, clientY) => {
    if (!isDragging) return;
    setOffset({ x: clientX - dragStart.x, y: clientY - dragStart.y });
  };

  const handleEnd = () => setIsDragging(false);

  // Render Image on Canvas
  useEffect(() => {
    if (!cropModalOpen || !selectedRawImage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = selectedRawImage;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const aspect = uploadType === 'avatar' ? 1 : 16 / 9;
      const targetWidth = uploadType === 'avatar' ? 300 : 600;
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

  // ⚡ DIRECT SAVE & UPLOAD TO CLOUDINARY + DATABASE
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
          const res = await userApi.post(endpoint, formData);

          if (res.data.success) {
            const updatedData = res.data.data;
            const newUrl = uploadType === 'avatar' ? updatedData.avatar_url : updatedData.cover_url;

            if (uploadType === 'avatar') {
              setProfile((prev) => ({ ...prev, avatarUrl: newUrl }));
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

            setMessage(`${uploadType === 'avatar' ? 'Avatar' : 'Cover'} uploaded and saved!`);
            setCropModalOpen(false);
          }
        } catch (err) {
          setMessage('Media upload failed. Please try again.');
        } finally {
          setIsUploadingMedia(false);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans transition-colors duration-300">
      <Navbar />

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
      <div className="relative h-44 sm:h-64 lg:h-80 w-full bg-slate-900 border-b border-slate-800/80 overflow-hidden group">
        {profile.coverUrl ? (
          <img
            src={profile.coverUrl}
            alt="Cover"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-950 flex flex-col items-center justify-center gap-1.5 opacity-90">
            <span className="text-2xl sm:text-3xl">🖼️</span>
            <span className="text-xs text-slate-400 font-mono uppercase tracking-widest">
              No Background Cover
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30" />

        {/* Change Cover Button */}
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 bg-slate-900/80 hover:bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold backdrop-blur-xl border border-slate-700/80 shadow-2xl flex items-center gap-2 transition-all"
        >
          <span>📷</span> <span className="hidden sm:inline">Change Cover Banner</span>
        </button>
      </div>

      {/* 2. MAIN CONTAINER */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 relative pb-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-16 sm:-mt-20 mb-6 gap-4">
          
          {/* Avatar Ring */}
          <div className="relative z-10 self-start sm:self-auto">
            <div className="p-1 rounded-3xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-2xl">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="h-28 w-28 sm:h-36 sm:w-36 rounded-2xl object-cover border-4 border-slate-950 bg-slate-950"
                />
              ) : (
                <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-2xl border-4 border-slate-950 bg-slate-900 flex items-center justify-center text-3xl sm:text-4xl font-black text-slate-300">
                  {profile.displayName ? profile.displayName.substring(0, 2).toUpperCase() : 'OP'}
                </div>
              )}
            </div>

            {/* Quick Upload Camera Badge */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 z-20 bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 sm:p-3 rounded-2xl border-2 border-slate-950 shadow-xl transition-transform hover:scale-110 active:scale-95 flex items-center justify-center"
              title="Change Profile Photo"
            >
              📷
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-slate-100 transition-all border border-slate-800 shadow-lg active:scale-95"
              >
                Edit Profile
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-red-950/80 text-red-400 hover:bg-red-900/80 transition-all border border-red-800/50 shadow-lg"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* FEEDBACK ALERT BANNER */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-2xl text-xs font-semibold border backdrop-blur-xl ${
              message.includes('successfully') || message.includes('saved')
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}
          >
            {message}
          </div>
        )}

        {/* DISPLAY MODE */}
        {!isEditing ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {profile.displayName || 'Unnamed Operator'}
              </h1>
              <p className="text-xs font-mono text-slate-400">
                📍 {profile.location || 'Unknown Location'}
              </p>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl whitespace-pre-line">
              {profile.bio || 'No profile biography specified yet.'}
            </p>
          </div>
        ) : (
          /* EDIT FORM MODE */
          <form
            onSubmit={handleUpdateSubmit}
            className="space-y-5 bg-slate-900/50 p-6 rounded-2xl border border-slate-800/80 backdrop-blur-xl shadow-2xl"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 font-mono">
                  Display Name
                </label>
                <input
                  type="text"
                  value={profile.displayName}
                  onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 font-mono">
                  Location
                </label>
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 font-mono">Bio</label>
              <textarea
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg"
            >
              {isSubmitting ? 'Saving...' : 'Save Profile Text Changes'}
            </button>
          </form>
        )}
      </main>

      {/* CROPPER MODAL */}
      {cropModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Crop & Upload {uploadType === 'avatar' ? 'Avatar' : 'Cover Banner'}
            </h4>

            <div
              className="relative overflow-hidden rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center cursor-move touch-none"
              onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
              onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
              onMouseUp={handleEnd}
              onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchEnd={handleEnd}
            >
              <canvas ref={canvasRef} className="max-w-full max-h-[250px] object-contain" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-mono">Zoom</span>
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

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCropModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCropAndUpload}
                disabled={isUploadingMedia}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:scale-95"
              >
                {isUploadingMedia ? 'Uploading...' : 'Save & Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}