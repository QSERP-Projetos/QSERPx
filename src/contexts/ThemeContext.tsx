import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { STORAGE_KEYS } from '../constants/storageKeys';

type Theme = 'light' | 'dark';

type ThemeColors = {
  background: string;
  cardBackground: string;
  cardBackgroundAlt: string;
  text: string;
  textSecondary: string;
  muted: string;
  primary: string;
  primarySoft: string;
  primaryBorder: string;
  onPrimary: string;
  inputBackground: string;
  inputBorder: string;
  inputBorderSoft: string;
  tableHeadBackground: string;
  tableHeadText: string;
  tableHeadBorder: string;
  sidebarBackground: string;
  shadowCard: string;
  shadowModal: string;
  icon: string;
};

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getInitialTheme = (): Theme => {
  const saved = window.localStorage.getItem(STORAGE_KEYS.theme);
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
};

const cssVar = (name: string, fallback: string): string => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return value?.trim() || fallback;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem(STORAGE_KEYS.theme, theme);
  }, [theme]);

  const colors = useMemo<ThemeColors>(() => {
    const fallbackLight: ThemeColors = {
      background: '#eceff4',
      cardBackground: '#f8fafc',
      cardBackgroundAlt: '#f3f4f6',
      text: '#000000',
      textSecondary: '#525252',
      muted: '#525252',
      primary: '#000000',
      primarySoft: 'rgba(0, 0, 0, 0.06)',
      primaryBorder: 'rgba(0, 0, 0, 0.14)',
      onPrimary: '#ffffff',
      inputBackground: 'rgba(0, 0, 0, 0.04)',
      inputBorder: '#d4d4d4',
      inputBorderSoft: 'rgba(0, 0, 0, 0.12)',
      tableHeadBackground: '#6b7280',
      tableHeadText: '#ffffff',
      tableHeadBorder: 'rgba(255, 255, 255, 0.28)',
      sidebarBackground: '#f3f4f6',
      shadowCard: '0 12px 32px rgba(15, 23, 42, 0.12)',
      shadowModal: '0 20px 50px rgba(15, 23, 42, 0.18)',
      icon: '#000000',
    };

    const fallbackDark: ThemeColors = {
      background: '#1e1e1e',
      cardBackground: '#252526',
      cardBackgroundAlt: '#2d2d30',
      text: '#d4d4d4',
      textSecondary: '#9da0a6',
      muted: '#9da0a6',
      primary: '#d4d4d4',
      primarySoft: 'rgba(212, 212, 212, 0.1)',
      primaryBorder: 'rgba(212, 212, 212, 0.2)',
      onPrimary: '#1e1e1e',
      inputBackground: '#3c3c3c',
      inputBorder: '#3c3c3c',
      inputBorderSoft: 'rgba(255, 255, 255, 0.08)',
      tableHeadBackground: '#3c3c3c',
      tableHeadText: '#f3f3f3',
      tableHeadBorder: 'rgba(255, 255, 255, 0.12)',
      sidebarBackground: '#252526',
      shadowCard: '0 12px 32px rgba(0, 0, 0, 0.5)',
      shadowModal: '0 20px 50px rgba(0, 0, 0, 0.65)',
      icon: '#d4d4d4',
    };

    const fallback = theme === 'light' ? fallbackLight : fallbackDark;

    return {
      background: cssVar('--color-bg', fallback.background),
      cardBackground: cssVar('--color-surface', fallback.cardBackground),
      cardBackgroundAlt: cssVar('--color-surface-alt', fallback.cardBackgroundAlt),
      text: cssVar('--color-text', fallback.text),
      textSecondary: cssVar('--color-muted', fallback.textSecondary),
      muted: cssVar('--color-muted', fallback.muted),
      primary: cssVar('--color-primary', fallback.primary),
      primarySoft: cssVar('--color-primary-soft', fallback.primarySoft),
      primaryBorder: cssVar('--color-primary-border', fallback.primaryBorder),
      onPrimary: cssVar('--color-on-primary', fallback.onPrimary),
      inputBackground: cssVar('--color-input-bg', fallback.inputBackground),
      inputBorder: cssVar('--color-border', fallback.inputBorder),
      inputBorderSoft: cssVar('--color-border-soft', fallback.inputBorderSoft),
      tableHeadBackground: cssVar('--table-head-bg', fallback.tableHeadBackground),
      tableHeadText: cssVar('--table-head-fg', fallback.tableHeadText),
      tableHeadBorder: cssVar('--table-head-border', fallback.tableHeadBorder),
      sidebarBackground: cssVar('--color-sidebar-bg', fallback.sidebarBackground),
      shadowCard: cssVar('--shadow-card', fallback.shadowCard),
      shadowModal: cssVar('--shadow-modal', fallback.shadowModal),
      icon: cssVar('--color-text', fallback.icon),
    };
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        colors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
