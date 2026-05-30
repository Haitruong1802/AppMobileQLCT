// v3.120 — Toast queue store. Notify dùng store push toast thay Alert.
// v3.129 — Max 3 toast cùng lúc + dedupe (cùng msg trong 800ms).
import { create } from 'zustand';
import { TOAST_DISMISS_MS } from '../utils/constants';

export type ToastVariant = 'info' | 'success' | 'error';

export interface ToastItem {
  id: number;
  msg: string;
  variant: ToastVariant;
  createdAt: number;
}

interface ToastStore {
  items: ToastItem[];
  push: (msg: string, variant?: ToastVariant) => void;
  dismiss: (id: number) => void;
}

let _seq = 0;

const MAX_TOAST_COUNT = 3;
const DEDUPE_WINDOW_MS = 800;

export const useToastStore = create<ToastStore>((set, get) => ({
  items: [],
  push: (msg, variant = 'info') => {
    const now = Date.now();
    // Dedupe: nếu vừa push cùng message trong 800ms qua, bỏ qua
    const last = get().items[get().items.length - 1];
    if (last && last.msg === msg && last.variant === variant && now - last.createdAt < DEDUPE_WINDOW_MS) {
      return;
    }
    const id = ++_seq;
    set((s) => {
      const next = [...s.items, { id, msg, variant, createdAt: now }];
      // Cap max 3 toast: drop oldest nếu vượt
      if (next.length > MAX_TOAST_COUNT) next.shift();
      return { items: next };
    });
    // Auto-dismiss sau TOAST_DISMISS_MS
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, TOAST_DISMISS_MS);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));
