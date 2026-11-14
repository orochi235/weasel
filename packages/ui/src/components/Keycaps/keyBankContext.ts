import { createContext } from 'react';
import type { KeySpellings } from './legendFit';

export interface KeyBankContextValue {
  wrap: boolean;
  spellings: KeySpellings;
}

export const KeyBankContext = createContext<KeyBankContextValue | null>(null);
