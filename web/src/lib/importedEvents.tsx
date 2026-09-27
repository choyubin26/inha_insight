import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ImportedEvent } from './icsImport.ts';

// Events imported from an external calendar file (e.g. a Google Calendar .ics export), so a
// student's outside commitments can show up alongside notice deadlines on this site's calendar.
// No accounts, so this lives in the browser's localStorage, same approach as saved.tsx.

const KEY = 'inha-notices.imported.v1';

function isImportedEvent(x: unknown): x is ImportedEvent {
  return !!x && typeof x === 'object' && typeof (x as ImportedEvent).uid === 'string' && typeof (x as ImportedEvent).date === 'string';
}

function load(): ImportedEvent[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter(isImportedEvent) : [];
  } catch {
    return []; // private mode / blocked storage / corrupt JSON
  }
}

interface ImportedState {
  events: ImportedEvent[];
  /** Adds/refreshes events by uid (re-importing the same file updates edited events). */
  addAll: (events: ImportedEvent[]) => void;
  remove: (uid: string) => void;
  clear: () => void;
}

const Ctx = createContext<ImportedState | null>(null);

export function ImportedProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<ImportedEvent[]>(load);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === KEY && setEvents(load());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const write = useCallback((update: (cur: ImportedEvent[]) => ImportedEvent[]) => {
    setEvents((cur) => {
      const next = update(cur);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: still works for this session */
      }
      return next;
    });
  }, []);

  const addAll = useCallback(
    (incoming: ImportedEvent[]) =>
      write((cur) => {
        const byUid = new Map(cur.map((e) => [e.uid, e]));
        for (const e of incoming) byUid.set(e.uid, e);
        return [...byUid.values()];
      }),
    [write],
  );
  const remove = useCallback((uid: string) => write((cur) => cur.filter((e) => e.uid !== uid)), [write]);
  const clear = useCallback(() => write(() => []), [write]);

  return <Ctx.Provider value={{ events, addAll, remove, clear }}>{children}</Ctx.Provider>;
}

export function useImportedEvents(): ImportedState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useImportedEvents must be used inside <ImportedProvider>');
  return ctx;
}
