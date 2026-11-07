---
'@weasel-js/ui': patch
---

A Properties slider on a scaled track (`scale`) now steps on Left and Right by one step in value units, as it does on Up and Down, mirrored on a right-to-left track. It used to leave those keys to the native input, which runs along 0..1 there and moved by no value step at all. An unscaled track already behaved this way.
