/**
 * Network devices. Each is drawn as SVG path data in a unit square standing
 * on its foot, and set over a strip its label lays out in, the way the actor
 * carries its name under the figure.
 */
import { ACTOR_FIGURE, figureOver } from './figures';
import { outlineFromD } from './fromD';
import type { OutlineDef } from './types';

/** A device's drawing and the label strip under it, in px at the default size. */
const GLYPH = 56;
const STRIP = 32;

/** What a device stencil places on a click. */
export const DEVICE_SIZE = { width: 96, height: GLYPH + STRIP };

const SHARE = GLYPH / (GLYPH + STRIP);
const device = (d: string, detail: string): OutlineDef => figureOver(outlineFromD(d, { detail }), 1, SHARE);

/** The actor's figure at a device's height. */
const user = figureOver(ACTOR_FIGURE, 0.6, SHARE);

/** A circle as two arcs, for the rings and dots in the devices' detail. */
const ring = (cx: number, cy: number, r: number): string =>
  `M${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}`;

/** A tower: three drive bays and a power button. */
const server = device(
  'M0.33 0H0.67Q0.7 0 0.7 0.03V0.97Q0.7 1 0.67 1H0.33Q0.3 1 0.3 0.97V0.03Q0.3 0 0.33 0Z',
  `M0.37 0.16H0.63M0.37 0.28H0.63M0.37 0.4H0.63${ring(0.5, 0.8, 0.045)}`,
);

/** A short cylinder, two arrows crossing on its side. Each head's barbs run along the axes, so they stay crisp. */
const router = device(
  'M0.08 0.46A0.42 0.14 0 0 1 0.92 0.46V0.86A0.42 0.14 0 0 1 0.08 0.86Z',
  'M0.08 0.46A0.42 0.14 0 0 0 0.92 0.46'
    + 'M0.38 0.68L0.62 0.92M0.53 0.92H0.62V0.83'
    + 'M0.38 0.92L0.62 0.68M0.53 0.68H0.62V0.77',
);

/** A flat box, its ports' traffic running both ways. */
const switchDevice = device(
  'M0.09 0.56H0.91Q0.94 0.56 0.94 0.59V0.97Q0.94 1 0.91 1H0.09Q0.06 1 0.06 0.97V0.59Q0.06 0.56 0.09 0.56Z',
  'M0.24 0.69H0.76M0.715 0.645L0.76 0.69L0.715 0.735'
    + 'M0.76 0.87H0.24M0.285 0.825L0.24 0.87L0.285 0.915',
);

/** A brick wall, its courses staggered. */
const firewall = device(
  'M0.1 0.3H0.9V1H0.1Z',
  'M0.1 0.475H0.9M0.1 0.65H0.9M0.1 0.825H0.9'
    + 'M0.37 0.3V0.475M0.63 0.3V0.475'
    + 'M0.24 0.475V0.65M0.5 0.475V0.65M0.76 0.475V0.65'
    + 'M0.37 0.65V0.825M0.63 0.65V0.825'
    + 'M0.24 0.825V1M0.5 0.825V1M0.76 0.825V1',
);

/** An open laptop: its screen, and the keyboard deck seen edge on. */
const laptop = device(
  'M0.2 0.84V0.43Q0.2 0.4 0.23 0.4H0.77Q0.8 0.4 0.8 0.43V0.84L0.94 0.96Q0.96 1 0.92 1H0.08Q0.04 1 0.06 0.96Z',
  'M0.26 0.46H0.74V0.78H0.26ZM0.2 0.84H0.8M0.43 0.92H0.57',
);

/** A desktop monitor on its stand. */
const desktop = device(
  'M0.13 0.3H0.87Q0.9 0.3 0.9 0.33V0.79Q0.9 0.82 0.87 0.82H0.56V0.93H0.7V1H0.3V0.93H0.44V0.82H0.13Q0.1 0.82 0.1 0.79V0.33Q0.1 0.3 0.13 0.3Z',
  'M0.16 0.36H0.84V0.76H0.16Z',
);

/** A handset: its screen and a speaker slot. */
const phone = device(
  'M0.37 0.4H0.63Q0.68 0.4 0.68 0.45V0.95Q0.68 1 0.63 1H0.37Q0.32 1 0.32 0.95V0.45Q0.32 0.4 0.37 0.4Z',
  'M0.38 0.47H0.62V0.86H0.38ZM0.46 0.93H0.54',
);

/** A printer: paper fed at the top, a sheet out of the slot at the front. */
const printer = device(
  'M0.28 0.55V0.36H0.72V0.55H0.86Q0.9 0.55 0.9 0.59V0.84Q0.9 0.88 0.86 0.88H0.74V1H0.26V0.88H0.14Q0.1 0.88 0.1 0.84V0.59Q0.1 0.55 0.14 0.55Z',
  `M0.26 0.88H0.74M0.34 0.94H0.66M0.2 0.78H0.8${ring(0.78, 0.66, 0.025)}`,
);

/** The internet: a globe, its equator, two parallels, and two meridians. */
const globe = device(
  ring(0.5, 0.6, 0.4),
  'M0.1 0.6H0.9M0.1536 0.4H0.8464M0.1536 0.8H0.8464M0.5 0.2V1'
    + 'M0.5 0.2A0.17 0.4 0 0 0 0.5 1A0.17 0.4 0 0 0 0.5 0.2',
);

/** A drive seen from above: its case, the platter on its spindle, and the arm swung over it from its pivot. */
const disk = device(
  'M0.1 0.42H0.9Q0.94 0.42 0.94 0.46V0.96Q0.94 1 0.9 1H0.1Q0.06 1 0.06 0.96V0.46Q0.06 0.42 0.1 0.42Z',
  `${ring(0.42, 0.71, 0.22)}${ring(0.42, 0.71, 0.03)}${ring(0.8, 0.53, 0.03)}M0.78 0.55L0.5 0.8`,
);

export const NETWORK_OUTLINES = {
  server, router, switch: switchDevice, firewall, laptop, desktop, phone, printer, user, globe, disk,
};
