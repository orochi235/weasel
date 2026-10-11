import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { BarLayout, groupBarNodes, type PropertyControlProps, renderBarLeaf } from '@weasel-js/ui';
import type { ReactNode } from 'react';
import { useFieldChoices } from './fieldChoices';
import { extra, labField } from './fields';

export interface ControlBarProps {
  group: PrefGroup;
  /** Dotted path of `group`. */
  path: string;
  /** Whether the panel shows the leaf at a path. */
  visible: (path: string) => boolean;
  /** Whether the leaf at a path takes input. */
  enabled: (path: string) => boolean;
  /** The value the leaf at a path shows. */
  value: (path: string, leaf: PrefLeaf) => unknown;
  write: (path: string, value: unknown) => void;
  /** Whether the lab draws the leaf's control itself, which then keeps its row form. */
  custom: (path: string, leaf: PrefLeaf) => boolean;
  /** The leaf at a path as one of the panel's rows. */
  row: (path: string) => ReactNode;
  /** A nested group's rows, for a group the bar opens from a button. */
  open: (group: PrefGroup, path: string) => ReactNode;
}

/**
 * A group drawn `as: 'bar'` in a `ControlPanel`: its leaves on one line in
 * their bar forms, under no heading. A nested section is a run between
 * dividers, and a nested page, tab, or panel opens from a button.
 */
export function ControlBar(props: ControlBarProps) {
  const { group, path, visible, enabled, value, write, custom, row, open } = props;
  return (
    <BarLayout
      framed
      label={group.name === '' ? undefined : group.name}
      nodes={groupBarNodes(group, path, open)}
      cells={(leaves) =>
        leaves
          .filter((node) => visible(node.path))
          .map(({ path: at, leaf }) => ({
            path: at,
            content: custom(at, leaf) ? (
              row(at)
            ) : (
              <Cell
                path={at}
                leaf={leaf}
                value={value(at, leaf)}
                write={(v) => write(at, v)}
                disabled={!enabled(at)}
                row={() => row(at)}
              />
            ),
          }))
      }
      row={({ path: at }) => (visible(at) ? row(at) : null)}
    />
  );
}

function Cell({
  path,
  leaf,
  value,
  write,
  disabled,
  row,
}: {
  path: string;
  leaf: PrefLeaf;
  value: unknown;
  write: (value: unknown) => void;
  disabled: boolean;
  row: () => ReactNode;
}) {
  const made = labField(leaf, value, write, useFieldChoices(), disabled);
  // `labField` names a row's control where the leaf names none; in a bar that choice is the bar's.
  const field =
    made !== null && extra<string>(leaf, 'control') === undefined
      ? ({ ...made, control: undefined } as PropertyControlProps)
      : made;
  return <>{renderBarLeaf({ leaf, path, name: leaf.name, field, disabled, row })}</>;
}
