import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });

export const tokens = {
  dark: {
    isDark: true,
    bg:            '#000000',
    sidebar:       '#0A0A0A',
    card:          '#111111',
    cardHover:     '#1A1A1A',
    border:        '#222222',
    borderStrong:  '#333333',
    input:         '#151515',
    text:          '#F5F5F7',
    textSecondary: '#ABABAB',
    textMuted:     '#6E6E73',
    textDisabled:  '#48484A',
    primary:       '#7C5CFC',
    primaryHover:  '#9B7FFF',
    primaryLight:  '#C44BB8',
    primaryBg:     'rgba(124,92,252,0.10)',
    primaryBorder: 'rgba(124,92,252,0.25)',
    success:       '#30D158',
    successBg:     'rgba(48,209,88,0.10)',
    successBorder: 'rgba(48,209,88,0.25)',
    warning:       '#FFD60A',
    warningBg:     'rgba(255,214,10,0.10)',
    warningBorder: 'rgba(255,214,10,0.25)',
    error:         '#FF453A',
    errorBg:       'rgba(255,69,58,0.10)',
    errorBorder:   'rgba(255,69,58,0.25)',
    info:          '#0A84FF',
    infoBg:        'rgba(10,132,255,0.10)',
    infoBorder:    'rgba(10,132,255,0.25)',
    shadow:        '0 4px 16px rgba(0,0,0,0.6)',
    shadowSm:      '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)',
    shadowMd:      '0 4px 16px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)',
    shadowLg:      '0 8px 32px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)',
    shadowXl:      '0 16px 64px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.6)',
    focusRing:     'rgba(124,92,252,0.35)',
  },
  light: {
    isDark: false,
    bg:            '#F5F5F7',
    sidebar:       '#FFFFFF',
    card:          '#FFFFFF',
    cardHover:     '#F0F0F5',
    border:        '#E5E5EA',
    borderStrong:  '#C7C7CC',
    input:         '#F2F2F7',
    text:          '#1D1D1F',
    textSecondary: '#3C3C43',
    textMuted:     '#8E8E93',
    textDisabled:  '#AEAEB2',
    primary:       '#7C5CFC',
    primaryHover:  '#5E3ED9',
    primaryLight:  '#9B7FFF',
    primaryBg:     'rgba(124,92,252,0.08)',
    primaryBorder: 'rgba(124,92,252,0.20)',
    success:       '#34C759',
    successBg:     'rgba(52,199,89,0.08)',
    successBorder: 'rgba(52,199,89,0.22)',
    warning:       '#FF9F0A',
    warningBg:     'rgba(255,159,10,0.08)',
    warningBorder: 'rgba(255,159,10,0.22)',
    error:         '#FF3B30',
    errorBg:       'rgba(255,59,48,0.08)',
    errorBorder:   'rgba(255,59,48,0.22)',
    info:          '#007AFF',
    infoBg:        'rgba(0,122,255,0.08)',
    infoBorder:    'rgba(0,122,255,0.22)',
    shadow:        '0 1px 4px rgba(0,0,0,0.08)',
    shadowSm:      '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
    shadowMd:      '0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
    shadowLg:      '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
    shadowXl:      '0 16px 64px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.10)',
    focusRing:     'rgba(124,92,252,0.20)',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius  = { sm: 6, md: 10, lg: 14, xl: 18, pill: 100 };

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      setTheme(saved);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
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
