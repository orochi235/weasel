import { createContext, useContext } from 'react';

/** Which way a row of controls runs. A vertical one turns its structure a quarter turn and keeps what it holds upright. */
export type Orientation = 'horizontal' | 'vertical';

/** The way the row a control sits in runs. A bar sets it for its cells, and a popover opened from one sets it back. */
export const OrientationContext = createContext<Orientation>('horizontal');

/** The way the row this control sits in runs. */
export function useOrientation(): Orientation {
  return useContext(OrientationContext);
}
