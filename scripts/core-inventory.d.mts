export type Inventory = Record<string, Record<string, string>>;
export const INVENTORY: string;
export function entryPoints(): Record<string, string>;
export function collectInventory(): Inventory;
export function diffInventory(recorded: Inventory, actual: Inventory): string[];
export function formatInventory(inventory: Inventory): string;
