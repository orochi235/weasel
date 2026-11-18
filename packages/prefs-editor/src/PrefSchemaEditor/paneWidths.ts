import type { CSSProperties } from 'react';
import { useEditorSize, type EditorPrefs } from './editorPrefs';

/** How far a drag may size each pane. The narrowest is also as far as a pane gives way to a narrow window. */
export const PANE_RANGE = { structure: { min: 180, max: 640 }, attributes: { min: 220, max: 720 }, aside: { min: 120, max: 640 } } as const;
const RANGE_VARS = Object.fromEntries(Object.entries(PANE_RANGE).map(([pane, { min }]) => [`--${pane}-min`, `${min}px`])) as CSSProperties;

/** The width of each of the asset editor's resizable panes, kept in `prefs`, and the style that lays them out. */
export function usePaneWidths(prefs: EditorPrefs | undefined) {
  const structure = useEditorSize('structureWidth', prefs);
  const attributes = useEditorSize('attributesWidth', prefs);
  const aside = useEditorSize('sidebarWidth', prefs);
  const style = { ...RANGE_VARS, '--structure-w': `${structure.value}px`, '--attributes-w': `${attributes.value}px`, '--aside-w': `${aside.value}px` } as CSSProperties;
  return { structure, attributes, aside, style };
}
