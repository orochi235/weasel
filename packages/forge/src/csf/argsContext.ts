import { type Context, createContext, type Dispatch, type SetStateAction } from 'react';

type Args = Record<string, unknown>;

export interface ArgsScope {
  /** The args the story renders with: its own, then config, then the frame-local ones. */
  args: Args;
  /** The trial's config as it stands. An `undefined` key means the story's own arg. */
  config: Args;
  defaults: Args;
  setConfig: (path: string, value: unknown) => void;
  /** Args a MessagePort would not deliver intact, kept in the frame because config crosses one. */
  setLocal: Dispatch<SetStateAction<Args>>;
}

export const ArgsContext: Context<ArgsScope | null> = createContext<ArgsScope | null>(null);
