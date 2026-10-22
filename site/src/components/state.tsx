import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { load, save } from '../lib/storage';

interface AppState {
  toast: (message: string) => void;
  copy: (text: string, label?: string) => void;
  stack: Set<string>;
  toggleStack: (name: string) => void;
  setStack: (names: string[]) => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
}

export function AppProvider({ knownPlugins, children }: { knownPlugins: Set<string>; children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [on, setOn] = useState(false);
  const timer = useRef<number>();
  const [stack, setStackState] = useState(() => new Set(load<string[]>('stack', []).filter((n) => knownPlugins.has(n))));

  useEffect(() => save('stack', [...stack]), [stack]);

  const toast = useCallback((text: string) => {
    setMessage(text);
    setOn(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOn(false), 1800);
  }, []);

  const copy = useCallback(
    async (text: string, label = `Copied: ${text}`) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = Object.assign(document.createElement('textarea'), { value: text });
        document.body.append(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      toast(label);
    },
    [toast],
  );

  const value = useMemo<AppState>(
    () => ({
      toast,
      copy,
      stack,
      toggleStack: (name) =>
        setStackState((s) => {
          const next = new Set(s);
          if (next.has(name)) next.delete(name);
          else next.add(name);
          return next;
        }),
      setStack: (names) => setStackState(new Set(names.filter((n) => knownPlugins.has(n)))),
    }),
    [toast, copy, stack, knownPlugins],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className={`toast${on ? ' is-on' : ''}`} role="status" aria-live="polite">
        {message}
      </div>
    </Ctx.Provider>
  );
}
