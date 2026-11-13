# mertrassa.github.io

My personal site: **https://mertrassa.github.io/**

It is a single page of plain HTML, CSS and JavaScript with no build step. GitHub Pages serves the
repository root as it is.

## What is on it

- **Selected work**: seven projects, filterable by area.
- **The lab**: three of those projects ported to JavaScript so they run in the browser.
  - *Harmonify* (`js/harmonify.js`): the similarity score and tie-break from
    [Harmonify-CSC111](https://github.com/mertrassa/Harmonify-CSC111), on the same 200 songs and
    200 listeners (`data/harmonify.json`).
  - *ffmeta* (`js/meta.js`): the Monte Carlo model and tail fit from
    [tt-ffmeta](https://github.com/mertrassa/tt-ffmeta).
  - *Columns* (`js/gems.js`): the board, colours and matching rules of
    [Columns-CSC258](https://github.com/mertrassa/Columns-CSC258).
- **Coursework**: my University of Toronto courses, by year or by area.
- **From above**: drone photographs, also on [VSCO](https://vsco.co/mertrassa/gallery).

## Run it locally

```bash
python -m http.server 4173
```

then open http://localhost:4173/. Opening `index.html` straight from disk also works, except for the
Harmonify demo, which needs to fetch its data file over HTTP.

## Editing

| To change | Edit |
| --- | --- |
| Text, projects, experience | `index.html` |
| Courses and photo captions | the `COURSES` and `PHOTOS` lists in `js/main.js` |
| Colours and type | the tokens at the top of `css/style.css` |
| Photographs | `assets/photos/` (3:2 JPEGs; larger files will look sharper) |
