/** The tokens a theme sets scrollbars with. A theme defining neither leaves scrollbars to the platform. */
export const SCROLLBAR_TOKENS = ['scrollbar-color', 'scrollbar-width'] as const;

/** Whether a theme with these token names styles its scrollbars. */
export const stylesScrollbars = (names: Iterable<string>): boolean =>
  [...names].some((n) => (SCROLLBAR_TOKENS as readonly string[]).includes(n));

/**
 * The declaration a theme root takes so `scrollbar-color` follows its token. The property inherits, so each
 * element that changes the token declares it again, or its subtree would inherit the value resolved above it.
 */
export const SCROLLBAR_COLOR_DECL = 'scrollbar-color: var(--wzl-scrollbar-color, auto);';

/**
 * The rules putting a sheet's scrollbar tokens to work, at no specificity so any class of a consumer's wins.
 * `scrollbar-color` goes on every element that can change the token: `:root`, a theme root, and an element choosing
 * any of `axes`. `scrollbar-width` does not inherit, so it goes on every element.
 */
export function scrollbarRules(axes: Iterable<string>): string[] {
  const roots = [':root', '[data-wzl-theme]', ...[...new Set(axes)].map((a) => `[data-wzl-${a}]`)];
  return [
    `:where(${roots.join(', ')}) {`,
    `  ${SCROLLBAR_COLOR_DECL}`,
    '}',
    '',
    ':where(*) {',
    '  scrollbar-width: var(--wzl-scrollbar-width, auto);',
    '}',
    '',
  ];
}
