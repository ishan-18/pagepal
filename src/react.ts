import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPal, type Pal, type PalOptions } from 'pagepal';

/**
 * Create a pal for the lifetime of the component. Options are read once, on
 * mount; give the component a new `key` to recreate the pal with new options.
 * Returns `null` until mounted (and during SSR).
 */
export function usePal(options: PalOptions = {}): Pal | null {
  const [pal, setPal] = useState<Pal | null>(null);
  const initial = useRef(options);

  useEffect(() => {
    const instance = createPal(initial.current);
    setPal(instance);
    return () => {
      instance.destroy();
      setPal(null);
    };
  }, []);

  return pal;
}

/** Renders nothing; puts a pal on the page while mounted. */
export function PagePal(props: PalOptions): null {
  usePal(props);
  return null;
}

const PalContext = createContext<Pal | null>(null);

/** Creates a pal and makes it available to descendants via `usePagePal()`. */
export function PagePalProvider({ children, ...options }: PalOptions & { children?: ReactNode }) {
  const pal = usePal(options);
  return createElement(PalContext.Provider, { value: pal }, children);
}

/** The pal from the nearest `PagePalProvider` (`null` before mount or outside a provider). */
export function usePagePal(): Pal | null {
  return useContext(PalContext);
}
