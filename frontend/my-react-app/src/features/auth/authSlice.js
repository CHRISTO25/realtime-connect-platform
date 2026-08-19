import { createSlice } from "@reduxjs/toolkit";

// Initialize state safely from localStorage so tokens survive page refreshes
const initialState = {
  user: localStorage.getItem('user_id') ? {
    id: localStorage.getItem('user_id'),
    role: localStorage.getItem('user_role') || 'user',
  } : null,
  token: localStorage.getItem('access_token') || null,
  refreshToken: localStorage.getItem('refresh_token') || null,
  isAuthenticated: !!localStorage.getItem('access_token'),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      const { user, token, refresh_token, access_token } = action.payload;
      const resolvedToken = token || access_token;

      state.user = user;
      state.token = resolvedToken;
      if (refresh_token) {
        state.refreshToken = refresh_token;
      }
      state.isAuthenticated = true;

      // Synchronize with browser local storage
      if (resolvedToken) localStorage.setItem('access_token', resolvedToken);
      if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
      if (user?.id) localStorage.setItem('user_id', user.id);
      if (user?.role) localStorage.setItem('user_role', user.role);
    },

    tokenRefreshed: (state, action) => {
      const { token, access_token, refresh_token } = action.payload;
      const resolvedToken = token || access_token;

      state.token = resolvedToken;
      if (resolvedToken) {
        localStorage.setItem('access_token', resolvedToken);
      }
      if (refresh_token) {
        state.refreshToken = refresh_token;
        localStorage.setItem('refresh_token', refresh_token);
      }
    },

    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;

      // Clear all session storage
      localStorage.clear();
    },
  },
});

export const { loginSuccess, tokenRefreshed, logout } = authSlice.actions;

export default authSlice.reducer;