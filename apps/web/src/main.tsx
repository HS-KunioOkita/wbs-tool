import React from 'react';
import { createRoot } from 'react-dom/client';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <React.StrictMode>
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>WBS 管理ツール</h1>
      <p>フェーズ 1: バックエンド基盤・データ層・ドメイン層を実装中です。画面実装は次フェーズ。</p>
    </main>
  </React.StrictMode>,
);
