import { meta, story } from '@weasel-js/forge';
import { loadInto } from '../../Along/lab/Presets';
import { BAR_ARC_SCHEMA, type BarArcConfig } from './barArcSchema';
import { BarArcView } from './BarArcView';

/** A bar along an arc: built item lists, scroll and menu overflow, align and sweep, read back off the page. */
export default meta({ title: 'ui/Along/Bar on an arc', layout: 'fullscreen' });

export const Lab = story({
  config: BAR_ARC_SCHEMA,
  render: ({ config, setConfig }) => <BarArcView config={config as BarArcConfig} onPreset={(p) => loadInto(setConfig, p.config)} />,
});
