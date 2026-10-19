import { createContext, useContext, type ReactNode } from 'react';

const DevtoolsLabelContext = createContext<string | null>(null);

/** Props for `<DevtoolsLabel>`. */
export interface DevtoolsLabelProps {
  /** The name a devtools panel lists each canvas below this under, unless the canvas has an `aria-label` or id. */
  value: string;
  children?: ReactNode;
}

/**
 * Names the canvases beneath it in a devtools panel, ahead of any labeled
 * element between them and it. A host that frames canvases it did not write,
 * such as a lab's trial or a story's frame, knows the right name; the nearest
 * labeled ancestor is only a guess.
 */
export function DevtoolsLabel({ value, children }: DevtoolsLabelProps) {
  return <DevtoolsLabelContext.Provider value={value}>{children}</DevtoolsLabelContext.Provider>;
}

/** The label the nearest `<DevtoolsLabel>` gives, or null outside one. */
export function useDevtoolsLabel(): string | null {
  return useContext(DevtoolsLabelContext);
}
