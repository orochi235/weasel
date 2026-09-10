import { LabShell } from '@weasel-js/labkit';
import { PropertyPanel, PropertyGroup, SliderRow, ToggleRow } from '@weasel-js/ui';
import { useEffect, useMemo, useState } from 'react';
import { PresetBar } from './PresetBar';
import {
  INITIAL,
  loadLive,
  loadSaved,
  persistLive,
  type LabState,
  type Preset,
  type SurfaceKey,
} from './presets';
import { useLabHistory } from './useLabHistory';
import styles from './PaletteLab.module.css';
import { PalettePreview } from './PalettePreview';
import { AnchorList } from './AnchorList';
import { floorDegrees, generate, type Anchor, type Constraints } from './palette/generate';

const SURFACES: Record<SurfaceKey, string> = { dark: '#181a1e', light: '#f5f5f6' };

/**
 * Which gates the best attempt still misses, and by how much.
 *
 * "Infeasible" on its own leaves you dragging sliders to find out which one
 * bound — and past about twenty colors more than one usually does.
 */
function unmetGates(c: Constraints, stats: ReturnType<typeof generate>['stats']): string[] {
  const out: string[] = [];
  const floor = floorDegrees(c);
  if (floor > 0 && stats.minHueGap < floor - 0.01) {
    out.push(`hue gap reaches ${stats.minHueGap.toFixed(0)}° of the ${floor.toFixed(0)}° asked for`);
  }
  if (c.minContrast > 0 && stats.minContrast < c.minContrast) {
    out.push(`contrast reaches ${stats.minContrast.toFixed(2)} of ${c.minContrast.toFixed(1)}`);
  }
  if (c.minDistance > 0 && stats.minDistance < c.minDistance - 0.005) {
    out.push(`distance between colors reaches ${stats.minDistance.toFixed(3)} of ${c.minDistance.toFixed(2)}`);
  }
  if (c.minSurfaceDistance > 0 && stats.minSurfaceDistance < c.minSurfaceDistance - 0.005) {
    out.push(
      `distance from the surface reaches ${stats.minSurfaceDistance.toFixed(3)} of ${c.minSurfaceDistance.toFixed(2)}`,
    );
  }
  if (out.length > 0 && c.count * floor > 360) {
    out.push(`${c.count} hues ${floor.toFixed(0)}° apart would need ${(c.count * floor).toFixed(0)}° of circle`);
  }
  return out;
}

export function PaletteLab() {
  // Restored once, at mount: an HMR bounce or a reload should not cost the
  // configuration someone was in the middle of building.
  const [initial] = useState<LabState>(() => loadLive() ?? INITIAL);
  const { state, update, undo, redo, canUndo, canRedo } = useLabHistory<LabState>(initial);
  const [saved, setSaved] = useState<readonly Preset[]>(loadSaved);
  const { c, surfaceKey, anchors } = state;

  const set = <K extends keyof Constraints>(key: K, value: Constraints[K]) =>
    update({ ...state, c: { ...state.c, [key]: value } }, `c.${String(key)}`);
  const setSurfaceKey = (next: SurfaceKey) => update({ ...state, surfaceKey: next }, 'surface');
  const setAnchors = (next: readonly Anchor[]) => update({ ...state, anchors: next }, 'anchors');

  const constraints = useMemo<Constraints>(
    () => ({ ...c, surface: SURFACES[surfaceKey], anchors }),
    [c, surfaceKey, anchors],
  );

  const palette = useMemo(() => generate(constraints), [constraints]);

  useEffect(() => persistLive(state), [state]);

  return (
    <LabShell
      title="Palette lab"
      header={
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.reset}
            onClick={undo}
            disabled={!canUndo}
            title="Undo (⌘Z)"
          >
            Undo
          </button>
          <button
            type="button"
            className={styles.reset}
            onClick={redo}
            disabled={!canRedo}
            title="Redo (⇧⌘Z)"
          >
            Redo
          </button>
          <button type="button" className={styles.reset} onClick={() => update(INITIAL, 'reset')}>
            Reset
          </button>
        </div>
      }
    >
      <div className={styles.layout}>
        <aside className={styles.controls}>
          <PropertyPanel title="Constraints">
            <PropertyGroup title="Set">
              <SliderRow
                label="Colors"
                value={c.count}
                min={5}
                max={32}
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
                value={c.hueFloor}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => set('hueFloor', v)}
                format={(v) => ((v * 360) / Math.max(1, c.count)).toFixed(0)}
                unit={<sup>°</sup>}
                description={`A share of the even ${(360 / Math.max(1, c.count)).toFixed(1)}° this many colors would get. Held as a share so the floor means the same thing at any count. 0 turns it off.`}
              />
              <SliderRow
                label="Min contrast"
                value={c.minContrast}
                min={0}
                max={7}
                step={0.1}
                onChange={(v) => set('minContrast', v)}
                description="WCAG, which reads lightness only. 3:1 is its floor for graphical objects. 0 turns it off."
              />
              <SliderRow
                label="From surface"
                value={c.minSurfaceDistance}
                min={0}
                max={0.6}
                step={0.01}
                onChange={(v) => set('minSurfaceDistance', v)}
                description="Perceptual distance from the surface — the gate contrast cannot express, because it counts chroma. This is what lets a yellow stay yellow on paper. 0 turns it off."
              />
              <SliderRow
                label="Between colors"
                value={c.minDistance}
                min={0}
                max={0.4}
                step={0.01}
                onChange={(v) => set('minDistance', v)}
                description="Perceptual distance between any two swatches. Catches the pair that shares a hue gap but still reads alike. 0 turns it off."
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
          <PresetBar
            state={state}
            saved={saved}
            onSavedChange={setSaved}
            onLoad={(next, name) => update(next, `preset:${name}`, `load ${name}`)}
          />
          {!palette.feasible && (
            <p className={styles.infeasible} role="status">
              <strong>No arrangement satisfies these gates.</strong> Showing the closest attempt.{' '}
              {unmetGates(constraints, palette.stats).join('; ') || 'Loosen a gate or ask for fewer colors.'}
            </p>
          )}
          <PalettePreview palette={palette} surface={constraints.surface} />
        </main>
      </div>
    </LabShell>
  );
}
