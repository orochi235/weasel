import { meta, story } from '@weasel-js/forge';
import { loadInto } from '../../Along/lab/Presets';
import { SLIDER_ARC_SCHEMA, type SliderArcConfig } from './sliderArcSchema';
import { SliderArcView } from './SliderArcView';

/** Every Slider prop on an arc, beside a straight twin given the same props and value. */
export default meta({ title: 'ui/Along/Slider on an arc', layout: 'fullscreen' });

export const Lab = story({
  config: SLIDER_ARC_SCHEMA,
  render: ({ config, setConfig }) => (
    <SliderArcView config={config as SliderArcConfig} onPreset={(p) => loadInto(setConfig, p.config)} />
  ),
});
