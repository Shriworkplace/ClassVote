import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const { isLoaded: isClerkLoaded, isSignedIn, user: clerkUser } = useUser();
  const { getToken, signOut } = useClerkAuth();

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync session with backend MongoDB
  const refreshUser = useCallback(async () => {
    try {
      let authHeaders = {};
      if (isSignedIn) {
        try {
          const token = await getToken();
          if (token) {
            authHeaders = { Authorization: `Bearer ${token}` };
          }
        } catch {
          // Token fetch error
        }
      }

      const res = await fetch('/api/auth/me', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (!isClerkLoaded) return;
    refreshUser();
  }, [isClerkLoaded, isSignedIn, clerkUser?.id, refreshUser]);

  // Sign out from both Clerk and local session
  const logout = async () => {
    try {
      await signOut();
    } catch {}
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
  };

  const updateProfile = async (payload) => {
    let authHeaders = { 'Content-Type': 'application/json' };
    if (isSignedIn) {
      try {
        const token = await getToken();
        if (token) authHeaders.Authorization = `Bearer ${token}`;
      } catch {}
    }

    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update profile');
    }
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: !isClerkLoaded || isLoading,
        isSignedIn: Boolean(isSignedIn || user),
        clerkUser,
        logout,
        updateProfile,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
};
