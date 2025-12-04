import { createContext, useContext, useMemo, useState } from 'react';

export type ThemeName = 'morning' | 'day' | 'evening' | 'boy' | 'girl';

interface ThemeClasses {
  background: string;
  card: string;
  softAccent: string;
}

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  classes: ThemeClasses;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Time-of-day based default theme (used when there is no gender override).
export const getInitialTheme = (): ThemeName => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 18) return 'day';
  return 'evening';
};

const getThemeClasses = (theme: ThemeName): ThemeClasses => {
  switch (theme) {
    case 'boy':
      return {
        background: 'bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100',
        card: 'bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-200',
        softAccent: 'bg-white/80',
      };
    case 'girl':
      return {
        background: 'bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-100',
        card: 'bg-gradient-to-br from-pink-100 via-rose-100 to-fuchsia-200',
        softAccent: 'bg-white/80',
      };
    case 'morning':
      return {
        background: 'bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50',
        card: 'bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100',
        softAccent: 'bg-white/80',
      };
    case 'day':
      return {
        background: 'bg-gradient-to-br from-sky-50 via-emerald-50 to-amber-50',
        card: 'bg-gradient-to-br from-sky-100 via-emerald-100 to-amber-100',
        softAccent: 'bg-white/80',
      };
    case 'evening':
    default:
      return {
        background:
          'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900',
        card: 'bg-gradient-to-br from-slate-800 via-purple-800 to-slate-900',
        softAccent: 'bg-slate-900/70',
      };
  }
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);

  const classes = useMemo(() => getThemeClasses(theme), [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, classes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

