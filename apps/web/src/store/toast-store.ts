import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  correlationId?: string;
}

interface ToastStore {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: nextId++ }],
    })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/**
 * 任意の例外（特に ApiError）からトーストを生成する小ユーティリティ。
 * - ERR-001 / ERR-002 / ERR-003 はユーザ起因なので相関 ID を出さない
 * - ERR-005 / ERR-006 は相関 ID 付き ERROR
 */
export function pushErrorToast(err: unknown): void {
  const push = useToastStore.getState().push;
  if (err && typeof err === 'object' && 'code' in err) {
    const e = err as { code: string; message: string; correlationId?: string };
    const kind: ToastKind = e.code === 'ERR-005' || e.code === 'ERR-006' ? 'error' : 'warning';
    push({
      kind,
      message: e.message,
      ...(kind === 'error' && e.correlationId !== undefined
        ? { correlationId: e.correlationId }
        : {}),
    });
  } else {
    const message = err instanceof Error ? err.message : String(err);
    push({ kind: 'error', message });
  }
}
