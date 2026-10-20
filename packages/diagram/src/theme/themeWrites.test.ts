import { describe, expect, it } from 'vitest';
import { themeWrites, type ThemedScene } from './themeWrites';
import { DIAGRAM_THEMES } from './themes';
import { AB, BC, themedScene } from './themeFixture';

const blueprint = DIAGRAM_THEMES.blueprint!;
type Painted = { fill?: { paint: { color: string } }; stroke?: { paint: { color: string } }; style?: { fontFamily: string; fontSize: number } };
const writesOf = (ids?: ReadonlySet<string>) => {
  const scene = themedScene();
  return { scene, writes: themeWrites(scene as unknown as ThemedScene, blueprint, ids) as Map<string, Painted> };
};

describe('themeWrites', () => {
  it('colors a shape by its role, and one naming none by the default role', () => {
    const { writes } = writesOf();
    expect(writes.get('a')!.fill!.paint.color).toBe(blueprint.roles.accent!.fill);
    expect(writes.get('a')!.stroke!.paint.color).toBe(blueprint.roles.accent!.stroke);
    expect(writes.get('c')!.fill!.paint.color).toBe(blueprint.roles.default!.fill);
  });

  it('leaves a color the author set by hand, and still writes the rest', () => {
    const { writes } = writesOf();
    expect(writes.get('b')!.fill!.paint.color).toBe('#123456');
    expect(writes.get('b')!.stroke!.paint.color).toBe(blueprint.roles.default!.stroke);
  });

  it("sets each text row in its shape's text color and the theme's family, keeping the row's size", () => {
    const { scene, writes } = writesOf();
    const rows = scene.childrenOf('b' as never);
    expect(rows.length).toBe(2);
    for (const id of rows) {
      const before = scene.get(id)!.data as Painted;
      const row = writes.get(id)!;
      expect(row.fill!.paint.color).toBe(blueprint.roles.default!.text);
      expect(row.style!.fontFamily).toBe(blueprint.font.family);
      expect(row.style!.fontSize).toBe(before.style!.fontSize);
    }
  });

  it('recolors connectors and their labels', () => {
    const { writes } = writesOf();
    expect(writes.get(AB)!.stroke!.paint.color).toBe(blueprint.edge.stroke);
    expect(writes.get(BC)!.stroke!.paint.color).toBe(blueprint.edge.stroke);
    expect(writes.get(`${AB}/label`)!.fill!.paint.color).toBe(blueprint.label.fill);
  });

  it('recolors a group box as a container, and its title in the container text color', () => {
    const { writes } = writesOf();
    expect(writes.get('g')!.fill!.paint.color).toBe(blueprint.container.fill);
    expect(writes.get('g')!.stroke!.paint.color).toBe(blueprint.container.stroke);
    expect(writes.get('g/label')!.fill!.paint.color).toBe(blueprint.container.text);
  });

  it('given ids, writes only those shapes and what belongs to them', () => {
    const { scene, writes } = writesOf(new Set(['a']));
    expect([...writes.keys()].sort()).toEqual(['a', ...scene.childrenOf('a' as never)].sort());
  });

  it('writes nothing a second time', () => {
    const scene = themedScene();
    for (const [id, data] of themeWrites(scene as unknown as ThemedScene, blueprint)) scene.update(id as never, { data });
    expect(themeWrites(scene as unknown as ThemedScene, blueprint).size).toBe(0);
  });
});
