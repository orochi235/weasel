import { useEffect, useState, useSyncExternalStore } from 'react';
import { SceneCanvas, asNodeId, solid, useScene } from '@weasel-js/core';
import type { FillStyle } from '@weasel-js/core';
import type { TextStyle } from '@weasel-js/text';
import {
  getFontFallbackPolicy, setFontFallbackPolicy,
  registerCanvasFont, unregisterCanvasFont, isCanvasFont,
  resolveFontVariant, subscribeGlyphReady, glyphGeneration,
  type FontFallbackPolicy, type ResolveResult,
} from '@weasel-js/font';
import { ToggleBar } from '@weasel-js/ui';
import s from './FontFallbackDemo.module.css';

const W = 520;
const ROW = 60;
const H = ROW * 3 + 12;
const SAMPLE = 'Hamburgefonstiv 0123';
const INK = solid('#1c1c1c');

/** A family the browser has but no atlas was baked for. */
const CANVAS_FAMILY = 'Georgia';

/** One family per way the resolver can answer. `sans-serif` is the baked
 *  Inter atlas the site registers at startup. */
const ROWS = [
  { family: 'sans-serif', how: 'baked atlas (registerFont)' },
  { family: CANVAS_FAMILY, how: 'registerCanvasFont' },
  { family: 'Courier New', how: 'never registered' },
];

const POLICIES: { value: FontFallbackPolicy; label: string }[] = [
  { value: 'substitute', label: 'substitute' },
  { value: 'canvas', label: 'canvas' },
  { value: 'none', label: 'none' },
];

interface NodeData { text: string; style: TextStyle; fill: FillStyle }

const NODES = ROWS.map((r, i) => ({
  kind: 'leaf' as const,
  layer: 'default' as const,
  id: asNodeId(r.family),
  pose: { x: 16, y: 12 + i * ROW, width: W - 32, height: 44 },
  data: { text: SAMPLE, style: { fontSize: 32, fontFamily: r.family }, fill: INK },
}));

/** Where a family's glyphs come from, in the words the readout shows. */
function tierOf(r: ResolveResult): string {
  if (r.entry) return 'baked atlas';
  if (r.source === 'canvas') return 'rasterized by the browser';
  if (r.source === 'outline') return 'font outlines';
  return 'nothing';
}

export function FontFallbackDemo() {
  const scene = useScene<NodeData, 'default'>({ systemLayers: [{ id: 'default' }], initial: NODES });
  const [policy, setPolicy] = useState<FontFallbackPolicy>(getFontFallbackPolicy);

  // Both the policy and canvas enrollment are process-wide: every other demo
  // resolves through them too, so put them back on the way out.
  useEffect(() => {
    const before = getFontFallbackPolicy();
    const enrolledHere = !isCanvasFont(CANVAS_FAMILY);
    registerCanvasFont(CANVAS_FAMILY);
    return () => {
      setFontFallbackPolicy(before);
      if (enrolledHere) unregisterCanvasFont(CANVAS_FAMILY);
    };
  }, []);
  useEffect(() => setFontFallbackPolicy(policy), [policy]);

  // Re-read the resolutions whenever what a family resolves to changes: a
  // policy switch, an enrollment, or the atlas finishing its load.
  useSyncExternalStore(subscribeGlyphReady, glyphGeneration);

  return (
    <div className={s.demo}>
      <div className={s.controls}>
        <span className={s.label}>Unregistered families</span>
        <ToggleBar
          items={POLICIES}
          value={policy}
          onChange={(v) => v && setPolicy(v)}
          ariaLabel="Fallback policy"
          size="sm"
        />
      </div>
      <SceneCanvas width={W} height={H} className="ckd-canvas" scene={scene} />
      <table className={s.readout}>
        <thead>
          <tr><th>Requested</th><th>Set up with</th><th>Drawn from</th></tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const r = resolveFontVariant(row.family, 400, 'normal');
            return (
              <tr key={row.family}>
                <td>{row.family}</td>
                <td>{row.how}</td>
                <td>
                  {tierOf(r)}
                  {r.substituted && <span className={s.swap}> — in {r.substituted.resolved}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
