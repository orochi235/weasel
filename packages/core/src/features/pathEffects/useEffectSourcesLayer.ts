/**
 * The layer that shows what a selected path effect was made from: the outlines
 * of the sources it hides, drawn faintly under the selection chrome.
 */
import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { DrawCommand } from '@weasel-js/renderer';
import { PATH_OVERLAY_ROLES } from 'canvas/pathOverlay';
import { sceneDepLookup } from 'canvas/derivedPath';
import { chromeStateFrom } from 'canvas/drawEnvelope';
import type { RenderLayer } from 'core/layers/render';
import { sourcesHiddenBy } from './effectSources';
import type { NodeId, Scene } from 'core/scene/types';
import { readEffectSource } from './readSource';

const FAINT = 0.4;

/** For each selected path-effect node, the outlines of the sources it holds hidden (`sourcesHiddenBy`) as the effect
 *  reads them, in a one-screen-pixel stroke of the `'chrome'` overlay color at 40% opacity. The selection comes off the draw envelope. */
export function useEffectSourcesLayer<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): RenderLayer<unknown> {
  const sceneRef = useLatest(scene);
  return useMemo<RenderLayer<unknown>>(() => ({
    id: 'effect-sources',
    label: 'Hidden effect sources',
    space: 'world',
    draw: (data) => {
      const selected = chromeStateFrom(data)?.selection ?? [];
      const sc = sceneRef.current;
      const stroke = PATH_OVERLAY_ROLES['chrome']!.stroke!;
      const depOf = sceneDepLookup(sc);
      const lines: DrawCommand[] = [];
      for (const id of selected) {
        for (const source of sourcesHiddenBy(sc, id as NodeId)) {
          if (!sc.isHidden(source)) continue;
          const dep = depOf(source);
          const path = dep === undefined ? null : readEffectSource(dep as never)?.world ?? null;
          if (path !== null) lines.push({ kind: 'path', path, stroke: { paint: stroke, width: { px: 1 } } });
        }
      }
      return lines.length === 0 ? [] : [{ kind: 'group', alpha: FAINT, children: lines }];
    },
  }), [sceneRef]);
}
