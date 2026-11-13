import { type PrefGroup, type PrefLeaf, prefShownValue } from '@weasel-js/prefs';
import { deepEqual } from '@weasel-js/registry';
import { Button } from '@weasel-js/ui/components/Button';
import { Icon } from '@weasel-js/ui/components/Icon';
import { configLeaves } from '../config/leaves';
import { isRecord, valueAtPath, withValueAtPath } from '../config/path';
import { isEncodedLeaf, storedDefault } from '../config/storedDefault';
import { icon } from '../icons.gen';
import { leafValueAt } from './fields';

/** What the row at `path` shows: an encoded leaf's stored value read through its encoding. */
function shownAt(config: Record<string, unknown>, path: string, leaf: PrefLeaf): unknown {
  if (!isEncodedLeaf(leaf)) return leafValueAt(config, path, leaf);
  const dot = path.lastIndexOf('.');
  const within = dot === -1 ? config : valueAtPath(config, path.slice(0, dot));
  return prefShownValue(leaf, valueAtPath(config, path), isRecord(within) ? within : undefined);
}

/** The heading button of a `.resettable()` group: writes the group's value at its path, once, with each leaf
 *  beneath it at its default, and is disabled while every row reads its default. */
export function ResetGroup({
  group,
  path,
  config,
  setConfig,
}: {
  group: PrefGroup;
  path: string;
  config: Record<string, unknown>;
  setConfig: (path: string, value: unknown) => void;
}) {
  const changed = [...configLeaves(group, path)].filter(
    ([p, leaf]) => !deepEqual(shownAt(config, p, leaf), leaf.default),
  );
  return (
    <Button
      iconOnly
      variant="ghost"
      size="sm"
      aria-label={`Reset ${group.name}`}
      tooltip={`Reset ${group.name} to defaults`}
      disabled={changed.length === 0}
      onClick={() => {
        const reset = changed.reduce(
          (at, [p, leaf]) => withValueAtPath(at, p, storedDefault(leaf)),
          config,
        );
        setConfig(path, valueAtPath(reset, path));
      }}
    >
      <Icon name={icon('ui:reset')} />
    </Button>
  );
}
