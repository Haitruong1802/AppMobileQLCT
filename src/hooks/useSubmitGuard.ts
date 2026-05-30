// v3.120 — Hook chống double-tap submit. Reuse cho mọi form save/transfer/add.
import { useRef, useState } from 'react';

export function useSubmitGuard() {
  const [busy, setBusy] = useState(false);
  const lockRef = useRef(false);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (lockRef.current) return undefined;
    lockRef.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  }

  return { busy, run };
}
