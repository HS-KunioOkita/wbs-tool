import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes.js';
import { ToastViewport } from './components/ToastViewport.js';
import './styles/base.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRoutes />
      <ToastViewport />
    </BrowserRouter>
  </React.StrictMode>,
);
