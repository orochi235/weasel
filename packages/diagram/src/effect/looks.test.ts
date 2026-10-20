import { describe, expect, it } from 'vitest';
import type { EffectLook } from './draw';
import { compact } from './compact';
import { diagramScene } from '../fromData';
import { DIAGRAM_THEMES } from '../theme/themes';
import type { DiagramTheme } from '../theme/types';
import { laneId, lanes } from './lanes';
import { EFFECT_LOOKS } from './looks';
import { nodeGraph } from './nodeGraph';
import { rack } from './rack';
import { SKIP } from './skipFixture';

describe('EffectLook', () => {
  // The typecheck is the test: looks with different options share one list type.
  it('holds looks with different options in one list, no cast', () => {
    const looks: EffectLook[] = [nodeGraph, rack, lanes, compact];
    const shipped: readonly EffectLook[] = Object.values(EFFECT_LOOKS);
    for (const look of [...looks, ...shipped]) expect(look(SKIP).data.nodes.length).toBeGreaterThan(0);
  });
});

describe('a look under a theme', () => {
  const pipeline = { ...SKIP, stages: SKIP.stages.map((s) => (s.id === 'mix' ? { ...s, bypassed: true } : s)) };
  type Painted = { fill?: { paint: { color: string } }; stroke?: { paint: { color: string }; dash?: number[] } };
  const drawn = (look: EffectLook<{ theme?: DiagramTheme }>, theme?: DiagramTheme) => {
    const { data, scene, color } = look(pipeline, theme ? { theme } : {});
    return { specs: new Map(diagramScene(data, scene).map((s) => [s.id as string, s.data as Painted])), color };
  };

  it("gives today's colors under night, and the same with no theme", () => {
    const night = DIAGRAM_THEMES.night!;
    for (const look of Object.values(EFFECT_LOOKS) as EffectLook<{ theme?: DiagramTheme }>[]) {
      const { specs, color } = drawn(look, night);
      expect([...specs]).toEqual([...drawn(look).specs]);
      expect(specs.get('blur')!.fill!.paint.color).toBe('#16222c');
      expect(specs.get('blur')!.stroke!.paint.color).toBe('#3d566b');
      expect(specs.get('mix')!.fill!.paint.color).toBe('#121a21');
      expect(specs.get('mix')!.stroke!.dash).toEqual([4, 3]);
      expect(color('image')).toBe('#6fb3ff');
      expect(color('number')).toBe('#c58bff');
    }
    expect(drawn(lanes, night).specs.get(laneId('image'))!.fill!.paint.color).toBe('rgba(255, 255, 255, 0.035)');
  });

  it("takes another theme's roles, series, and lane bodies", () => {
    const pastel = DIAGRAM_THEMES.pastel!;
    const { specs, color } = drawn(lanes, pastel);
    expect(specs.get('blur')!.fill!.paint.color).toBe(pastel.roles.default!.fill);
    expect(specs.get('mix')!.fill!.paint.color).toBe(pastel.roles.muted!.fill);
    expect(color('image')).toBe(pastel.series[0]);
    expect(specs.get(laneId('image'))!.fill!.paint.color).toBe(pastel.lane.bodies[0]!.fill);
  });
});
