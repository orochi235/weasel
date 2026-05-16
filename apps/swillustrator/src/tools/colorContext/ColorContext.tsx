/**
 * React context publisher for `ColorContextApi`. Wrap the UI subtree
 * in `<ColorContextProvider value={api}>` once near the root; any
 * descendant that needs to read or mutate active paint calls
 * `useColorContext()`. Throws when used outside a provider to surface
 * misconfiguration loudly rather than producing silent no-ops.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { ColorContextApi } from './useColorContextTool';

const ColorContextRef = createContext<ColorContextApi | null>(null);

export function ColorContextProvider(props: {
  value: ColorContextApi;
  children: ReactNode;
}) {
  return (
    <ColorContextRef.Provider value={props.value}>
      {props.children}
    </ColorContextRef.Provider>
  );
}

export function useColorContext(): ColorContextApi {
  const v = useContext(ColorContextRef);
  if (!v) {
    throw new Error(
      'useColorContext must be used inside <ColorContextProvider>',
    );
  }
  return v;
}
