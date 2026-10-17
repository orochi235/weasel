import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createIconRegistry, type IconRegistry, type IconTable, type IconVariantLoader } from '@weasel-js/icons';

const IconRegistryContext = createContext<IconRegistry | null>(null);

/** Props for {@link IconRegistryProvider}. */
export interface IconRegistryProviderProps {
  /** Tables to register: `virtual:weasel-icons`'s default export, or tables imported by hand. A new value replaces the tables the last one registered. */
  icons?: IconTable | readonly IconTable[];
  /** Variants a component may ask for by name, as dynamic imports: `{ all: () => import('virtual:weasel-icons/all') }`. */
  variants?: Readonly<Record<string, IconVariantLoader>>;
  children: ReactNode;
}

/** A registry this component owns, holding `icons` until they change and offering `variants`. */
function useOwnedRegistry(
  icons: IconRegistryProviderProps['icons'],
  variants: IconRegistryProviderProps['variants'],
): IconRegistry {
  // The first tables register here so the first render can draw them; the effect below takes over their release.
  const [{ registry, seed }] = useState(() => {
    const created = createIconRegistry();
    if (variants) created.provideVariants(variants);
    return { registry: created, seed: icons && { icons, release: created.add(icons) } };
  });
  const seedTaken = useRef(false);
  const provided = useRef(variants);
  useEffect(() => {
    if (!seedTaken.current) {
      seedTaken.current = true;
      if (seed && seed.icons === icons) return seed.release;
      seed?.release();
    }
    return icons ? registry.add(icons) : undefined;
  }, [registry, seed, icons]);
  useEffect(() => {
    if (provided.current === variants) return;
    provided.current = variants;
    if (variants) registry.provideVariants(variants);
  }, [registry, variants]);
  return registry;
}

/** Holds one icon registry for everything below it. */
export function IconRegistryProvider({ icons, variants, children }: IconRegistryProviderProps) {
  const registry = useOwnedRegistry(icons, variants);
  return <IconRegistryContext.Provider value={registry}>{children}</IconRegistryContext.Provider>;
}

/**
 * Joins the registry in scope, or holds one of its own when given `icons` or `variants` or when none
 * is in scope. Its tree is the same element either way, so switching never remounts the children.
 */
export function IconRegistryScope({ icons, variants, children }: Partial<IconRegistryProviderProps> & { children: ReactNode }) {
  const parent = useContext(IconRegistryContext);
  const own = icons !== undefined || variants !== undefined || !parent;
  const registry = useOwnedRegistry(own ? icons : undefined, own ? variants : undefined);
  return <IconRegistryContext.Provider value={own ? registry : parent}>{children}</IconRegistryContext.Provider>;
}

/** Mount an empty {@link IconRegistryProvider} only when none is already in scope. */
export function IconRegistryProviderIfRoot({ children }: { children: ReactNode }) {
  return <IconRegistryScope>{children}</IconRegistryScope>;
}

/** The registry in scope, or `null` outside every provider. */
export function useIconRegistry(): IconRegistry | null {
  return useContext(IconRegistryContext);
}
