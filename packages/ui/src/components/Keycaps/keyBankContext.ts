import { createContext } from 'react';
import type { BankFitter } from './bankFitter';

export interface KeyBankContextValue {
  wrap: boolean;
  minScale: number;
  fitter: BankFitter;
}

export const KeyBankContext = createContext<KeyBankContextValue | null>(null);
