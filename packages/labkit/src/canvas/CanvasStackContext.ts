import { createContext } from 'react';
import type { ViewTransform } from '../instrument/types';

export interface CanvasStackContextValue {
  view: ViewTransform;
}

export const CanvasStackContext = createContext<CanvasStackContextValue | null>(null);
