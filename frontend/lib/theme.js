import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });

export const tokens = {
  dark: {
    isDark: true,
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
    primary: '#9B4FD4',
    primaryHover: '#C44BB8',
    primaryLight: '#E040A0',
    primaryBg: 'rgba(155, 79, 212, 0.1)',
    primaryBorder: 'rgba(155, 79, 212, 0.3)',
    success: '#22C55E',
    successBg: 'rgba(34,197,94,0.1)',
    successBorder: 'rgba(34,197,94,0.3)',
    warning: '#EAB308',
    warningBg: 'rgba(234,179,8,0.1)',
    warningBorder: 'rgba(234,179,8,0.3)',
    error: '#EF4444',
    errorBg: 'rgba(239,68,68,0.1)',
    errorBorder: 'rgba(239,68,68,0.3)',
    info: '#3B82F6',
    infoBg: 'rgba(59,130,246,0.1)',
    infoBorder: 'rgba(59,130,246,0.3)',
    shadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    shadowSm: '0 1px 4px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
    shadowMd: '0 4px 16px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.2)',
    shadowLg: '0 12px 48px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.3)',
    focusRing: 'rgba(155,79,212,0.35)',
  },
  light: {
    isDark: false,
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
    primary: '#9B4FD4',
    primaryHover: '#C44BB8',
    primaryLight: '#E040A0',
    primaryBg: 'rgba(155, 79, 212, 0.08)',
    primaryBorder: 'rgba(155, 79, 212, 0.2)',
    success: '#16A34A',
    successBg: 'rgba(22,163,74,0.08)',
    successBorder: 'rgba(22,163,74,0.25)',
    warning: '#CA8A04',
    warningBg: 'rgba(202,138,4,0.08)',
    warningBorder: 'rgba(202,138,4,0.25)',
    error: '#DC2626',
    errorBg: 'rgba(220,38,38,0.08)',
    errorBorder: 'rgba(220,38,38,0.25)',
    info: '#2563EB',
    infoBg: 'rgba(37,99,235,0.08)',
    infoBorder: 'rgba(37,99,235,0.25)',
    shadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    shadowSm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    shadowMd: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
    shadowLg: '0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
    focusRing: 'rgba(155,79,212,0.2)',
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
