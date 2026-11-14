import { createContext, useContext, type ReactNode } from 'react';
import { resolveSize, type ControlSize } from '@weasel-js/ui-logic';

export type { ControlSize } from '@weasel-js/ui-logic';

const DensityContext = createContext<ControlSize | undefined>(undefined);

/** Props for {@link Density}. */
export interface DensityScopeProps {
  /** The size every sized control inside draws at, unless it sets its own or a nearer scope sets another. */
  size: ControlSize;
  children?: ReactNode;
}

/**
 * Sets the size of the `sm`/`md` controls inside it: buttons, segmented bars, and the containers that hold them.
 * The nearest scope wins, and a control's own `size` wins over any scope.
 */
export function Density({ size, children }: DensityScopeProps) {
  return <DensityContext.Provider value={size}>{children}</DensityContext.Provider>;
}

/** The size a control draws at: `own`, else the nearest {@link Density}'s, else `fallback` (default `'md'`). */
export function useDensity(own?: ControlSize, fallback?: ControlSize): ControlSize {
  return resolveSize(own, useContext(DensityContext), fallback);
}

/** The `size` prop a container takes. Given, it sets a {@link Density} scope over everything the container holds. */
export interface DensityProps {
  /** The size of the controls inside, and of the container's own chrome. Default: the nearest {@link Density}'s,
   *  else `'md'`. A control inside that sets its own `size` keeps it. */
  size?: ControlSize;
}

/** `children` under a {@link Density} scope of `size`, or as they are when `size` is unset: how a container's
 *  `size` reaches the controls it holds. */
export function withDensity(size: ControlSize | undefined, children: ReactNode): ReactNode {
  return size === undefined ? children : <Density size={size}>{children}</Density>;
}
