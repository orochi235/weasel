import { kebab, type PrefsCssOptions } from './css';

/**
 * `prefsCss` names for the kit's own settings: `tree.typeaheadMs` writes as
 * `--wzl-kit-tree-typeahead-ms`, clear of theme tokens. With `at`, only the
 * leaves under it are written, each named from below it; a selector outside
 * `at` keeps its whole path in its attribute name.
 */
export function kitSettingsCssOptions(at?: string): PrefsCssOptions {
  const under = (path: string): string | null => {
    if (at === undefined || at === '') return path;
    return path.startsWith(`${at}.`) ? path.slice(at.length + 1) : null;
  };
  return {
    property: (path) => {
      const rest = under(path);
      return rest === null ? null : `--wzl-kit-${kebab(rest)}`;
    },
    attribute: (selector) => `data-wzl-kit-${kebab(under(selector) ?? selector)}`,
  };
}
