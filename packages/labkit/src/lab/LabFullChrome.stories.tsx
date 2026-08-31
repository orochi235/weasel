import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef } from 'react';
import type { ConfigField } from '../controls/types';
import { defineInstrument } from '../instrument/defineInstrument';
import type { Instrument, RenderContext } from '../instrument/types';
import type { JobEvent } from '../job/types';
import { Lab } from './Lab';
import { useLabContext } from './LabContext';

interface ScanConfig {
  gain: number;
  integrationMs: number;
  source: string;
  channel: string;
  traceColor: string;
  autoBaseline: boolean;
}

interface ScanState {
  samples: number[];
  marks: number[];
}

const PLOT = { w: 240, h: 120 };

function scanSchema(traceColor: string): ConfigField[] {
  return [
    { key: 'gain', label: 'Gain', type: 'slider', default: 1.4, min: 0.1, max: 4, step: 0.1 },
    {
      key: 'integrationMs',
      label: 'Integration (ms)',
      type: 'number',
      default: 250,
      min: 10,
      max: 2000,
      step: 10,
    },
    {
      key: 'source',
      label: 'Source',
      type: 'select',
      default: 'deuterium',
      options: [
        { value: 'deuterium', label: 'Deuterium' },
        { value: 'tungsten', label: 'Tungsten' },
        { value: 'xenon', label: 'Xenon flash' },
      ],
    },
    { key: 'channel', label: 'Channel', type: 'text', default: 'CH-1', maxLength: 12 },
    { key: 'traceColor', label: 'Trace', type: 'color', default: traceColor },
    { key: 'autoBaseline', label: 'Auto baseline', type: 'checkbox', default: true },
  ];
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

interface SweepSpec {
  count: number;
  everyMs: number;
  /** Frame indices that report a `failed` event instead of a sample. */
  dropped?: number[];
  /** Frame index at which the whole run throws, and what it throws. */
  faultAt?: number;
  fault?: string;
}

async function* sweep(spec: SweepSpec, signal: AbortSignal): AsyncGenerator<JobEvent<number>> {
  yield { kind: 'total', total: spec.count };
  for (let i = 0; i < spec.count; i++) {
    await wait(spec.everyMs, signal);
    if (signal.aborted) return;
    if (i === spec.faultAt) throw new Error(spec.fault ?? 'Sweep failed');
    if (spec.dropped?.includes(i)) {
      yield { kind: 'failed', index: i, error: `Frame ${i}: detector saturated` };
      continue;
    }
    yield { kind: 'item', item: Math.sin(i * 0.55) * 42 + 58 };
  }
}

// Rendered for its effect alone: a mark seeded on mount gives every trial one
// undoable edit, so Undo reads live instead of starting greyed out.
function SeedMarks({ ctx }: { ctx: RenderContext<ScanState, ScanConfig> }) {
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    ctx.setState((prev) => ({ ...prev, marks: [...prev.marks, 64, 152] }));
  }, [ctx]);
  return null;
}

function scanInstrument(
  name: string,
  traceColor: string,
  spec: SweepSpec,
): Instrument<ScanState, ScanConfig, number> {
  return defineInstrument<ScanState, ScanConfig, number>({
    name,
    defaultConfig: () => ({
      gain: 1.4,
      integrationMs: 250,
      source: 'deuterium',
      channel: 'CH-1',
      traceColor,
      autoBaseline: true,
    }),
    initialState: () => ({ samples: [], marks: [] }),
    configSchema: () => scanSchema(traceColor),
    render: (ctx) => <SeedMarks ctx={ctx} />,
    canvas: {
      initialView: { zoom: 1, pan: { x: 24, y: 24 } },
      layers: [
        {
          id: 'grid',
          draw: (c, { zoom }) => {
            c.strokeStyle = '#8894a8';
            c.globalAlpha = 0.3;
            c.lineWidth = 1 / zoom;
            for (let x = 0; x <= PLOT.w; x += 20) {
              c.beginPath();
              c.moveTo(x, 0);
              c.lineTo(x, PLOT.h);
              c.stroke();
            }
            for (let y = 0; y <= PLOT.h; y += 20) {
              c.beginPath();
              c.moveTo(0, y);
              c.lineTo(PLOT.w, y);
              c.stroke();
            }
            c.globalAlpha = 1;
          },
        },
        {
          id: 'trace',
          draw: (c, { state, config, zoom }) => {
            if (state.samples.length === 0) return;
            c.strokeStyle = config.traceColor;
            c.lineWidth = 2 / zoom;
            c.beginPath();
            state.samples.forEach((sample, i) => {
              const x = i * 10;
              const y = PLOT.h - Math.min(PLOT.h, sample * config.gain * 0.7);
              if (i === 0) c.moveTo(x, y);
              else c.lineTo(x, y);
            });
            c.stroke();
          },
        },
        {
          id: 'marks',
          draw: (c, { state, zoom }) => {
            c.strokeStyle = '#f08c00';
            c.lineWidth = 1 / zoom;
            for (const x of state.marks) {
              c.beginPath();
              c.moveTo(x, 0);
              c.lineTo(x, PLOT.h);
              c.stroke();
            }
          },
        },
      ],
    },
    layers: {
      ids: [
        { id: 'grid', label: 'Grid', alwaysOn: true },
        { id: 'trace', label: 'Trace' },
        { id: 'marks', label: 'Marks' },
      ],
    },
    dragDrop: {
      palette: [
        { id: 'peak', label: 'Peak marker' },
        { id: 'baseline', label: 'Baseline point' },
        { id: 'window', label: 'Integration window' },
      ],
      onDrop: (worldPos, _item, state) => ({ ...state, marks: [...state.marks, worldPos.x] }),
    },
    undo: { snapshotOn: ['state.change', 'canvas.itemAdded'], maxDepth: 20 },
    job: {
      auto: true,
      run: ({ signal }) => sweep(spec, signal),
      onItem: (item, state) => ({ ...state, samples: [...state.samples, item] }),
    },
  });
}

const spectrometer = scanInstrument('Spectrometer', '#5ad1ff', { count: 24, everyMs: 1200 });
const beamProfile = scanInstrument('Beam profile', '#ffd166', {
  count: 12,
  everyMs: 900,
  dropped: [4, 9],
});
const thermalDrift = scanInstrument('Thermal drift', '#ff8fa3', {
  count: 8,
  everyMs: 800,
  faultAt: 3,
  fault: 'Sensor bus timeout on channel 2',
});

/** Opens the other two trials and saves one snapshot per trial, so every
 *  toolbar shows its Load control and the header's Select has somewhere to
 *  add to. */
function SeedTrials() {
  const lab = useLabContext();
  const opened = useRef(false);
  const saved = useRef(false);
  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      lab.addTrial('Beam profile');
      lab.addTrial('Thermal drift');
      return;
    }
    if (!saved.current && lab.trials.length === 3) {
      saved.current = true;
      for (const trial of lab.trials) lab.saveSnapshot(trial.id, 'Baseline');
    }
  }, [lab]);
  return null;
}

const runLog = defineInstrument<{ lines: string[] }, Record<string, never>>({
  name: 'Run log',
  defaultConfig: () => ({}),
  initialState: () => ({
    lines: ['09:04 lamp warm', '09:06 slit 50 µm', '09:12 calibrated', '09:14 sweep armed'],
  }),
  render: ({ state }) => (
    <div className="lk-run-log">
      {state.lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  ),
});

const meta: Meta<typeof Lab> = {
  title: 'labkit/Lab/FullChrome',
  component: Lab,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Lab>;

/** Every chrome surface a lab renders, on screen at once: three instruments so
 *  the header offers its Select, three trials each carrying a title bar, the
 *  full toolbar, a control panel with one of every field type, the palette and
 *  layer list, and a status bar with a running job. Starts in dark, where the
 *  `nebula` backdrop paints. */
export const AllChrome: Story = {
  args: {
    instruments: [spectrometer, beamProfile, thermalDrift],
    defaultInstrument: 'Spectrometer',
    title: 'Optics bench',
    storage: null,
    mode: 'dark',
    nebula: ['#3b5bdb', '#7048e8', '#0ca678'],
    children: (
      <>
        <SeedTrials />
        <span className="lk-run-tag">Run 42 · bench 3</span>
      </>
    ),
  },
};

/** Undocking, in both targets. `Notes` declares `undockAs: 'floating'`, so its
 *  tear-out control sends it to the layer above the grid; every other section
 *  defaults to a tile and joins the tiling as a peer of the trials. */
export const UndockablePanels: Story = {
  args: {
    ...AllChrome.args,
    chrome: [
      {
        id: 'notes',
        region: 'sidebar',
        item: {
          title: 'Notes',
          undockAs: 'floating',
          body: <p className="lk-run-tag">Undock me — I float.</p>,
        },
      },
    ],
  },
};

/** The chrome the other story cannot show at the same time: one instrument, so
 *  the header is an Add trial button; one trial, so Close is disabled; no
 *  config schema, canvas, undo or job, so the sidebar falls back to its
 *  placeholder and the toolbar keeps only what is left. */
export const SingleInstrument: Story = {
  args: {
    instruments: [runLog],
    defaultInstrument: 'Run log',
    title: 'Run log',
    storage: null,
  },
};

/** The shell footer, which `<Lab>` had no prop for — reaching it used to mean
 *  building `<LabShell>` yourself. Trial chrome is contributions now; see
 *  `labkit/Chrome/Regions` for those. */
export const WithFooter: Story = {
  args: {
    instruments: [spectrometer, beamProfile],
    defaultInstrument: 'Spectrometer',
    title: 'With footer',
    storage: null,
    mode: 'dark',
    footer: <span className="lk-run-tag">Footer — reached through LabProps.footer</span>,
  },
};
