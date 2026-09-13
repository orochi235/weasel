import { type Context, createContext, type Dispatch, type SetStateAction } from 'react';

type Args = Record<string, unknown>;

export interface ArgsScope {
  /** The args the story renders with: its own, then config, then the frame-local ones. */
  args: Args;
  /** `args` without the frame-local ones. */
  configArgs: Args;
  /** The story's args before any config was merged over them. */
  initialArgs: Args;
  defaults: Args;
  setConfig: (path: string, value: unknown) => void;
  /** Args that cannot be structured-cloned, kept in the frame because config crosses a MessagePort. */
  setLocal: Dispatch<SetStateAction<Args>>;
}

export const ArgsContext: Context<ArgsScope | null> = createContext<ArgsScope | null>(null);
