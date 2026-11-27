/**
 * `@weasel-js/font/sfnt` — font containers unpacked into standalone sfnt bytes.
 *
 * A `.ttc` collection or a `.dfont` holds several faces, and opentype.js parses neither. These run
 * before any parser and need no browser, so a consumer bringing its own parser can use them alone.
 *
 * @packageDocumentation
 */

export { isDataForkFont, isFontCollection, postScriptNameOf, sfntFromCollection } from './outline/sfnt';
