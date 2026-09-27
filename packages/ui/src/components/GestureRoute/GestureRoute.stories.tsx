import type { Meta, StoryObj } from '@weasel-js/forge';
import { GestureRoute } from './GestureRoute';
import s from './GestureRoute.stories.module.css';

const meta: Meta<typeof GestureRoute> = {
  title: 'ui/Foundations/GestureRoute',
  component: GestureRoute,
  args: { route: '[initial] drag => node +mod ?shift' },
};
export default meta;

type Story = StoryObj<typeof GestureRoute>;

export const Default: Story = {};

const SECTIONS: readonly { title: string; routes: readonly string[] }[] = [
  {
    title: 'Phases — channel × phase value',
    routes: [
      '[initial] click => handle',
      '[engaged] click => handle',
      '[*] click => handle',
      '[*:engaged] click => handle',
      '[rect:engaged] click => handle',
      '[initial,engaged] click => handle',
    ],
  },
  {
    title: 'Pointer gestures (hasTarget)',
    routes: [
      '[initial] click => handle',
      '[initial] pointerDown => handle',
      '[initial] dblTap => node',
      '[initial] drag => handle',
      '[initial] contextMenu => node',
    ],
  },
  {
    title: 'Targets — wildcard vs specific vs empty',
    routes: [
      '[initial] click',
      '[initial] click => handle',
      '[initial] click => empty',
    ],
  },
  {
    title: 'Wheel — default vs specific arg',
    routes: [
      '[initial] wheel',
      '[initial] wheel(up)',
      '[initial] wheel(down)',
    ],
  },
  {
    title: 'Key gestures — minimal KeyCap rendering',
    routes: [
      '[initial] keyDown(Escape)',
      '[initial] keyDown(ArrowDown)',
      '[initial] keyDown(ArrowUp)',
      '[initial] keyDown(ArrowLeft)',
      '[initial] keyDown(ArrowRight)',
      '[initial] keyDown(Enter)',
      '[initial] keyDown(Tab)',
      '[initial] keyDown(Backspace)',
      '[initial] keyDown(Delete)',
      '[initial] keyDown( )',
      '[initial] keyDown(z)',
      '[initial] keyUp(Escape)',
    ],
  },
  {
    title: 'Held key gestures — keyHeld lifecycle (drag-shaped)',
    routes: [
      '[initial] keyHeld(Space)',
      '[initial] keyHeld(Space) +mod',
      '[*:initial] keyHeld(Space)',
      '[engaged] keyHeld(Escape)',
    ],
  },
  {
    title: 'Multi-touch tap — finger counts',
    routes: [
      '[initial] multiTouchTap(2)',
      '[initial] multiTouchTap(3)',
      '[initial] multiTouchTap(4)',
    ],
  },
  {
    title: 'Modifiers — required, optional, coalesced',
    routes: [
      '[initial] drag => node +shift',
      '[initial] drag => node +mod',
      '[initial] drag => node +mod +shift',
      '[initial] drag => node ?shift',
      '[initial] drag => node +mod ?shift',
      '[initial] drag => node +mod +shift +alt',
      '[initial] keyDown(z) +mod',
      '[initial] keyDown(z) +mod +shift',
      '[initial] keyDown(z) +mod ?shift',
      '[initial] wheel(up) +mod',
    ],
  },
  {
    title: 'Compound — combinations across axes',
    routes: [
      '[*:engaged] keyDown(Delete)',
      '[rect:engaged] keyDown(Escape) +mod',
      '[engaged] drag => handle +shift',
      '[initial,engaged] contextMenu => empty',
      '[*] wheel(up) +mod',
    ],
  },
];

/** Every route shape, grouped by the axis it varies. */
export const AllPermutations: Story = {
  render: () => (
    <div className={s.catalog}>
      {SECTIONS.map(({ title, routes }) => (
        <section key={title}>
          <h3 className={s.heading}>{title}</h3>
          <div className={s.rows}>
            {routes.map((route) => (
              <div key={route} className={s.row}>
                <code className={s.source}>{route}</code>
                <GestureRoute route={route} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};
