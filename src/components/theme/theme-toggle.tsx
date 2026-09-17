import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme/theme-provider';
import { strings } from '@/i18n';

/**
 * The icon of the theme that will be switched to. Both icons live in the same box and
 * cross over, so the button does not blink when the page changes colour around it.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? strings.theme.light : strings.theme.dark;
  const dark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
      data-theme={theme}
      className={className}
    >
      <span className="relative block size-5" aria-hidden>
        <Sun
          className={`absolute inset-0 size-5 transition-all duration-300 motion-reduce:transition-none ${
            dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'
          }`}
        />
        <Moon
          className={`absolute inset-0 size-5 transition-all duration-300 motion-reduce:transition-none ${
            dark ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'
          }`}
        />
      </span>
    </Button>
  );
}
