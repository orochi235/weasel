import { applyPrefConditions, isPrefLeaf, prefJudge, type PrefGroup } from '@weasel-js/prefs';

/** One stretch of a menu bar: a menu group's title, or a run of anything else, drawn as a bar. */
export type MenuBarTitle =
  | { kind: 'menu'; key: string; name: string; access?: string; group: PrefGroup }
  | { kind: 'other'; key: string; schema: PrefGroup };

/** A menu bar schema's top-level children in order: each `as: 'menu'` group a title, and each consecutive run of
 *  anything else one `other`, holding those children under their own keys so their paths stay the bar's. */
export function menuBarTitles(schema: PrefGroup): MenuBarTitle[] {
  const titles: MenuBarTitle[] = [];
  let run: PrefGroup['children'] | null = null;
  for (const [key, child] of Object.entries(schema.children)) {
    if (!isPrefLeaf(child) && child.as === 'menu') {
      run = null;
      titles.push({ kind: 'menu', key, name: child.name, ...(child.access ? { access: child.access } : {}), group: child });
      continue;
    }
    if (!run) {
      run = {};
      titles.push({ kind: 'other', key, schema: { name: '', children: run } });
    }
    run[key] = child;
  }
  return titles;
}

/** The titles and runs a menu bar draws as its conditions leave it, read as `Bar` reads them: a title whose
 *  `showIf` fails is left out, and the keys of those whose `enableIf` fails are in `disabled`. */
export function shownMenuBar(
  schema: PrefGroup, read: (path: string) => unknown, over?: PrefGroup,
): { titles: MenuBarTitle[]; disabled: ReadonlySet<string> } {
  const { shown, disabled } = applyPrefConditions(schema, prefJudge(schema, read, undefined, over), { keepEmpty: true });
  return { titles: shown ? menuBarTitles(shown) : [], disabled };
}
