---
'@weasel-js/text-dom': patch
---

`domPositionToCharOffset` read a caret sitting in an empty text node, which a browser can leave behind after deleting a span's last character, as the end of the text, so the edit overlay's selection jumped there. It now counts only the text before that node.
