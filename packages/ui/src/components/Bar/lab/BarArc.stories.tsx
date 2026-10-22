import { f, meta, story } from '@weasel-js/forge';
import { LAB_ACTIONS } from '../../Along/lab/labActions';
import { loadInto } from '../../Along/lab/Presets';
import { BAR_ARC_DEFAULTS as D, type BarArcConfig } from './barArcConfig';
import { BarArcView } from './BarArcView';

/** A bar along an arc: built item lists, scroll and menu overflow, align and sweep, read back off the page. */
export default meta({ title: 'ui/Along/Bar on an arc', layout: 'fullscreen' });

export const Lab = story({
  config: f.schema({
    items: f.group({
      actions: f.number(D.items.actions).range(0, LAB_ACTIONS.length).step(1).label('Actions'),
      fields: f.number(D.items.fields).range(0, 4).step(1).label('Fields'),
      section: f.boolean(D.items.section).label('Fields in a section of their own'),
      lead: f.enum(D.items.lead, ['none', 'label', 'icon']).radio().label('Lead'),
    }).label('Items'),
    layout: f.group({
      overflow: f.enum(D.layout.overflow, ['scroll', 'menu']).radio().label('Overflow'),
      align: f.enum(D.layout.align, ['start', 'center', 'end']).radio().label('Align'),
    }).label('Layout'),
    arc: f.group({
      center: f.number(D.arc.center).range(0, 359).step(1).suffix('°').label('Centered on'),
      measure: f.enum(D.arc.measure, ['deg', 'px']).radio().label('Span in'),
      sweep: f.number(D.arc.sweep).range(10, 359).step(1).suffix('°').label('Sweep'),
      length: f.number(D.arc.length).range(40, 800).step(10).suffix('px').label('Length'),
      direction: f.enum(D.arc.direction, ['cw', 'ccw']).radio().label('Direction'),
      inset: f.number(D.arc.inset).range(0, 80).step(1).suffix('px').label('Inset'),
      size: f.number(D.arc.size).range(160, 420).step(10).suffix('px').label('Box'),
    }).label('Arc'),
    debug: f.group({
      boxes: f.boolean(D.debug.boxes).label('Outline each item, its glyph, its spot and its up'),
    }).label('Debug'),
  }),
  render: ({ config, setConfig }) => <BarArcView config={config as BarArcConfig} onPreset={(p) => loadInto(setConfig, p.config)} />,
});
