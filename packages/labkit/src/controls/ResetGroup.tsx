import { isPrefLeaf, prefShownValue, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { deepEqual } from '@weasel-js/registry';
import { Button } from '@weasel-js/ui/components/Button';
import { Icon } from '@weasel-js/ui/components/Icon';
import { isRecord, valueAtPath, withValueAtPath } from '../config/path';
import { icon } from '../icons.gen';
import { leafValueAt } from './fields';

/** Every leaf beneath a group, by its dotted path. */
function leavesUnder(group: PrefGroup, at: string): [string, PrefLeaf][] {
  return Object.entries(group.children).flatMap(([key, child]) => {
    const path = at === '' ? key : `${at}.${key}`;
    return isPrefLeaf(child) ? [[path, child] as [string, PrefLeaf]] : leavesUnder(child, path);
  });
}

const isEncoded = (leaf: PrefLeaf): boolean => (leaf as { encoding?: unknown }).encoding !== undefined;

/** What the row at `path` shows: an encoded leaf's stored value read through its encoding. */
function shownAt(config: Record<string, unknown>, path: string, leaf: PrefLeaf): unknown {
  if (!isEncoded(leaf)) return leafValueAt(config, path, leaf);
  const dot = path.lastIndexOf('.');
  const within = dot === -1 ? config : valueAtPath(config, path.slice(0, dot));
  return prefShownValue(leaf, valueAtPath(config, path), isRecord(within) ? within : undefined);
}

// An encoded leaf's default is the option it reads as, not what it stores; holding nothing reads as it.
const resetValue = (leaf: PrefLeaf): unknown => (isEncoded(leaf) ? undefined : leaf.default);

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
  const changed = leavesUnder(group, path).filter(([p, leaf]) => !deepEqual(shownAt(config, p, leaf), leaf.default));
  return (
    <Button
      iconOnly
      variant="ghost"
      size="sm"
      ariaLabel={`Reset ${group.name}`}
      tooltip={`Reset ${group.name} to defaults`}
      disabled={changed.length === 0}
      onClick={() => {
        const reset = changed.reduce((at, [p, leaf]) => withValueAtPath(at, p, resetValue(leaf)), config);
        setConfig(path, valueAtPath(reset, path));
      }}
    >
      <Icon name={icon('ui:reset')} />
    </Button>
  );
}
