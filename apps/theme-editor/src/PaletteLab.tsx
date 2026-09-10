import { LabShell } from '@weasel-js/labkit';
import { PropertyPanel, PropertyGroup, SliderRow, ToggleRow } from '@weasel-js/ui';
import { useMemo, useState } from 'react';
import styles from './PaletteLab.module.css';
import { PalettePreview } from './PalettePreview';
import { AnchorList } from './AnchorList';
import { DEFAULT_CONSTRAINTS, generate, type Anchor, type Constraints } from './palette/generate';

const SURFACES = { dark: '#181a1e', light: '#f5f5f6' } as const;
type SurfaceKey = keyof typeof SURFACES;

export function PaletteLab() {
  const [c, setC] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [surfaceKey, setSurfaceKey] = useState<SurfaceKey>('dark');
  const [anchors, setAnchors] = useState<readonly Anchor[]>([]);

  const set = <K extends keyof Constraints>(key: K, value: Constraints[K]) =>
    setC((prev) => ({ ...prev, [key]: value }));

  const constraints = useMemo<Constraints>(
    () => ({ ...c, surface: SURFACES[surfaceKey], anchors }),
    [c, surfaceKey, anchors],
  );

  const palette = useMemo(() => generate(constraints), [constraints]);

  return (
    <LabShell
      title="Palette lab"
      header={
        <button
          type="button"
          className={styles.reset}
          onClick={() => {
            setC(DEFAULT_CONSTRAINTS);
            setAnchors([]);
          }}
        >
          Reset
        </button>
      }
    >
      <div className={styles.layout}>
        <aside className={styles.controls}>
          <PropertyPanel title="Constraints">
            <PropertyGroup title="Set">
              <SliderRow
                label="Colors"
                value={c.count}
                min={3}
                max={16}
                step={1}
                onChange={(v) => set('count', v)}
              />
              <ToggleRow
                label="Order"
                value={c.order}
                options={[
                  { value: 'farthest', label: 'Farthest' },
                  { value: 'hue', label: 'By hue' },
                ]}
                onChange={(v) => set('order', v)}
                description="Farthest keeps any prefix separated — the first three of ten stay far apart."
              />
              <ToggleRow
                label="Surface"
                value={surfaceKey}
                options={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' },
                ]}
                onChange={setSurfaceKey}
                description="Which background the contrast floor is measured against."
              />
            </PropertyGroup>

            <PropertyGroup title="Gates">
              <SliderRow
                label="Min hue gap"
                value={c.minHueGap}
                min={0}
                max={45}
                step={1}
                onChange={(v) => set('minHueGap', v)}
                description="0 turns the gate off. Legend matching gets unreliable below 30°."
              />
              <SliderRow
                label="Min contrast"
                value={c.minContrast}
                min={0}
                max={7}
                step={0.1}
                onChange={(v) => set('minContrast', v)}
                description="0 turns the gate off. 3:1 is the WCAG floor for graphical objects."
              />
            </PropertyGroup>

            <PropertyGroup title="Lightness law">
              <SliderRow
                label="Target"
                value={c.lightnessTarget}
                min={0.4}
                max={0.92}
                step={0.01}
                onChange={(v) => set('lightnessTarget', v)}
              />
              <SliderRow
                label="Pull"
                value={c.lightnessPull}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => set('lightnessPull', v)}
                description="0 leaves every hue at its own chroma peak; 1 flattens them all onto the target."
              />
            </PropertyGroup>

            <PropertyGroup title="Chroma">
              <SliderRow
                label="Fraction of cap"
                value={c.chromaFraction}
                min={0.4}
                max={1}
                step={0.01}
                onChange={(v) => set('chromaFraction', v)}
              />
              <SliderRow
                label="Equalize"
                value={c.equalize}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => set('equalize', v)}
                description="Pulls chroma toward the set mean. The weak hues are already at the gamut ceiling, so this buys their chroma by moving lightness."
              />
            </PropertyGroup>

            <AnchorList anchors={anchors} onChange={setAnchors} count={c.count} />
          </PropertyPanel>
        </aside>

        <main className={styles.preview}>
          {!palette.feasible && (
            <p className={styles.infeasible} role="status">
              <strong>No arrangement satisfies these gates.</strong> Showing the closest attempt.{' '}
              {constraints.count * constraints.minHueGap > 360
                ? `${constraints.count} hues ${constraints.minHueGap}\u00b0 apart would need ${
                    constraints.count * constraints.minHueGap
                  }\u00b0 of circle.`
                : 'Loosen the contrast floor or the hue gap, or ask for fewer colors.'}
            </p>
          )}
          <PalettePreview palette={palette} surface={constraints.surface} />
        </main>
      </div>
    </LabShell>
  );
}
