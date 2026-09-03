import {
  ArrowIcon,
  EllipseIcon,
  LineIcon,
  PencilIcon,
  RectIcon,
  SelectIcon,
  TextIcon,
} from '@weasel-js/ui';
import type { TrialTool } from '../tools/types';
import type { AnnotationKind } from './types';

/** Which weasel tool an annotation tool drives, and what kind of mark that
 *  makes. `select` makes none. */
export interface AnnotationToolInfo {
  weaselTool: string;
  kind?: AnnotationKind;
}

// `arrow` and `stroke` have no weasel tool of their own, so the kind cannot be
// read back from the insert — the overlay takes it from the tool id it holds.
const TOOLS: Record<string, AnnotationToolInfo> = {
  select: { weaselTool: 'select' },
  stroke: { weaselTool: 'pencil', kind: 'stroke' },
  line: { weaselTool: 'line', kind: 'line' },
  arrow: { weaselTool: 'line', kind: 'arrow' },
  rect: { weaselTool: 'rect', kind: 'rect' },
  ellipse: { weaselTool: 'ellipse', kind: 'ellipse' },
  text: { weaselTool: 'text', kind: 'text' },
};

/** The palette an instrument gets for declaring `annotations`. Ids share the
 *  trial's contribution namespace with `instrument.tools`, and one tool slot
 *  holds whichever is active. */
export const ANNOTATION_TOOLS: readonly TrialTool[] = [
  { id: 'select', label: 'Select', icon: SelectIcon, group: 'annotate' },
  { id: 'stroke', label: 'Freehand', icon: PencilIcon, group: 'annotate' },
  { id: 'line', label: 'Line', icon: LineIcon, group: 'annotate' },
  { id: 'arrow', label: 'Arrow', icon: ArrowIcon, group: 'annotate' },
  { id: 'rect', label: 'Rectangle', icon: RectIcon, group: 'annotate' },
  { id: 'ellipse', label: 'Ellipse', icon: EllipseIcon, group: 'annotate' },
  { id: 'text', label: 'Text', icon: TextIcon, group: 'annotate' },
];

/** What `id` drives, or undefined for a tool that is not one of these. */
export function annotationToolInfo(id: string | null): AnnotationToolInfo | undefined {
  return id === null ? undefined : TOOLS[id];
}

/** Every weasel tool the overlay has to mount for this palette to work. */
export const ANNOTATION_WEASEL_TOOLS: readonly string[] = [
  ...new Set(Object.values(TOOLS).map((t) => t.weaselTool)),
];
