import { useContext } from 'react';
import { ArgsContext } from '../argsContext';

type Args = Record<string, unknown>;

/** Storybook's `useArgs`, writing through the trial's config. Stands in for `storybook/preview-api`. */
export function useArgs(): [Args, (patch: Args) => void, (argNames?: string[]) => void] {
  const scope = useContext(ArgsContext);
  if (!scope) throw new Error('useArgs must be called inside a CSF story loaded by forge');
  const { args, initialArgs, defaults, setConfig } = scope;
  const updateArgs = (patch: Args) => {
    for (const [key, value] of Object.entries(patch)) setConfig(key, value);
  };
  const resetArgs = (argNames?: string[]) => {
    for (const key of argNames ?? [...new Set([...Object.keys(defaults), ...Object.keys(args)])]) {
      const leaf = key in defaults;
      const initial = leaf ? defaults[key] : initialArgs[key];
      // An unchanged arg with no leaf may be a function, which cannot cross the port.
      if (leaf || !Object.is(args[key], initial)) setConfig(key, initial);
    }
  };
  return [args, updateArgs, resetArgs];
}
