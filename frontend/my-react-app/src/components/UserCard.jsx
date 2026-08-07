import React from 'react';

const UserCard = React.memo(function UserCard({
  user,
  isFriend,
  hasSentReq,
  hasInboundReq,
  actionUserId,
  onSendRequest,
  onUnfriend,
  onBlockUser,
}) {
  const userIdStr = String(user.user_id);
  const online = user.is_online === true;

  return (
    <div
      className={`group rounded-2xl border bg-slate-900/40 backdrop-blur-xl overflow-hidden transition-all duration-300 flex flex-col justify-between hover:shadow-2xl ${
        isFriend ? 'border-emerald-500/40 bg-slate-900/70' : 'border-slate-800/80 hover:border-slate-700'
      }`}
    >
      {/* COVER BANNER */}
      <div className="relative h-24 w-full bg-slate-950 overflow-hidden">
        {user.cover_url ? (
          <img src={user.cover_url} alt="Cover" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-950 opacity-90" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />
      </div>

      {/* CARD BODY */}
      <div className="px-5 pb-4 pt-1 relative flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-end justify-between -mt-10 mb-3">
            <div className="relative">
              <div
                className={`p-0.5 rounded-2xl bg-gradient-to-tr ${
                  online ? 'from-emerald-400 to-indigo-500 shadow-emerald-500/20' : 'from-slate-700 to-slate-800'
                } shadow-xl`}
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.display_name} className="h-14 w-14 rounded-2xl object-cover border-2 border-slate-900 bg-slate-950" />
                ) : (
                  <div className="h-14 w-14 rounded-2xl border-2 border-slate-900 bg-slate-950 flex items-center justify-center font-black text-white text-sm">
                    {(user.display_name || 'U').substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-slate-900 ${
                  online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
                }`}
              />
            </div>

            <div className="flex flex-col items-end gap-1">
              <span
                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  online
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}
              >
                {online ? 'ONLINE' : 'OFFLINE'}
              </span>
              <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border border-slate-800 bg-slate-950/80 text-slate-300">
                📍 {user.location || 'Worldwide'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold tracking-tight text-white group-hover:text-indigo-400 transition-colors">
              {user.display_name || 'Anonymous User'}
            </h4>
            {isFriend && (
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ✓ Friend
              </span>
            )}
          </div>

          <p className="text-xs mt-1.5 leading-relaxed text-slate-400 line-clamp-2">
            {user.bio || 'No bio provided.'}
          </p>
        </div>

        {/* BUTTON ACTIONS */}
        <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
          <button
            onClick={() => onBlockUser(userIdStr, user.display_name)}
            disabled={actionUserId === userIdStr}
            className="text-[11px] font-bold text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
          >
            🚫 Block
          </button>

          {isFriend ? (
            <button
              onClick={() => onUnfriend(userIdStr, user.display_name)}
              disabled={actionUserId === userIdStr}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-red-400 hover:bg-red-950/40 border border-slate-800 hover:border-red-900/50 transition-all active:scale-95"
            >
              Unfriend
            </button>
          ) : hasSentReq ? (
            <button disabled className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-indigo-400 border border-indigo-500/30 opacity-90 cursor-not-allowed">
              ⏳ Request Sent
            </button>
          ) : hasInboundReq ? (
            <span className="text-[11px] font-mono text-amber-400 font-bold bg-amber-950/40 px-2.5 py-1 rounded-xl border border-amber-500/30">
              📩 Pending Invite
            </span>
          ) : (
            <button
              onClick={() => onSendRequest(userIdStr, user.display_name)}
              disabled={actionUserId === userIdStr}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg active:scale-95 disabled:opacity-50 transition-all"
            >
              {actionUserId === userIdStr ? 'Sending...' : '+ Add Friend'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default UserCard;