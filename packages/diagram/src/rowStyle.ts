import type { Row, RowTextStyle } from './body';

/** The face a diagram node's text is set in. */
export type DiagramTextStyle = { fontFamily: string; fontSize: number; fontWeight?: number; fontStyle?: 'italic'; align?: 'center' };

type Font = { fontFamily: string; fontSize: number };

/** The face `s` names, `font` filling in what it leaves out. */
export const textFace = (s: RowTextStyle | undefined, font: Font): DiagramTextStyle => ({
  fontFamily: s?.fontFamily ?? font.fontFamily,
  fontSize: s?.fontSize ?? font.fontSize,
  ...(s?.bold === true ? { fontWeight: 700 } : {}),
  ...(s?.italic === true ? { fontStyle: 'italic' as const } : {}),
});

/** The face a body row's text is set in. A label row's is centered in the row. */
export function rowTextStyle(row: Row | undefined, font: Font): DiagramTextStyle {
  const face = textFace(row?.kind === 'label' || row?.kind === 'field' ? row.style : undefined, font);
  return row?.kind === 'label' ? { ...face, align: 'center' } : face;
}
