import { useMemo, useState, useEffect } from 'react';
import {
  bezierCubic,
  bezierQuadratic,
  nurbs,
  spiro,
  type SharedAnchor,
} from '@weasel-js/geom/curves';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Select } from '@weasel-js/ui/components/Select';
import { CURVE_PRESETS } from './curveLab/presets';
import { RepresentationPanel, type OverlayFlags } from './curveLab/RepresentationPanel';
import { DemoStageGroup } from './DemoStage';

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
        <Select
          label="Preset"
          orientation="row"
          width="fit"
          options={CURVE_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
          selectedKey={presetId}
          onSelectionChange={onPresetChange}
        />
        <Checkbox isSelected={overlays.anchors} onChange={(v) => setOverlays((o) => ({ ...o, anchors: v }))}>
          anchors
        </Checkbox>
        <Checkbox isSelected={overlays.comb} onChange={(v) => setOverlays((o) => ({ ...o, comb: v }))}>
          curvature comb
        </Checkbox>
        <Checkbox isSelected={overlays.inflections} onChange={(v) => setOverlays((o) => ({ ...o, inflections: v }))}>
          inflections + extrema
        </Checkbox>
        <span className="curve-lab-preset-desc">{preset.description}</span>
      </div>
      <DemoStageGroup>
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
      </DemoStageGroup>
    </div>
  );
}
