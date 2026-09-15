import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'konvert-me.theme';
const DEFAULT_THEME: Theme = 'dark';

/** While it is on <html>, element-level transitions are off — see index.css. */
export const THEME_SWITCHING_CLASS = 'theme-switching';
/** Must match --theme-transition in index.css. */
export const THEME_TRANSITION_MS = 240;

/** The colour of the browser chrome around the page, per theme. */
const THEME_COLORS: Record<Theme, string> = { light: '#ffffff', dark: '#000000' };

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // private mode or blocked storage: the default theme is good enough
  }
  return DEFAULT_THEME;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Everything that has to change outside React when the theme changes. */
function paintTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore: the theme simply will not survive a reload
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const fallbackTimer = useRef<number | undefined>(undefined);

  // The first paint is done by the inline script of index.html, before anything is
  // drawn; this only makes sure React and the document agree, without animating.
  useEffect(() => {
    paintTheme(readStoredTheme());
    return () => window.clearTimeout(fallbackTimer.current);
  }, []);

  const apply = useCallback((next: Theme) => {
    const root = document.documentElement;
    const commit = () => {
      paintTheme(next);
      flushSync(() => setThemeState(next));
    };

    // Hushes the hundred little transitions the interface carries, so that nothing
    // repaints itself while the page changes colour.
    root.classList.add(THEME_SWITCHING_CLASS);

    const startViewTransition = (document as ViewTransitionDocument).startViewTransition;
    if (startViewTransition && !prefersReducedMotion()) {
      // One cross-fade of the whole page, composited by the browser.
      startViewTransition.call(document, commit);
    } else {
      commit();
    }

    window.clearTimeout(fallbackTimer.current);
    fallbackTimer.current = window.setTimeout(
      () => root.classList.remove(THEME_SWITCHING_CLASS),
      THEME_TRANSITION_MS,
    );
  }, []);

  const toggleTheme = useCallback(() => {
    // The document is the truth about what is on the screen right now.
    apply(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
  }, [apply]);

  const value = useMemo(() => ({ theme, setTheme: apply, toggleTheme }), [theme, apply, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
