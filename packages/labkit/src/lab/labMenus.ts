import { isPrefLeaf, type PrefGroup, type PrefLeaf, pref } from '@weasel-js/prefs';
import { mergeMenuDefs } from '@weasel-js/routing';
import { MARKS_COMMAND, takesMarks } from '../annotations/labMarks';
import type { LabContribution } from '../chrome/labTypes';
import { groupsOf } from '../chrome/regions/groupsOf';
import type { InstrumentList } from '../instrument/types';
import { MODES } from './labModes';

type Children = Record<string, PrefLeaf | PrefGroup>;

/** The menus a lab declares for its menu bar, with the values behind them. */
export interface LabMenus {
  /** A bar of groups drawn `as: 'menu'`, each a title on the lab's menu bar. Action leaves name
   *  commands registered in the lab, as `useCommand` from `<Lab>`'s children registers them. */
  schema: PrefGroup;
  /** Values behind the schema's boolean and enum leaves, by dotted path. */
  values?: Readonly<Record<string, unknown>>;
  onChange?: (path: string, value: unknown) => void;
}

/** What {@link labMenuBar} builds the bar from. */
export interface LabMenuBarInput {
  instruments: InstrumentList;
  addTrial: boolean;
  zoom: boolean;
  /** The lab's chrome contributions; its header items become rows in the Lab menu. */
  header: readonly LabContribution[];
  declared?: PrefGroup;
}

const isMenu = (node: PrefLeaf | PrefGroup | undefined): node is PrefGroup =>
  node !== undefined && !isPrefLeaf(node) && node.as === 'menu';

function addRows(instruments: InstrumentList): PrefLeaf | PrefGroup {
  if (instruments.length === 1) return pref.action(`lab.add.${instruments[0]!.name}`);
  const rows: Children = {};
  instruments.forEach((i, n) => {
    rows[`t${n}`] = pref.action(`lab.add.${i.name}`);
  });
  return pref.group('Add trial', rows, { as: 'menu' });
}

/** One section per run the header draws, in the header's order: a group, or an ungrouped item. */
function itemSections(contributions: readonly LabContribution[]): Children {
  const header = contributions.filter((c) => c.region === 'header');
  const sections: Children = {};
  groupsOf(header).forEach((g, n) => {
    const rows: Children = {};
    for (const c of g.entries) {
      if (c.item) rows[`c-${c.id}`] = pref.action(`lab.item.${c.id}`);
    }
    if (Object.keys(rows).length > 0) sections[`s${n}`] = pref.group('', rows);
  });
  return sections;
}

function labMenu({ instruments, addTrial, header }: LabMenuBarInput): PrefGroup {
  const children: Children = addTrial ? { add: addRows(instruments) } : {};
  return pref.group('Lab', { ...children, ...itemSections(header) }, { as: 'menu' });
}

function viewMenu(zoom: boolean, marks: boolean): PrefGroup {
  const theme = pref.group(
    'Theme',
    Object.fromEntries(MODES.map(({ mode }) => [mode, pref.action(`lab.mode.${mode}`)])),
    { as: 'menu' },
  );
  const zoomSection: Children = zoom
    ? { zoom: pref.group('', { zoom: pref.action('lab.zoom') }) }
    : {};
  const marksSection: Children = marks
    ? { marks: pref.group('', { marks: pref.action(MARKS_COMMAND) }) }
    : {};
  return pref.group('View', { ...zoomSection, ...marksSection, theme }, { as: 'menu' });
}

function merged(
  id: string,
  builtIn: PrefGroup,
  declared: PrefLeaf | PrefGroup | undefined,
): PrefGroup {
  if (declared === undefined) return builtIn;
  if (!isMenu(declared)) {
    throw new Error(
      `[labkit] '${id}' in a lab's menus is a built-in menu: declare a group as: 'menu' to add to it, or use another key`,
    );
  }
  const defs = [builtIn, declared].map((menu) => ({ def: { id, menu }, owner: null }));
  return mergeMenuDefs(defs, null)[0]!.menu;
}

/**
 * The lab's menu bar as a schema: Lab (add trial and the header's item contributions), then the
 * menus the lab declares, then View (zoom, Marks in a lab whose instruments take marks, and color mode). A declared menu keyed `lab` or `view`
 * adds its rows to the built-in one, after a separator.
 */
export function labMenuBar(input: LabMenuBarInput): PrefGroup {
  const { lab, view, ...rest } = input.declared?.children ?? {};
  return pref.group('', {
    lab: merged('lab', labMenu(input), lab),
    ...rest,
    view: merged('view', viewMenu(input.zoom, takesMarks(input.instruments)), view),
  });
}
