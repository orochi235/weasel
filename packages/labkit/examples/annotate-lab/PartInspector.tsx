/**
 * Two renderings of the same part, side by side, both accepting marks.
 *
 * The instrument owns the picture and nothing else: it declares which of its
 * elements take marks and which config keys move them, and labkit provides the
 * palette, the overlay, the store and the hook. Circle a defect on the left
 * pane, change `angle`, and `isStale` answers that the mark no longer
 * describes the picture underneath it.
 *
 * The target refs are module-scope because `targets()` is called with the
 * trial's state and config, not from inside a component — an element a
 * capability names has to be reachable from outside React.
 */
import { type CaptureSource, defineInstrument, f, useAnnotations } from '@weasel-js/labkit';
import { createRef } from 'react';

interface Config {
  angle: number;
  shading: 'flat' | 'smooth';
  label: string;
}

const CONTENT = { w: 260, h: 180 };

const flatRef = createRef<HTMLDivElement>();
const shadedRef = createRef<HTMLDivElement>();

/** The pane's own picture, for an export to draw marks over. The instrument
 *  hands it back as markup because it *is* markup — an SVG base keeps the
 *  export vector all the way through and rasterizes once at the end. */
const svgOf = (ref: typeof flatRef) => (): CaptureSource => ({
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

function InspectorBody({ config }: { config: Config }) {
  return (
    <div className="ex-panes">
      <figure>
        <div ref={flatRef} data-pane="flat">
          <Part angle={config.angle} shading="flat" />
        </div>
        <figcaption>{config.label} — flat</figcaption>
      </figure>
      <figure>
        <div ref={shadedRef} data-pane="shaded">
          <Part angle={config.angle} shading={config.shading} />
        </div>
        <figcaption>
          {config.label} — {config.shading} <MarkCount config={config} />
        </figcaption>
      </figure>
    </div>
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
  render: (ctx) => <InspectorBody config={ctx.config} />,
  annotations: {
    // What a mark is allowed to mean here. A status carries its own colour, so
    // a fixed defect stops shouting without anyone re-drawing it.
    meaning: {
      statuses: [
        { id: 'open', label: 'Open', color: '#e5484d' },
        { id: 'confirmed', label: 'Confirmed', color: '#f5a524' },
        { id: 'fixed', label: 'Fixed', color: '#30a46c' },
      ],
    },
    targets: () => [
      // `shading` moves only the right pane's picture, so only that target
      // declares it: a mark on the left survives a change that would strand
      // one on the right.
      {
        id: 'flat',
        ref: flatRef,
        content: CONTENT,
        positionDependsOn: ['angle'],
        base: svgOf(flatRef),
      },
      {
        id: 'shaded',
        ref: shadedRef,
        content: CONTENT,
        positionDependsOn: ['angle', 'shading'],
        base: svgOf(shadedRef),
      },
    ],
  },
});
