import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from '@/app/App';
import { ThemeProvider } from '@/components/theme/theme-provider';
import '@/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Не найден корневой элемент приложения');

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
