/** The one layer that draws what a snap won: every mark in the outcome store. */
import type { DrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { SnapOutcomeStore } from './outcomeStore';
import { glyphCommands, measuredSegmentCommands } from './readoutDraw';
import type { SnapReadoutStyle } from './types';

const TICK = 6;

/** A screen-space layer drawing the marks in `store`, redrawn when they change. */
export function createSnapReadoutLayer(
  store: SnapOutcomeStore,
  style: SnapReadoutStyle = {},
): RenderLayer<unknown> {
  const color = style.color ?? '#e8742c';
  const gapColor = style.gapColor ?? '#3aa0ff';
  const width = style.lineWidth ?? 1;
  const strokeOf = (c: string) => ({ paint: { kind: 'solid' as const, color: c }, width });
  return {
    id: 'snap-readout',
    label: 'Snap readout',
    space: 'screen',
    alwaysOn: true,
    subscribe: (repaint) => store.subscribe(repaint),
    draw: (_data, view) => {
      const marks = store.get();
      if (marks.length === 0) return [];
      const t = viewToTransform(view);
      const out: DrawCommand[] = [];
      for (const m of marks) {
        const measured = m.kind === 'gap' || m.kind === 'distance';
        const c = m.color ?? (measured ? gapColor : color);
        if (m.kind === 'point') {
          const [x, y] = worldToScreen(m.at.x, m.at.y, t);
          out.push(...glyphCommands(m.glyph, x, y, m.label, c));
          continue;
        }
        const [x0, y0] = worldToScreen(m.from.x, m.from.y, t);
        const [x1, y1] = worldToScreen(m.to.x, m.to.y, t);
        out.push(...measuredSegmentCommands(
          x0, y0, x1, y1, measured ? TICK : 0, strokeOf(c), measured ? String(Math.round(m.value)) : null, c,
        ));
      }
      return out;
    },
  };
}
