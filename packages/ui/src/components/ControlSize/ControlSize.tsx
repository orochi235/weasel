import { createContext, useContext, type ReactNode } from 'react';
import { resolveSize, type ControlSize } from '@weasel-js/ui-logic';

export type { ControlSize } from '@weasel-js/ui-logic';

const ControlSizeContext = createContext<ControlSize | undefined>(undefined);

/** Props for {@link ControlSizeScope}. */
export interface ControlSizeScopeProps {
  /** The size every sized control inside draws at, unless it sets its own or a nearer scope sets another. */
  size: ControlSize;
  children?: ReactNode;
}

/**
 * Sets the size of the `sm`/`md` controls inside it: buttons, segmented bars, text, select and numeric fields, and
 * the containers that hold them. The nearest scope wins, and a control's own `size` wins over any scope. The pixels
 * each size stands for come from the theme's density.
 */
export function ControlSizeScope({ size, children }: ControlSizeScopeProps) {
  return <ControlSizeContext.Provider value={size}>{children}</ControlSizeContext.Provider>;
}

/** The size a control draws at: `own`, else the nearest {@link ControlSizeScope}'s, else `fallback` (default `'md'`). */
export function useControlSize(own?: ControlSize, fallback?: ControlSize): ControlSize {
  return resolveSize(own, useContext(ControlSizeContext), fallback);
}

/** The nearest {@link ControlSizeScope}'s size, or `undefined` outside every scope: for a control that, unscoped and
 *  unsized, takes the height its container gives it rather than a default of its own. */
export function useControlSizeScope(): ControlSize | undefined {
  return useContext(ControlSizeContext);
}

/** The `size` prop a sized control or container takes. On a container, given, it sets a {@link ControlSizeScope}
 *  over everything the container holds. */
export interface ControlSizeProps {
  /** The size of the control, or of the controls inside and the container's own chrome. Default: the nearest
   *  {@link ControlSizeScope}'s, else the control's own default. A control inside that sets its own `size` keeps it. */
  size?: ControlSize;
}

/** `children` under a {@link ControlSizeScope} of `size`, or as they are when `size` is unset: how a container's
 *  `size` reaches the controls it holds. */
export function withControlSize(size: ControlSize | undefined, children: ReactNode): ReactNode {
  return size === undefined ? children : <ControlSizeScope size={size}>{children}</ControlSizeScope>;
}
