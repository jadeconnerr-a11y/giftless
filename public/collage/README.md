# Landing page collage photos

Drop image files in this folder to fill the photo collage on either side of
the landing page headline. Until a file exists, that slot shows a dashed
placeholder naming the file it's waiting for.

Expected filenames (used by `src/components/chat/hero-collage.tsx`):

- `left-1.jpg`, `left-2.jpg`, `left-3.jpg`, `left-4.jpg`
- `right-1.jpg`, `right-2.jpg`, `right-3.jpg`, `right-4.jpg`

Any image format works (`.jpg`, `.png`, `.webp`, …) — just update the `file`
value for that slot in `hero-collage.tsx` to match the extension you used.

To change a photo's size, position, tilt, or add a clickable caption that
fills the chat box, edit the `LEFT_SLOTS` / `RIGHT_SLOTS` arrays in
`src/components/chat/hero-collage.tsx` — every value is a plain number with
a comment explaining what it does.
