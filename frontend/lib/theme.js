import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });

export const tokens = {
  dark: {
    isDark: true,
    bg:            '#05050A',
    sidebar:       '#08080F',
    card:          '#0F0F18',
    cardHover:     '#161622',
    border:        '#1E1E2E',
    borderStrong:  '#2C2C40',
    input:         '#0C0C16',
    text:          '#F5F5F7',
    textSecondary: '#ABABAB',
    textMuted:     '#7A7A80',
    textDisabled:  '#48484A',
    primary:       '#7C5CFC',
    primaryHover:  '#9B7FFF',
    primaryLight:  '#9B7FFF',
    primaryBg:     'rgba(124,92,252,0.12)',
    primaryBorder: 'rgba(124,92,252,0.28)',
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
    shadow:        '0 4px 20px rgba(0,0,0,0.65)',
    shadowSm:      '0 1px 3px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.35)',
    shadowMd:      '0 4px 20px rgba(0,0,0,0.65), 0 1px 6px rgba(0,0,0,0.45)',
    shadowLg:      '0 8px 36px rgba(0,0,0,0.75), 0 2px 10px rgba(0,0,0,0.5)',
    shadowXl:      '0 20px 70px rgba(0,0,0,0.85), 0 6px 20px rgba(0,0,0,0.6)',
    focusRing:     'rgba(124,92,252,0.38)',
    glassBg:       'rgba(255,255,255,0.03)',
    glassBgMed:    'rgba(255,255,255,0.055)',
    glassBorder:   'rgba(255,255,255,0.07)',
    glassBorderStrong: 'rgba(255,255,255,0.12)',
    ambientGlow:   'rgba(124,92,252,0.06)',
    gradPrimary:   'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 50%, #6D3FF2 100%)',
    gradSuccess:   'linear-gradient(135deg, #30D158 0%, #34C759 100%)',
    gradWarning:   'linear-gradient(135deg, #FFD60A 0%, #FF9F0A 100%)',
    gradError:     'linear-gradient(135deg, #FF453A 0%, #FF6B62 100%)',
    gradInfo:      'linear-gradient(135deg, #0A84FF 0%, #34AADC 100%)',
    gradTeal:      'linear-gradient(135deg, #00C4CC 0%, #0A84FF 100%)',
    gradOrange:    'linear-gradient(135deg, #FF9F0A 0%, #FF6B00 100%)',
  },
  light: {
    isDark: false,
    bg:            '#F0F0F7',
    sidebar:       '#FAFAFF',
    card:          '#FFFFFF',
    cardHover:     '#F4F4FA',
    border:        '#E5E5EF',
    borderStrong:  '#C7C7D0',
    input:         '#F2F2F9',
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
    shadow:        '0 1px 4px rgba(0,0,0,0.09)',
    shadowSm:      '0 1px 3px rgba(0,0,0,0.09), 0 1px 2px rgba(0,0,0,0.05)',
    shadowMd:      '0 4px 18px rgba(0,0,0,0.11), 0 1px 4px rgba(0,0,0,0.07)',
    shadowLg:      '0 8px 34px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.08)',
    shadowXl:      '0 16px 64px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.10)',
    focusRing:     'rgba(124,92,252,0.22)',
    glassBg:       'rgba(255,255,255,0.72)',
    glassBgMed:    'rgba(255,255,255,0.85)',
    glassBorder:   'rgba(0,0,0,0.07)',
    glassBorderStrong: 'rgba(0,0,0,0.12)',
    ambientGlow:   'rgba(124,92,252,0.04)',
    gradPrimary:   'linear-gradient(135deg, #7C5CFC 0%, #9B7FFF 50%, #6D3FF2 100%)',
    gradSuccess:   'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
    gradWarning:   'linear-gradient(135deg, #FF9F0A 0%, #FFD60A 100%)',
    gradError:     'linear-gradient(135deg, #FF3B30 0%, #FF6B62 100%)',
    gradInfo:      'linear-gradient(135deg, #007AFF 0%, #34AADC 100%)',
    gradTeal:      'linear-gradient(135deg, #00C4CC 0%, #007AFF 100%)',
    gradOrange:    'linear-gradient(135deg, #FF9F0A 0%, #FF6B00 100%)',
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
