import { type Context, createContext, type Dispatch, type SetStateAction } from 'react';
import { stableStringify } from '../protocol/messages';

type Args = Record<string, unknown>;

/** A frame-local arg, and the config value it was set over: it applies only while config still holds that. */
export interface LocalArg {
  value: unknown;
  over: string;
}

export type LocalArgs = Record<string, LocalArg>;

/** A config value in the form `LocalArg.over` records. */
export const coverOf = (value: unknown): string => stableStringify(value) ?? ' undefined';

/** The frame-local values that still apply over `config`. */
export const appliedLocal = (local: LocalArgs, config: Args): Args =>
  Object.fromEntries(
    Object.entries(local)
      .filter(([key, entry]) => coverOf(config[key]) === entry.over)
      .map(([key, entry]) => [key, entry.value]),
  );

export interface ArgsScope {
  /** The args the story renders with: its own, then config, then the frame-local ones that still apply. */
  args: Args;
  /** The trial's config as it stands. An `undefined` key means the story's own arg. */
  config: Args;
  defaults: Args;
  /** The story's own args, before config and the frame-local ones. */
  original: Args;
  setConfig: (path: string, value: unknown) => void;
  /** Args a MessagePort would not deliver intact, kept in the frame because config crosses one. */
  setLocal: Dispatch<SetStateAction<LocalArgs>>;
}

export const ArgsContext: Context<ArgsScope | null> = createContext<ArgsScope | null>(null);
