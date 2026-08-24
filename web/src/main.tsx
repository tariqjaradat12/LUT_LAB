import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EditProvider } from './state/editStore';
import App from './App';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EditProvider>
      <App />
    </EditProvider>
  </StrictMode>,
);
