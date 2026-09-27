import { createContext } from 'react';
import type { DepGraph } from '../story/types';

/** The component graph the vite plugin derived from source; null until it arrives. */
export const DependenciesContext = createContext<DepGraph | null>(null);
