import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });

export const tokens = {
  dark: {
    bg: '#0B0B0F',
    sidebar: '#13131A',
    card: '#16161D',
    cardHover: '#1C1C25',
    border: '#26262F',
    borderStrong: '#2E2E3A',
    input: '#1A1A22',
    text: '#F4F4F5',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    textDisabled: '#52525B',
    primary: '#7C5CFC',
    primaryHover: '#6D4DF0',
    primaryLight: '#9277FD',
    primaryBg: 'rgba(124, 92, 252, 0.1)',
    primaryBorder: 'rgba(124, 92, 252, 0.3)',
    success: '#22C55E',
    warning: '#EAB308',
    error: '#EF4444',
    info: '#3B82F6',
    shadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  },
  light: {
    bg: '#FAFAFA',
    sidebar: '#FFFFFF',
    card: '#FFFFFF',
    cardHover: '#F4F4F5',
    border: '#E4E4E7',
    borderStrong: '#D4D4D8',
    input: '#FFFFFF',
    text: '#18181B',
    textSecondary: '#52525B',
    textMuted: '#71717A',
    textDisabled: '#A1A1AA',
    primary: '#7C5CFC',
    primaryHover: '#6D4DF0',
    primaryLight: '#9277FD',
    primaryBg: 'rgba(124, 92, 252, 0.08)',
    primaryBorder: 'rgba(124, 92, 252, 0.2)',
    success: '#16A34A',
    warning: '#CA8A04',
    error: '#DC2626',
    info: '#2563EB',
    shadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
  },
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, t: tokens[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
