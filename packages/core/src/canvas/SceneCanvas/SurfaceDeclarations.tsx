import { CanvasView, type CanvasViewProps } from '../CanvasView';
import { ViewMarker } from '../ViewMarker';
import type { SurfaceContribution } from '../surfaceContribution';

/** The views and markers a `<SceneCanvas>` declares on its surface: its
 *  `views` prop, its contributions' views, views added through the handle,
 *  then its contributions' markers. */
export function SurfaceDeclarations({ views, entries, added }: {
  views: readonly CanvasViewProps[] | undefined;
  entries: readonly SurfaceContribution[];
  added: readonly CanvasViewProps[];
}) {
  return (
    <>
      {views?.map((v, i) => <CanvasView key={v.id} {...v} order={v.order ?? i} />)}
      {entries.flatMap((e) => e.views ?? []).map((v) => <CanvasView key={`contribution:${v.id}`} {...v} />)}
      {added.map((v) => <CanvasView key={`added:${v.id}`} {...v} />)}
      {entries.flatMap((e) => e.markers ?? []).map((m) => <ViewMarker key={`contribution:${m.id}`} {...m} />)}
    </>
  );
}
