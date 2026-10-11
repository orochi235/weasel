import { isPrefLeaf, type PrefGroup } from '@weasel-js/prefs';
import { Button, ResetIcon } from '@weasel-js/ui';
import { valueAtPath } from '../config/path';

/** Every leaf beneath a group, as its dotted path and its default. */
function leavesUnder(group: PrefGroup, at: string): [string, unknown][] {
  return Object.entries(group.children).flatMap(([key, child]) => {
    const path = at === '' ? key : `${at}.${key}`;
    return isPrefLeaf(child)
      ? [[path, child.default] as [string, unknown]]
      : leavesUnder(child, path);
  });
}

/** The heading button of a `.resettable()` group: writes each changed leaf's
 *  default, and is disabled while nothing has changed. */
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
        for (const [p, d] of changed) setConfig(p, d);
      }}
    >
      <ResetIcon />
    </Button>
  );
}
