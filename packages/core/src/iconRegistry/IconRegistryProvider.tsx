import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createIconRegistry, type IconRegistry, type IconTable, type IconVariantLoader } from '@weasel-js/icons';

const IconRegistryContext = createContext<IconRegistry | null>(null);

/** Props for {@link IconRegistryProvider}. */
export interface IconRegistryProviderProps {
  /** Tables registered for the provider's lifetime: `virtual:weasel-icons`'s default export, or tables imported by hand. */
  icons?: IconTable | readonly IconTable[];
  /** Variants a component may ask for by name, as dynamic imports: `{ all: () => import('virtual:weasel-icons/all') }`. */
  variants?: Readonly<Record<string, IconVariantLoader>>;
  children: ReactNode;
}

/** Holds one icon registry for everything below it. */
export function IconRegistryProvider({ icons, variants, children }: IconRegistryProviderProps) {
  const [registry] = useState(() => {
    const created = createIconRegistry(icons);
    if (variants) created.provideVariants(variants);
    return created;
  });
  const registered = useRef(icons);
  const provided = useRef(variants);
  useEffect(() => {
    if (registered.current === icons) return undefined;
    registered.current = icons;
    return icons ? registry.add(icons) : undefined;
  }, [registry, icons]);
  useEffect(() => {
    if (provided.current === variants) return;
    provided.current = variants;
    if (variants) registry.provideVariants(variants);
  }, [registry, variants]);
  return <IconRegistryContext.Provider value={registry}>{children}</IconRegistryContext.Provider>;
}

/** Mount an empty {@link IconRegistryProvider} only when none is already in scope. */
export function IconRegistryProviderIfRoot({ children }: { children: ReactNode }) {
  if (useContext(IconRegistryContext)) return <>{children}</>;
  return <IconRegistryProvider>{children}</IconRegistryProvider>;
}

/** The registry in scope, or `null` outside every provider. */
export function useIconRegistry(): IconRegistry | null {
  return useContext(IconRegistryContext);
}
