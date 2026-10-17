import { expect, it } from 'vitest';
import { sourceTablesUnder } from './tables';

it("leaves the plugin's own test fixtures out of the tables a dev server serves", () => {
  expect(sourceTablesUnder(import.meta.dirname).map((t) => t.namespace)).toEqual([]);
});
