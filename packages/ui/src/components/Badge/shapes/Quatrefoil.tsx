import type { ShapeModule, ShapeComposeSpec } from '../types';

export interface QuatrefoilParams {
  spikeR?: number;
  lobeR?: number;
  valleyR?: number;
  valleyAt?: number;
  spikeCurvature?: number;
  spikeBend?: number;
  spikeTipErosion?: number;
  lobeCurvature?: number;
  lobeBend?: number;
  lobeTipErosion?: number;
  valleySmooth?: number;
  rotation?: number;
  samples?: number;
}

const DEFAULTS: Required<QuatrefoilParams> = {
  spikeR: 50,
  lobeR: 42,
  valleyR: 25,
  valleyAt: 0.5,
  spikeCurvature: 1,
  spikeBend: 0,
  spikeTipErosion: 0,
  lobeCurvature: 1,
  lobeBend: 0,
  lobeTipErosion: 0,
  valleySmooth: 3,
  rotation: 0,
  samples: 192,
};

const Quatrefoil: ShapeModule<QuatrefoilParams> = {
  compose: (params): ShapeComposeSpec => {
    const cfg = { ...DEFAULTS, ...params };
    return { base: 'quatrefoil', baseParams: cfg };
  },
  insets: { top: 10, right: 14, bottom: 10, left: 14 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Quatrefoil;
