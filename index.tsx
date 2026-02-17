import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Initialize global process object for the browser environment.
// This allows dynamic updates to process.env.API_KEY at runtime 
// via the Gatekeeper UI while satisfying library dependencies.
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || {};
  (window as any).process.env = (window as any).process.env || {};
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);