/** A shape's marks read back from the scene nodes `diagramScene` draws them as, `<id>/mark:<i>`. */
import { themeFont, type DataMark, type DiagramTheme, type PortAnchor } from '@weasel-js/diagram';
import type { ReadNode, ReadScene } from './sceneReaders';

type Paint = { paint?: { color?: unknown; opacity?: unknown }; width?: unknown; dash?: unknown };
type MarkData = {
  diagram?: { mark?: { d?: unknown }; anchor?: { at: PortAnchor; self: PortAnchor; offset?: { x: number; y: number } } };
  fill?: Paint; stroke?: Paint; text?: unknown;
  style?: { fontFamily?: string; fontSize?: number; fontWeight?: number; fontStyle?: string; letterSpacing?: number };
};

const DEFAULT_MARK_STROKE_WIDTH = 1.5;
const color = (p: Paint | undefined): string | undefined => (typeof p?.paint?.color === 'string' ? p.paint.color : undefined);
const sameAnchor = (a: PortAnchor, b: PortAnchor): boolean => a.u === b.u && a.v === b.v;

/** The path mark `data` draws. A stroke the same as `nodeStroke` on a mark with no fill is the default, left unset. */
function pathMark(data: MarkData, d: string, nodeStroke: string | undefined): DataMark {
  const fill = color(data.fill);
  const stroke = color(data.stroke);
  const opacity = data.fill?.paint?.opacity ?? data.stroke?.paint?.opacity;
  const width = data.stroke?.width;
  return {
    d,
    ...(fill !== undefined ? { fill } : {}),
    ...(stroke !== undefined && (fill !== undefined || stroke !== nodeStroke) ? { stroke } : {}),
    ...(stroke !== undefined && typeof width === 'number' && width !== DEFAULT_MARK_STROKE_WIDTH ? { strokeWidth: width } : {}),
    ...(stroke !== undefined && Array.isArray(data.stroke?.dash) ? { dash: data.stroke.dash as number[] } : {}),
    ...(typeof opacity === 'number' ? { opacity } : {}),
  };
}

/** The text mark `data` draws, its face as far as it differs from the theme's. */
function textMark(data: MarkData, text: string, nodeText: string | undefined, theme: DiagramTheme): DataMark {
  const anchor = data.diagram!.anchor!;
  const face = data.style ?? {};
  const font = themeFont(theme);
  const size = face.fontSize ?? font.fontSize;
  const style = {
    ...(face.fontSize !== undefined && face.fontSize !== font.fontSize ? { fontSize: face.fontSize } : {}),
    ...(face.fontFamily !== undefined && face.fontFamily !== font.fontFamily ? { fontFamily: face.fontFamily } : {}),
    ...(face.fontWeight !== undefined ? (face.fontWeight === 700 ? { bold: true } : { weight: face.fontWeight }) : {}),
    ...(face.fontStyle === 'italic' ? { italic: true } : {}),
    ...(face.letterSpacing ? { tracking: face.letterSpacing / size } : {}),
  };
  const fill = color(data.fill);
  return {
    text,
    at: anchor.at,
    ...(!sameAnchor(anchor.self, anchor.at) ? { self: anchor.self } : {}),
    ...(anchor.offset !== undefined ? { offset: anchor.offset } : {}),
    ...(fill !== undefined && fill !== nodeText ? { color: fill } : {}),
    ...(Object.keys(style).length > 0 ? { style } : {}),
  };
}

/** The marks drawn for `node`, in order; `colors` are the node's stroke and text, which a mark defaults to. */
export function readMarks(
  scene: ReadScene, node: ReadNode, colors: { stroke?: string | undefined; text?: string | undefined }, theme: DiagramTheme,
): DataMark[] {
  const marks: DataMark[] = [];
  for (let i = 0; ; i++) {
    const mark = scene.get(`${node.id}/mark:${i}` as never);
    if (mark === undefined) return marks;
    const data = (mark.data ?? {}) as MarkData;
    const d = data.diagram?.mark?.d;
    if (typeof d === 'string') marks.push(pathMark(data, d, colors.stroke));
    else if (typeof data.text === 'string' && data.diagram?.anchor !== undefined) marks.push(textMark(data, data.text, colors.text, theme));
  }
}
