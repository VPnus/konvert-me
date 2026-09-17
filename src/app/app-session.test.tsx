import { cleanup, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppSession } from '@/app/app-session';
import { formatMinor } from '@/core/money';
import { clearAllData } from '@/db/backup';
import { changeCountry } from '@/db/repositories/settings';
import { currentCountry, setCurrentCountry } from '@/i18n/country';

/** A screen of the app: a sum, and how many times the screen was put on the page from the start. */
let mounted = 0;
function Screen() {
  useEffect(() => {
    mounted += 1;
  }, []);
  return <p data-testid="sum">{formatMinor(150_000, { fractionDigits: 0 })}</p>;
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/overview']}>
      <Routes>
        <Route element={<AppSession />}>
          <Route path="/overview" element={<Screen />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await clearAllData();
  mounted = 0;
});

afterEach(() => {
  cleanup();
  setCurrentCountry('ru');
});

describe('the app session', () => {
  it('draws the screens once the country of the data is read, in its currency', async () => {
    await changeCountry('us');
    renderApp();

    expect((await screen.findByTestId('sum')).textContent?.replace(/\s/g, ' ')).toBe('1 500 $');
    expect(currentCountry()).toBe('us');
  });

  it('draws every screen anew when another country arrives', async () => {
    renderApp();
    expect((await screen.findByTestId('sum')).textContent).toMatch(/₽/);
    expect(mounted).toBe(1);

    await changeCountry('us');
    expect(await screen.findByText(/\$/)).toBeTruthy();
    // put on the page again, not only drawn again: nothing of the old currency stays in its state
    expect(mounted).toBe(2);
  });
});
