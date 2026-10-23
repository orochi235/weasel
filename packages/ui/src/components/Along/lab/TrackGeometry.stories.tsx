import { f, meta, story } from '@weasel-js/forge';
import { TrackGeometryView, type TrackGeometryConfig } from './TrackGeometryView';

export default meta({ title: 'ui/Along', layout: 'fullscreen', tags: ['lab'] });

/** An arc edited by handles on a canvas, and what geom's track functions say about it. */
export const TrackGeometry = story({
  config: f.schema({
    direction: f.enum('cw', ['cw', 'ccw']).radio().label('Direction'),
    stations: f.number(7).range(2, 25).step(1).label('Stations'),
  }),
  render: ({ config, setConfig }) => (
    <TrackGeometryView
      config={config as TrackGeometryConfig}
      onConfig={(patch) => {
        for (const [key, value] of Object.entries(patch)) setConfig(key, value);
      }}
    />
  ),
});
