# Keerthana Music Archive — web app

Static web app for the Keerthana music school's song library. Hosted free on GitHub Pages.

## Files
- `index.html` — the whole app (search, personal library, concert builder). Self-contained.
- `catalog.json` — the song catalogue exported from the INDEX Google Sheet (used later for live updates).
- `.nojekyll` — tells GitHub Pages to serve files as-is.

## Publishing (GitHub Pages)
1. Put these files at the **root** of the repo (default branch, e.g. `main`).
2. Repo **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main` / `/ (root)`.
3. Wait ~1 minute; the site appears at `https://<org>.github.io/<repo>/`.

## Who maintains what
- **App code** (this repo): the developer side — deploy on change.
- **Song content** (PDFs, audio, raga/tala/composer details): the maintenance team, in Google Drive + the INDEX Sheet. No GitHub needed.

Nothing sensitive lives here — file access is controlled by Google Drive permissions, not by this repo.
