---
'@weasel-js/font': minor
---

`fontFamilies(list)` reads a CSS `font-family` list into the names it holds, and `cssUnescape(text)` resolves CSS escapes.

```ts
fontFamilies(`"A, B", 'O\\'Neil', Foo\\ Bar, serif`); // ['A, B', "O'Neil", 'Foo Bar', 'serif']
```

A comma inside quotes, an escape or a function such as `var()` splits nothing, and a function entry comes back as
written.

<!-- entry: api -->
