import { useContext } from 'react';
import { ArgsContext } from '../argsContext';
import { isPortSafe } from '../portSafe';

type Args = Record<string, unknown>;

/** A Proxy passes `isPortSafe` and still makes `structuredClone` throw. */
const sendable = (value: unknown): boolean => {
  if (!isPortSafe(value)) return false;
  try {
    structuredClone(value);
    return true;
  } catch {
    return false;
  }
};

const without =(args: Args, keys: string[]): Args =>
  Object.fromEntries(Object.entries(args).filter(([key]) => !keys.includes(key)));

/**
 * Storybook's `useArgs`, writing through the trial's config. Stands in for `storybook/preview-api`.
 * A value a MessagePort would not deliver intact, such as a function, a React element or a class
 * instance, stays in the frame.
 */
export function useArgs(): [Args, (patch: Args) => void, (argNames?: string[]) => void] {
  const scope = useContext(ArgsContext);
  if (!scope) throw new Error('useArgs must be called inside a CSF story loaded by forge');
  const { args, config, defaults, original, setConfig, setLocal } = scope;
  const updateArgs = (patch: Args) => {
    const sent: [string, unknown][] = [];
    const kept: Args = {};
    for (const [key, value] of Object.entries(patch)) {
      if (sendable(value)) sent.push([key, value]);
      else kept[key] = value;
    }
    setLocal((prev) => ({ ...without(prev, Object.keys(patch)), ...kept }));
    for (const [key, value] of sent) setConfig(key, value);
  };
  const resetArgs = (argNames?: string[]) => {
    const keys = argNames ?? [...new Set([...Object.keys(defaults), ...Object.keys(args)])];
    // A key with no control shows its original from the frame, so the render does not wait on the port.
    const overlay: Args = {};
    for (const key of keys) {
      if (key in defaults) {
        setConfig(key, defaults[key]);
        continue;
      }
      overlay[key] = original[key];
      if (config[key] !== undefined) setConfig(key, undefined);
    }
    setLocal((prev) => ({ ...(argNames ? without(prev, keys) : {}), ...overlay }));
  };
  return [args, updateArgs, resetArgs];
}
