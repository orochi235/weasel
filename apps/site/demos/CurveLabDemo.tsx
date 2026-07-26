import { useMemo, useState, useEffect } from 'react';
import {
  bezierCubic,
  bezierQuadratic,
  nurbs,
  spiro,
  type SharedAnchor,
} from '@weasel-js/core';
import { CURVE_PRESETS } from './curveLab/presets';
import { RepresentationPanel, type OverlayFlags } from './curveLab/RepresentationPanel';

const PANEL_W = 360;
const PANEL_H = 360;

const REPS = [bezierCubic, bezierQuadratic, nurbs, spiro] as const;

export function CurveLabDemo() {
  const [presetId, setPresetId] = useState(CURVE_PRESETS[0].id);
  const [anchors, setAnchors] = useState<SharedAnchor[]>(() =>
    CURVE_PRESETS[0].anchors.map((a) => ({ ...a })),
  );
  const [overlays, setOverlays] = useState<OverlayFlags>({
    anchors: true,
    comb: false,
    inflections: false,
  });

  const preset = useMemo(
    () => CURVE_PRESETS.find((p) => p.id === presetId) ?? CURVE_PRESETS[0],
    [presetId],
  );

  const onPresetChange = (id: string) => {
    setPresetId(id);
    const next = CURVE_PRESETS.find((p) => p.id === id);
    if (next) setAnchors(next.anchors.map((a) => ({ ...a })));
  };

  // E2e probe: expose live anchor state. Re-register whenever anchors change
  // so the probe returns the latest snapshot.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hook = (window as unknown as {
      __weaselTest?: { registerProbe?: (name: string, fn: () => unknown) => () => void };
    }).__weaselTest;
    if (!hook?.registerProbe) return;
    return hook.registerProbe('curveLab', () => ({ anchors, presetId }));
  }, [anchors, presetId]);

  return (
    <div className="curve-lab-root">
      <div className="curve-lab-toolbar">
        <label>
          Preset:{' '}
          <select value={presetId} onChange={(e) => onPresetChange(e.currentTarget.value)}>
            {CURVE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={overlays.anchors}
            onChange={(e) => { const v = e.currentTarget.checked; setOverlays((o) => ({ ...o, anchors: v })); }}
          />{' '}anchors
        </label>
        <label>
          <input
            type="checkbox"
            checked={overlays.comb}
            onChange={(e) => { const v = e.currentTarget.checked; setOverlays((o) => ({ ...o, comb: v })); }}
          />{' '}curvature comb
        </label>
        <label>
          <input
            type="checkbox"
            checked={overlays.inflections}
            onChange={(e) => { const v = e.currentTarget.checked; setOverlays((o) => ({ ...o, inflections: v })); }}
          />{' '}inflections + extrema
        </label>
        <span className="curve-lab-preset-desc">{preset.description}</span>
      </div>
      <div className="curve-lab-grid">
        {REPS.map((rep) => (
          <RepresentationPanel
            key={rep.kind}
            rep={rep}
            anchors={anchors}
            onAnchorsChange={setAnchors}
            overlays={overlays}
            width={PANEL_W}
            height={PANEL_H}
          />
        ))}
      </div>
    </div>
  );
}
