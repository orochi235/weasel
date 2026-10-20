import { isPrefLeaf, type PrefGroup } from '@weasel-js/prefs';
import { Button } from '@weasel-js/ui/components/Button';
import { Icon } from '@weasel-js/ui/components/Icon';
import { valueAtPath, withValueAtPath } from '../config/path';
import { icon } from '../icons.gen';

/** Every leaf beneath a group, as its dotted path and its default. */
function leavesUnder(group: PrefGroup, at: string): [string, unknown][] {
  return Object.entries(group.children).flatMap(([key, child]) => {
    const path = at === '' ? key : `${at}.${key}`;
    return isPrefLeaf(child)
      ? [[path, child.default] as [string, unknown]]
      : leavesUnder(child, path);
  });
}

/** The heading button of a `.resettable()` group: writes the group's value at its path, once, with each leaf
 *  beneath it at its default, and is disabled while nothing has changed. */
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
  const changed = leavesUnder(group, path).filter(
    ([p, d]) => !Object.is(valueAtPath(config, p), d),
  );
  return (
    <Button
      iconOnly
      variant="ghost"
      size="sm"
      ariaLabel={`Reset ${group.name}`}
      tooltip={`Reset ${group.name} to defaults`}
      disabled={changed.length === 0}
      onClick={() => {
        const reset = changed.reduce((at, [p, d]) => withValueAtPath(at, p, d), config);
        setConfig(path, valueAtPath(reset, path));
      }}
    >
      <Icon name={icon('ui:reset')} />
    </Button>
  );
}
