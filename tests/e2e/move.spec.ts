import { test, expect } from './fixtures';

interface RectPose { x: number; y: number; width: number; height: number }

test('move — drag translates the dragged item by the gesture delta', async ({ demo }) => {
  await demo.goto('move');
  const before = await demo.getScene();
  const a = before.nodes.find((n) => n.id === 'a');
  expect(a, 'demo seeds item with id "a"').toBeTruthy();
  const pose = a!.pose as RectPose;
  const center: [number, number] = [pose.x + pose.width / 2, pose.y + pose.height / 2];

  await demo.dragScene({ from: center, by: [80, 40] });

  const after = await demo.getScene();
  const aAfter = after.nodes.find((n) => n.id === 'a')!;
  const poseAfter = aAfter.pose as RectPose;
  // Snap is on (20-unit tiles), so tolerate snap-to-grid: expect within one tile.
  expect(Math.abs(poseAfter.x - (pose.x + 80))).toBeLessThanOrEqual(20);
  expect(Math.abs(poseAfter.y - (pose.y + 40))).toBeLessThanOrEqual(20);

  // The non-dragged item must not have moved.
  const bBefore = before.nodes.find((n) => n.id === 'b')!.pose as RectPose;
  const bAfter = after.nodes.find((n) => n.id === 'b')!.pose as RectPose;
  expect(bAfter).toEqual(bBefore);
});
