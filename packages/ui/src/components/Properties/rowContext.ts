import { createContext, type ReactNode, useContext } from 'react';

/** What a `PropertyRow` tells the controls inside it: the label it already shows. */
export interface PropertyRowScope {
  label: ReactNode;
}

export const PropertyRowContext = createContext<PropertyRowScope | null>(null);

/** The row a control sits in, or `null` for one standing alone. A control that would draw a label of its own
 *  leaves it to the row's. */
export function usePropertyRow(): PropertyRowScope | null {
  return useContext(PropertyRowContext);
}
