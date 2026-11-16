import { useEffect, useState } from 'react';
import { useScene } from '@weasel-js/core';
import { Button } from '@weasel-js/ui/components/Button';
import { CheckboxGroup } from '@weasel-js/ui/components/CheckboxGroup';
import { Select } from '@weasel-js/ui/components/Select';
import { CURVE_PRESETS } from './curveLab/presets';
import { anchorsOf, applyPreset, curveSceneOptions, presetIdOf, REPS } from './curveLab/curveScene';
import { RepresentationPanel, type OverlayFlags } from './curveLab/RepresentationPanel';
import { DemoStageGroup } from './DemoStage';

const OVERLAYS: readonly { value: keyof OverlayFlags; label: string }[] = [
  { value: 'anchors', label: 'anchors' },
  { value: 'comb', label: 'curvature comb' },
  { value: 'inflections', label: 'inflections + extrema' },
];

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

  // Test probe `curveLab`: the anchors and preset as they stand.
  useEffect(() => window.__weaselTest?.registerProbe('curveLab', () => ({ anchors, presetId })), [anchors, presetId]);

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
        <CheckboxGroup<keyof OverlayFlags>
          aria-label="Overlays"
          orientation="horizontal"
          sweep
          items={OVERLAYS}
          value={OVERLAYS.filter((o) => overlays[o.value]).map((o) => o.value)}
          onChange={(on) => setOverlays({ anchors: on.includes('anchors'), comb: on.includes('comb'), inflections: on.includes('inflections') })}
        />
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
