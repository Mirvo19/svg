# svg animator

a browser-based tool for uploading svgs, animating them, and exporting a self-contained html file you can drop anywhere. no build step, no npm, no backend  just open `index.html` and you're good.

---

## what it does

you drag in (or click to upload) any `.svg` file. it runs through a preprocessing pipeline that cleans it up, flattens shapes into paths, and gets everything ready for animation. then you pick a mode, tweak the settings, and hit play. when you're happy with it you can export the whole thing as a single html file that animates on its own.

---

## animation modes

there's 10 of them:

- **draw**  strokes draw themselves on screen (the classic one)
- **fade**  elements fade in one by one
- **dash**  a dash travels along each path
- **scale**  paths pop in from zero scale
- **slide**  everything slides in from the left
- **spin**  paths spin in while fading up
- **blur**  fades in from blurry to sharp
- **bounce**  paths bounce in from above
- **flip**  paths flip in on the x axis
- **wave**  ripple wave entrance effect

---

## controls

- **duration**  how long each path takes to animate (0.2s – 8s)
- **initial delay**  how long to wait before the animation starts
- **stagger**  time offset between each consective path (this one makes a big difference, play with it)
- **easing**  a handful of gsap easing curves to choose from
- **stroke color**  color picker for the stroke
- **stroke width**  multiplier on the orignal stroke widths
- **background color**  changes the preview background

---

## the preprocessor

this is the thing that actually makes it work. before any animation happens, the svg goes through a pipeline:

1. sanitizes the raw svg with dompurify (removes anything sketchy)
2. resolves `<use>` tags by inlining the referenced elements
3. normalizes the viewbox so sizing is predictable
4. converts circles, ellipses, rects, lines and polygons into `<path>` elements (gsap needs paths)
5. flattens groups and extracts any inline styles into attributes
6. isolates stroke-only paths from filled ones

if your svg fails to load, it's usually because it's malformed xml or has something the sanitizer stripped out. check the browser console for details.

---

## exporting

hit the **export html** button and it'll prompt you to save a `.html` file. that file is completely self-contained  it embeds the svg, the animation script, and loads gsap from a cdn. you can open it locally or host it anywhere.

the exported animation mirrors exactly what you see in the preview, same timings and everything.

---

## project structure

```
index.html           the whole ui lives here
js/
  app.js             main controller, wires everything together
  preprocessor.js    svg cleaning + path conversion pipeline
  animator.js        gsap timeline builder for all 10 modes
  exporter.js        generates the self-contained html export
  ui.js              toast notifications, color pickers, tooltips
css/
  app.css            custom styles (tailwind handles most of it)
```

---

## dependencies (all cdn, nothing to install)

- [gsap](https://gsap.com/)  animation engine
- [dompurify](https://github.com/cure53/DOMPurify)  svg sanitization
- [tailwind css](https://tailwindcss.com/)  utility styles
- [alpine.js](https://alpinejs.dev/)  lightweight reactivity
- [pickr](https://github.com/Simonwep/pickr)  color pickers
- [tippy.js](https://atomiks.github.io/tippyjs/)  tooltips
- [sweetalert2](https://sweetalert2.github.io/)  error dialogs
- [toastify](https://github.com/apvarun/toastify-js)  toast notifcations
- [lucide](https://lucide.dev/)  icons

---

## known quirks

- very complex svgs with thousands of paths can be slow to preprocess, just give it a second
- some svgs that use css classes for styling instead of attributes won't animate correctly  the preprocessor tries to handle this but it's not perfect
- the `<use>` tag resolution only works for internal references (things defined in the same file), external hrefs are removed
- if you're opening from `file://` locally, the export save dialog might behave slightly differently depending on your browser

---

## running it

literally just open `index.html` in a browser. thats it.
---

---

made with gsap + vanilla js. no frameworks, no bundler, no fuss.
