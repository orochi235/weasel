/**
 * Every annotation target's marks, drawn read-only on the overview through the
 * export's own vector path: `markSvgNodes`, then `serializeSvg`.
 */
import type { View } from '@weasel-js/core';
import { serializeSvg } from '@weasel-js/svg';
import { type CSSProperties, type RefObject, useEffect, useReducer } from 'react';
import { useAnnotationsOptional } from '../annotations/AnnotationsContext';
import { markSvgNodes } from '../annotations/svgNodes';
import type { AnnotationsApi } from '../annotations/types';
import type { CameraContextValue } from '../canvas/CameraInput';

/** A target's box, in the camera's frame-local units. */
interface LocalRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where `el` sits in the camera's frame-local units: its screen rect,
 *  measured against the camera's element, through the camera. */
function localRectOf(el: HTMLElement, camera: CameraContextValue): LocalRect | null {
  const host = camera.element();
  if (!host) return null;
  const r = el.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  const v = camera.view.get();
  return {
    x: (r.left - h.left) / v.scale.x + v.x,
    y: (r.top - h.top) / v.scale.y + v.y,
    w: r.width / v.scale.x,
    h: r.height / v.scale.y,
  };
}

/** The element a target's marks sit on. The capability's targets carry their
 *  `ref`; the store's type names only the half it reads. */
function elementOf(target: object): HTMLElement | null {
  return (target as { ref?: RefObject<HTMLElement | null> }).ref?.current ?? null;
}

function markupOf(api: AnnotationsApi, target: string, content: { w: number; h: number }): string {
  const painted = api.paintedMarks(target);
  if (painted.length === 0) return '';
  const nodes = painted.flatMap(({ mark, style }) => markSvgNodes(mark, content, style));
  return serializeSvg(nodes, { viewBox: { x: 0, y: 0, width: content.w, height: content.h } });
}

/** Props for `<OverviewMarks>`. */
export interface OverviewMarksProps {
  fit: View;
  camera: CameraContextValue;
}

/**
 * The marks of every target in the annotations store in scope, placed where
 * each target's element sits on the stage. Draws nothing outside an annotating
 * trial, and takes no input.
 */
export function OverviewMarks({ fit, camera }: OverviewMarksProps) {
  const api = useAnnotationsOptional();
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => api?.subscribe(redraw), [api]);
  if (!api) return null;
  const s = fit.scale.x;
  return (
    <>
      {api.targets().map((t) => {
        const el = elementOf(t);
        const box = el ? localRectOf(el, camera) : null;
        const markup = box ? markupOf(api, t.id, t.content) : '';
        if (!box || !markup) return null;
        const place = {
          ['--lk-overview-mx' as string]: `${(box.x - fit.x) * s}px`,
          ['--lk-overview-my' as string]: `${(box.y - fit.y) * s}px`,
          ['--lk-overview-mw' as string]: `${box.w * s}px`,
          ['--lk-overview-mh' as string]: `${box.h * s}px`,
        } as CSSProperties;
        return (
          <div
            key={t.id}
            className="lk-overview__marks"
            style={place}
            data-target={t.id}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: the export's SVG serializer is the one vector path marks have; re-deriving React nodes would be a second.
            dangerouslySetInnerHTML={{ __html: markup }}
          />
        );
      })}
    </>
  );
}
