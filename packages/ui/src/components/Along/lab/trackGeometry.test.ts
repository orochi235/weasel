import { expect, test } from 'vitest';
import { HANDLE_IDS, savedHandles } from './trackGeometry';

const all = Object.fromEntries(HANDLE_IDS.map((id) => [id, { x: 10, y: 20 }]));

test('saved handles read back only when every handle has a finite x and y', () => {
  expect(savedHandles(all)).toEqual(all);
  expect(savedHandles({ ...all, probe: { x: 10 } })).toBeNull();
  expect(savedHandles({ ...all, probe: { x: 10, y: null } })).toBeNull();
  expect(savedHandles({ ...all, probe: undefined })).toBeNull();
  expect(savedHandles('x')).toBeNull();
  expect(savedHandles(undefined)).toBeNull();
});
