/** One step of a workflow job that runs a command. */
export interface CiStep {
  run: string;
  env: Record<string, string>;
  if?: string;
}
export function readCi(text: string): { env: Record<string, string>; steps: CiStep[] };
export function sourceChecks(steps: CiStep[]): string[][];
export function builtSteps(steps: CiStep[], nodeMajor: number): CiStep[];
export const CI_YML: URL;
