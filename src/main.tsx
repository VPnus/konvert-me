import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from '@/app/App';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { currentLanguage } from '@/i18n';
import '@/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('The root element of the app is missing');

// The page is served in Russian; another language says so, for screen readers and hyphenation.
document.documentElement.lang = currentLanguage();

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
