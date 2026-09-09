import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={`theme-toggle-group ${className}`} role="group" aria-label="Theme Switcher">
      <button
        type="button"
        className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
        onClick={() => setTheme('dark')}
        title="สลับเป็นโหมดมืด (Dark Mode)"
        aria-pressed={theme === 'dark'}
      >
        <Moon size={13} />
        <span>Dark</span>
      </button>
      <button
        type="button"
        className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
        onClick={() => setTheme('light')}
        title="สลับเป็นโหมดสว่าง (Light Mode)"
        aria-pressed={theme === 'light'}
      >
        <Sun size={13} />
        <span>Light</span>
      </button>
    </div>
  );
}
