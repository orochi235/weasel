import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { BarLayout, groupBarNodes, renderBarLeaf } from '@weasel-js/ui';
import type { ReactNode } from 'react';
import { useFieldChoices } from './fieldChoices';
import { labField } from './fields';

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
  /** Where the values an edit passes through go — see `ControlRow`'s `draftConfig`. */
  draft?: (path: string, value: unknown) => void;
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
  const { group, path, visible, enabled, value, write, draft, custom, row, open } = props;
  return (
    <BarLayout
      framed
      overflow={group.overflow}
      lead={group.lead}
      icon={group.icon}
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
                draft={draft && ((v) => draft(at, v))}
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
  draft,
  disabled,
  row,
}: {
  path: string;
  leaf: PrefLeaf;
  value: unknown;
  write: (value: unknown) => void;
  draft: ((value: unknown) => void) | undefined;
  disabled: boolean;
  row: () => ReactNode;
}) {
  const field = labField(leaf, value, write, useFieldChoices(), disabled, draft);
  return <>{renderBarLeaf({ leaf, path, name: leaf.name, field, disabled, row })}</>;
}
