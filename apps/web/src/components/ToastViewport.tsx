import { useEffect } from 'react';
import { useToastStore } from '../store/toast-store.js';
import styles from './ToastViewport.module.css';

export function ToastViewport(): JSX.Element {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    if (toasts.length === 0) return;
    const id = toasts[toasts.length - 1]!.id;
    const timer = window.setTimeout(() => dismiss(id), 6000);
    return () => window.clearTimeout(timer);
  }, [toasts, dismiss]);

  return (
    <div className={styles.viewport} aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.kind] ?? ''}`}>
          <div className={styles.message}>{t.message}</div>
          {t.correlationId ? (
            <div className={styles.correlation}>相関 ID: {t.correlationId.slice(0, 8)}</div>
          ) : null}
          <button
            type="button"
            aria-label="閉じる"
            className={styles.closeButton}
            onClick={() => dismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
