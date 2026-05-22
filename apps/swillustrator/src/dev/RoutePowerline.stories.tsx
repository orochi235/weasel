import type { Meta, StoryObj } from '@storybook/react-vite';
import { Powerline } from '@orochi235/weasel-ui';
import { routeToPowerline } from './RegistryDetail';

/** Visual catalog of every route-config shape the inspector renders as a
 *  Powerline. Each section groups permutations of one axis (phases, gestures,
 *  args, targets, modifiers) so regressions on a specific axis are easy to
 *  spot. Source-of-truth: `routeToPowerline` in `RegistryDetail.tsx`. */
const meta: Meta = {
  title: 'swillustrator/Inspector/Route Powerline',
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj;

function Row({ route }: { route: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', alignItems: 'center', gap: 16, padding: '4px 0' }}>
      <code style={{ fontSize: 12, color: 'var(--wzl-muted, #a59685)' }}>{route}</code>
      <Powerline {...routeToPowerline(route)} />
    </div>
  );
}

function Section({ title, routes }: { title: string; routes: readonly string[] }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h3 style={{ font: '600 14px/1.4 system-ui', margin: '12px 0 6px', color: 'var(--wzl-fg, #d4c4a8)' }}>{title}</h3>
      <div style={{ borderTop: '1px solid var(--wzl-panel-border, #4a3c2e)' }}>
        {routes.map((r) => <Row key={r} route={r} />)}
      </div>
    </section>
  );
}

/** Every permutation grouped by axis. Use this as the canonical visual test
 *  for changes to `routeToPowerline`, the gesture badge, KeyCap rendering,
 *  modifier coalescence, and wildcard/default styling. */
export const AllPermutations: Story = {
  render: () => (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: 'var(--wzl-fg, #d4c4a8)' }}>
      <Section
        title="Phases — channel × phase value"
        routes={[
          '[initial] click handle',
          '[engaged] click handle',
          '[*] click handle',
          '[*:engaged] click handle',
          '[rect:engaged] click handle',
          '[initial,engaged] click handle',
        ]}
      />
      <Section
        title="Pointer gestures (hasTarget)"
        routes={[
          '[initial] click handle',
          '[initial] pointerDown handle',
          '[initial] dblTap node',
          '[initial] drag handle',
          '[initial] contextMenu node',
        ]}
      />
      <Section
        title="Targets — wildcard vs specific vs empty"
        routes={[
          '[initial] click',
          '[initial] click handle',
          '[initial] click empty',
        ]}
      />
      <Section
        title="Wheel — default vs specific arg"
        routes={[
          '[initial] wheel',
          '[initial] wheel(up)',
          '[initial] wheel(down)',
        ]}
      />
      <Section
        title="Key gestures — minimal KeyCap rendering"
        routes={[
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
        ]}
      />
      <Section
        title="Multi-touch tap — finger counts"
        routes={[
          '[initial] multiTouchTap(2)',
          '[initial] multiTouchTap(3)',
          '[initial] multiTouchTap(4)',
        ]}
      />
      <Section
        title="Modifiers — required, optional, coalesced"
        routes={[
          '[initial] drag node +shift',
          '[initial] drag node +mod',
          '[initial] drag node +mod +shift',
          '[initial] drag node ?shift',
          '[initial] drag node +mod ?shift',
          '[initial] drag node +mod +shift +alt',
          '[initial] keyDown(z) +mod',
          '[initial] keyDown(z) +mod +shift',
          '[initial] keyDown(z) +mod ?shift',
          '[initial] wheel(up) +mod',
        ]}
      />
      <Section
        title="Compound — combinations across axes"
        routes={[
          '[*:engaged] keyDown(Delete)',
          '[rect:engaged] keyDown(Escape) +mod',
          '[engaged] drag handle +shift',
          '[initial,engaged] contextMenu empty',
          '[*] wheel(up) +mod',
        ]}
      />
    </div>
  ),
};
