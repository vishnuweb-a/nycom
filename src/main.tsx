import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource-variable/inter';
import '@/styles/global.css';

import App from '@/App';
import { recoverFromChunkError } from '@/utils/chunkRecovery';

/*
  Route-level import failures surface through `RouteErrorBoundary`. This catches
  the ones that cannot: a dynamic import rejecting outside React's render cycle,
  such as a prefetch or an import fired from an event handler. Only recognised
  stale-chunk messages trigger a reload — every other rejection is left to
  propagate so real bugs stay visible in the console and in error reporting.
*/
window.addEventListener('unhandledrejection', (event) => {
  recoverFromChunkError(event.reason);
});

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root was not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
