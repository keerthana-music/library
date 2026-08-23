# Keerthana Music Archive — web app

Static web app for the Keerthana music school's song library. Hosted free on GitHub Pages.

## Files
- `index.html` — the whole app (archive, concert builder, import). Self-contained.
- `krithi-dictionary.json` — the ~8k karnatik reference database, for name-checking on import. Static; fetched by the app.
- `catalog.json` — **not read by the app.** A generated snapshot of the archive, produced by `digitize/sync_catalog.py` from `MASTER/index.json`, and consumed only by the scanning pipeline (`digitize/match.py`). Safe to regenerate at any time.
- `.nojekyll` — tells GitHub Pages to serve files as-is.

## Where the data comes from (changed 2026-08-23)

The app once loaded its song list from the INDEX Google Sheet, published as JSON by
an Apps Script, with a copy embedded in `index.html` as a fallback. That meant three
copies of one list, and they drifted — a row deleted from `catalog.json` was still
being served from the embedded snapshot weeks later.

The krithi list is now derived from the archive itself: `bundle.json` in each Drive
folder is the source of truth, the app aggregates those into `MASTER/index.json`
(the ↻ button), and `syncCat()` builds the in-memory list from that. Nothing to
publish, nothing to keep in step.

Still on the sheet side, deliberately: the **vocabulary** (raga, tala, composer,
phonetics, melakartha, janya) belongs in a Google Sheet that Akka and the admins can
edit by hand. That is a separate publisher from the retired catalogue one, and until
it exists the app falls back to the `META` constant in `index.html`.

## Publishing (GitHub Pages)
1. Put these files at the **root** of the repo (default branch, e.g. `main`).
2. Repo **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main` / `/ (root)`.
3. Wait ~1 minute; the site appears at `https://<org>.github.io/<repo>/`.

## Who maintains what
- **App code** (this repo): the developer side — deploy on change.
- **The krithi index** (notation PDFs and their raga/tala/composer): the maintenance team, through the app itself. Add and Import write `bundle.json` into Drive; ↻ rebuilds `MASTER/index.json`. No GitHub, no spreadsheet.
- **The vocabulary** (raga/tala/composer name lists and the reference tabs): Akka and admins, in the INDEX Sheet.

Nothing sensitive lives here — file access is controlled by Google Drive permissions, not by this repo.
