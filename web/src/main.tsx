import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.tsx';
import { ImportedProvider } from './lib/importedEvents.tsx';
import { LanguageProvider } from './lib/language.tsx';
import { ProfileProvider } from './lib/profile.tsx';
import { SavedProvider } from './lib/saved.tsx';
import './styles/base.css';
import './styles/theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <LanguageProvider>
        <ProfileProvider>
          <SavedProvider>
            <ImportedProvider>
              <App />
            </ImportedProvider>
          </SavedProvider>
        </ProfileProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
);
