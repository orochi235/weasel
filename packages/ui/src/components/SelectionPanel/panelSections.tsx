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
import { prefDrawsNoControl } from '../Prefs/PrefWords';
import { prefDrawsActionRow } from '../Prefs/registeredActions';
import { pathWithin, RAIL_ATTR, selectionAttrs } from '../Prefs/selection';
import type { RenderedCell } from './cells';
import { panelLeafKey, type PanelRow, type PanelSection } from './model';
import { rowCells, type PanelCellScope } from './panelCells';
import { PanelTabs, sectionHeaded, sectionNamed, type PanelMarks } from './selection';
import s from './SelectionPanel.module.css';

/** A section with what it draws, before it is placed among its neighbors. */
interface DrawnSection {
  section: PanelSection;
  content: ReactNode;
  /** The same section split for a frame to draw: whether it is titled, what its heading holds after the name, and its rows. */
  framed?: { titled: boolean; inline: ReactNode; rows: ReactNode };
  /** Every row of the section is one a `showIf` hides, and its heading says so. */
  hidden?: boolean;
}

/** One line of bar forms, with no heading and no row labels. */
function barSection(section: PanelSection, scope: PanelCellScope, marks: PanelMarks): DrawnSection[] {
  const cells = section.rows.flatMap((row) => rowCells(row, scope, 'bar'));
  if (cells.length === 0) return [];
  const bar = (
    <BarLayout
      framed
      overflow={section.overflow}
      lead={section.lead}
      icon={section.icon}
      label={section.name === '' ? undefined : section.name}
      nodes={cells.map((cell) => ({ kind: 'cell', path: cell.key, content: cell.hidden ? <>{cell.content}<HiddenBadge /></> : cell.content }))}
      cells={() => []}
      row={() => null}
      attrs={(at, leaf) => selectionAttrs(at, marks, leaf)}
    />
  );
  return [{ section, content: bar }];
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
    <div key={panelLeafKey(first)} className={s.row} {...(controls.every((cell) => cell.disabled) ? { 'data-disabled': '' } : {})}
      {...selectionAttrs(panelLeafKey(first), shared ? selectedOnly(marks) : marks, true)} {...(shared ? hiddenAttrs(marked) : {})}>
      <span className={s.rowLabel} title={first.leaf.description}>
        {row.label}
        {marked && <HiddenBadge />}
      </span>
      <span className={s.rowControls}>
        {controls.map(({ key, content }) => (
          <Fragment key={key}>{content}</Fragment>
        ))}
      </span>
    </div>
  );
}

/**
 * The row of the leaf a headed section draws in its heading, named for the section. It stays a row where the panel
 * has its own renderer for it, whose control the panel knows nothing of the size of, or where a pair shares it.
 */
function headingRow(section: PanelSection, scope: PanelCellScope): PanelRow | undefined {
  if (section.heading === undefined || !sectionHeaded(section)) return undefined;
  const row = section.rows.find((r) => r.leaves.length === 1 && panelLeafKey(r.leaves[0]!) === section.heading);
  const only = row?.leaves[0];
  if (!only || scope.renderers?.[only.path] || scope.renderers?.[only.leaf.kind]) return undefined;
  return row;
}

/** A section's rows under its heading, or nothing when no row draws a control. */
function rowsSection(section: PanelSection, scope: PanelCellScope, marks: PanelMarks): DrawnSection[] {
  const lifted = headingRow(section, scope);
  // Render controls before emitting row chrome so a null-rendering
  // leaf (custom renderer opting out) collapses its cell — and the
  // whole row / section when nothing survives. PrefsForm precedent.
  const rows = section.rows
    .filter((row) => row !== lifted)
    .map((row) => ({ row, controls: rowCells(row, scope) }))
    .filter(({ controls }) => controls.length > 0);
  const only = lifted?.leaves[0];
  const headControl = only && rowCells({ label: section.name, leaves: [{ ...only, leaf: { ...only.leaf, name: section.name } }] }, scope)[0];
  if (rows.length === 0 && !headControl) return [];
  const headed = sectionHeaded(section);
  // A section hidden whole carries one mark, on its heading; with no heading each of its rows does.
  const whole = headed && rows.every(({ controls }) => controls.every((cell) => cell.hidden)) && headControl?.hidden !== false;
  const rowMarks: PanelMarks = whole ? { ...marks, hidden: undefined } : marks;
  const marked = (controls: readonly RenderedCell[]): boolean => !whole && controls.every((cell) => cell.hidden);
  const control = headControl && (
    <span className={s.headingControl} {...selectionAttrs(panelLeafKey(only!), rowMarks, true)}>
      {headControl.content}
      {!whole && headControl.hidden && <HiddenBadge />}
    </span>
  );
  const drawnRows = rows.map(({ row, controls }) =>
    row.leaves.length === 1 && controls[0].block
      ? blockRow(row, controls[0], section.name === '', rowMarks, marked(controls))
      : labeledRow(row, controls, rowMarks, marked(controls)),
  );
  const content = (
    <>
      {headed && !control && <h3 className={s.sectionTitle}>{section.name}{whole && <HiddenBadge />}</h3>}
      {control && (
        // The title dims itself, so the control sits beside it rather than in it, where it would dim too.
        <div className={s.sectionHead}>
          <h3 className={s.sectionTitle}>{section.name}{whole && <HiddenBadge />}</h3>
          {control}
        </div>
      )}
      {drawnRows}
    </>
  );
  const inline = whole || control ? <>{whole && <HiddenBadge />}{control}</> : undefined;
  return [{ section, content, hidden: whole, framed: { titled: headed || Boolean(control), inline, rows: drawnRows } }];
}

/** The sections in order, each one `selected` can name carrying its key: a run of `tab` sections as one strip, a `panel` in a box, the rest under their headings. */
function placed(sections: readonly DrawnSection[], marks: PanelMarks): ReactNode[] {
  const { lead } = marks;
  const out: ReactNode[] = [];
  for (const step of prefTabRuns(sections, (drawn) => drawn.section.as === 'tab')) {
    if (!step.tabs) {
      const { section, content, hidden, framed } = step.item;
      const attrs = { ...(sectionNamed(section) ? selectionAttrs(section.key, selectedOnly(marks)) : {}), ...hiddenAttrs(hidden === true) };
      out.push(
        prefAsBox(section.as) && framed ? (
          <MotifFrame
            key={section.key}
            fallback={FORM_FRAMES.labeled}
            title={framed.titled ? section.name : undefined}
            inline={framed.inline}
            level={3}
            className={s.sectionPanel}
            attrs={attrs}
          >
            {/* One item for the well's column, so its gap falls under the heading and not between rows. */}
            <div>{framed.rows}</div>
          </MotifFrame>
        ) : (
          <section key={section.key} className={s.section} {...attrs}>
            {content}
          </section>
        ),
      );
      continue;
    }
    const run = step.tabs.map(({ section: at, content }) => {
      const holds = at.key === lead || at.rows.some((row) => row.leaves.some((item) => pathWithin(panelLeafKey(item), lead)));
      // An open tab says so with `data-selected` of its own, so a tab is pressed as a rail entry is and the mark is its panel's.
      const [attrs, panelAttrs] = [{ [RAIL_ATTR]: at.key }, selectionAttrs(at.key, selectedOnly(marks))];
      return { id: at.key, name: at.name, content, holds, attrs, panelAttrs };
    });
    out.push(<PanelTabs key={step.tabs[0]!.section.key} className={s.section} tabs={run} lead={lead} />);
  }
  return out;
}

/** Every section of a panel that has something to draw, in order. */
export function panelSections(sections: readonly PanelSection[], scope: PanelCellScope, marks: PanelMarks): ReactNode[] {
  const drawn = sections.flatMap((section) =>
    section.as === 'bar' ? barSection(section, scope, marks) : rowsSection(section, scope, marks),
  );
  return placed(drawn, marks);
}
