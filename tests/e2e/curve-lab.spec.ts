import { test, expect } from './fixtures';

interface SharedAnchorEcho { x: number; y: number; weight?: number; spiroType?: string }
interface LabProbe { anchors: SharedAnchorEcho[]; presetId: string }

test('curve lab — preset switch updates the shared anchor state', async ({ demo }) => {
  await demo.goto('curve-lab');
  const initial = (await demo.probe<LabProbe>('curveLab'))!;
  expect(initial).toBeTruthy();
  expect(initial.presetId).toBe('smooth-s');
  const initialCount = initial.anchors.length;

  await demo.page.selectOption('select', 'sharp-corner');

  const after = (await demo.probe<LabProbe>('curveLab'))!;
  expect(after.presetId).toBe('sharp-corner');
  expect(after.anchors.length).toBe(5);
  expect(after.anchors.length).not.toBe(initialCount);
  expect(after.anchors.some((a) => a.spiroType === 'corner')).toBe(true);
});

test('curve lab — all four panels render their representation labels', async ({ demo }) => {
  await demo.goto('curve-lab');
  // Labels live inside .curve-lab-panel-title divs (one per panel).
  const labels = await demo.page.locator('.curve-lab-panel-title').allTextContents();
  expect(labels.some((l) => l.startsWith('Cubic Bezier'))).toBe(true);
  expect(labels.some((l) => l.startsWith('Quadratic Bezier'))).toBe(true);
  expect(labels.some((l) => l.startsWith('NURBS'))).toBe(true);
  expect(labels.some((l) => l.startsWith('Spiro'))).toBe(true);
});
