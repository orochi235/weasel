import { test, expect } from './fixtures';
import { sceneToCss } from './helpers/coords';

test('zoom — wheel zoom keeps the cursor-anchored scene point pinned', async ({ demo }) => {
  await demo.goto('zoom');

  const viewBefore = await demo.getView();
  // Pick an off-center scene point so anchor regressions are visible.
  const scenePoint: [number, number] = [120, 90];

  const rectBefore = await demo.page.locator('canvas').last().boundingBox();
  expect(rectBefore).toBeTruthy();
  const rectBeforeCss = {
    left: rectBefore!.x,
    top: rectBefore!.y,
    width: rectBefore!.width,
    height: rectBefore!.height,
  };
  const [cssX, cssY] = sceneToCss(scenePoint, viewBefore, rectBeforeCss);

  // ZoomDemo binds zoom to ⌘+wheel (mod = Meta on Mac, Ctrl elsewhere); plain
  // wheel pans. Use ControlOrMeta so this works on both platforms.
  await demo.page.mouse.move(cssX, cssY);
  await demo.page.keyboard.down('ControlOrMeta');
  await demo.page.mouse.wheel(0, -200); // negative deltaY = zoom in
  await demo.page.keyboard.up('ControlOrMeta');

  const viewAfter = await demo.getView();
  expect(viewAfter.scale.x).toBeGreaterThan(viewBefore.scale.x);

  // After zoom, the same scene point should map to a CSS position near (cssX, cssY).
  const rectAfter = await demo.page.locator('canvas').last().boundingBox();
  const rectAfterCss = {
    left: rectAfter!.x,
    top: rectAfter!.y,
    width: rectAfter!.width,
    height: rectAfter!.height,
  };
  const [cssX2, cssY2] = sceneToCss(scenePoint, viewAfter, rectAfterCss);
  expect(Math.abs(cssX2 - cssX)).toBeLessThanOrEqual(1);
  expect(Math.abs(cssY2 - cssY)).toBeLessThanOrEqual(1);
});
