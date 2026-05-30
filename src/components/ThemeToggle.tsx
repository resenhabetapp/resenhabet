import { useTheme } from '../lib/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="w-14 h-8 bg-surface-container border border-outline-variant rounded-full relative p-1 flex items-center justify-between cursor-pointer select-none outline-none focus:outline-none transition-all shadow-inner"
      title={isDark ? 'Mudar para Modo Brasil' : 'Mudar para Modo Arena (Escuro)'}
    >
      {/* Background Icons */}
      <span className="text-xs select-none pl-0.5">🇧🇷</span>
      <span className="text-xs select-none pr-0.5">🌙</span>

      {/* Sliding Knob */}
      <div
        className={`absolute w-6 h-6 rounded-full bg-primary shadow flex items-center justify-center text-[11px] transform transition-transform duration-300 ease-in-out ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isDark ? '🌙' : '🇧🇷'}
      </div>
    </button>
  );
}
