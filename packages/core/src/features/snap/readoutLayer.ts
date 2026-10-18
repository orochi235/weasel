/** The one layer that draws what a snap won: every mark in the outcome store. */
import type { DrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { SnapOutcomeStore } from './outcomeStore';
import { glyphCommands, measuredSegmentCommands } from './readoutDraw';

export interface SnapReadoutStyle {
  /** Points, lines and their labels. Default orange, as the path marker. */
  color?: string;
  /** Gap and distance marks. Default blue, as the guides. */
  gapColor?: string;
  /** Stroke width in screen px. Default 1. */
  lineWidth?: number;
}

const TICK = 6;

export function createSnapReadoutLayer(
  store: SnapOutcomeStore,
  style: SnapReadoutStyle = {},
): RenderLayer<unknown> {
  const color = style.color ?? '#e8742c';
  const gapColor = style.gapColor ?? '#3aa0ff';
  const width = style.lineWidth ?? 1;
  const stroke = { paint: { kind: 'solid' as const, color }, width };
  const gapStroke = { paint: { kind: 'solid' as const, color: gapColor }, width };
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
        if (m.kind === 'point') {
          const [x, y] = worldToScreen(m.at.x, m.at.y, t);
          out.push(...glyphCommands(m.glyph, x, y, m.label, color));
          continue;
        }
        const [x0, y0] = worldToScreen(m.from.x, m.from.y, t);
        const [x1, y1] = worldToScreen(m.to.x, m.to.y, t);
        if (m.kind === 'line') out.push(...measuredSegmentCommands(x0, y0, x1, y1, 0, stroke, null, color));
        else out.push(...measuredSegmentCommands(x0, y0, x1, y1, TICK, gapStroke, String(Math.round(m.value)), gapColor));
      }
      return out;
    },
  };
}
