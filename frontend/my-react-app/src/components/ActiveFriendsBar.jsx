import React from 'react';

const ActiveFriendsBar = React.memo(function ActiveFriendsBar({ friends }) {
  if (!friends || friends.length === 0) return null;

  return (
    <header className="mx-4 sm:mx-6 pt-6 max-w-7xl lg:mx-auto lg:w-full">
      <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl space-y-3 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Connected Friends ({friends.length})
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">REALTIME PRESENCE</span>
        </div>

        <div className="flex items-center gap-5 overflow-x-auto pb-2 scrollbar-none">
          {friends.map((friend) => {
            const online = friend.is_online === true;

            return (
              <div key={friend.user_id || friend.id} className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer">
                <div className="relative p-0.5 rounded-full transition-all duration-300 group-hover:scale-110">
                  {/* Outer Avatar Ring: Glowing gradient if ONLINE, muted slate if OFFLINE */}
                  <div className={`p-0.5 rounded-full ${online ? 'bg-gradient-to-tr from-emerald-400 via-indigo-500 to-purple-500 shadow-xl' : 'bg-slate-800'}`}>
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} alt={friend.display_name} className="h-14 w-14 rounded-full object-cover border-2 border-slate-950" />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center font-bold text-white text-sm">
                        {(friend.display_name || 'F').substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Dynamic Status Indicator Dot */}
                  <span
                    className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-slate-950 ${
                      online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
                    }`}
                    title={online ? 'Online Now' : 'Offline'}
                  />
                </div>

                <span className={`text-[11px] font-semibold max-w-[80px] truncate text-center transition-colors ${online ? 'text-slate-200 group-hover:text-white' : 'text-slate-500'}`}>
                  {friend.display_name?.split(' ')[0] || 'Friend'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
});

export default ActiveFriendsBar;