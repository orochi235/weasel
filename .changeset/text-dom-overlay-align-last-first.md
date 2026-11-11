---
"@weasel-js/text-dom": patch
---

The edit overlay clears `text-align-last` before it sets `text-align`, and sets it again only when justifying. Under css-text-4, where `text-align` is a shorthand that resets `text-align-last`, clearing it afterward left the overlay's `text-align` unreadable.
