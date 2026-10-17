import { mergeMenuDefs } from '@weasel-js/core';
import { isPrefLeaf, type PrefGroup, type PrefLeaf, pref } from '@weasel-js/prefs';
import type { LabContribution } from '../chrome/labTypes';
import type { InstrumentList } from '../instrument/types';

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

/** One section per header-item group in first-appearance order, the ungrouped last. */
function itemSections(contributions: readonly LabContribution[]): Children {
  const groups = new Map<string | undefined, Children>();
  for (const c of contributions) {
    if (c.region !== 'header' || !c.item) continue;
    const rows = groups.get(c.group) ?? {};
    rows[`c-${c.id}`] = pref.action(`lab.item.${c.id}`);
    groups.set(c.group, rows);
  }
  const ordered = [...groups].sort(([a], [b]) => Number(a === undefined) - Number(b === undefined));
  const sections: Children = {};
  ordered.forEach(([, rows], n) => {
    sections[`s${n}`] = pref.group('', rows);
  });
  return sections;
}

function labMenu({ instruments, addTrial, header }: LabMenuBarInput): PrefGroup {
  const children: Children = addTrial ? { add: addRows(instruments) } : {};
  return pref.group('Lab', { ...children, ...itemSections(header) }, { as: 'menu' });
}

function viewMenu(zoom: boolean): PrefGroup {
  const theme = pref.group(
    'Theme',
    {
      auto: pref.action('lab.mode.auto'),
      light: pref.action('lab.mode.light'),
      dark: pref.action('lab.mode.dark'),
    },
    { as: 'menu' },
  );
  const zoomSection: Children = zoom
    ? { zoom: pref.group('', { zoom: pref.action('lab.zoom') }) }
    : {};
  return pref.group('View', { ...zoomSection, theme }, { as: 'menu' });
}

function merged(
  id: string,
  builtIn: PrefGroup,
  declared: PrefLeaf | PrefGroup | undefined,
): PrefGroup {
  if (declared === undefined) return builtIn;
  if (!isMenu(declared)) {
    throw new Error(
      `[labkit] a lab's declared menu-bar entry '${id}' must be a group drawn as: 'menu'`,
    );
  }
  const defs = [builtIn, declared].map((menu) => ({ def: { id, menu }, owner: null }));
  return mergeMenuDefs(defs, null)[0]!.menu;
}

/**
 * The lab's menu bar as a schema: Lab (add trial and the header's item contributions), then the
 * menus the lab declares, then View (zoom and color mode). A declared menu keyed `lab` or `view`
 * adds its rows to the built-in one, after a separator.
 */
export function labMenuBar(input: LabMenuBarInput): PrefGroup {
  const { lab, view, ...rest } = input.declared?.children ?? {};
  return pref.group('', {
    lab: merged('lab', labMenu(input), lab),
    ...rest,
    view: merged('view', viewMenu(input.zoom), view),
  });
}
