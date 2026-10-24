/**
 * An object leaf in a selection panel: the object's own fields as rows, and
 * each section of them as its `as` says.
 */
import { useContext, type ReactNode } from 'react';
import { isPrefLeaf, pairRuns, prefAsBox, prefSectionLeaves, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import { MotifFrame } from '../MotifFrame';
import { FORM_FRAMES } from '../Prefs/frames';
import { objectRows, type ObjectLeafParts } from '../Prefs/objectRows';
import { pathWithin, selectionAttrs } from '../Prefs/selection';
import { renderCells, type LeafCell } from './cells';
import { objectFieldCell, type ObjectFieldOwner } from './objectField';
import { objectFieldRows } from './objectFieldRows';
import type { PropertyRenderContext, PropertyRenderer } from './renderContext';
import { PanelMarksContext, PanelTabs } from './selection';
import s from './SelectionPanel.module.css';

/** The paired row of each field that shares one, by the field's full path, which is what a `pair` names. Fields
 *  are neighbors within one run of them: a section between two ends it. */
function fieldPairs(
  children: PrefObject['children'], base: string, out = new Map<string, { key: string; label: string }>(),
): Map<string, { key: string; label: string }> {
  let run: Array<readonly [string, PrefLeaf]> = [];
  const flush = (): void => {
    for (const { items, pair } of pairRuns(run, (field) => field)) {
      if (pair) for (const [path] of items) out.set(path, pair);
    }
    run = [];
  };
  for (const [key, child] of Object.entries(children)) {
    if (isPrefLeaf(child)) {
      run.push([`${base}.${key}`, child]);
    } else {
      flush();
      fieldPairs(child.members, base, out);
    }
  }
  flush();
  return out;
}

/**
 * Renders an object leaf: the object's own fields, as rows. A child's edit
 * commits the parent object, never the child's path — writing into a path
 * whose value is not an object yet would corrupt it.
 */
export function ObjectLeaf({
  ctx,
  renderers,
  selectionKey = '',
}: {
  ctx: PropertyRenderContext;
  renderers?: Record<string, PropertyRenderer>;
  selectionKey?: string;
}): ReactNode {
  const pref = ctx.pref as PrefObject;
  const marks = useContext(PanelMarksContext);
  const held = typeof ctx.value === 'object' && ctx.value !== null
    ? (ctx.value as Record<string, unknown>)
    : undefined;
  const eachObject = ctx.each.map((v) =>
    typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined,
  );

  // A value whose fields all sit under sections is titled by them — its
  // own heading would stack onto the first one and name nothing new.
  const allGrouped = Object.values(pref.children).every((child) => !isPrefLeaf(child));

  const pairs = fieldPairs(pref.children, ctx.path);
  const owner: ObjectFieldOwner = { ctx, held, eachObject, pairs, renderers, selectionKey };

  const parts: ObjectLeafParts<LeafCell> = {
    path: ctx.path,
    cell: (key, child, surface) => objectFieldCell(owner, key, child, surface),
    // Neighbors are drawn together, so a run of paired flags fuses in a bar as it does in a row.
    barCells: (cells) => renderCells(cells, renderers).map((cell) => ({ kind: 'cell', path: cell.key, content: cell.content })),
    rows: (cells) => objectFieldRows(cells, renderers, marks, ctx.hidden === true),
    barAttrs: (at, leaf) => (leaf ? selectionAttrs(at, marks, true) : {}),
    tabs: (run) => (
      <PanelTabs
        lead={marks.lead}
        tabs={run.map((tab) => ({
          ...tab,
          holds: prefSectionLeaves(tab.section.members).some(([key]) => pathWithin(`${ctx.path}.${key}`, marks.lead)),
        }))}
      />
    ),
    // Depth is drawn only where a label marks it.
    frame: (key, section, inner, { labeled, indent }) => [
      prefAsBox(section.as) ? (
        <MotifFrame key={`group:${key}`} fallback={FORM_FRAMES.labeled} title={labeled ? section.name : undefined} level={5} className={s.objectPanel}>
          <div>{inner}</div>
        </MotifFrame>
      ) : (
        <div key={`group:${key}`} className={labeled && indent ? s.objectGroup : undefined}>
          {labeled && <h5 className={s.sectionTitle}>{section.name}</h5>}
          {inner}
        </div>
      ),
    ],
  };

  const rows = objectRows(pref.children, parts, !allGrouped);
  if (rows.length === 0) return null;
  return (
    <div className={s.objectLeaf}>
      {!allGrouped && <h4 className={s.sectionTitle}>{pref.name}</h4>}
      {rows}
    </div>
  );
}
