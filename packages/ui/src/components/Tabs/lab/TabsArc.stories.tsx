import { f, meta, story } from '@weasel-js/forge';
import { TABS_ARC_DEFAULTS as D, TabsArcView, type TabsArcConfig } from './TabsArcView';

export default meta({ title: 'Primitives/Tabs', layout: 'fullscreen', tags: ['lab'] });

/** Tabs and page tabs along an arc: a tab set over the top of a circle with its panel inside, and a page strip under one. */
export const OnAnArc = story({
  config: f.schema({
    tabs: f.number(D.tabs).range(1, 8).step(1).label('Tabs'),
    sweep: f.number(D.sweep).range(40, 340).step(5).suffix('°').label('Sweep'),
    inset: f.number(D.inset).range(0, 80).step(1).suffix('px').label('Inset'),
    size: f.number(D.size).range(200, 480).step(10).suffix('px').label('Box'),
    turn: f.number(D.turn).range(0, 45).step(1).suffix('°').label('Box turned by'),
  }),
  render: ({ config }) => <TabsArcView config={config as TabsArcConfig} />,
});
