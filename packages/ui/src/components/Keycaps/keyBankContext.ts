import { createContext } from 'react';
import type { BankMember, KeySpellings } from './legendFit';

export interface KeyBankContextValue {
  wrap: boolean;
  spellings: KeySpellings;
  minScale: number;
  /** Records a member's fit, or drops the member when `member` is null. */
  report(id: string, member: BankMember | null): void;
}

export const KeyBankContext = createContext<KeyBankContextValue | null>(null);
