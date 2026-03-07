# WETLANDS 1.1 Web Refactor

HTML/JS refactor of the Swift Playgrounds app in `WETLANDS 1.1.zip`.

## Features implemented
- 4-tab survey UI (Metadata / Vegetation / Hydrology / Soils)
- Core fields carried over from Swift model
- Device geolocation capture
- Multi-select checklists for hydrology and hydric soil indicators
- Species autocomplete (datalist) using `VASC_names.json`
- Photo upload + thumbnail preview + remove before submit
- Draft autosave + draft restore (`localStorage` key: `wetlandCurrentDraft`)
- Sticky tab workflow with Prev/Next navigation
- Local submission store (`localStorage` key: `wetlandSurveys`)
- CSV export of all submitted surveys
- GeoJSON export (`Point` using longitude/latitude)
- PWA installability (`manifest.webmanifest` + `service-worker.js`)

## Project structure

- `docs/` → deployable static web app (GitHub Pages source)
- `archive/screenshots/` → internal design snapshots and legacy artifacts

## Run locally
From this folder:

```bash
python3 -m http.server 8080
```

Then open:
`http://localhost:8080/docs/`

## Notes
- This is a clean web baseline, not a 1:1 pixel clone of SwiftUI.
- Camera/photo-roll flow was not ported yet.
- Species autocomplete from `VASC_names.json` can be added next as an enhancement.
