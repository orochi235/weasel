import { createContext } from 'react';

/** Marks an instrument keeps in its own `AnnotationStorage`, already loaded by
 *  `<Lab>` for the trials present when it opened, keyed by trial id. A trial
 *  missing from it loads its own. */
export const AnnotationPreloadContext = createContext<ReadonlyMap<string, unknown> | null>(null);
