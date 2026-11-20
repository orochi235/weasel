import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type LightboxLayerSet, LightboxLayers, useLightboxLayers } from '../lightbox/LightboxLayers';
import { SurfaceCanvasContext, SurfaceContext } from '../surface/SurfaceContext';
import type { SurfaceHandle } from '../surface/useTiledSurface';
import { LabSurface } from './LabSurface';

describe('LabSurface', () => {
  it("leaves a host surface's lightbox layers in force for the lab's trials", () => {
    const under = document.createElement('div');
    const over = document.createElement('div');
    const host = { below: [under], above: [over] };
    const surface = {
      getContainer: () => over,
      registerTile: () => {},
      registerClear: () => () => {},
      invalidateAll: () => {},
    } as unknown as SurfaceHandle;
    let seen: LightboxLayerSet | null = null;
    function Probe() {
      seen = useLightboxLayers();
      return null;
    }
    render(
      <SurfaceContext.Provider value={surface}>
        <SurfaceCanvasContext.Provider value={{ over: null, under: null, top: null, claimTop: () => () => {} }}>
          <LightboxLayers below={host.below} above={host.above}>
            <LabSurface bodyRef={() => {}}>
              <Probe />
            </LabSurface>
          </LightboxLayers>
        </SurfaceCanvasContext.Provider>
      </SurfaceContext.Provider>,
    );
    expect(seen).toEqual(host);
  });

  it('declares its own buffers as the layers a lightbox lifts', () => {
    let seen: LightboxLayerSet | null = null;
    function Probe() {
      seen = useLightboxLayers();
      return null;
    }
    const { container } = render(
      <LabSurface bodyRef={() => {}}>
        <Probe />
      </LabSurface>,
    );
    expect(seen).toEqual({
      below: [container.querySelector('.lk-lab__layer--under')],
      above: [container.querySelector('.lk-lab__layer--over')],
    });
  });
});
