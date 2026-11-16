/**
 * The example end to end, as a person uses it: insert a gem with its tool, edit it in the properties panel and
 * with the tint tool, undo and redo, save and load, and turn the feature off. Throws at the first step that
 * does not hold; `log` hears one line per step as it passes.
 */
import { act } from 'react';
import { buildSceneViewCommands, createScene, defaultDrawOne, findNodeShape, getNodeShapes, nodeShapesOf, sceneFromJSON, type FeaturePreset, type RectPose } from '@weasel-js/core';
import { GEM_BLUE, GEM_PALETTE, gemFeature, isGem, type GemData } from './index.js';
import { GemHost, click, drag, fieldLabeled, mount, newProbe, settle, typeInto, type GemScene, type Probe } from './host.js';
import { OneByOneGemCanvas } from './oneByOne.js';
import { drawPreset } from '@weasel-js/editing';

function check(holds: boolean, what: string): asserts holds {
  if (!holds) throw new Error(`gem scenario: expected ${what}`);
}

const ON: readonly FeaturePreset[] = [drawPreset, gemFeature];
const OFF: readonly FeaturePreset[] = [drawPreset];

const newScene = (): GemScene => createScene<unknown, 'default', RectPose>({ systemLayers: [{ id: 'default' }] });
const theGem = (scene: GemScene) => {
  const gems = [...scene.nodes.values()].filter((n) => isGem(n.data));
  check(gems.length === 1, `one gem in the scene, found ${gems.length}`);
  return gems[0]!;
};
const gemData = (scene: GemScene) => theGem(scene).data as GemData;
const paints = (scene: GemScene, color: string) =>
  JSON.stringify(buildSceneViewCommands(scene, { x: 0, y: 0, scale: { x: 1, y: 1 } }, defaultDrawOne)).includes(color);
const presetPainter = (scene: GemScene) => getNodeShapes(nodeShapesOf(scene)).some((e) => e.id === 'app:gem');
const processPainter = () => getNodeShapes().some((e) => e.id === 'app:gem');
const tools = (probe: Probe) => {
  check(probe.tools !== null, 'the canvas to have created its tools');
  return probe.tools;
};
/** Makes `id` the active tool, as a palette button does. */
const activate = (probe: Probe, id: string) => act(() => tools(probe).setActive(id));
const registered = (probe: Probe, id: string) => (probe.registry?.list() ?? []).some((a) => a.id === id);

export async function runGemScenario(log: (line: string) => void = () => {}): Promise<void> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const steps: [string, () => void | Promise<void>][] = [];
  const step = (name: string, run: () => void | Promise<void>) => steps.push([name, run]);

  const scene = newScene();
  const probe = newProbe();
  let app = mount(<GemHost scene={scene} features={ON} probe={probe} />);

  step('installs its painter, tools, and action', async () => {
    await settle();
    check(presetPainter(scene), "the scene's painters to hold the gem's");
    check(!processPainter(), 'the process-wide painters not to');
    check(tools(probe).has('gem') && tools(probe).has('tint'), 'the gem and tint tools');
    check(registered(probe, 'gem.tint'), 'gem.tint to be registered');
  });

  step('inserts a gem by dragging with its tool', () => {
    activate(probe, 'gem');
    drag(app.container, [0, 0], [100, 100]);
    const gem = theGem(scene);
    check(JSON.stringify(gem.data) === JSON.stringify({ gem: { color: GEM_BLUE, facets: 4 } }), `the factory's data, got ${JSON.stringify(gem.data)}`);
    const pose = gem.pose as RectPose;
    check(pose.x === 0 && pose.y === 0 && pose.width === 100 && pose.height === 100, `the dragged box, got ${JSON.stringify(pose)}`);
  });

  step('paints with its painter, and picks and selects by its outline', () => {
    check(findNodeShape(theGem(scene), nodeShapesOf(scene))?.id === 'app:gem', 'the gem painter to claim the node');
    check(paints(scene, GEM_BLUE), 'the frame to paint the gem blue');
    activate(probe, 'select');
    click(app.container, [3, 97]);
    check(probe.clicks.at(-1) === null, 'a click inside the box but off the outline to hit nothing');
    click(app.container, [50, 50]);
    const hit = probe.clicks.at(-1);
    check(hit?.id === theGem(scene).id && hit.kind === 'gem', `a click on the gem to hit it as kind gem, got ${JSON.stringify(hit)}`);
    check(scene.getSelection().includes(theGem(scene).id), 'the click to select it');
  });

  step('edits its facets in the properties panel', () => {
    typeInto(fieldLabeled(app.container, 'Facets'), '6');
    check(gemData(scene).gem.facets === 6, `six facets, got ${gemData(scene).gem.facets}`);
  });

  step('tints it by dragging with the tint tool, committing with no applyOps', () => {
    activate(probe, 'tint');
    drag(app.container, [50, 50], [98, 50]);
    check(gemData(scene).gem.color === GEM_PALETTE[2], `two steps along the palette, got ${gemData(scene).gem.color}`);
    check(paints(scene, GEM_PALETTE[2]), 'the frame to paint the new color');
  });

  step('undoes and redoes each edit', () => {
    check(scene.undo() && gemData(scene).gem.color === GEM_BLUE, 'undo to take the tint back');
    check(scene.undo() && gemData(scene).gem.facets === 4, 'undo to take the facets back');
    check(scene.redo() && gemData(scene).gem.facets === 6, 'redo to bring the facets back');
    check(scene.redo() && gemData(scene).gem.color === GEM_PALETTE[2], 'redo to bring the tint back');
  });

  let loaded!: GemScene;
  const loadedProbe = newProbe();
  step('saves, loads, and goes on editing the loaded scene', async () => {
    const saved: string = JSON.stringify(scene.toJSON());
    loaded = sceneFromJSON<unknown, 'default', RectPose>(JSON.parse(saved));
    app.unmount();
    app = mount(<GemHost scene={loaded} features={ON} probe={loadedProbe} />);
    await settle();
    check(JSON.stringify(gemData(loaded)) === JSON.stringify(gemData(scene)), 'the loaded gem to hold what was saved');
    check(paints(loaded, GEM_PALETTE[2]), 'the loaded gem to paint');
    activate(loadedProbe, 'select');
    click(app.container, [50, 50]);
    check(loadedProbe.clicks.at(-1)?.kind === 'gem', 'the loaded gem to pick as kind gem');
    activate(loadedProbe, 'tint');
    drag(app.container, [50, 50], [74, 50]);
    check(gemData(loaded).gem.color === GEM_PALETTE[3], `one more step, got ${gemData(loaded).gem.color}`);
  });

  step('turned off, unregisters everything it installed', async () => {
    app.render(<GemHost scene={loaded} features={OFF} probe={loadedProbe} />);
    await settle();
    check(!tools(loadedProbe).has('gem') && !tools(loadedProbe).has('tint'), 'no gem or tint tool');
    check(!registered(loadedProbe, 'gem.tint'), 'gem.tint to be unregistered');
    check(!presetPainter(loaded), "the scene's painters to have dropped the gem's");
    check(!paints(loaded, GEM_PALETTE[3]), 'the gem not to paint');
    activate(loadedProbe, 'select');
    click(app.container, [50, 50]);
    check(loadedProbe.clicks.at(-1)?.kind !== 'gem', 'nothing to route as kind gem');
    app.unmount();
  });

  step('installed one by one, releases its process-wide painter on unmount', async () => {
    const plain = newScene();
    const plainProbe = newProbe();
    const canvas = mount(<OneByOneGemCanvas scene={plain} onToolsCreated={plainProbe.sawTools} />);
    await settle();
    check(processPainter(), 'the process-wide painters to hold the gem painter');
    activate(plainProbe, 'gem');
    drag(canvas.container, [0, 0], [100, 100]);
    check(findNodeShape(theGem(plain))?.id === 'app:gem', 'the inserted gem to paint with it');
    canvas.unmount();
    check(!processPainter(), 'the painter to be released');
  });

  for (const [i, [name, run]] of steps.entries()) {
    await run();
    log(`ok ${i + 1}/${steps.length} ${name}`);
  }
}
