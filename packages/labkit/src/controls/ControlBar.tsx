import type { PrefBoundReader, PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { Bar, renderBarLeaf } from '@weasel-js/ui/components/Bar';
import {
  type BarLeafNode,
  barCells,
  barNodeChildren,
  groupBarNodes,
} from '@weasel-js/ui/components/PrefsBar';
import { loneLeafContext } from '@weasel-js/ui/components/PrefsSource';
import { PropertySpan } from '@weasel-js/ui/components/Properties';
import type { ReactNode } from 'react';
import { useFieldChoices } from './fieldChoices';
import { labField, useLabSettles, useTextWaitMs } from './fields';

export interface ControlBarProps {
  group: PrefGroup;
  /** Dotted path of `group`. */
  path: string;
  /** Whether the panel shows the leaf at a path. */
  visible: (path: string) => boolean;
  /** Whether the leaf at a path takes input. */
  enabled: (path: string) => boolean;
  /** Whether the action at a path is drawn pressed: its `activeIf` holds. */
  active?: (path: string) => boolean;
  /** The value the leaf at a path shows. */
  value: (path: string, leaf: PrefLeaf) => unknown;
  /** Reads the panel's values, which a number's `minAt` and `maxAt` bound it by. */
  read: PrefBoundReader;
  write: (path: string, value: unknown) => void;
  /** The leaf as the bar's cell draws it: an action's run told the panel's config. */
  bind: (leaf: PrefLeaf) => PrefLeaf;
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
  const {
    group,
    path,
    visible,
    enabled,
    active,
    value,
    read,
    write,
    bind,
    draft,
    custom,
    row,
    open,
  } = props;
  const cell = ({ path: at, leaf }: BarLeafNode) => {
    const drawn = bind(leaf);
    return {
      ctx: {
        ...loneLeafContext(at, drawn, value(at, leaf), (v) => write(at, v)),
        disabled: !enabled(at),
      },
      render: () =>
        custom(at, leaf) ? (
          row(at)
        ) : (
          <Cell
            path={at}
            leaf={drawn}
            value={value(at, leaf)}
            write={(v) => write(at, v)}
            draft={draft && ((v) => draft(at, v))}
            read={read}
            disabled={!enabled(at)}
            active={active?.(at) === true}
            row={() => row(at)}
          />
        ),
    };
  };
  // A leaf the lab draws itself keeps its own control, so it never fuses into a run of paired flags.
  const own = (leaves: readonly BarLeafNode[]) =>
    Object.fromEntries(
      leaves.filter((n) => custom(n.path, n.leaf)).map((n) => [n.path, () => row(n.path)]),
    );
  // A bar takes the panel's whole width, a pairs group's included.
  return (
    <PropertySpan>
      <Bar
        className="lk-control-bar"
        framed
        overflow={group.overflow}
        lead={group.lead}
        icon={group.icon}
        off={!enabled(path)}
        label={group.name === '' ? undefined : group.name}
      >
        {barNodeChildren(groupBarNodes(group, path, open), {
          cells: (leaves) => {
            const shown = leaves.filter((node) => visible(node.path));
            return barCells(shown, cell, own(shown));
          },
        })}
      </Bar>
    </PropertySpan>
  );
}

function Cell({
  path,
  leaf,
  value,
  write,
  draft,
  read,
  disabled,
  active,
  row,
}: {
  path: string;
  leaf: PrefLeaf;
  value: unknown;
  write: (value: unknown) => void;
  draft: ((value: unknown) => void) | undefined;
  read: PrefBoundReader;
  disabled: boolean;
  active: boolean;
  row: () => ReactNode;
}) {
  const field = labField(
    leaf,
    value,
    write,
    useFieldChoices(),
    disabled,
    draft,
    read,
    useLabSettles(),
    useTextWaitMs(leaf),
  );
  return <>{renderBarLeaf({ leaf, path, name: leaf.name, field, disabled, active, row })}</>;
}
