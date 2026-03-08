# WETLANDS Web App

A field-first wetland delineation and inventory web app for Nova Scotia workflows.

This project is a browser-based data collection tool used to capture wetland site observations, manage local submissions, and export report-ready outputs (including printable report HTML for PDF generation).

---

## Purpose

WETLANDS provides a practical, offline-friendly form workflow for:

- Rapid field data capture
- Repeatable wetland delineation records
- Local-first storage for draft and submitted forms
- Simple export pathways for downstream reporting and GIS use

---

## Current functionality

### Survey workflow

- 4-tab form layout:
  - Metadata
  - Vegetation
  - Hydrology
  - Soils
- Prev/Next tab navigation
- Submit flow that saves a completed survey and returns to dashboard

### Data capture

- Core wetland delineation fields (including disturbance/problematic conditions and summary determinations)
- Device geolocation capture (lat/long)
- Vegetation entries by layer (Tree/Shrub/Herb) with species lookup by common/scientific/code, indicator status autofill, cover %, and dominant flag
- Hydric soil horizon entries and indicator selection
- Wetland hydrology indicator selection
- Notes field
- Photo attachment support with preview/removal before submit

### Plant reference lookup

- Dedicated in-app species reference view on the dashboard
- Search by common name, scientific name, and available species codes
- Detailed species card output from NS indicator source records
- Data-dictionary definitions shown inline for coded/technical fields

### Local persistence

- Draft autosave + restore via **IndexedDB** (`wetlandCurrentDraft`)
- Submitted surveys stored locally via **IndexedDB** (`wetlandSurveys`)
- One-time legacy migration from prior `localStorage` keys is included
- Submission dashboard for preview, reload to form, delete, and per-record export

### Export options

- All-submission export:
  - CSV
  - GeoJSON
- Per-record export:
  - CSV
  - GeoJSON
  - Markdown
  - HTML report
  - PDF (Aesthetic report)
  - PDF (Form-Style, NS-reference-inspired layout)

### Vegetation indices

- Dominance Test computed automatically using the 50/20 rule by stratum (Tree/Shrub/Herb)
- Prevalence Index computed from indicator-status weighted cover totals (OBL/FACW/FAC/FACU/UPL)

### Reporting style

Record HTML export is styled as a structured report with:

- Branded header and generated timestamp
- Survey metadata table
- Summary status cards
- Vegetation, soil, and hydrology tables
- Notes and photo section

### PWA behavior

- Manifest + service worker present
- Install prompt support where browser allows

---

## Project structure

- `docs/` → deployable app source (GitHub Pages root)
  - `index.html`
  - `app.js`
  - `styles.css`
  - `assets/`
  - `manifest.webmanifest`
  - `service-worker.js`

---

## Run locally

From repository root:

```bash
python3 -m http.server 8080
```

Then open:

`http://localhost:8080/docs/`

---

## GitHub Pages

This repo is configured to publish from:

- Branch: `main`
- Folder: `/docs`

Default Pages URL:

`https://fraxinusenviro.github.io/WETLANDS/`

---

## Notes

- This is a practical web implementation for field operations, not a SwiftUI clone.
- Storage is currently local-browser only (no backend sync yet).
- PDF output is intentionally handled as a downloaded printable HTML to avoid popup restrictions across mobile/webview environments.
