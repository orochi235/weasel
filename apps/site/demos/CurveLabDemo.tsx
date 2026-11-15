import { useEffect, useState } from 'react';
import { useScene } from '@weasel-js/core';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Select } from '@weasel-js/ui/components/Select';
import { CURVE_PRESETS } from './curveLab/presets';
import { anchorsOf, applyPreset, curveSceneOptions, presetIdOf, REPS } from './curveLab/curveScene';
import { RepresentationPanel, type OverlayFlags } from './curveLab/RepresentationPanel';
import { DemoStageGroup } from './DemoStage';

const PANEL_W = 360;
const PANEL_H = 360;

export function CurveLabDemo() {
  const [options] = useState(curveSceneOptions);
  const scene = useScene(options);
  const anchors = anchorsOf(scene);
  const presetId = presetIdOf(scene);
  const [overlays, setOverlays] = useState<OverlayFlags>({
    anchors: true,
    comb: false,
    inflections: false,
  });

  const preset = CURVE_PRESETS.find((p) => p.id === presetId) ?? CURVE_PRESETS[0];

  const onPresetChange = (id: string) => {
    const next = CURVE_PRESETS.find((p) => p.id === id);
    if (next && id !== presetId) applyPreset(scene, next);
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
        <Button size="sm" disabled={!scene.canUndo()} onClick={() => scene.undo()}>Undo</Button>
        <Button size="sm" disabled={!scene.canRedo()} onClick={() => scene.redo()}>Redo</Button>
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
              scene={scene}
              anchors={anchors}
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
