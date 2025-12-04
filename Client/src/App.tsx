import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme, getInitialTheme } from './contexts/ThemeContext';
import Login from './components/Login';
import ProfileSetup from './components/ProfileSetup';
import Dashboard from './components/Dashboard';

interface StoredProfile {
  id: string;
  nickname: string;
  gender?: string;
}

function AppContent() {
  const { user, loading } = useAuth();
  const { setTheme } = useTheme();
  const [hasProfile, setHasProfile] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    if (user) {
      checkProfile();
    } else {
      // When there is no logged-in user, fall back to the time-based theme.
      setTheme(getInitialTheme());
      setCheckingProfile(false);
    }
    // We intentionally do not include checkProfile in the dependency array
    // to avoid recreating it on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const checkProfile = () => {
    if (!user || typeof window === 'undefined') {
      setHasProfile(false);
      setTheme(getInitialTheme());
      setCheckingProfile(false);
      return;
    }

    const raw = window.localStorage.getItem(`profile_${user.id}`);
    if (!raw) {
      setHasProfile(false);
      setTheme(getInitialTheme());
      setCheckingProfile(false);
      return;
    }

    try {
      const profile = JSON.parse(raw) as StoredProfile;
      setHasProfile(true);

      if (profile.gender === 'male') {
        setTheme('boy');
      } else if (profile.gender === 'female') {
        setTheme('girl');
      } else {
        setTheme(getInitialTheme());
      }
    } catch {
      setHasProfile(false);
      setTheme(getInitialTheme());
    } finally {
      setCheckingProfile(false);
    }
  };

  if (loading || checkingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-2xl font-bold text-purple-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onSuccess={checkProfile} />;
  }

  if (!hasProfile) {
    return <ProfileSetup onComplete={checkProfile} />;
  }

  return <Dashboard />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
