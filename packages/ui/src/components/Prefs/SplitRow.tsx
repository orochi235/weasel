import type { ReactNode } from 'react';
import type { PrefLeaf, PrefLocus } from '@weasel-js/prefs';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Disclosure } from '../Disclosure';
import { PropertyRow } from '../Properties/PropertyRow';
import type { RowWidth } from './compound';
import type { PrefRenderContext } from './PrefsRow';
import { splitMember, splitName, splitShape, type SplitCtx, type SplitLevel, type SplitMember, type SplitShape } from './splitRows';
import s from './Prefs.module.css';
import c from './Split.module.css';

/** What the form draws for one leaf whose value may be split. */
export interface SplitRowState {
  shape: SplitShape;
  /** The value is split and the form can write one member, so the row has a control to draw for each. */
  members: boolean;
  /** The row has something to open to: its members, or a split or a join to offer. */
  opens: boolean;
  open: boolean;
  /** What the control that opens the row is called, and the group it opens to. */
  name: string;
  /** The `id` of the group the row opens to. */
  bodyId: string;
}

/**
 * What the row of `pref` draws for its split value, in a form given something to split with. `own` is the row's
 * path and `from` where its value lives; `aliased` says the leaf is one an alias shows. A value standing for
 * several (`mixed`) has no one locus to draw the members of.
 */
export function splitRowState(
  split: SplitCtx | undefined, values: unknown, pref: PrefLeaf, own: string, from: string, aliased: boolean, mixed: boolean,
): SplitRowState | null {
  if (split === undefined) return null;
  const shape = splitShape(pref, split.loci?.get(from), (path) => split.selectorAt(path, aliased), values);
  if (shape === null) return null;
  const { levels, free } = shape;
  const members = shape.locus !== undefined && levels.length > 0 && split.onChangeAt !== undefined && !mixed;
  const opens = members || (split.onSplit !== undefined && free.length > 0) || (split.onJoin !== undefined && levels.length > 0);
  const name = levels.length > 0 ? splitName(pref.name, levels) : `Split ${pref.name}`;
  return { shape, members, opens, open: opens && split.opened.has(own), name, bodyId: split.bodyId(own) };
}

/** The option each selector of a split value is set to, as marks beside the leaf's name. */
export function SplitMarks({ levels }: { levels: readonly SplitLevel[] }) {
  return levels.map((level) => (
    <span key={level.by} className={c.mark} title={`${level.name}: ${level.current}`}>
      <Badge size="xs" emphasis="high" variant="outline">{level.current}</Badge>
    </span>
  ));
}

/** The marks alone, for a leaf drawn where there is no row to open: a heading's control, a bar's cell. */
export function splitMarks(split: SplitCtx | undefined, values: unknown, ctx: PrefRenderContext, aliased: boolean): ReactNode {
  const state = splitRowState(split, values, ctx.pref, ctx.path, ctx.path, aliased, true);
  return state && state.shape.levels.length > 0 ? <SplitMarks levels={state.shape.levels} /> : null;
}

/** The control that opens a row whose value may be split: nothing for a row with nothing to open to. */
export function SplitToggle({ state, onToggle }: { state: SplitRowState; onToggle: () => void }) {
  if (!state.opens) return null;
  return <Disclosure className={c.toggle} label={state.name} open={state.open} onToggle={onToggle} controls={state.open ? state.bodyId : undefined} />;
}

/**
 * The marks and the toggle on a line of their own, for a leaf with no label line: a `block` leaf, or an action's
 * row. A row with a label line carries the marks in its hint and the toggle after its control, where the button
 * comes after the control the row's `<label>` names.
 */
export function SplitHead({ state, onToggle }: { state: SplitRowState; onToggle: () => void }) {
  return (
    <span className={c.lead}>
      <SplitMarks levels={state.shape.levels} />
      <SplitToggle state={state} onToggle={onToggle} />
    </span>
  );
}

/** What {@link SplitBody} is given to draw the leaf's own control for each member. */
export interface SplitMemberParts {
  /** Draws the leaf's control from a render context. */
  renderControl: (ctx: PrefRenderContext) => ReactNode;
  /** Whether the control's row is a group and not a `<label>`. */
  isGroup: (ctx: PrefRenderContext) => boolean;
  /** The room the leaf's control needs. */
  width: RowWidth;
}

/**
 * What a row opens to, under it: a split value's members, and a split or a join for each selector. The members
 * are each option of the outermost selector, holding the leaf's own control over that member, or the next
 * selector's options where the value is split again.
 */
export function SplitBody({ ctx, state, split, parts }: {
  /** The leaf's own render context: its row's. */
  ctx: PrefRenderContext;
  state: SplitRowState;
  split: SplitCtx;
  parts: SplitMemberParts;
}) {
  const { levels, free, locus } = state.shape;
  const { onSplit, onJoin, onChangeAt } = split;
  const { pref, path } = ctx;
  const stacked = parts.width !== 'column' || pref.block === true;
  const row = (member: SplitMember): ReactNode => {
    const of: PrefRenderContext = {
      ...ctx,
      pref: { ...pref, name: [pref.name, ...member.labels].join(', ') },
      value: member.value,
      mixed: false,
      mixedAt: undefined,
      setValueAt: undefined,
      auto: false,
      setAuto: () => {},
      setValue: (value) => onChangeAt?.(path, value, member.at),
    };
    return (
      <PropertyRow
        key={member.labels.at(-1)}
        label={member.labels.at(-1)}
        layout={stacked ? 'block' : 'inline'}
        className={stacked ? `${s.row} ${s.rowStacked}` : s.row}
        group={parts.isGroup(of)}
        disabled={of.disabled}
      >
        <span className={parts.width === 'filled' ? `${s.rowControl} ${s.rowControlFilled}` : s.rowControl}>{parts.renderControl(of)}</span>
      </PropertyRow>
    );
  };
  const under = (held: PrefLocus, depth: number, outer: SplitMember | undefined): ReactNode[] =>
    levels[depth]!.options.map((option) => {
      const member = splitMember(held, outer, levels[depth]!, option, pref.default);
      if (depth === levels.length - 1) return row(member);
      return (
        <div key={option.value} role="group" aria-label={option.label} className={c.branch}>
          <span className={c.branchName}>{option.label}</span>
          {under(held, depth + 1, member)}
        </div>
      );
    });
  return (
    <div id={state.bodyId} role="group" aria-label={state.name} className={c.body}>
      {state.members && locus !== undefined && under(locus, 0, undefined)}
      <div className={c.actions}>
        {onSplit && free.map(({ by, name }) => (
          <Button key={by} size="sm" disabled={ctx.disabled} onClick={() => onSplit(path, by)}>Split by {name}</Button>
        ))}
        {onJoin && levels.map(({ by, name }) => (
          <Button key={by} size="sm" disabled={ctx.disabled} onClick={() => onJoin(path, by)}>Join {name}</Button>
        ))}
      </div>
    </div>
  );
}
