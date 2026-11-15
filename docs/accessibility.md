# Accessibility notes

A canvas that draws pixels has no accessibility of its own. Here the live screens are real DOM, so they keep everything the browser gives them. The gap is the screens that are pictures. This page says how that gap is closed and what is still open.

## What is built and tested

Each line is checked by a test: the reading order by a unit test, the rest by Playwright tests in `bench/tests`.

- **Every screen is in the accessibility tree, mounted or not.** One ordered list holds one entry for each frame, with its name and its position in the set. It costs two elements a frame.
- **One tab stop.** Tab enters the list. Arrow keys move to the nearest screen in that direction. Home and End go to the first and last.
- **The list comes first.** It sits before the screens in the document, so Tab reaches it before the controls of any live screen.
- **Reading order.** Rows from top to bottom, left to right inside a row.
- **Focus is visible.** Focus on a list entry selects that frame, draws a ring round it on the canvas and pans it into view.
- **Enter goes inside.** The camera fits the screen, it comes alive, and focus moves to its first control. Escape returns to its list entry.
- **Selection is announced** through a polite live region, with the screen's name and its position out of the total.
- **The canvas follows focus.** When focus moves to a control that is partly out of view, the browser's scroll is turned into a camera move.
- **Screens that are not live are `inert`.** Their controls are not in the tab order and not announced.
- **Keys for everything a pointer does.** Arrows pan. Plus and minus zoom. 0 is 100%. 1 fits everything. 2 fits the selection. This covers WCAG 2.5.7, dragging movements.
- **Browser zoom is left alone.** Ctrl or Cmd with plus and minus still zoom the page.
- **Reduced motion.** With `prefers-reduced-motion: reduce` there is no glide after a drag and no camera tween. The view jumps. The engine follows the setting if it changes while the page is open. Pass `reducedMotion: true` or `false` to override it.
- **Role.** The viewport is a group with the role description "canvas". It is not `application`, which would switch off a screen reader's reading keys inside live screens.

## What you have to do

- **Give the canvas a label.** `label` names the group and the list.
- **Give every frame a real name.** It is what a screen reader user hears and what is drawn above the frame.
- **Put a way past the canvas before it.** The page cannot scroll while the pointer is on the canvas, so the canvas must never be the only way to reach what follows it. A skip link works.
- **Set the far layer's colours.** A canvas cannot read CSS. Pass `colors`, or call `setColors`, with values that meet contrast in your theme. Call `invalidatePictures()` after a theme change, because a picture bakes its colours in.
- **Keep text readable inside your screens.** The engine scales whole screens. It does not change what is in them.
- **Mark overlay controls.** Anything you float over the canvas should carry `data-ic-chrome`, be at least 44 by 44 CSS pixels, and be reachable by keyboard.

## Known limits

- **Pictures do not adapt.** In forced colours mode each live frame gets a real outline in a system colour, but pictures keep the colours they were taken with.
- **Zoom level is not announced.** Neither is a screen coming alive. Both need batching so they do not flood a screen reader.
- **There is no text alternative to the spatial view** beyond the list. A visible, searchable panel of the same list would help.
- **Parked screens on older React keep running.** Before React 19.2 a parked screen's timers and live regions go on. A live region inside a parked screen is hidden with `display: none`, so it should not be announced, but its code still runs.
- **Iframe screens.** Focus can enter a live iframe screen. Escape pressed inside the iframe does not reach the canvas, so it cannot return focus to the list. Tabbing past the last control inside leaves it, as with any iframe.
- **Touch.** One finger pans and two pinch. This is written and has not been tested on a device.

## What needs a person

Nothing here was tested with VoiceOver, NVDA, JAWS or TalkBack. The tree and the focus behaviour were checked by script. A script can say that the right elements, roles and names exist. It cannot say that the result is pleasant or even usable by ear. If you run it with assistive technology, please open an issue with what you found.
