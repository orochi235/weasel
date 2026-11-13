import { type PrefGroup, prefResets } from '@weasel-js/prefs';
import { ResetControl } from '@weasel-js/ui/components/Properties';
import { valueAtPath, withValueAtPath } from '../config/path';
import { leafIsReset, resetWrite } from './leafReset';

/** The reset in the heading of a group that says `resettable`: writes the group's value at its path, once, with
 *  each leaf beneath it as a reset leaves it (`prefResets`), and is disabled while every one already is. */
export function ResetGroup({
  group,
  path,
  config,
  auto,
  setConfig,
}: {
  group: PrefGroup;
  path: string;
  config: Record<string, unknown>;
  /** The paths now unpinned. */
  auto: ReadonlySet<string>;
  setConfig: (path: string, value: unknown) => void;
}) {
  const resets = prefResets(group, path);
  return (
    <ResetControl
      name={group.name}
      disabled={resets.every((r) => leafIsReset(config, r.path, r.leaf, auto))}
      onReset={() => {
        // Every leaf, the ones already reset included: the write pins whatever under it holds no sentinel.
        const reset = resets.reduce(
          (at, r) => withValueAtPath(at, r.path, resetWrite(r.leaf)),
          config,
        );
        setConfig(path, valueAtPath(reset, path));
      }}
    />
  );
}
