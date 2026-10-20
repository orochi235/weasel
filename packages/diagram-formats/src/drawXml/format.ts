/** Draw-style XML as a {@link DiagramFormat}. */
import type { DiagramFormat } from '../document';
import { readDrawXml } from './read';

/** The root element, past any XML declaration, doctype, comments, and processing instructions. */
const ROOT = /^\s*(?:<\?[^]*?\?>\s*|<!--[^]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<(mxfile|mxGraphModel)[\s/>]/;

/**
 * Draw-style XML: a page per `<diagram>`, each a graph model of cells with
 * geometry, written out or compressed. Recognized by its root element, since
 * `.xml` names many formats.
 */
export const DRAW_XML: DiagramFormat = {
  id: 'draw-xml',
  name: 'Draw-style XML',
  extensions: ['.xml'],
  detect: (text) => ROOT.test(text),
  read: readDrawXml,
};
