import type { RenderLayer, SnapSource } from '@weasel-js/core';
import {
  createGuidesLayer, createRulers, guideSnapSource, useGuides, type Rulers, type RulersOptions, type RulersSettings,
} from '@weasel-js/guides';
import { useMemo } from 'react';

/** What {@link useEditorRulers} reads: the rulers' settings and their setter, and how the rulers read the
 *  document. `root` and `lengths` are kept by identity, so pass constants. */
export interface EditorRulersOptions extends Pick<RulersOptions, 'root' | 'lengths' | 'origin' | 'size'> {
  /** A `rulersSchema` group's values, as the app's prefs hold them. */
  settings: RulersSettings;
  setSettings: (next: RulersSettings) => void;
}

/** The rulers, their guides, and the toggle between showing and hiding them. */
export interface EditorRulers {
  visible: boolean;
  toggle: () => void;
  /** Install its `contribution` on the canvas and draw `<Rulers>` over it while shown; null while hidden. */
  rulers: Rulers | null;
  /** The guides dragged off the rulers, drawn whether or not the rulers are shown. */
  layer: RenderLayer<unknown>;
  /** Snaps to those guides; hand it to the canvas's snapping. */
  snapSource: SnapSource;
}

/**
 * An editor's rulers and the guides dragged off them, shown while `settings.visible` is on. The guides live as
 * long as the component; a document does not save them. Each keeps its identity until its inputs change.
 */
export function useEditorRulers({ settings, setSettings, root, lengths, origin, size }: EditorRulersOptions): EditorRulers {
  const { visible } = settings;
  const { addGuide, removeGuide, getGuides, subscribe } = useGuides();
  const rulers = useMemo(
    () => createRulers({
      guides: { addGuide, removeGuide, getGuides }, root,
      ...(lengths !== undefined ? { lengths } : {}), ...(origin !== undefined ? { origin } : {}), ...(size !== undefined ? { size } : {}),
    }),
    [addGuide, removeGuide, getGuides, root, lengths, origin, size],
  );
  const layer = useMemo(
    () => createGuidesLayer({ getGuides: () => rulers.settled(getGuides()), subscribe, extent: 'full' }),
    [rulers, getGuides, subscribe],
  );
  const snapSource = useMemo(() => guideSnapSource({ getGuides }), [getGuides]);
  return {
    visible,
    toggle: () => setSettings({ ...settings, visible: !visible }),
    rulers: visible ? rulers : null,
    layer,
    snapSource,
  };
}
