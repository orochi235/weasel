import { type Context, createContext } from 'react';

export interface ArgsScope {
  args: Record<string, unknown>;
  /** The story's args before any config was merged over them. */
  initialArgs: Record<string, unknown>;
  defaults: Record<string, unknown>;
  setConfig: (path: string, value: unknown) => void;
}

export const ArgsContext: Context<ArgsScope | null> = createContext<ArgsScope | null>(null);
