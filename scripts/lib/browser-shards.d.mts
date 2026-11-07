export function browserProcesses(cores: number): number;
export function browserShards(argv: string[], n: number): string[][];
export const DURATIONS_ENV: string;
export function balancedSlices(ids: string[], durations: Record<string, number>, count: number): { ids: string[]; ms: number }[];
export function recordedDurations(root: string, project?: string): Record<string, number>;
export function sliceId(project: string, file: string): string;
export function durationsEnv(root: string, env?: Record<string, string | undefined>): Record<string, string>;
