import { useContext } from 'react';
import { ArgsContext } from '../argsContext';

type Args = Record<string, unknown>;

const crosses = (value: unknown): boolean => {
  try {
    structuredClone(value);
    return true;
  } catch {
    return false;
  }
};

const without = (args: Args, keys: string[]): Args =>
  Object.fromEntries(Object.entries(args).filter(([key]) => !keys.includes(key)));

/**
 * Storybook's `useArgs`, writing through the trial's config. Stands in for `storybook/preview-api`.
 * A value that cannot be structured-cloned, such as a function or a React element, stays in the frame.
 */
export function useArgs(): [Args, (patch: Args) => void, (argNames?: string[]) => void] {
  const scope = useContext(ArgsContext);
  if (!scope) throw new Error('useArgs must be called inside a CSF story loaded by forge');
  const { args, configArgs, initialArgs, defaults, setConfig, setLocal } = scope;
  const updateArgs = (patch: Args) => {
    const sent: [string, unknown][] = [];
    const kept: Args = {};
    for (const [key, value] of Object.entries(patch)) {
      if (crosses(value)) sent.push([key, value]);
      else kept[key] = value;
    }
    setLocal((prev) => ({ ...without(prev, Object.keys(patch)), ...kept }));
    for (const [key, value] of sent) setConfig(key, value);
  };
  const resetArgs = (argNames?: string[]) => {
    const restored: Args = {};
    for (const key of argNames ?? [...new Set([...Object.keys(defaults), ...Object.keys(args)])]) {
      const leaf = key in defaults;
      const initial = leaf ? defaults[key] : initialArgs[key];
      if (!leaf && Object.is(configArgs[key], initial)) continue;
      if (leaf || crosses(initial)) setConfig(key, initial);
      // Config holds a value over an original that cannot be sent back, so the original wins locally.
      else restored[key] = initial;
    }
    setLocal((prev) => (argNames ? { ...without(prev, argNames), ...restored } : restored));
  };
  return [args, updateArgs, resetArgs];
}
