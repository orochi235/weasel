export interface FleetNode {
  name: string;
  online: boolean;
  free: number;
  cores: number;
  barred: string;
}
export interface Reading {
  gpu: number | null;
  idle: number | null;
}
export const IDLE_WINDOW_S: number;
export function inQuietHours(span: string, now?: Date): boolean;
export function parseStatus(text: string, now?: Date): FleetNode[];
export function parseProbe(text: string): Reading;
export function gpuReady(reading: Reading | null): boolean;
export function rankForBrowser(probed: { node: FleetNode; reading: Reading | null }[]): (FleetNode & Reading)[];
export function usableNodes(nodes: FleetNode[], options?: { avoid?: string[]; minFree?: number }): FleetNode[];
export function fleetNodes(): Promise<FleetNode[]>;
export function rankForRest(probed: { node: FleetNode; reading: Reading | null }[]): (FleetNode & Reading)[];
export function placeParts(options?: {
  avoid?: string[];
  minFree?: number;
  timeoutMs?: number;
}): Promise<{ browser: (FleetNode & Reading) | undefined; rest: (FleetNode & Reading) | undefined; readings: string }>;
