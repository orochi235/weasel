import type { PrefGroup } from '@weasel-js/prefs';
import { type PrefsSource, sourceIsAtReset } from '@weasel-js/ui/components/PrefsSource';
import { ResetControl } from '@weasel-js/ui/components/Properties';

/** The reset in the heading of a group that says `resettable`: puts every leaf beneath it back as its schema
 *  starts it, as one write, and is disabled while every one it reaches already is. */
export function ResetGroup({
  group,
  path,
  source,
}: {
  group: PrefGroup;
  path: string;
  source: PrefsSource;
}) {
  return (
    <ResetControl
      name={group.name}
      disabled={sourceIsAtReset(source, path)}
      onReset={() => source.reset([path])}
    />
  );
}
