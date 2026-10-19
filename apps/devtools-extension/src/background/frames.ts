/**
 * One tab can hold weasel in several frames, each with its own hook and its
 * own `root-N` ids. The panel sees one id space: the top frame's ids as they
 * are, and every other frame's as `frame<N>/<id>`.
 */
import type { DevtoolsRootInfo, PageMessage } from '@weasel-js/core/devtools-protocol';

const SCOPED = /^frame(\d+)\/(.+)$/;

export function scopeRootId(frameId: number, rootId: string): string {
  return frameId === 0 ? rootId : `frame${frameId}/${rootId}`;
}

/** The frame and its own id for an id the panel holds. */
export function unscopeRootId(scoped: string): { frameId: number; rootId: string } {
  const m = SCOPED.exec(scoped);
  return m ? { frameId: Number(m[1]), rootId: m[2]! } : { frameId: 0, rootId: scoped };
}

export function scopeRoot(frameId: number, root: DevtoolsRootInfo): DevtoolsRootInfo {
  if (frameId === 0) return root;
  return { ...root, id: scopeRootId(frameId, root.id), label: `${root.label} (frame ${frameId})` };
}

/** `message` with every root id it carries scoped to `frameId`. */
export function scopePageMessage(frameId: number, message: PageMessage): PageMessage {
  if (frameId === 0) return message;
  switch (message.type) {
    case 'sup': return { ...message, roots: message.roots.map((r) => scopeRoot(frameId, r)) };
    case 'root-added': return { ...message, root: scopeRoot(frameId, message.root) };
    default: {
      const m = message as PageMessage & { rootId?: unknown };
      return typeof m.rootId === 'string' ? { ...m, rootId: scopeRootId(frameId, m.rootId) } as PageMessage : message;
    }
  }
}
