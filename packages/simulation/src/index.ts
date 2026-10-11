/**
 * @weasel-js/simulation — a velocity-Verlet N-body integrator over forces in
 * d3-force's protocol. Nothing here needs React or a DOM; the frame-loop hook
 * is in `@weasel-js/simulation/react`.
 */
export { createSimulation } from './createSimulation';
export type {
  Simulation,
  SimulationCore,
  SimulationForce,
  SimulationNode,
  SimulationOptions,
  UseSimulationOptions,
} from './types';
export {
  DEFAULT_ALPHA_DECAY,
  DEFAULT_ALPHA_MIN,
  DEFAULT_VELOCITY_DECAY,
} from './types';
