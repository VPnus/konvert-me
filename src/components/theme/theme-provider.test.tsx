import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_SWITCHING_CLASS, THEME_TRANSITION_MS, ThemeProvider } from '@/components/theme/theme-provider';
import { ThemeToggle } from '@/components/theme/theme-toggle';

function themeColor(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  document.documentElement.className = '';
  document.head.innerHTML = '<meta name="theme-color" content="#000000" />';
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('theme', () => {
  it('paints the stored theme without animating the first render', () => {
    localStorage.setItem('konvert-me.theme', 'light');
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass(THEME_SWITCHING_CLASS);
    expect(themeColor()).toBe('#ffffff');
  });

  it('arms the transition for the moment of the switch and disarms it after', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    act(() => screen.getByTestId('theme-toggle').click());

    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement).toHaveClass(THEME_SWITCHING_CLASS);
    expect(themeColor()).toBe('#ffffff');
    expect(localStorage.getItem('konvert-me.theme')).toBe('light');

    act(() => vi.advanceTimersByTime(THEME_TRANSITION_MS));
    expect(document.documentElement).not.toHaveClass(THEME_SWITCHING_CLASS);
  });
});
