export interface Saved {
  dismissed?: boolean;
  position?: { left: number; top: number };
}

export interface Store {
  read(): Saved;
  write(patch: Saved): void;
}

/** localStorage can be missing or throw (private mode, blocked site data); treat that as "nothing saved". */
export function createStore(win: Window, key: string, enabled: boolean): Store {
  const read = (): Saved => {
    if (!enabled) return {};
    try {
      const raw = win.localStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null ? (parsed as Saved) : {};
    } catch {
      return {};
    }
  };

  return {
    read,
    write(patch) {
      if (!enabled) return;
      try {
        win.localStorage.setItem(key, JSON.stringify({ ...read(), ...patch }));
      } catch {
        // Not persisting is fine.
      }
    },
  };
}
