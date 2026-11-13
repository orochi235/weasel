import { createToolOptionValues, type ToolOptionValues } from '@weasel-js/routing';
import { useContext, useState } from 'react';
import { PersistenceContext } from '../state/Persistence';
import { labToolOptionValues } from './options';

/** The lab's tool option values: its records' when there are any, so every trial and the options palette read one
 *  store; else values held by this component alone. */
export function useLabToolOptionValues(): ToolOptionValues {
  const records = useContext(PersistenceContext);
  const [fallback] = useState(createToolOptionValues);
  return records ? labToolOptionValues(records) : fallback;
}
