/**
 * The number a CSS value starts with, read as px: `0` where it starts with none (`normal`, `auto`, an empty
 * custom property). For a computed length, or a custom property's text; the unit is not checked.
 */
export function cssPx(value: string): number {
  return Number.parseFloat(value) || 0;
}
