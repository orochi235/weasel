---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

New export `heldKeySpec(key)`, from `@weasel-js/routing` and `@weasel-js/core`: the `key-held` spec for holding a key, with every modifier optional when the key is itself a modifier and forbidden otherwise. It is general surface for any hold-a-key binding; offhand tool triggers and the labkit loupe's peek key both build their spec with it. The loupe changes for a peek key that is not a modifier: a letter no longer starts a peek while another modifier is down, the same as an offhand tool's trigger. The default peek key, Alt, behaves as before.
