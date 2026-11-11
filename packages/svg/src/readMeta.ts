/** Reading the elements and attributes in the namespaces a caller names into `NamespaceMeta`. */

import type { NamespaceMeta, NamespacedElement } from './types';

export function collectDocumentMeta(
  root: Element,
  uriToPrefix: Map<string, string>,
): NamespaceMeta | undefined {
  if (uriToPrefix.size === 0) return undefined;
  const meta: NamespaceMeta = {};

  // Root-level namespaced attributes.
  for (let i = 0; i < root.attributes.length; i++) {
    const a = root.attributes[i];
    if (!a.namespaceURI) continue;
    const prefix = uriToPrefix.get(a.namespaceURI);
    if (!prefix) continue;
    const bucket = (meta[prefix] ??= {});
    (bucket.attrs ??= {})[a.localName] = a.value;
  }

  // Root-level namespaced child elements. The body of these is collected
  // recursively as a generic XML-element tree; geometry inside them is NOT
  // promoted to SvgNodes (that's the consumer's job if they want it).
  for (let i = 0; i < root.children.length; i++) {
    const c = root.children[i];
    if (!c.namespaceURI) continue;
    const prefix = uriToPrefix.get(c.namespaceURI);
    if (!prefix) continue;
    const bucket = (meta[prefix] ??= {});
    const elements = (bucket.elements ??= {});
    const list = (elements[c.localName] ??= []);
    list.push(collectNamespacedElement(c, uriToPrefix));
  }

  return Object.keys(meta).length > 0 ? meta : undefined;
}

function collectNamespacedElement(
  el: Element,
  uriToPrefix: Map<string, string>,
): NamespacedElement {
  const result: NamespacedElement = { attrs: {} };
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    // For namespaced *elements* we collect every attribute (namespaced or
    // not) under the element — unlike root attrs where we filter by NS.
    // Treat `xmlns:*` as structural and skip.
    if (a.name.startsWith('xmlns')) continue;
    result.attrs[a.localName] = a.value;
  }

  let hasChildElements = false;
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    if (!c.namespaceURI) continue;
    const prefix = uriToPrefix.get(c.namespaceURI);
    if (!prefix) continue;  // child in undeclared NS: drop
    hasChildElements = true;
    const children = (result.children ??= {});
    const list = (children[c.localName] ??= []);
    list.push(collectNamespacedElement(c, uriToPrefix));
  }

  if (!hasChildElements && el.textContent != null && el.textContent.trim() !== '') {
    result.text = el.textContent;
  }

  return result;
}

/** Per-element namespace meta: walked at every parsed SVG element. */
export function collectElementMeta(
  el: Element,
  uriToPrefix: Map<string, string>,
): NamespaceMeta | undefined {
  if (uriToPrefix.size === 0) return undefined;
  const meta: NamespaceMeta = {};
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    if (!a.namespaceURI) continue;
    const prefix = uriToPrefix.get(a.namespaceURI);
    if (!prefix) continue;
    const bucket = (meta[prefix] ??= {});
    (bucket.attrs ??= {})[a.localName] = a.value;
  }
  // Namespaced child elements on a *standard* SVG element (e.g. a <g>) are
  // also surfaced under elements[] in the same shape used at the root.
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    if (!c.namespaceURI) continue;
    const prefix = uriToPrefix.get(c.namespaceURI);
    if (!prefix) continue;
    const bucket = (meta[prefix] ??= {});
    const elements = (bucket.elements ??= {});
    const list = (elements[c.localName] ??= []);
    list.push(collectNamespacedElement(c, uriToPrefix));
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}
