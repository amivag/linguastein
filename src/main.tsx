import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { markUpdateReady } from './app/updates';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root element is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Installable, offline-capable app shell (spec §24).
//
// `onNeedReload` is what stops `autoUpdate` reloading the page from under
// someone mid-session; the app offers the reload instead. See `app/updates.ts`.
registerSW({ immediate: true, onNeedReload: markUpdateReady });
