import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';

// Browsers change a focused <input type="number">'s value when the mouse
// wheel scrolls over it, so scrolling the page while the cursor happens to
// pass over a fee/rating field silently nudges it (e.g. 70 -> 69.78). Blur
// any focused number input before the wheel event can act on it.
document.addEventListener('wheel', () => {
  const el = document.activeElement;
  if (el && el.tagName === 'INPUT' && el.type === 'number') el.blur();
}, { passive: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/crm">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
