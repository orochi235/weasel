/**
 * Anything posted to a page can reach the devtools session, and anything a page posts can reach a panel. Each side
 * refuses what is not a protocol message rather than throwing from the first field it reads.
 */
import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDevtoolsHook } from './hook';
import { isPageMessage, isPanelMessage } from './messageShape';
import { DEVTOOLS_PROTOCOL, type PageMessage, type PanelMessage } from './protocol';
import { createInPageTransports } from './transport';

const P = DEVTOOLS_PROTOCOL;

/** A message with each field either the protocol's or anything at all. */
const lookalike = fc.record({
  type: fc.oneof(
    fc.constantFrom('yo', 'bye', 'get-children', 'get-node', 'get-state', 'get-trace', 'get-frame', 'get-registry',
      'get-history', 'select', 'highlight', 'set-tool', 'set-overlays', 'sup', 'root-added', 'root-removed',
      'changed', 'result', 'error'),
    fc.anything(),
  ),
  protocol: fc.oneof(fc.constant(P), fc.anything()),
  requestId: fc.oneof(fc.nat(), fc.anything()),
  rootId: fc.oneof(fc.constant('root-1'), fc.anything()),
  nodeId: fc.anything(), cursor: fc.anything(), coordCursor: fc.anything(), checkpoints: fc.anything(),
  ids: fc.anything(), toolId: fc.anything(), overlays: fc.anything(), kitVersion: fc.anything(),
  roots: fc.anything(), root: fc.anything(), areas: fc.anything(), message: fc.anything(),
}, { requiredKeys: [] });

const anyMessage = fc.oneof(fc.anything(), lookalike);

afterEach(() => vi.restoreAllMocks());

/** A session over an in-page transport, whose emitter reports a throw from the session to `console.error`. */
function connected() {
  const threw = vi.spyOn(console, 'error').mockImplementation(() => {});
  const hook = createDevtoolsHook({ schedule: (f) => f() });
  const { page, panel } = createInPageTransports();
  hook.connect(page);
  const heard: PageMessage[] = [];
  panel.onMessage((m) => heard.push(m));
  panel.send({ type: 'yo', protocol: P });
  return { send: (m: unknown) => panel.send(m as PanelMessage), heard, threw };
}

describe('devtools message shapes', () => {
  it('judges any value without throwing', () => {
    fc.assert(fc.property(anyMessage, (m) => {
      isPanelMessage(m);
      isPageMessage(m);
    }));
  });

  it.each([null, 'yo', 7, [], { type: 'select', protocol: P, requestId: 1, rootId: 'root-1', ids: 5 }])(
    'refuses %j from a panel without throwing',
    (m) => {
      const t = connected();
      t.send(m);
      expect(t.threw).not.toHaveBeenCalled();
      expect(t.heard.filter((h) => h.type === 'result')).toHaveLength(0);
    },
  );

  it('answers every malformed request with an error, never a throw', () => {
    fc.assert(fc.property(lookalike, (m) => {
      const t = connected();
      const before = t.heard.length;
      t.send(m);
      expect(t.threw).not.toHaveBeenCalled();
      if (!isPanelMessage(m)) expect(t.heard.slice(before).every((h) => h.type === 'error')).toBe(true);
    }));
  });
});
