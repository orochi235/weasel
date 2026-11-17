import { describe, expect, it } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from '../edge';
import { diagramScene } from '../fromData';
import { diagramColorOf, diagramFontSizeOf, setDiagramColor, setDiagramFontSize } from './applyTheme';
import { AB, themedScene } from './themeFixture';

const headed = () => createScene<unknown, 'main', RectPose>({
  systemLayers: [{ id: 'main' }],
  initial: diagramScene({
    nodes: [{ id: 'n', rows: [{ kind: 'header', text: 'Title' }, { kind: 'label', text: 'one' }] }], edges: [],
  }, { layout: 'none' }) as never,
  registry: withDiagramRegistry(),
});

describe('diagramColorOf', () => {
  it("reads a header shape's text color from the rows a text color reaches, not its header", () => {
    const scene = headed();
    setDiagramColor(scene, ['n'], 'fill', '#0000ff');
    expect(diagramColorOf(scene, 'n', 'text')).not.toBe('#0000ff');
    setDiagramColor(scene, ['n'], 'text', '#ff0000');
    expect(diagramColorOf(scene, 'n', 'text')).toBe('#ff0000');
    expect(diagramColorOf(scene, 'n', 'fill')).toBe('#0000ff');
  });

  it("reads a connector's label wherever its id puts it", () => {
    const scene = themedScene();
    const label = scene.get(`${AB}/label` as never)!;
    scene.remove(label.id);
    scene.add({ ...label, id: 'elsewhere' } as never);
    setDiagramColor(scene, [AB], 'text', '#00ff00');
    expect(diagramColorOf(scene, AB, 'text')).toBe('#00ff00');
  });

  it('reads nothing for a node that is not a shape or connector', () => {
    const scene = themedScene();
    expect(diagramColorOf(scene, `${AB}/label`, 'text')).toBeUndefined();
    expect(diagramFontSizeOf(scene, 'missing')).toBeUndefined();
  });
});

describe('diagramFontSizeOf', () => {
  it('reads the size setDiagramFontSize sets', () => {
    const scene = headed();
    setDiagramFontSize(scene, ['n'], 22);
    expect(diagramFontSizeOf(scene, 'n')).toBe(22);
  });
});
