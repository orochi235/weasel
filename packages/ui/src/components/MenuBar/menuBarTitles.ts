import { setOwn } from '@weasel-js/registry';
import { applyPrefConditions, isPrefLeaf, prefJudge, type PrefGroup } from '@weasel-js/prefs';
import { accessLetter } from '@weasel-js/menu';

/** One stretch of a menu bar: a menu group's title, or a run of anything else, drawn as a bar. */
export type MenuBarPart =
  | { kind: 'menu'; key: string; name: string; access?: string; group: PrefGroup }
  | { kind: 'other'; key: string; schema: PrefGroup };

/** A menu bar schema's top-level children in order: each `as: 'menu'` group a title, and each consecutive run of
 *  anything else one `other`, holding those children under their own keys so their paths stay the bar's. Throws when
 *  two titles declare one access letter, compared as the keys are. */
export function menuBarTitles(schema: PrefGroup): MenuBarPart[] {
  const titles: MenuBarPart[] = [];
  const letters = new Map<string, string>();
  let run: PrefGroup['children'] | null = null;
  for (const [key, child] of Object.entries(schema.children)) {
    if (!isPrefLeaf(child) && child.as === 'menu') {
      const letter = accessLetter(child.access);
      if (letter !== undefined) {
        const holder = letters.get(letter);
        if (holder !== undefined) {
          throw new Error(`weasel: MenuBar titles "${holder}" and "${child.name}" both declare the access letter "${letter}". Give each title a letter of its own.`);
        }
        letters.set(letter, child.name);
      }
      run = null;
      titles.push({ kind: 'menu', key, name: child.name, ...(child.access ? { access: child.access } : {}), group: child });
      continue;
    }
    if (!run) {
      run = {};
      titles.push({ kind: 'other', key, schema: { name: '', children: run } });
    }
    setOwn(run, key, child);
  }
  return titles;
}

/** The titles and runs a menu bar draws as its conditions leave it, read as `Bar` reads them: a title whose
 *  `showIf` fails is left out, and the keys of those whose `enableIf` fails are in `disabled`. */
export function shownMenuBar(
  schema: PrefGroup, read: (path: string) => unknown, over?: PrefGroup,
): { titles: MenuBarPart[]; disabled: ReadonlySet<string> } {
  menuBarTitles(schema);
  const { shown, disabled } = applyPrefConditions(schema, prefJudge(schema, read, undefined, over), { keepEmpty: true });
  return { titles: shown ? menuBarTitles(shown) : [], disabled };
}
