import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  id: localStorage.getItem('user_id') || null,
  displayName: localStorage.getItem('display_name') || 'Guest',
  avatarUrl: localStorage.getItem('avatar_url') || '',
  isAuthenticated: !!localStorage.getItem('user_id'),
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    // Action 1: Set user profile after login or fetch
    setUserProfile: (state, action) => {
      state.id = action.payload.id;
      state.displayName = action.payload.displayName;
      state.avatarUrl = action.payload.avatarUrl;
      state.isAuthenticated = true;
    },
    // Action 2: Clear user session on logout
    logoutUser: (state) => {
      state.id = null;
      state.displayName = 'Guest';
      state.avatarUrl = '';
      state.isAuthenticated = false;
      localStorage.clear();
    },
  },
});

export const { setUserProfile, logoutUser } = userSlice.actions;
export default userSlice.reducer;