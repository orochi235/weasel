/**
 * One rendering of a part, accepting marks. Compare two renderings by opening
 * a second trial: the drawing tools in the lab's rail are shared, so a tool
 * picked once draws in either.
 *
 * The instrument owns the picture and nothing else: it declares which element
 * takes marks, which config keys move them, and how big its content is, and
 * labkit provides the palette, the overlay, the store, the hook and the
 * camera. Circle a defect, change `angle`, and `isStale` answers that the mark
 * no longer describes the picture underneath it; change `shading` and it
 * still does. Wheel or drag the empty well and the marks ride along.
 *
 * Refs are held per trial because `targets()` is called with the trial's
 * state and config, not from inside a component, and every trial of this
 * instrument declares the same target: one module-scope ref would hand each
 * trial whichever pane mounted last.
 */
import { type CaptureSource, defineInstrument, f, useAnnotations } from '@weasel-js/labkit';

interface Config {
  angle: number;
  shading: 'flat' | 'smooth';
  label: string;
}

const CONTENT = { w: 260, h: 180 };
/** The picture and its caption, which is what the stage lays out and zooms. */
const STAGE = { width: CONTENT.w, height: CONTENT.h + 26 };

type PaneRef = { current: HTMLDivElement | null };
const panes = new Map<string, PaneRef>();
function paneFor(trialId: string): PaneRef {
  let ref = panes.get(trialId);
  if (!ref) {
    ref = { current: null };
    panes.set(trialId, ref);
  }
  return ref;
}

/** The pane's own picture, for an export to draw marks over. The instrument
 *  hands it back as markup because it *is* markup — an SVG base keeps the
 *  export vector all the way through and rasterizes once at the end. */
const svgOf = (ref: PaneRef) => (): CaptureSource => ({
  kind: 'svg',
  markup: ref.current?.querySelector('svg')?.outerHTML ?? '',
});

/** A crude bracket, drawn from the config so a change visibly moves it. */
function Part({ angle, shading }: { angle: number; shading: Config['shading'] }) {
  return (
    <svg viewBox="0 0 260 180" width={CONTENT.w} height={CONTENT.h} role="img" aria-label="Part">
      <title>Part</title>
      <rect width="260" height="180" fill="#f4f1ea" />
      <g transform={`rotate(${angle} 130 90)`}>
        <path
          d="M60 130 L60 60 L110 60 L110 100 L200 100 L200 130 Z"
          fill={shading === 'flat' ? '#8b98a8' : '#a8b4c4'}
          stroke="#2c3542"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="85" cy="82" r="9" fill="#f4f1ea" stroke="#2c3542" strokeWidth="3" />
        <circle cx="176" cy="115" r="9" fill="#f4f1ea" stroke="#2c3542" strokeWidth="3" />
      </g>
    </svg>
  );
}

/** The store is reached through a hook, not through chrome context. The
 *  sidebar's own `Marks` panel is labkit's; this is a host reading the same
 *  store for its own caption. */
function MarkCount({ config }: { config: Config }) {
  const marks = useAnnotations();
  const all = marks.query();
  const stale = all.filter((a) => marks.isStale(a, config)).length;
  return (
    <span className="ex-count">
      {all.length} marks{stale > 0 ? `, ${stale} stale` : ''}
    </span>
  );
}

function InspectorBody({ config, trialId }: { config: Config; trialId: string }) {
  return (
    <figure className="ex-figure">
      <div ref={(el) => void (paneFor(trialId).current = el)} data-pane="part">
        <Part angle={config.angle} shading={config.shading} />
      </div>
      <figcaption>
        {config.label} — {config.shading} <MarkCount config={config} />
      </figcaption>
    </figure>
  );
}

export const PartInspector = defineInstrument<Record<string, never>, Config>({
  name: 'PartInspector',
  config: f.schema({
    angle: f.number(0).range(-45, 45).step(1),
    shading: f.enum('flat', ['flat', 'smooth']),
    label: f.string('bracket-7'),
  }),
  initialState: () => ({}),
  render: (ctx) => <InspectorBody config={ctx.config} trialId={ctx.trial.id} />,
  stage: { size: STAGE },
  annotations: {
    // What a mark is allowed to mean here. A status carries its own color, so
    // a fixed defect stops shouting without anyone re-drawing it.
    meaning: {
      statuses: [
        { id: 'open', label: 'Open', color: '#e5484d' },
        { id: 'confirmed', label: 'Confirmed', color: '#f5a524' },
        { id: 'fixed', label: 'Fixed', color: '#30a46c' },
      ],
    },
    // `shading` recolors the part without moving it, so it is not declared:
    // a mark survives a shading change and is stranded by a new angle.
    targets: (_state, _config, trial) => {
      const ref = paneFor(trial.id);
      return [{ id: 'part', ref, content: CONTENT, positionDependsOn: ['angle'], base: svgOf(ref) }];
    },
  },
});
