export const BUILD_ORDER: string[];
export function buildInOrder(names: string[], build: (name: string) => number): { name: string; code: number } | null;
