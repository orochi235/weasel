/** Writing the attributes and elements a node keeps for declared namespaces. */

import { escapeAttr, escapeText } from './xmlEscape';
import type { NamespaceMeta, NamespacedElement } from './types';

export function namespacedElementXml(prefix: string, localName: string, el: NamespacedElement): string {
  const attrs: string[] = [];
  for (const [name, value] of Object.entries(el.attrs)) {
    attrs.push(`${name}="${escapeAttr(value)}"`);
  }
  const head = attrs.length > 0 ? `<${prefix}:${localName} ${attrs.join(' ')}>` : `<${prefix}:${localName}>`;
  let body = '';
  if (el.children) {
    for (const [childName, list] of Object.entries(el.children)) {
      for (const child of list) body += namespacedElementXml(prefix, childName, child);
    }
  } else if (el.text != null) {
    body = escapeText(el.text);
  }
  return `${head}${body}</${prefix}:${localName}>`;
}

export function metaAttrsXml(meta: NamespaceMeta | undefined, namespaces: Record<string, string>): string {
  if (!meta) return '';
  const parts: string[] = [];
  for (const prefix of Object.keys(namespaces)) {
    const bucket = meta[prefix];
    if (!bucket?.attrs) continue;
    for (const [name, value] of Object.entries(bucket.attrs)) {
      parts.push(`${prefix}:${name}="${escapeAttr(value)}"`);
    }
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

export function metaElementsXml(meta: NamespaceMeta | undefined, namespaces: Record<string, string>): string {
  if (!meta) return '';
  let out = '';
  for (const prefix of Object.keys(namespaces)) {
    const bucket = meta[prefix];
    if (!bucket?.elements) continue;
    for (const [localName, list] of Object.entries(bucket.elements)) {
      for (const el of list) out += namespacedElementXml(prefix, localName, el);
    }
  }
  return out;
}
