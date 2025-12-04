import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(USER_KEY)
        : null;

    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as AuthUser;
        setUser(parsed);
      } catch {
        window.localStorage.removeItem(USER_KEY);
      }
    }

    setLoading(false);
  }, []);

  const handleAuthSuccess = (data: AuthUser) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(USER_KEY, JSON.stringify(data));
    setUser(data);
  };

  const login = async (email: string, password: string) => {
    const data = await api.post<AuthUser>('/auth/login', {
      email,
      password,
    });
    handleAuthSuccess(data);
  };

  const register = async (email: string, password: string) => {
    const data = await api.post<AuthUser>('/auth/register', {
      email,
      password,
    });
    handleAuthSuccess(data);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Even if the request fails, clear local auth state.
      console.error('Logout request failed:', error);
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(USER_KEY);
      }
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
