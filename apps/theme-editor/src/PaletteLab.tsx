import { LabShell, ToolbarRegion, type LabContribution } from '@weasel-js/labkit';
import { LABS, PALETTE_LAB } from '../../shared/labs';
import {
  PropertyPanel,
  RedoIcon,
  ResetIcon,
  ToggleRow,
  UndoIcon,
} from '@weasel-js/ui';
import { useEffect, useMemo, useState } from 'react';
import { PresetBar } from './PresetBar';
import { SwatchPanel } from './SwatchPanel';
import {
  INITIAL,
  loadLive,
  loadSaved,
  persistLive,
  type LabState,
  type Preset,
  type SurfaceKey,
} from './presets';
import { useLabHistory, type LabHistory } from './useLabHistory';
import styles from './PaletteLab.module.css';
import { PalettePreview } from './PalettePreview';
import { AnchorList } from './AnchorList';
import { ConstraintsPanel } from './palette/ConstraintsPanel';
import { unmetGates } from './palette/unmetGates';
import { generate, type Anchor, type Constraints } from '@weasel-js/theme/engine';

const SURFACES: Record<SurfaceKey, string> = { dark: '#181a1e', light: '#f5f5f6' };

export function PaletteLab() {
  // Restored once, at mount: an HMR bounce or a reload should not cost the
  // configuration someone was in the middle of building.
  const [initial] = useState<LabState>(() => loadLive() ?? INITIAL);
  const history = useLabHistory<LabState>(initial);
  const { state, update, canUndo, canRedo } = history;
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

  const rail = useMemo<readonly LabContribution<LabHistory<LabState>>[]>(
    () => [
      {
        id: 'undo',
        group: 'history',
        region: 'header',
        item: {
          icon: UndoIcon,
          label: 'Undo',
          shortcut: '⌘Z',
          showLabel: true,
          disabled: !canUndo,
          onActivate: (h) => h.undo(),
        },
      },
      {
        id: 'redo',
        group: 'history',
        region: 'header',
        item: {
          icon: RedoIcon,
          label: 'Redo',
          shortcut: '⇧⌘Z',
          showLabel: true,
          disabled: !canRedo,
          onActivate: (h) => h.redo(),
        },
      },
      {
        id: 'reset',
        region: 'header',
        item: {
          icon: ResetIcon,
          label: 'Reset',
          showLabel: true,
          onActivate: (h) => h.update(INITIAL, 'reset'),
        },
      },
    ],
    [canUndo, canRedo],
  );

  return (
    <LabShell
      title="Palette lab"
      pages={LABS}
      path={PALETTE_LAB.href}
      header={
        <ToolbarRegion region="header" label="Lab actions" contributions={rail} ctx={history} />
      }
    >
      <div className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.controls}>
          <PropertyPanel title="Constraints">
            <ConstraintsPanel
              c={c}
              onSet={set}
              setRows={
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
              }
            />

            <AnchorList anchors={anchors} onChange={setAnchors} />
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
      <SwatchPanel anchors={anchors} onChange={setAnchors} count={c.count} />
      </div>
    </LabShell>
  );
}
