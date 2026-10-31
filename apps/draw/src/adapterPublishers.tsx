import { type NoticesDep, type SelectionApi, useBooleansAdapter, useCreateOutlinesAdapter, useNotices } from '@weasel-js/core';
import { toast } from '@weasel-js/ui/components/Toast';
import { useMemo } from 'react';
import { drawBooleansAdapter } from './booleansAdapter';
import type { DrawScene } from './drawDocument';
import { drawOutlinesAdapter } from './outlinesAdapter';

/** Publishes a `BooleansAdapter` as a dep so the kit's Pathfinder
 *  descriptors can read selection and execute boolean ops on WeaselDraw nodes.
 *  Must live inside `<SceneCanvas>` since `useBooleansAdapter` calls
 *  `useDepSource`, which requires the surrounding `<DepRegistryProvider>`. */
export function BooleansAdapterPublisher({
  scene,
  selection,
}: {
  scene: DrawScene;
  selection: SelectionApi;
}): null {
  const adapter = useMemo(
    () => drawBooleansAdapter(scene, selection.adapterMethods),
    [scene, selection],
  );
  useBooleansAdapter(adapter);
  return null;
}

/** Publishes the adapter the kit's `createOutlines` and `outlineStroke`
 *  actions convert text and strokes through. */
export function CreateOutlinesAdapterPublisher({
  scene,
  selection,
}: {
  scene: DrawScene;
  selection: SelectionApi;
}): null {
  const adapter = useMemo(
    () => drawOutlinesAdapter(scene, selection.adapterMethods),
    [scene, selection],
  );
  useCreateOutlinesAdapter(adapter);
  return null;
}

/** What a kit action tells the user, raised as a warning toast. */
const DRAW_NOTICES: NoticesDep = { warn: (title, opts) => { toast.warn(title, opts); } };

/** Publishes draw's toasts as the `notices` dep. */
export function NoticesPublisher(): null {
  useNotices(DRAW_NOTICES);
  return null;
}
