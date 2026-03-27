import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress Vite HMR connection errors which are expected in this environment
const suppressViteErrors = (event: any) => {
  const message = event.message || (event.reason && event.reason.message) || '';
  const isViteError = 
    message.includes('WebSocket closed without opened') ||
    message.includes('failed to connect to websocket') ||
    message.includes('WebSocket connection to') ||
    message.includes('HMR') ||
    message.includes('vite');

  if (isViteError) {
    if (event.preventDefault) event.preventDefault();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    return true;
  }
};

window.addEventListener('unhandledrejection', suppressViteErrors, true);
window.addEventListener('error', suppressViteErrors, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
