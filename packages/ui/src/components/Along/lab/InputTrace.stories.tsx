import { f, meta, story } from '@weasel-js/forge';
import { InputTraceView, type InputTraceConfig } from './InputTraceView';

export default meta({ title: 'ui/Along', layout: 'fullscreen', tags: ['lab'] });

/** Every pointer, wheel, focus and key event on a curved bar and slider, and the order Tab steps through them. */
export const InputTrace = story({
  config: f.schema({
    actions: f.number(10).range(1, 10).step(1).label('Actions'),
    overflow: f.enum('scroll', ['scroll', 'menu']).radio().label('Overflow'),
    slider: f.boolean(true).label('Zoom slider'),
    log: f.group({
      pointer: f.boolean(true).label('Pointer'),
      moves: f.boolean(false).label('Pointer moves'),
      wheel: f.boolean(true).label('Wheel'),
      focus: f.boolean(true).label('Focus'),
      keys: f.boolean(true).label('Keys'),
    }).label('Log'),
  }),
  render: ({ config }) => <InputTraceView config={config as InputTraceConfig} />,
});
