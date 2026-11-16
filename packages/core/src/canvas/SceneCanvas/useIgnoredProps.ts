import { useEffect, useRef } from 'react';
import { isDev } from '@weasel-js/react';
import type { SceneCanvasProps } from './props';
import { isToolsApi } from './useCanvasTools';

type Props = Pick<
  SceneCanvasProps<unknown, string, unknown>,
  'tools' | 'defaultTools' | 'defaultActiveTool' | 'ambient' | 'selectTool' | 'geometry'
>;

/** The props set on `props` that another prop overrides: those a `ToolsApi` in `tools` takes over, and `picking`
 *  under `pickEvery`. */
export function ignoredProps(props: Props): { underTakeover: string[]; underPickEvery: string[] } {
  const underTakeover: string[] = [];
  if (props.tools && isToolsApi(props.tools)) {
    if (props.defaultTools?.length) underTakeover.push('defaultTools');
    if (props.defaultActiveTool !== undefined) underTakeover.push('defaultActiveTool');
    if (props.ambient?.length) underTakeover.push('ambient');
    if (props.selectTool?.pickBest) underTakeover.push('selectTool.pickBest');
  }
  const underPickEvery = props.geometry?.pickEvery && props.geometry.picking !== undefined ? ['geometry.picking'] : [];
  return { underTakeover, underPickEvery };
}

/** Warns, in development and once per canvas, about props another prop makes the canvas ignore. */
export function useIgnoredProps(props: Props): void {
  const warned = useRef({ takeover: false, pickEvery: false });
  const { underTakeover, underPickEvery } = ignoredProps(props);
  const takeoverKey = underTakeover.join(', ');
  const pickEveryKey = underPickEvery.join(', ');
  useEffect(() => {
    if (!isDev()) return;
    if (takeoverKey && !warned.current.takeover) {
      warned.current.takeover = true;
      console.warn(
        `[SceneCanvas] \`tools\` is a ToolsApi, which takes over the canvas's tools, so ${takeoverKey} ` +
        `${underTakeover.length > 1 ? 'are' : 'is'} ignored. Configure them on your own \`useTools\` call instead.`,
      );
    }
    if (pickEveryKey && !warned.current.pickEvery) {
      warned.current.pickEvery = true;
      console.warn('[SceneCanvas] `geometry.picking` is ignored because `geometry.pickEvery` is set: that override owns the hit test. Drop one of them.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeoverKey, pickEveryKey]);
}
