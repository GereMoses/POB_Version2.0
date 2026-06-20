import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { theme as antdTheme } from 'antd';
import { THEMES, DEFAULT_THEME_KEY, STORAGE_KEY, getTheme } from '../themes/themes';

const ThemeContext = createContext(null);

const resolveAlgorithm = (key) =>
  key === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;

export const ThemeProvider = ({ children }) => {
  const [themeKey, setThemeKey] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_KEY
  );

  const currentTheme = useMemo(() => getTheme(themeKey), [themeKey]);

  const applyTheme = useCallback((key) => {
    setThemeKey(key);
    localStorage.setItem(STORAGE_KEY, key);
  }, []);

  // Inject CSS variables on :root so inline-styled components can read them
  // even when they don't use useTheme(). Dark-mode pages use var(--pob-text-primary).
  useEffect(() => {
    const c = currentTheme.colors;
    const isDark = currentTheme.algorithmKey === 'dark';
    const root = document.documentElement;
    root.style.setProperty('--pob-text-primary',   isDark ? '#d9d9d9'  : '#1F2937');
    root.style.setProperty('--pob-text-secondary', isDark ? '#8c8c8c'  : '#6B7A8D');
    root.style.setProperty('--pob-bg-page',        c.contentBg);
    root.style.setProperty('--pob-bg-card',        isDark ? '#141414'  : '#FFFFFF');
    root.style.setProperty('--pob-border',         isDark ? '#303030'  : '#E5E7EB');
    root.style.setProperty('--pob-accent',         c.accentBlue);
    root.setAttribute('data-pob-theme', themeKey);
    // Set html class for CSS selectors
    document.body.classList.toggle('pob-dark', isDark);
  }, [currentTheme, themeKey]);

  // Ant Design ConfigProvider config — rebuilt when theme changes
  const antdConfig = useMemo(() => ({
    algorithm: resolveAlgorithm(currentTheme.algorithmKey),
    token: currentTheme.antdToken,
  }), [currentTheme]);

  const value = useMemo(() => ({
    themeKey,
    theme: currentTheme,
    themes: THEMES,
    applyTheme,
    antdConfig,
    isDark: currentTheme.algorithmKey === 'dark',
    COLORS: currentTheme.colors,
  }), [themeKey, currentTheme, applyTheme, antdConfig]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};

export default ThemeContext;
