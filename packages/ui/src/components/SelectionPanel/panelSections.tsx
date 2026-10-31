/**
 * A panel's sections, drawn: a `bar` as one line, a run of `tab` sections as
 * one strip, a `panel` in a box, and the rest as rows under their headings.
 */
import { Fragment, type ReactNode } from 'react';
import { prefAsBox, prefTabRuns } from '@weasel-js/prefs';
import { BarLayout } from '../Bar/BarLayout';
import { MotifFrame } from '../MotifFrame';
import { FORM_FRAMES } from '../Prefs/frames';
import { HiddenBadge, hiddenAttrs } from '../Prefs/hidden';
import { offTitle } from '../Prefs/offTitle';
import { prefDrawsNoControl } from '../Prefs/PrefWords';
import { prefDrawsActionRow } from '../Prefs/registeredActions';
import { RAIL_ATTR, selectionAttrs } from '../Prefs/selection';
import type { RenderedCell } from './cells';
import { LabeledRow } from './LabeledRow';
import { isPanelSection, panelLeafKey, panelOwnRows, panelRowsOf, type PanelRow, type PanelSection } from './model';
import { rowCells, type PanelCellScope } from './panelCells';
import { PanelTabs, sectionHeaded, sectionHolds, sectionNamed, type PanelMarks } from './selection';
import s from './SelectionPanel.module.css';

/** A section with what it draws, before it is placed among its neighbors. */
interface DrawnSection {
  section: PanelSection;
  content: ReactNode;
  /** The same section split for a frame to draw: whether it is titled, what its heading holds after the name, and its rows. */
  framed?: { titled: boolean; inline: ReactNode; rows: ReactNode };
  /** Every row of the section is one a `showIf` hides, and its heading says so. */
  hidden?: boolean;
  /** Every row of the section is one a `showIf` hides, whether or not it carries the mark. */
  allHidden: boolean;
  /** The section's `enableIf` turns it off, and its title dims. */
  off?: boolean;
}

/** Whether `section`'s `enableIf` turns it off. */
const sectionOff = (section: PanelSection, scope: PanelCellScope): boolean => scope.disabled.has(section.path);

/** One line of bar forms, with no heading and no row labels; a section nested in it puts its cells on the line too. */
function barSection(section: PanelSection, scope: PanelCellScope, marks: PanelMarks): DrawnSection | undefined {
  const cells = panelRowsOf(section).flatMap((row) => rowCells(row, scope, 'bar'));
  if (cells.length === 0) return undefined;
  const off = sectionOff(section, scope);
  const bar = (
    <BarLayout
      framed
      overflow={section.overflow}
      lead={section.lead}
      icon={section.icon}
      disabled={off}
      label={section.name === '' ? undefined : section.name}
      nodes={cells.map((cell) => ({ kind: 'cell', path: cell.key, content: cell.hidden ? <>{cell.content}<HiddenBadge /></> : cell.content }))}
      cells={() => []}
      attrs={(at, leaf) => selectionAttrs(at, marks, leaf)}
    />
  );
  return { section, content: bar, off, allHidden: cells.every((cell) => cell.hidden) };
}

/**
 * A `block` leaf brings its own chrome — it spans the section instead of
 * sitting in a labeled row's control cell. Under a headless section nothing
 * else names it, so it heads itself; an object leaf already renders its own
 * heading.
 */
function blockRow(row: PanelRow, control: RenderedCell, headless: boolean, marks: PanelMarks, marked: boolean): ReactNode {
  const [only] = row.leaves;
  return (
    // An object leaf ends in rows of its own, each with the gap a row leaves under it.
    <div key={panelLeafKey(only)} className={only.leaf.kind === 'object' ? undefined : s.blockRow}
      {...selectionAttrs(panelLeafKey(only), marks, true)}>
      {marked && <HiddenBadge lead />}
      {headless && only.leaf.kind !== 'object' && !prefDrawsNoControl(only.leaf) && !prefDrawsActionRow(only.leaf) && (
        <h4 className={s.sectionTitle} title={only.leaf.description}>
          {only.leaf.name}
        </h4>
      )}
      {control.content}
    </div>
  );
}

/** `marks` for an element whose hidden mark is worked out where it is drawn. */
const selectedOnly = (marks: PanelMarks): PanelMarks => ({ selected: marks.selected });

function labeledRow(row: PanelRow, controls: readonly RenderedCell[], marks: PanelMarks, marked: boolean): ReactNode {
  const [first] = row.leaves;
  // A row several leaves share is drawn for its first, and is hidden only when they all are.
  const shared = row.leaves.length > 1;
  return (
    <LabeledRow
      key={panelLeafKey(first)}
      label={row.label}
      title={first.leaf.description}
      marked={marked}
      disabled={controls.every((cell) => cell.disabled)}
      attrs={{ ...selectionAttrs(panelLeafKey(first), shared ? selectedOnly(marks) : marks, true), ...(shared ? hiddenAttrs(marked) : {}) }}
    >
      {controls.map(({ key, content }) => (
        <Fragment key={key}>{content}</Fragment>
      ))}
    </LabeledRow>
  );
}

/**
 * The row of the leaf a headed section draws in its heading, named for the section. It stays a row where the panel
 * has its own renderer for it, whose control the panel knows nothing of the size of, or where a pair shares it.
 */
function headingRow(section: PanelSection, scope: PanelCellScope): PanelRow | undefined {
  if (section.heading === undefined || !sectionHeaded(section)) return undefined;
  const row = panelOwnRows(section).find((r) => r.leaves.length === 1 && panelLeafKey(r.leaves[0]!) === section.heading);
  const only = row?.leaves[0];
  if (!only || scope.renderers?.[only.path] || scope.renderers?.[only.leaf.kind]) return undefined;
  return row;
}

/** A row with its controls, or a nested section as drawn: `undefined` where it draws nothing. */
type Part = { row: PanelRow; controls: RenderedCell[] } | { drawn: DrawnSection | undefined };

const partDraws = (part: Part): boolean => ('drawn' in part ? part.drawn !== undefined : part.controls.length > 0);
const partHidden = (part: Part): boolean => ('drawn' in part ? part.drawn?.allHidden === true : part.controls.every((cell) => cell.hidden));

/**
 * A section's rows and nested sections under its heading, or nothing when none of them draws. `depth` is how deep
 * it is nested. `hush` says a section it sits in carries the hidden mark for it.
 */
function rowsSection(section: PanelSection, scope: PanelCellScope, marks: PanelMarks, depth: number, hush: boolean): DrawnSection | undefined {
  const lifted = headingRow(section, scope);
  // Render controls before emitting row chrome so a null-rendering
  // leaf (custom renderer opting out) collapses its cell — and the
  // whole row / section when nothing survives. PrefsForm precedent.
  const partsOf = (hushed: boolean): Part[] => section.items
    .filter((item) => item !== lifted)
    .map((item) => isPanelSection(item) ? { drawn: drawSection(item, scope, marks, depth + 1, hushed) } : { row: item, controls: rowCells(item, scope) });
  let parts = partsOf(hush);
  const only = lifted?.leaves[0];
  const headControl = only && rowCells({ label: section.name, leaves: [{ ...only, leaf: { ...only.leaf, name: section.name } }] }, scope)[0];
  if (!parts.some(partDraws) && !headControl) return undefined;
  const headed = sectionHeaded(section);
  const off = sectionOff(section, scope);
  const title = offTitle(section.name, off);
  // A section hidden whole carries one mark, on its heading; with no heading each of its rows does.
  const allHidden = parts.filter(partDraws).every(partHidden) && headControl?.hidden !== false;
  const whole = !hush && headed && allHidden;
  if (whole) parts = partsOf(true);
  const quiet = hush || whole;
  const rowMarks: PanelMarks = quiet ? { ...marks, hidden: undefined } : marks;
  const marked = (controls: readonly RenderedCell[]): boolean => !quiet && controls.every((cell) => cell.hidden);
  const control = headControl && (
    <span className={s.headingControl} {...selectionAttrs(panelLeafKey(only!), rowMarks, true)}>
      {headControl.content}
      {!quiet && headControl.hidden && <HiddenBadge />}
    </span>
  );
  const drawnRows = placed(parts.map((part) => {
    if ('drawn' in part) return part.drawn;
    const { row, controls } = part;
    if (controls.length === 0) return undefined;
    const node = row.leaves.length === 1 && controls[0].block
      ? blockRow(row, controls[0], section.name === '', rowMarks, marked(controls))
      : labeledRow(row, controls, rowMarks, marked(controls));
    return { node };
  }), marks, depth + 1);
  const Heading = depth === 0 ? 'h3' : 'h5';
  const content = (
    <>
      {headed && !control && <Heading className={s.sectionTitle}>{title}{whole && <HiddenBadge />}</Heading>}
      {control && (
        // The title dims itself, so the control sits beside it rather than in it, where it would dim too.
        <div className={s.sectionHead}>
          <Heading className={s.sectionTitle}>{title}{whole && <HiddenBadge />}</Heading>
          {control}
        </div>
      )}
      {drawnRows}
    </>
  );
  const inline = whole || control ? <>{whole && <HiddenBadge />}{control}</> : undefined;
  return { section, content, hidden: whole, allHidden, off, framed: { titled: headed || Boolean(control), inline, rows: drawnRows } };
}

/** `section` as drawn, `depth` sections deep, or `undefined` when it draws nothing. */
function drawSection(section: PanelSection, scope: PanelCellScope, marks: PanelMarks, depth: number, hush = false): DrawnSection | undefined {
  return section.as === 'bar' ? barSection(section, scope, marks) : rowsSection(section, scope, marks, depth, hush);
}

/** A row already drawn, placed among the sections beside it. */
interface DrawnRow {
  node: ReactNode;
  section?: undefined;
}

const drawsSomething = (item: DrawnSection | DrawnRow | undefined): item is DrawnSection | DrawnRow => item !== undefined;

/**
 * Rows and sections in order, `depth` sections deep, each section `selected` can name carrying its key: a run of
 * `tab` sections as one strip, a `panel` in a box, the rest under their headings. What draws nothing is left out.
 */
function placed(items: ReadonlyArray<DrawnSection | DrawnRow | undefined>, marks: PanelMarks, depth: number): ReactNode[] {
  const { lead } = marks;
  const out: ReactNode[] = [];
  for (const step of prefTabRuns(items, (drawn) => drawn.section?.as === 'tab', drawsSomething)) {
    if (step.tabs) {
      const run = step.tabs.map((drawn) => {
        const { section: at, content, off } = drawn as DrawnSection;
        // An open tab says so with `data-selected` of its own, so a tab is pressed as a rail entry is and the mark is its panel's.
        const [attrs, panelAttrs] = [{ [RAIL_ATTR]: at.key }, selectionAttrs(at.key, selectedOnly(marks))];
        return { id: at.key, name: at.name, content, holds: sectionHolds(at, lead), attrs, panelAttrs, disabled: off };
      });
      out.push(<PanelTabs key={`tabs:${run[0]!.id}`} className={depth === 0 ? s.section : undefined} tabs={run} lead={lead} />);
      continue;
    }
    if (step.item.section === undefined) {
      out.push(step.item.node);
      continue;
    }
    const { section, content, hidden, off, framed } = step.item;
    const attrs = { ...(sectionNamed(section) ? selectionAttrs(section.key, selectedOnly(marks)) : {}), ...hiddenAttrs(hidden === true) };
    const key = `section:${section.key}`;
    if (prefAsBox(section.as) && framed) {
      out.push(
        <MotifFrame
          key={key}
          motif={section.motif}
          fallback={FORM_FRAMES.labeled}
          title={framed.titled ? section.name : undefined}
          inline={framed.inline}
          level={depth === 0 ? 3 : 5}
          className={s.sectionPanel}
          attrs={attrs}
          disabled={off}
        >
          {/* One item for the well's column, so its gap falls under the heading and not between rows. */}
          <div>{framed.rows}</div>
        </MotifFrame>,
      );
    } else if (depth === 0) {
      out.push(<section key={key} className={s.section} {...attrs}>{content}</section>);
    } else {
      // Depth is drawn only where a heading marks it, as an object leaf draws it.
      out.push(<div key={key} className={sectionHeaded(section) ? s.objectGroup : undefined} {...attrs}>{content}</div>);
    }
  }
  return out;
}

/** Every section of a panel that has something to draw, in order. */
export function panelSections(sections: readonly PanelSection[], scope: PanelCellScope, marks: PanelMarks): ReactNode[] {
  return placed(sections.map((section) => drawSection(section, scope, marks, 0)), marks, 0);
}
