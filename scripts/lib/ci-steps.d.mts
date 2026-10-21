/** One step of a workflow job that runs a command. */
export interface CiStep {
  run: string;
  env: Record<string, string>;
  if?: string;
}
export function readCi(text: string): { env: Record<string, string>; nodes: number[]; steps: CiStep[] };
export function sourceChecks(steps: CiStep[]): string[][];
export function builtSteps(steps: CiStep[], nodeMajor: number): CiStep[];
export function jobSteps(steps: CiStep[], nodeMajor: number): CiStep[];
export function offFleetNodes(nodes: number[], nvmrc: string): number[];
export const CI_YML: URL;
