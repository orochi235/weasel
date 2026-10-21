/**
 * `<ViewMarker>` — one view's aim, outlined inside another view's frame: a
 * minimap's indicator, a picture-in-picture's footprint on the main view.
 */
import { useCallback, useEffect } from 'react';
import { useLatest } from '@weasel-js/react';
import type { ViewMarkerProps } from 'features/viewports/viewMarker';
import { useOptionalViewRegistry } from './viewRegistry';

/**
 * Draws one view's aim inside another's frame, after that view's own layers.
 *
 * Renders nothing; outside a surface it is inert. Either view may mount after
 * the marker does: until both are there it draws nothing.
 */
export function ViewMarker(props: ViewMarkerProps): null {
  const registry = useOptionalViewRegistry();
  const live = useLatest(props);
  const read = useCallback(() => live.current, [live]);
  const { id, target } = props;

  // Which stack the marker is listed in, and its layer's id, are fixed at
  // registration; everything else is read off `live` at draw time.
  useEffect(() => registry?.registerMarker(read), [registry, read, id, target]);

  useEffect(() => {
    registry?.surface()?.requestRedraw();
  });

  return null;
}
