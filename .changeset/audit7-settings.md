---
'@weasel-js/theme': patch
'@weasel-js/routing': patch
'@weasel-js/prefs': patch
---

Fixes from an audit of theme, routing and prefs:

- An axis value, a token name or a tool id that matches the name of an `Object.prototype` member (`toString`, `constructor`) now reads as any other name. Before, `fullSelection` kept `{ mode: 'toString' }` and resolved a function as a token's value, `resolveTokens` resolved a token named `constructor` to `Object`, `flattenTokens` reported such a token as a duplicate, `loadDTCG` filled a mode that lacked the token with `Object`, and `useTools` answered `has('toString')` with true.
- `useColorModePreference` reads the stored choice again when `storageKey` changes. It kept the old key's choice and wrote it into the new slot on the next `setPreference`.
- `prefsCss` leaves out a held color whose text could end its declaration or its rule, as it already escapes a string or an enum option.
- `applyTheme` leaves out a token whose value has `;`, `{` or `}` outside a quoted string, or a quote left open, and warns once in development, as `ThemeProvider` warns of an unknown axis value. Such a value, which a theme built from prefs can carry from storage, ended the theme's rule and wrote rules of its own.
- `prefDisplayBounds` converts a number leaf's `step` into its display unit without rounding, then rounds it up to the smallest step the unit's `precision` shows, so a step always changes the shown value and never moves less than declared: 1 mm shown in whole centimeters steps by 1 cm. A step that rounded to nothing fell back to the declared step in stored units. `resolvePrefUnit` gives `toDisplayExact`, the unrounded conversion, and `precision`.
