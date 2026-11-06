import type { Row, RowTextStyle } from './body';
import { weightOf } from './rowMeasure';

/** The face a diagram node's text is set in. `letterSpacing` is in world units. */
export type DiagramTextStyle = {
  fontFamily: string; fontSize: number; fontWeight?: number; fontStyle?: 'italic'; letterSpacing?: number; align?: 'center' | 'left';
};

type Font = { fontFamily: string; fontSize: number };

/** The face `s` names, `font` filling in what it leaves out. */
export const textFace = (s: RowTextStyle | undefined, font: Font): DiagramTextStyle => {
  const fontSize = s?.fontSize ?? font.fontSize;
  const weight = weightOf(s);
  return {
    fontFamily: s?.fontFamily ?? font.fontFamily,
    fontSize,
    ...(weight !== undefined ? { fontWeight: weight } : {}),
    ...(s?.italic === true ? { fontStyle: 'italic' as const } : {}),
    ...(s?.tracking ? { letterSpacing: s.tracking * fontSize } : {}),
  };
};

/** The face a body row's text is set in. A label row's is centered in the row, a header's set left. */
export function rowTextStyle(row: Row | undefined, font: Font): DiagramTextStyle {
  const styled = row?.kind === 'label' || row?.kind === 'field' || row?.kind === 'header';
  const face = textFace(styled ? row.style : undefined, font);
  if (row?.kind === 'label') return { ...face, align: 'center' };
  return row?.kind === 'header' ? { ...face, align: 'left' } : face;
}
