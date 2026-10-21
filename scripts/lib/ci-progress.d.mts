export const WEIGHTS: URL;
export const LABEL: string;
export type Weights = Record<string, number>;
export interface Sample {
  t: number;
  frac: number;
}
export interface Deviation {
  mean: number;
  worst: number;
}
export function readWeights(url?: URL | string): Weights;
export function writeWeights(table: Weights, url?: URL | string): void;
export function planWeights(labels: string[], table: Weights): number[];
export function createBar(
  weights: number[],
  emit: (line: string) => void,
  options?: { every?: number; cap?: number; now?: () => number },
): {
  total: number;
  samples: Sample[];
  start(): void;
  begin(i: number): void;
  end(i: number): void;
  skip(i: number): void;
  finish(): Deviation;
};
export function deviation(samples: Sample[], span: number, points?: number): Deviation;
export function measured(log: string): Weights;
export function calibrate(table: Weights, log: string): Weights;
