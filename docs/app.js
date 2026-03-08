const yesNo = ["", "Yes", "No"];
const observers = ["", "IB", "ZS", "SD", "CN", "Other"];
const provinces = ["", "NS", "PEI", "NB", "NL"];
const plotTypes = ["", "Wetland Control Plot", "Upland Control Plot"];
const pageOrder = ["metadata", "vegetation", "hydrology", "soils"];

const hydricSoilIndicators = ["Histosol (A1)","Histic Epipedon (A2)","Black Histic (A3)","Hydrogen Sulfide (A4)","Stratified Layers (A5)","Depleted Below Dark Surface (A11)","Thick Dark Surface (A12)","Sandy Mucky Mineral (S1)","Sandy Gleyed Matrix (S4)","Sandy Redox (S5)","Polyvalue Below Surface (S8)","Thin Dark Surface (S9)","Loamy Gleyed Matrix (F2)","Depleted Matrix (F3)","Redox Dark Surface (F6)","Depleted Dark Surface (F7)","Redox Depressions (F8)"];
const wetlandHydrologyPrimary = ["Surface Water (A1)","High Water Table (A2)","Saturation (A3)","Water Marks (B1)","Sediment Deposits (B2)","Drift Deposits (B3)","Algal Mat or Crust (B4)","Iron Deposits (B5)","Inundation Visible on Aerial Imagery (B7)","Sparsely Vegetated Concave Surface (B8)","Water-Stained Leaves (B9)","Aquatic Fauna (B13)","Marl Deposits (B15)","Hydrogen Sulfide Odor (C1)","Oxidized Rhizospheres on Living Roots (C3)","Presence of Reduced Iron (C4)","Recent Iron Reduction in Tilled Soils (C6)","Thin Muck Surface (C7)","Other (Explain in Remarks)"];
const wetlandHydrologySecondary = ["Surface Soil Cracks (B6)","Drainage Patterns (B10)","Moss Trim Lines (B16)","Dry-Season Water Table (C2)","Saturation Visible on Aerial Imagery (C9)","Stunted or Stressed Plants (D1)","Geomorphic Position (D2)","Shallow Aquitard (D3)","Microtopographic Relief (D4)","FAC-Neutral Test (D5)"];

const metadataFields = [
  ["SiteID", "text"], ["LocaleName", "text"], ["Province", "select", provinces], ["date", "date"], ["time", "time"], ["observer", "select", observers],
  ["PLOT_ID", "text"], ["WetlandID", "text"], ["PLOT_TYPE", "select", plotTypes], ["latitude", "number"], ["longitude", "number"],
  ["DistSoilYN", "select", yesNo], ["DistVegYN", "select", yesNo], ["DistHydroYN", "select", yesNo], ["ProbSoilYN", "select", yesNo], ["ProbVegYN", "select", yesNo], ["ProbHydroYN", "select", yesNo],
  ["ClimHydroNormalYN", "select", yesNo], ["CircNormalYN", "select", yesNo], ["SummaryHydroVegYN", "select", yesNo], ["SummaryHydricSoilYN", "select", yesNo], ["SummaryHydrologyYN", "select", yesNo], ["SummaryInWetlandYN", "select", yesNo]
];

const DB_NAME = 'wetlands-app-db';
const DB_VERSION = 1;
const KV_STORE = 'kv';
const DRAFT_KEY = 'wetlandCurrentDraft';
const DRAFT_LIBRARY_KEY = 'wetlandDraftLibrary';
const SURVEYS_KEY = 'wetlandSurveys';

let speciesList = ["ACERrubr", "PICErube", "QUERrubr", "KALMangu", "VIBUcass", "PTERaqui"];
let speciesRecords = [];
let speciesDisplayMap = new Map();
let plantReferenceRecords = [];
let speciesDataDictionary = {};
let state = defaultSurvey();
let surveys = [];
let draftsLibrary = [];
let activeTabIndex = 0;
let deferredPrompt = null;
let autosaveTimer = null;
let vegUi = {
  Tree: { max: 6, count: 6, collapsed: false },
  Shrub: { max: 6, count: 6, collapsed: false },
  Herb: { max: 10, count: 10, collapsed: false }
};
let soilUi = {
  horizonCount: 4,
  horizons: {
    1: { collapsed: false },
    2: { collapsed: false },
    3: { collapsed: false },
    4: { collapsed: false }
  }
};

async function init() {
  await migrateLegacyLocalStorage();
  surveys = await loadSurveys();
  draftsLibrary = await loadDraftLibrary();
  state = (await loadDraft()) || defaultSurvey();

  await loadSpecies();
  buildSpeciesDatalist();
  buildTabs();
  renderFormPages();
  bindActions();
  await refreshDashboard();
  renderSubmissions();
  renderDraftsLibrary();
  showView("home");
}

function defaultSurvey() {
  const now = new Date();
  const obj = { id: makeId(), timestamp: new Date().toISOString(), SiteID:"", LocaleName:"", Province:"", date: now.toISOString().slice(0,10), time: now.toTimeString().slice(0,5), observer:"", PLOT_ID:"", WetlandID:"", PLOT_TYPE:"", latitude:"", longitude:"", DistSoilYN:"", DistVegYN:"", DistHydroYN:"", ProbSoilYN:"", ProbVegYN:"", ProbHydroYN:"", ClimHydroNormalYN:"", CircNormalYN:"", SummaryHydroVegYN:"", SummaryHydricSoilYN:"", SummaryHydrologyYN:"", SummaryInWetlandYN:"", notes:"", RestrictiveLayer:"", RestrictiveLayerDepthCM:"", SurfaceWaterYN:"", SurfaceWaterDepthCM:"", WaterTableYN:"", WaterTableDepthCM:"", SaturationYN:"", SaturationDepthCM:"", HydricSoilIndicators:[], HydrologyPrimary:[], HydrologySecondary:[], photos:[] };
  ["Tree","Shrub"].forEach(g => { for (let i=1;i<=6;i++) { obj[`${g}Sp${i}`]=""; obj[`${g}Sp${i}Cov`]=""; obj[`${g}Sp${i}Status`]=""; obj[`${g}Sp${i}Dom`]=false; } });
  for (let i=1;i<=10;i++) { obj[`HerbSp${i}`]=""; obj[`HerbSp${i}Cov`]=""; obj[`HerbSp${i}Status`]=""; obj[`HerbSp${i}Dom`]=false; }
  for (let h=1;h<=4;h++) ["ThickCM","Texture","Matrix","MatrixPC","Redox","RedoxPC","RedoxType","RedoxLoc"].forEach(s => obj[`SoilH${h}${s}`]="");
  return obj;
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
  refreshLucideIcons();
}

function refreshLucideIcons() {
  if (globalThis.lucide?.createIcons) globalThis.lucide.createIcons();
}

function buildTabs() {
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = '';
  pageOrder.forEach((p, i) => {
    const b = document.createElement('button');
    b.textContent = p[0].toUpperCase() + p.slice(1);
    b.onclick = () => setActiveTab(i);
    tabs.appendChild(b);
  });
  setActiveTab(0);
}

function setActiveTab(i) {
  activeTabIndex = Math.max(0, Math.min(pageOrder.length - 1, i));
  const page = pageOrder[activeTabIndex];
  document.querySelectorAll('.tabs button').forEach((x, idx) => x.classList.toggle('active', idx === activeTabIndex));
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelector(`section.page[data-page='${page}']`)?.classList.add('active');
  document.getElementById('tab-status').textContent = `${page[0].toUpperCase() + page.slice(1)} (${activeTabIndex + 1}/${pageOrder.length})`;
}

function renderFormPages() {
  renderMetadata(); renderVegetation(); renderHydrology(); renderSoils();
}

function fieldEl(name, type, options, opts = {}) {
  const w = document.createElement('div'); w.className = 'field';
  w.innerHTML = `<label>${displayLabel(name)}</label>`;
  let input;
  if (type === 'select') {
    input = document.createElement('select');
    options.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v || '—'; input.appendChild(o); });
  } else if (type === 'textarea') input = document.createElement('textarea');
  else { input = document.createElement('input'); input.type = type; if (type === 'number') input.step = 'any'; }
  if (opts.list) input.setAttribute('list', opts.list);
  input.value = state[name] ?? '';
  input.oninput = () => { state[name] = input.value; queueAutosave(); };
  w.appendChild(input);
  return w;
}

function sectionCard(title, child) {
  const c = document.createElement('div'); c.className = 'card';
  c.innerHTML = `<h3 class='group-title'>${title}</h3>`;
  c.appendChild(child);
  return c;
}

function renderMetadata() {
  const root = document.getElementById('metadata-fields'); root.innerHTML = '';
  metadataFields.forEach(([n,t,o]) => root.appendChild(fieldEl(n,t,o)));
  root.appendChild(fieldEl('notes','textarea'));
  const photoWrap = document.createElement('div');
  photoWrap.className = 'field';
  photoWrap.innerHTML = `<label>Photos</label><input id='photo-input' type='file' accept='image/*' multiple /><div id='photo-preview' class='photo-preview'></div>`;
  root.appendChild(photoWrap);
  refreshPhotoPreview();
}

function renderVegetation() {
  const root = document.getElementById('vegetation-fields'); root.innerHTML = '';
  [['Tree',6],['Shrub',6],['Herb',10]].forEach(([g, n]) => {
    const card = document.createElement('div');
    card.className = 'card';

    const head = document.createElement('div');
    head.className = 'veg-head';
    const title = document.createElement('h3');
    title.className = 'group-title';
    title.textContent = `${g} Species`;

    const controls = document.createElement('div');
    controls.className = 'veg-controls';
    controls.innerHTML = `
      <button data-minus='${g}'>−</button>
      <span class='veg-count'>${vegUi[g].count}</span>
      <button data-plus='${g}'>+</button>
      <button class='chevron' data-collapse='${g}' aria-label='Toggle ${g} section'>${vegUi[g].collapsed ? '▸' : '▾'}</button>
    `;
    head.append(title, controls);
    card.appendChild(head);

    if (!vegUi[g].collapsed) {
      const table = document.createElement('div');
      table.className = 'veg-table';
      table.innerHTML = `<div class='veg-row veg-header'><div>#</div><div>Species (Common / Scientific / MCode)</div><div>Status</div><div>%</div><div>Dom</div></div>`;

      for (let i = 1; i <= Math.min(vegUi[g].count, n); i++) {
        const row = document.createElement('div');
        row.className = 'veg-row';
        row.innerHTML = `<div class='veg-idx'>${i}</div>`;

        const species = document.createElement('input');
        species.type = 'text';
        species.setAttribute('list', 'species-options');
        species.value = state[`${g}Sp${i}`] ?? '';
        species.oninput = () => {
          state[`${g}Sp${i}`] = species.value;
          queueAutosave();
        };
        species.onchange = () => {
          applySpeciesLookup(g, i, species.value);
          recomputeDominanceFlags();
          queueAutosave();
          renderVegetation();
        };

        const status = document.createElement('input');
        status.type = 'text';
        status.value = state[`${g}Sp${i}Status`] ?? '';
        status.placeholder = 'Status';
        status.readOnly = true;

        const cov = document.createElement('input');
        cov.type = 'number';
        cov.step = 'any';
        cov.value = state[`${g}Sp${i}Cov`] ?? '';
        cov.oninput = () => {
          state[`${g}Sp${i}Cov`] = cov.value;
          recomputeDominanceFlags();
          queueAutosave();
        };
        cov.onchange = () => {
          recomputeDominanceFlags();
          queueAutosave();
          renderVegetation();
        };

        const dom = document.createElement('input');
        dom.type = 'checkbox';
        dom.checked = !!state[`${g}Sp${i}Dom`];
        dom.disabled = true;
        dom.title = 'Auto-calculated using 50/20 rule';

        row.appendChild(species);
        row.appendChild(status);
        row.appendChild(cov);
        row.appendChild(dom);
        table.appendChild(row);
      }
      card.appendChild(table);
    }
    root.appendChild(card);
  });

  recomputeDominanceFlags();
  const metrics = vegetationMetrics();
  const summary = document.createElement('div');
  summary.className = 'card';
  summary.innerHTML = `
    <h3 class='group-title'>Vegetation Indices</h3>
    <div class='grid two'>
      <div><strong>Dominance Test (A/B):</strong> ${metrics.dominanceA}/${metrics.dominanceB} = <strong>${metrics.dominancePct.toFixed(1)}%</strong></div>
      <div><strong>Dominance Test Pass (&gt;50%):</strong> ${metrics.dominancePass ? 'Yes' : 'No'}</div>
      <div><strong>Prevalence Index (B/A):</strong> <strong>${metrics.prevalenceIndex.toFixed(2)}</strong></div>
      <div><strong>Prevalence Test Pass (≤3.0):</strong> ${metrics.prevalencePass ? 'Yes' : 'No'}</div>
    </div>
    <p class='muted'>Coverage totals — OBL: ${metrics.cover.OBL.toFixed(2)}, FACW: ${metrics.cover.FACW.toFixed(2)}, FAC: ${metrics.cover.FAC.toFixed(2)}, FACU: ${metrics.cover.FACU.toFixed(2)}, UPL: ${metrics.cover.UPL.toFixed(2)}</p>
  `;
  root.appendChild(summary);

  root.querySelectorAll('button[data-collapse]').forEach(b => b.onclick = () => {
    const g = b.dataset.collapse; vegUi[g].collapsed = !vegUi[g].collapsed; renderVegetation();
  });
  root.querySelectorAll('button[data-plus]').forEach(b => b.onclick = () => {
    const g = b.dataset.plus; vegUi[g].count = Math.min(vegUi[g].max, vegUi[g].count + 1); renderVegetation();
  });
  root.querySelectorAll('button[data-minus]').forEach(b => b.onclick = () => {
    const g = b.dataset.minus; vegUi[g].count = Math.max(1, vegUi[g].count - 1); renderVegetation();
  });
}

function renderHydrology() {
  const root = document.getElementById('hydrology-fields'); root.innerHTML = '';
  [["RestrictiveLayer","text"],["RestrictiveLayerDepthCM","number"],["SurfaceWaterYN","select",yesNo],["SurfaceWaterDepthCM","number"],["WaterTableYN","select",yesNo],["WaterTableDepthCM","number"],["SaturationYN","select",yesNo],["SaturationDepthCM","number"]].forEach(([n,t,o]) => root.appendChild(fieldEl(n,t,o)));
  root.appendChild(checkGroup('HydrologyPrimary', wetlandHydrologyPrimary));
  root.appendChild(checkGroup('HydrologySecondary', wetlandHydrologySecondary));
}

function renderSoils() {
  const root = document.getElementById('soil-fields');
  root.innerHTML = '';

  const top = document.createElement('div');
  top.className = 'card';
  top.innerHTML = `
    <div class='veg-head'>
      <h3 class='group-title'>Soil Horizons</h3>
      <div class='veg-controls'>
        <button data-soil-minus>−</button>
        <span class='veg-count'>${soilUi.horizonCount}</span>
        <button data-soil-plus>+</button>
      </div>
    </div>
  `;
  root.appendChild(top);

  for (let h = 1; h <= soilUi.horizonCount; h++) {
    const card = document.createElement('div');
    card.className = 'card';

    const collapsed = soilUi.horizons[h]?.collapsed;
    const head = document.createElement('div');
    head.className = 'veg-head';
    head.innerHTML = `
      <h3 class='group-title'>Soil Horizon ${h}</h3>
      <div class='veg-controls'>
        <button class='chevron' data-soil-collapse='${h}' aria-label='Toggle Soil Horizon ${h}'>${collapsed ? '▸' : '▾'}</button>
      </div>
    `;
    card.appendChild(head);

    if (!collapsed) {
      const table = document.createElement('div');
      table.className = 'soil-table';
      const pairs = [
        ['Thickness (cm)', `SoilH${h}ThickCM`, 'number', 'Texture', `SoilH${h}Texture`, 'text'],
        ['Matrix', `SoilH${h}Matrix`, 'text', 'Matrix %', `SoilH${h}MatrixPC`, 'number'],
        ['Redox', `SoilH${h}Redox`, 'text', 'Redox %', `SoilH${h}RedoxPC`, 'number'],
        ['Redox Type', `SoilH${h}RedoxType`, 'text', 'Redox Location', `SoilH${h}RedoxLoc`, 'text']
      ];

      pairs.forEach(([l1, k1, t1, l2, k2, t2]) => {
        const row = document.createElement('div');
        row.className = 'soil-row';

        const c1 = document.createElement('div');
        c1.className = 'soil-cell';
        c1.innerHTML = `<label>${l1}</label>`;
        const i1 = document.createElement('input');
        i1.type = t1; if (t1 === 'number') i1.step = 'any';
        i1.value = state[k1] ?? '';
        i1.oninput = () => { state[k1] = i1.value; queueAutosave(); };
        c1.appendChild(i1);

        const c2 = document.createElement('div');
        c2.className = 'soil-cell';
        c2.innerHTML = `<label>${l2}</label>`;
        const i2 = document.createElement('input');
        i2.type = t2; if (t2 === 'number') i2.step = 'any';
        i2.value = state[k2] ?? '';
        i2.oninput = () => { state[k2] = i2.value; queueAutosave(); };
        c2.appendChild(i2);

        row.append(c1, c2);
        table.appendChild(row);
      });
      card.appendChild(table);
    }

    root.appendChild(card);
  }

  root.appendChild(checkGroup('HydricSoilIndicators', hydricSoilIndicators));

  root.querySelector('[data-soil-minus]')?.addEventListener('click', () => {
    soilUi.horizonCount = Math.max(1, soilUi.horizonCount - 1);
    renderSoils();
  });
  root.querySelector('[data-soil-plus]')?.addEventListener('click', () => {
    soilUi.horizonCount = Math.min(4, soilUi.horizonCount + 1);
    renderSoils();
  });
  root.querySelectorAll('button[data-soil-collapse]').forEach(btn => btn.addEventListener('click', () => {
    const h = Number(btn.dataset.soilCollapse);
    soilUi.horizons[h].collapsed = !soilUi.horizons[h].collapsed;
    renderSoils();
  }));
}

function checkGroup(key, options) {
  const wrap = document.createElement('div'); wrap.className = 'card';
  wrap.innerHTML = `<h3 class='group-title'>${displayLabel(key)}</h3>`;
  const grid = document.createElement('div'); grid.className = 'grid';
  options.forEach(opt => {
    const row = document.createElement('label'); row.style.display='flex'; row.style.gap='.5rem';
    const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = (state[key]||[]).includes(opt);
    cb.onchange = () => { const set = new Set(state[key]||[]); cb.checked ? set.add(opt) : set.delete(opt); state[key] = [...set]; queueAutosave(); };
    row.append(cb, document.createTextNode(opt)); grid.appendChild(row);
  });
  wrap.appendChild(grid); return wrap;
}

function bindActions() {
  document.getElementById('btn-home').onclick = async () => {
    if (document.getElementById('view-form')?.classList.contains('active')) {
      const goHome = confirm('Return to dashboard? Your in-progress form will be saved to Drafts Library so you can resume later.');
      if (!goHome) return;
      await saveDraftSnapshot(`Dashboard return • ${state.SiteID || state.PLOT_ID || 'Untitled'}`);
    }
    await refreshDashboard();
    showView('home');
  };
  document.getElementById('btn-launch-new').onclick = () => { state = defaultSurvey(); renderFormPages(); queueAutosave(true); showView('form'); };
  document.getElementById('btn-open-submissions').onclick = async () => { surveys = await loadSurveys(); renderSubmissions(); showView('submissions'); };
  document.getElementById('btn-open-drafts').onclick = async () => { draftsLibrary = await loadDraftLibrary(); renderDraftsLibrary(); showView('drafts'); };
  document.getElementById('btn-open-plant-ref').onclick = () => { renderPlantReferenceList(''); showView('plant-ref'); };
  document.getElementById('btn-refresh-submissions').onclick = async () => { surveys = await loadSurveys(); renderSubmissions(); };
  document.getElementById('btn-refresh-drafts').onclick = async () => { draftsLibrary = await loadDraftLibrary(); renderDraftsLibrary(); };
  const plantSearch = document.getElementById('plant-ref-search');
  if (plantSearch) {
    plantSearch.oninput = () => renderPlantReferenceList(plantSearch.value || '');
  }

  document.getElementById('btn-prev-tab').onclick = () => setActiveTab(activeTabIndex - 1);
  document.getElementById('btn-next-tab').onclick = () => setActiveTab(activeTabIndex + 1);

  document.getElementById('btn-location').onclick = () => navigator.geolocation.getCurrentPosition(
    pos => { state.latitude = pos.coords.latitude; state.longitude = pos.coords.longitude; queueAutosave(true); renderFormPages(); },
    () => alert('Could not read location.')
  );

  document.addEventListener('change', async (e) => {
    if (e.target?.id === 'photo-input') {
      const files = [...e.target.files || []];
      const mapped = await Promise.all(files.map(fileToPhotoObject));
      state.photos = [...state.photos, ...mapped];
      queueAutosave(true); refreshPhotoPreview();
    }
  });

  document.getElementById('btn-submit').onclick = async (e) => {
    e?.preventDefault?.();
    try {
      state.timestamp = new Date().toISOString();
      state.id = makeId();

      const fullSubmission = cloneData(state);
      surveys.push(fullSubmission);
      let downgradedPhotos = false;

      try {
        await saveSurveys(surveys);
      } catch (err) {
        if (!isQuotaExceeded(err)) throw err;

        surveys[surveys.length - 1] = stripPhotoData(fullSubmission);
        await saveSurveys(surveys);
        downgradedPhotos = true;
      }

      await clearDraft();
      if (downgradedPhotos) {
        alert('Survey submitted, but photos were stored as metadata-only due to browser storage limits.');
      } else {
        alert(`Survey submitted. Saved count: ${surveys.length}`);
      }

      state = defaultSurvey();
      renderFormPages();
      await refreshDashboard();
      renderSubmissions();
      queueAutosave(true);
      showView('home');
    } catch (err) {
      console.error('Submit failed:', err);
      alert('Submit failed. Likely cause: browser storage limit reached. Try fewer/lower-res photos or clear older local submissions.');
    }
  };

  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) resetBtn.onclick = () => { if (!confirm('Reset current form?')) return; state = defaultSurvey(); renderFormPages(); queueAutosave(true); };
  const saveBtn = document.getElementById('btn-save-json');
  if (saveBtn) saveBtn.onclick = async () => { await saveDraft(state); alert('Draft saved.'); };
  const csvBtn = document.getElementById('btn-csv');
  if (csvBtn) csvBtn.onclick = async () => {
    surveys = await loadSurveys();
    return surveys.length
      ? smartExport({ content: toCSV(surveys), filename: `Survey_${dateStamp()}.csv`, mime: 'text/csv;charset=utf-8' })
      : alert('No submitted surveys.');
  };
  const gjBtn = document.getElementById('btn-geojson');
  if (gjBtn) gjBtn.onclick = async () => {
    surveys = await loadSurveys();
    return surveys.length
      ? smartExport({ content: JSON.stringify(toGeoJSON(surveys), null, 2), filename: `Survey_${dateStamp()}.geojson`, mime: 'application/geo+json' })
      : alert('No submitted surveys.');
  };

  const installBtn = document.getElementById('btn-install');
  if (installBtn) installBtn.onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installBtn.hidden = true; };
}

function renderSubmissions() {
  const list = document.getElementById('submission-list');
  const detail = document.getElementById('submission-detail');
  list.innerHTML = '';
  if (!surveys.length) { list.innerHTML = `<div class='card muted'>No submissions yet.</div>`; detail.innerHTML = `<p class='muted'>No data to preview.</p>`; return; }

  [...surveys].reverse().forEach(s => {
    const item = document.createElement('div'); item.className = 'submission-item';
    item.innerHTML = `<h4>${s.SiteID || 'Untitled Site'} · ${s.PLOT_ID || 'No Plot ID'}</h4><p>${new Date(s.timestamp).toLocaleString()}</p><div class='row'><button data-view='${s.id}'>Preview</button><button data-load='${s.id}'>Load into form</button><button data-delete='${s.id}'>Delete</button><button data-export='geojson:${s.id}'>GeoJSON</button><button data-export='md:${s.id}'>Markdown</button><button data-export='csv:${s.id}'>CSV</button><button data-export='html:${s.id}'>HTML</button><button data-export='pdf:${s.id}'>PDF</button></div>`;
    list.appendChild(item);
  });

  list.querySelectorAll('button[data-view]').forEach(b => b.onclick = () => {
    const id = b.dataset.view; const s = surveys.find(x => x.id === id); if (!s) return;
    const previewKeys = ['PLOT_ID','LocaleName','observer','latitude','longitude','DistSoilYN','DistVegYN','DistHydroYN','SummaryHydroVegYN','SummaryHydricSoilYN','SummaryHydrologyYN','SummaryInWetlandYN','notes'];
    detail.innerHTML = `<h3>${s.SiteID || 'Untitled Site'}</h3><p class='muted'>${new Date(s.timestamp).toLocaleString()}</p><div>${previewKeys.map(k => `<p><strong>${displayLabel(k)}:</strong> ${s[k] ?? ''}</p>`).join('')}<p><strong>Photos:</strong> ${(s.photos||[]).map(p=>p.name).join(', ') || '—'}</p></div>`;
  });

  list.querySelectorAll('button[data-load]').forEach(b => b.onclick = async () => {
    const id = b.dataset.load; const s = surveys.find(x => x.id === id); if (!s) return;
    state = cloneData(s); await saveDraft(state);
    renderFormPages(); showView('form'); setActiveTab(0);
  });

  list.querySelectorAll('button[data-delete]').forEach(b => b.onclick = async () => {
    const id = b.dataset.delete;
    if (!confirm('Delete this submission?')) return;
    surveys = surveys.filter(x => x.id !== id);
    await saveSurveys(surveys);
    renderSubmissions(); await refreshDashboard();
  });

  list.querySelectorAll('button[data-export]').forEach(b => b.onclick = () => {
    const [fmt, id] = b.dataset.export.split(':');
    const s = surveys.find(x => x.id === id);
    if (!s) return;
    exportRecord(fmt, s);
  });
}

function renderDraftsLibrary() {
  const list = document.getElementById('draft-list');
  const detail = document.getElementById('draft-detail');
  if (!list || !detail) return;
  list.innerHTML = '';

  if (!draftsLibrary.length) {
    list.innerHTML = `<div class='card muted'>No draft snapshots yet.</div>`;
    detail.innerHTML = `<p class='muted'>No draft selected.</p>`;
    return;
  }

  [...draftsLibrary].reverse().forEach(d => {
    const survey = d.survey || {};
    const pageName = pageOrder[d.activeTabIndex] || pageOrder[0];
    const label = pageName[0].toUpperCase() + pageName.slice(1);
    const item = document.createElement('div');
    item.className = 'submission-item';
    item.innerHTML = `<h4>${d.name || survey.SiteID || 'Untitled Draft'} · ${survey.PLOT_ID || 'No Plot ID'}</h4><p>${new Date(d.timestamp).toLocaleString()} · Resume on ${label}</p><div class='row'><button data-preview='${d.id}'>Preview</button><button data-resume='${d.id}'>Resume Draft</button><button data-delete='${d.id}'>Delete</button></div>`;
    list.appendChild(item);
  });

  list.querySelectorAll('button[data-preview]').forEach(b => b.onclick = () => {
    const d = draftsLibrary.find(x => x.id === b.dataset.preview);
    if (!d) return;
    const s = d.survey || {};
    const pageName = pageOrder[d.activeTabIndex] || pageOrder[0];
    detail.innerHTML = `<h3>${d.name || s.SiteID || 'Untitled Draft'}</h3><p class='muted'>Resume section: ${pageName[0].toUpperCase() + pageName.slice(1)}</p><p><strong>Site ID:</strong> ${s.SiteID || '—'}</p><p><strong>Plot ID:</strong> ${s.PLOT_ID || '—'}</p><p><strong>Observer:</strong> ${s.observer || '—'}</p><p><strong>Last update:</strong> ${new Date(d.timestamp).toLocaleString()}</p>`;
  });

  list.querySelectorAll('button[data-resume]').forEach(b => b.onclick = async () => {
    const d = draftsLibrary.find(x => x.id === b.dataset.resume);
    if (!d) return;
    state = cloneData(d.survey || defaultSurvey());
    await saveDraft(state);
    renderFormPages();
    showView('form');
    setActiveTab(typeof d.activeTabIndex === 'number' ? d.activeTabIndex : 0);
  });

  list.querySelectorAll('button[data-delete]').forEach(b => b.onclick = async () => {
    const id = b.dataset.delete;
    if (!confirm('Delete this draft snapshot?')) return;
    draftsLibrary = draftsLibrary.filter(x => x.id !== id);
    await saveDraftLibrary(draftsLibrary);
    await refreshDashboard();
    renderDraftsLibrary();
  });

  refreshLucideIcons();
}

async function refreshDashboard() {
  const stats = document.getElementById('dashboard-stats');
  const draft = await loadDraft();
  const lastSubmitted = surveys.at(-1);
  const lastDraft = draftsLibrary.at(-1);
  stats.innerHTML = [
    `<div class='card'><div class='stat-head'><i data-lucide='clipboard-check'></i><h3>${surveys.length}</h3></div><p class='stat-note'>Submitted Forms</p></div>`,
    `<div class='card'><div class='stat-head'><i data-lucide='save'></i><h3>${draft ? 'Active' : 'None'}</h3></div><p class='stat-note'>Current Working Draft</p></div>`,
    `<div class='card'><div class='stat-head'><i data-lucide='library'></i><h3>${draftsLibrary.length}</h3></div><p class='stat-note'>Draft Snapshots in Library</p></div>`,
    `<div class='card'><div class='stat-head'><i data-lucide='map-pin'></i><h3>${lastSubmitted?.SiteID || '-'}</h3></div><p class='stat-note'>Latest submitted site · ${lastSubmitted ? new Date(lastSubmitted.timestamp).toLocaleDateString() : 'No submissions yet'}</p></div>`,
    `<div class='card'><div class='stat-head'><i data-lucide='clock-3'></i><h3>${lastDraft?.survey?.PLOT_ID || '-'}</h3></div><p class='stat-note'>Most recent draft snapshot · ${lastDraft ? new Date(lastDraft.timestamp).toLocaleDateString() : 'No snapshots yet'}</p></div>`
  ].join('');
  refreshLucideIcons();
}

function normalizeStatus(status) {
  const s = String(status || '').toUpperCase().replace(/\s+/g, '');
  if (s.startsWith('OBL')) return 'OBL';
  if (s.startsWith('FACW')) return 'FACW';
  if (s === 'FAC' || s.startsWith('FAC+')) return 'FAC';
  if (s.startsWith('FACU')) return 'FACU';
  if (s.startsWith('UPL')) return 'UPL';
  return '';
}

function parseLegacySpeciesLine(line) {
  const m = String(line || '').match(/^([^\s-]+)\s*-\s*(.*?)\s*\((.*?)\)\s*-\s*([A-Za-z0-9+\-?]+)\s*$/);
  if (!m) return null;
  return {
    mcode: m[1].trim(),
    commonName: m[2].trim(),
    scientificName: m[3].trim(),
    indicatorStatus: normalizeStatus(m[4].trim()) || m[4].trim().toUpperCase()
  };
}

function speciesDisplay(rec) {
  const code = rec.mcode ? `${rec.mcode} - ` : '';
  const common = rec.commonName || 'Unknown';
  const sci = rec.scientificName || 'Unknown';
  const status = rec.indicatorStatus || 'NA';
  return `${code}${common} (${sci}) - ${status}`;
}

function speciesSearchKey(rec) {
  return [rec.mcode, rec.elcode, rec.commonName, rec.scientificName].filter(Boolean).join(' ').toLowerCase();
}

function extractScientificName(text) {
  const raw = String(text || '');
  const m = raw.match(/\(([^)]+)\)/);
  if (m && m[1]) return m[1].trim();
  return raw.trim() || '—';
}

function extractCommonName(text) {
  const raw = String(text || '');
  const noCode = raw.replace(/^[^-]+-\s*/, '');
  const m = noCode.match(/^(.*?)\s*\(([^)]+)\)\s*-\s*[A-Za-z0-9+\-?]+\s*$/);
  if (m && m[1]) return m[1].trim();
  return noCode.trim() || '—';
}

function searchPlantReference(q) {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return plantReferenceRecords.slice(0, 100);
  return plantReferenceRecords.filter(r => {
    const fields = [
      r['AC CDC Name'], r['GS Name'], r['AC CDC English Name'], r['GS English Name'],
      r['ELCODE'], r['NS Wetland Indicator Rank']
    ].filter(Boolean).join(' ').toLowerCase();
    return fields.includes(query);
  }).slice(0, 150);
}

function renderPlantReferenceList(query = '') {
  const list = document.getElementById('plant-ref-results');
  const detail = document.getElementById('plant-ref-detail');
  if (!list || !detail) return;
  const rows = searchPlantReference(query);
  if (!rows.length) {
    list.innerHTML = `<div class='card muted'>No matching species.</div>`;
    detail.innerHTML = `<p class='muted'>No record selected.</p>`;
    return;
  }
  list.innerHTML = '';
  rows.forEach((r, idx) => {
    const btn = document.createElement('button');
    btn.className = 'launch-card';
    const sci = r['AC CDC Name'] || r['GS Name'] || 'Unknown';
    const common = r['AC CDC English Name'] || r['GS English Name'] || 'Unknown';
    const code = r['ELCODE'] || '—';
    const status = String(r['NS Wetland Indicator Rank'] || '').toUpperCase() || '—';
    btn.innerHTML = `<strong>${common}</strong><span><em>${sci}</em> · ${code} · ${status}</span>`;
    btn.onclick = () => {
      const entries = Object.entries(r).filter(([,v]) => String(v || '').trim() !== '');
      detail.innerHTML = `<h3>${common}</h3><p class='muted'><em>${sci}</em></p><div>${entries.map(([k,v]) => `<p><strong>${k}:</strong> ${v}${speciesDataDictionary[k] ? `<br><span class='muted'>${speciesDataDictionary[k]}</span>` : ''}</p>`).join('')}</div>`;
    };
    list.appendChild(btn);
    if (idx === 0 && !query) btn.click();
  });
}

async function loadSpecies() {
  try {
    const [legacyRes, nsRes, fullRes, dictRes] = await Promise.all([
      fetch('./VASC_names.json'),
      fetch('./species_ns_indicators.json'),
      fetch('./species_ns_full_records.json'),
      fetch('./species_ns_data_dictionary.json')
    ]);
    const legacyRaw = legacyRes.ok ? await legacyRes.json() : [];
    const nsRaw = nsRes.ok ? await nsRes.json() : [];
    plantReferenceRecords = fullRes.ok ? await fullRes.json() : [];
    speciesDataDictionary = dictRes.ok ? await dictRes.json() : {};

    const legacy = (Array.isArray(legacyRaw) ? legacyRaw : [])
      .map(parseLegacySpeciesLine)
      .filter(Boolean);

    const bySci = new Map();
    const byCommon = new Map();
    nsRaw.forEach(r => {
      const rec = {
        elcode: r.elcode || '',
        scientificName: String(r.scientificName || '').trim(),
        commonName: String(r.commonName || '').trim(),
        indicatorStatus: normalizeStatus(r.nsWetlandIndicator || '')
      };
      if (rec.scientificName) bySci.set(rec.scientificName.toLowerCase(), rec);
      if (rec.commonName) byCommon.set(rec.commonName.toLowerCase(), rec);
    });

    const merged = [];
    legacy.forEach(l => {
      const ns = bySci.get((l.scientificName || '').toLowerCase()) || byCommon.get((l.commonName || '').toLowerCase());
      merged.push({
        mcode: l.mcode || '',
        elcode: ns?.elcode || '',
        scientificName: l.scientificName || ns?.scientificName || '',
        commonName: l.commonName || ns?.commonName || '',
        indicatorStatus: ns?.indicatorStatus || l.indicatorStatus || ''
      });
    });

    // add NS-only records not present in legacy list
    nsRaw.forEach(r => {
      const sci = String(r.scientificName || '').trim();
      if (!sci) return;
      if (merged.some(m => (m.scientificName || '').toLowerCase() === sci.toLowerCase())) return;
      merged.push({
        mcode: '',
        elcode: r.elcode || '',
        scientificName: sci,
        commonName: String(r.commonName || '').trim(),
        indicatorStatus: normalizeStatus(r.nsWetlandIndicator || '')
      });
    });

    speciesRecords = merged;
    speciesDisplayMap = new Map();
    speciesList = merged.map(speciesDisplay);
    speciesList.forEach((d, i) => speciesDisplayMap.set(d, merged[i]));
  } catch (err) {
    console.warn('Species load failed:', err);
  }
}

function buildSpeciesDatalist() {
  document.getElementById('species-options')?.remove();
  const dl = document.createElement('datalist'); dl.id = 'species-options';
  speciesList.slice(0, 6000).forEach(s => { const o = document.createElement('option'); o.value = s; dl.appendChild(o); });
  document.body.appendChild(dl);
}

function findSpeciesRecord(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;
  if (speciesDisplayMap.has(query)) return speciesDisplayMap.get(query);

  // strict matching only to avoid aggressive auto-replacement while typing
  const exact = speciesRecords.find(r => {
    const keys = [r.mcode, r.elcode, r.commonName, r.scientificName].filter(Boolean).map(v => String(v).toLowerCase());
    return keys.includes(q);
  });
  if (exact) return exact;

  // exact display text (case-insensitive)
  return speciesRecords.find(r => speciesDisplay(r).toLowerCase() === q) || null;
}

function applySpeciesLookup(group, i, raw) {
  const rec = findSpeciesRecord(raw);
  if (!rec) {
    state[`${group}Sp${i}Status`] = '';
    return;
  }
  state[`${group}Sp${i}`] = speciesDisplay(rec);
  state[`${group}Sp${i}Status`] = rec.indicatorStatus || '';
}

async function fileToPhotoObject(file) {
  const dataUrl = await new Promise(resolve => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.readAsDataURL(file); });
  return { name:file.name, type:file.type, size:file.size, dataUrl, ts:new Date().toISOString() };
}

function refreshPhotoPreview() {
  const root = document.getElementById('photo-preview'); if (!root) return;
  root.innerHTML = '';
  (state.photos || []).forEach((p, idx) => {
    const item = document.createElement('div'); item.className = 'photo-item';
    item.innerHTML = `<img src='${p.dataUrl}' alt='${p.name}' /><button data-remove='${idx}'>×</button>`;
    root.appendChild(item);
  });
  root.querySelectorAll('button[data-remove]').forEach(btn => btn.onclick = () => { state.photos.splice(Number(btn.dataset.remove),1); queueAutosave(true); refreshPhotoPreview(); });
}

function displayLabel(key) {
  const m = key.match(/^(Tree|Shrub|Herb)Sp(\d+)(Cov|Status|Dom)?$/);
  if (m) {
    const suffix = m[3] === 'Cov' ? ' % Cover' : m[3] === 'Status' ? ' Indicator Status' : m[3] === 'Dom' ? ' Dominant?' : '';
    return `${m[1]} Species #${m[2]}${suffix}`;
  }
  const h = key.match(/^SoilH(\d+)(ThickCM|Texture|Matrix|MatrixPC|Redox|RedoxPC|RedoxType|RedoxLoc)$/);
  if (h) {
    const map = { ThickCM: 'Thickness (cm)', Texture: 'Texture', Matrix: 'Matrix Color', MatrixPC: 'Matrix %', Redox: 'Redox Color', RedoxPC: 'Redox %', RedoxType: 'Redox Type', RedoxLoc: 'Redox Location' };
    return `Soil Horizon ${h[1]} ${map[h[2]]}`;
  }
  const fixed = {
    SiteID: 'Site ID', LocaleName: 'Locale', PLOT_ID: 'Plot ID', WetlandID: 'Wetland ID', PLOT_TYPE: 'Plot Type',
    DistSoilYN: 'Disturbed Soils?', DistVegYN: 'Disturbed Vegetation?', DistHydroYN: 'Disturbed Hydrology?',
    ProbSoilYN: 'Problematic Soils?', ProbVegYN: 'Problematic Vegetation?', ProbHydroYN: 'Problematic Hydrology?',
    ClimHydroNormalYN: 'Normal Climatic Conditions?', CircNormalYN: 'Normal Circumstances Present?',
    SummaryHydroVegYN: 'Hydrophytic Vegetation Present?', SummaryHydricSoilYN: 'Hydric Soils Present?',
    SummaryHydrologyYN: 'Wetland Hydrology Present?', SummaryInWetlandYN: 'Sampling Location in Wetland?',
    RestrictiveLayerDepthCM: 'Restrictive Layer Depth (cm)', SurfaceWaterDepthCM: 'Surface Water Depth (cm)', WaterTableDepthCM: 'Water Table Depth (cm)', SaturationDepthCM: 'Saturation Depth (cm)',
    HydricSoilIndicators: 'Hydric Soil Indicators'
  };
  if (fixed[key]) return fixed[key];
  return key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\bYN\b/g, '?');
}

function cloneData(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}
function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function isQuotaExceeded(err) {
  return err && (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}
function stripPhotoData(survey) {
  return {
    ...survey,
    photos: (survey.photos || []).map(p => ({
      name: p?.name || 'photo',
      type: p?.type || '',
      size: p?.size || 0,
      ts: p?.ts || new Date().toISOString(),
      stored: 'metadata-only'
    }))
  };
}

let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key, fallback = null) {
  const db = await openDb();
  const tx = db.transaction(KV_STORE, 'readonly');
  const val = await idbRequest(tx.objectStore(KV_STORE).get(key));
  return val ?? fallback;
}
async function idbSet(key, value) {
  const db = await openDb();
  const tx = db.transaction(KV_STORE, 'readwrite');
  tx.objectStore(KV_STORE).put(value, key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
async function idbDelete(key) {
  const db = await openDb();
  const tx = db.transaction(KV_STORE, 'readwrite');
  tx.objectStore(KV_STORE).delete(key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function migrateLegacyLocalStorage() {
  try {
    const existingDraft = await idbGet(DRAFT_KEY, null);
    if (existingDraft == null) {
      const rawDraft = localStorage.getItem(DRAFT_KEY);
      if (rawDraft) {
        try { await idbSet(DRAFT_KEY, JSON.parse(rawDraft)); } catch {}
      }
    }
    const existingSurveys = await idbGet(SURVEYS_KEY, null);
    if (existingSurveys == null) {
      const rawSurveys = localStorage.getItem(SURVEYS_KEY);
      if (rawSurveys) {
        try { await idbSet(SURVEYS_KEY, JSON.parse(rawSurveys)); } catch {}
      }
    }
    const existingDraftLibrary = await idbGet(DRAFT_LIBRARY_KEY, null);
    if (existingDraftLibrary == null) {
      const rawDraftLibrary = localStorage.getItem(DRAFT_LIBRARY_KEY);
      if (rawDraftLibrary) {
        try { await idbSet(DRAFT_LIBRARY_KEY, JSON.parse(rawDraftLibrary)); } catch {}
      }
    }
  } catch (err) {
    console.warn('Legacy migration skipped:', err);
  }
}

async function loadDraft() { return await idbGet(DRAFT_KEY, null); }
async function loadDraftLibrary() { return await idbGet(DRAFT_LIBRARY_KEY, []); }
async function loadSurveys() { return await idbGet(SURVEYS_KEY, []); }
async function saveDraft(draft) { await idbSet(DRAFT_KEY, draft); }
async function saveDraftLibrary(rows) { await idbSet(DRAFT_LIBRARY_KEY, rows); }
async function saveSurveys(rows) { await idbSet(SURVEYS_KEY, rows); }
async function clearDraft() { await idbDelete(DRAFT_KEY); }

async function saveDraftSnapshot(name = 'In-progress draft') {
  const snapshot = {
    id: makeId(),
    name,
    timestamp: new Date().toISOString(),
    activeTabIndex,
    survey: cloneData(state)
  };
  draftsLibrary = [...draftsLibrary, snapshot].slice(-100);
  await saveDraftLibrary(draftsLibrary);
  await saveDraft(state);
}

function queueAutosave(immediate=false) {
  const save = async () => {
    try {
      await saveDraft(state);
    } catch (err) {
      if (isQuotaExceeded(err)) {
        try {
          const slim = stripPhotoData(state);
          await saveDraft(slim);
          console.warn('Draft exceeded storage quota; saved metadata-only photos.');
        } catch (err2) {
          console.error('Draft autosave failed:', err2);
        }
      } else {
        console.error('Draft autosave failed:', err);
      }
    }
  };
  if (immediate) return save();
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => { void save(); }, 350);
}

function toCSV(rows) {
  const normalized = rows.map(r => ({ ...r, photos:(r.photos||[]).map(p=>p.name).join(';') }));
  const headers = [...new Set(normalized.flatMap(r => Object.keys(r)))];
  const esc = v => `"${String(Array.isArray(v)?v.join(';'):(v??'')).replaceAll('"', "''")}"`;
  return [headers.join(','), ...normalized.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}
function toGeoJSON(rows) { return { type:'FeatureCollection', features:rows.map(r => ({ type:'Feature', geometry:{ type:'Point', coordinates:[Number(r.longitude)||0, Number(r.latitude)||0] }, properties:r })) }; }

function exportCleanRecord(s) {
  return {
    ...s,
    photos: (s.photos || []).map(p => (typeof p === 'string' ? p : (p?.name || 'photo')))
  };
}

function speciesRows(s, group, n) {
  const rows = [];
  for (let i = 1; i <= n; i++) {
    const sp = s[`${group}Sp${i}`];
    const cov = s[`${group}Sp${i}Cov`];
    if (sp || cov) rows.push([sp || '—', cov || '—']);
  }
  return rows.length ? rows : [['—', '—']];
}

function soilRows(s) {
  const rows = [];
  for (let h = 1; h <= 4; h++) {
    const thick = s[`SoilH${h}ThickCM`];
    const texture = s[`SoilH${h}Texture`];
    const matrix = s[`SoilH${h}Matrix`];
    const matrixPC = s[`SoilH${h}MatrixPC`];
    const redox = s[`SoilH${h}Redox`];
    const redoxPC = s[`SoilH${h}RedoxPC`];
    const redoxType = s[`SoilH${h}RedoxType`];
    const redoxLoc = s[`SoilH${h}RedoxLoc`];
    if ([thick, texture, matrix, matrixPC, redox, redoxPC, redoxType, redoxLoc].some(Boolean)) {
      rows.push([`H${h}`, thick || '—', texture || '—', matrix || '—', matrixPC || '—', redox || '—', redoxPC || '—', redoxType || '—', redoxLoc || '—']);
    }
  }
  return rows.length ? rows : [['H1', '—', '—', '—', '—', '—', '—', '—', '—']];
}

function vegetationEntriesFromSurvey(s) {
  const entries = [];
  const groups = [['Tree', 6], ['Shrub', 6], ['Herb', 10]];
  groups.forEach(([g, n]) => {
    for (let i = 1; i <= n; i++) {
      const sp = s[`${g}Sp${i}`];
      const cov = Number(s[`${g}Sp${i}Cov`] || 0);
      const status = normalizeStatus(s[`${g}Sp${i}Status`] || '');
      const manualDom = !!s[`${g}Sp${i}Dom`];
      if (!sp && !cov) continue;
      entries.push({ group: g, i, species: sp || '—', cover: Number.isFinite(cov) ? cov : 0, status, manualDom });
    }
  });
  return entries;
}

function vegetationEntries() {
  return vegetationEntriesFromSurvey(state);
}

function autoDominantSet(entries) {
  // 50/20 rule by stratum:
  // 1) sort by descending absolute cover
  // 2) include species until cumulative cover > 50% of total stratum cover
  // 3) include any additional species with >= 20% of total stratum cover
  const byGroup = new Map();
  entries.forEach(e => {
    if (!byGroup.has(e.group)) byGroup.set(e.group, []);
    byGroup.get(e.group).push(e);
  });

  const set = new Set();
  for (const arr of byGroup.values()) {
    const sorted = [...arr].filter(e => e.cover > 0).sort((a, b) => b.cover - a.cover);
    const total = sorted.reduce((acc, e) => acc + (e.cover || 0), 0);
    if (total <= 0) continue;

    let cum = 0;
    for (const e of sorted) {
      set.add(`${e.group}:${e.i}`);
      cum += e.cover;
      if (cum > (0.5 * total)) break;
    }

    const min20 = 0.2 * total;
    sorted.forEach(e => {
      if (e.cover >= min20) set.add(`${e.group}:${e.i}`);
    });
  }
  return set;
}

function recomputeDominanceFlags() {
  const entries = vegetationEntries();
  const autoSet = autoDominantSet(entries);
  entries.forEach(e => {
    state[`${e.group}Sp${e.i}Dom`] = autoSet.has(`${e.group}:${e.i}`);
  });
}

function vegetationMetricsFromSurvey(s) {
  const entries = vegetationEntriesFromSurvey(s);
  const autoSet = autoDominantSet(entries);
  const dominant = entries.filter(e => autoSet.has(`${e.group}:${e.i}`));

  const dominanceB = dominant.length;
  const dominanceA = dominant.filter(e => ['OBL', 'FACW', 'FAC'].includes(e.status)).length;
  const dominancePct = dominanceB ? (dominanceA / dominanceB) * 100 : 0;

  const cover = { OBL: 0, FACW: 0, FAC: 0, FACU: 0, UPL: 0 };
  entries.forEach(e => { if (cover[e.status] != null) cover[e.status] += (e.cover || 0); });

  const A = cover.OBL + cover.FACW + cover.FAC + cover.FACU + cover.UPL;
  const B = cover.OBL * 1 + cover.FACW * 2 + cover.FAC * 3 + cover.FACU * 4 + cover.UPL * 5;
  const prevalenceIndex = A > 0 ? (B / A) : 0;

  return {
    dominanceA,
    dominanceB,
    dominancePct,
    dominancePass: dominancePct > 50,
    prevalenceIndex,
    prevalencePass: A > 0 ? prevalenceIndex <= 3.0 : false,
    cover,
    dominant
  };
}

function vegetationMetrics() {
  return vegetationMetricsFromSurvey(state);
}

function markdownTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(r => `| ${r.map(v => String(v ?? '—')).join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}`;
}

function recordMarkdown(s) {
  const lines = [
    `# WETLAND DELINEATION DATA FORM – NOVA SCOTIA`,
    ``,
    `![Fraxinus Logo](assets/fraxinus-logo.svg)`,
    ``,
    `**Plot ID:** ${s.PLOT_ID || '—'}`,
    ``,
    `## 1. Survey Metadata`
  ];

  ['SiteID','LocaleName','observer','latitude','longitude','Province','date','time','PLOT_TYPE','WetlandID'].forEach(k => {
    lines.push(`- **${displayLabel(k)}:** ${s[k] || '—'}`);
  });

  lines.push('', '## 2. Disturbance & Problematic Conditions');
  ['DistSoilYN','DistVegYN','DistHydroYN','ProbSoilYN','ProbVegYN','ProbHydroYN','ClimHydroNormalYN','CircNormalYN'].forEach(k => lines.push(`- **${displayLabel(k)}:** ${s[k] || '—'}`));

  lines.push('', '## 3. Summary Conditions');
  ['SummaryHydroVegYN','SummaryHydrologyYN','SummaryHydricSoilYN','SummaryInWetlandYN'].forEach(k => lines.push(`- **${displayLabel(k)}:** ${s[k] || '—'}`));

  lines.push('', '## 4. Vegetation', '### A. Tree Species', markdownTable(['Species', '% Cover'], speciesRows(s, 'Tree', 6)));
  lines.push('', '### B. Shrub Species', markdownTable(['Species', '% Cover'], speciesRows(s, 'Shrub', 6)));
  lines.push('', '### C. Herb Species', markdownTable(['Species', '% Cover'], speciesRows(s, 'Herb', 10)));

  lines.push('', '## 5. Hydric Soils', markdownTable(['Horizon','Thickness (cm)','Texture','Matrix','Matrix %','Redox','Redox %','Type','Location'], soilRows(s)));
  lines.push('', `**Hydric Soil Indicators:** ${(s.HydricSoilIndicators||[]).join(', ') || '—'}`);

  lines.push('', '## 6. Wetland Hydrology');
  ['RestrictiveLayer','RestrictiveLayerDepthCM','SurfaceWaterYN','SurfaceWaterDepthCM','WaterTableYN','WaterTableDepthCM','SaturationYN','SaturationDepthCM'].forEach(k => lines.push(`- **${displayLabel(k)}:** ${s[k] || '—'}`));
  lines.push(`- **Primary Indicators:** ${(s.HydrologyPrimary||[]).join(', ') || '—'}`);
  lines.push(`- **Secondary Indicators:** ${(s.HydrologySecondary||[]).join(', ') || '—'}`);

  lines.push('', '## 7. Notes', s.notes || '—');
  return lines.join('\n');
}

function recordHTML(s) {
  const val = (k) => s[k] || '—';
  const yesNo = (k) => (s[k] === 'Yes' ? 'Yes' : s[k] === 'No' ? 'No' : (s[k] || '—'));
  const logoUrl = new URL('assets/fraxinus-logo.svg', window.location.href).href;

  const metadataRows = [
    ['Site Name', val('SiteID')],
    ['Plot ID', val('PLOT_ID')],
    ['Wetland ID', val('WetlandID')],
    ['Surveyor', val('observer')],
    ['Locale', val('LocaleName')],
    ['Province', val('Province')],
    ['Date', val('date')],
    ['Time', val('time')],
    ['Latitude', val('latitude')],
    ['Longitude', val('longitude')],
    ['Plot Type', val('PLOT_TYPE')]
  ];

  const summaryItems = [
    ['Hydrophytic Vegetation?', yesNo('SummaryHydroVegYN')],
    ['Wetland Hydrology?', yesNo('SummaryHydrologyYN')],
    ['Hydric Soil?', yesNo('SummaryHydricSoilYN')],
    ['Point in Wetland?', yesNo('SummaryInWetlandYN')]
  ];

  const vegRows = [
    ...speciesRows(s, 'Tree', 6).map(r => ['Tree', r[0], r[1]]),
    ...speciesRows(s, 'Shrub', 6).map(r => ['Shrub', r[0], r[1]]),
    ...speciesRows(s, 'Herb', 10).map(r => ['Herb', r[0], r[1]])
  ];

  const soils = soilRows(s);
  const photoBlock = (s.photos || []).length
    ? `<div class='section'><h2>Field Photos</h2><div class='photo-grid'>${(s.photos||[]).map((p,idx)=>`<figure><img src='${p.dataUrl || ''}' alt='${p.name || `Photo ${idx+1}`}'/><figcaption>${p.name || `Photo ${idx+1}`}</figcaption></figure>`).join('')}</div></div>`
    : `<div class='section'><h2>Field Photos</h2><p class='muted'>No photos attached.</p></div>`;

  const now = new Date().toLocaleString();

  return `<!doctype html><html><head><meta charset='utf-8'/><title>${s.PLOT_ID||'Wetland Report'}</title>
  <style>
    :root{--ink:#0f172a;--muted:#475569;--line:#cbd5e1;--head:#e2e8f0;--bg:#f8fafc;--accent:#0b6b50}
    *{box-sizing:border-box}
    body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;margin:0;color:var(--ink);line-height:1.35;background:#fff}
    .page{max-width:980px;margin:0 auto;padding:24px}
    .header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid var(--line);padding-bottom:12px;margin-bottom:16px}
    .header-left{display:flex;gap:12px;align-items:flex-start}
    .header img{width:44px;height:44px;object-fit:contain}
    h1{font-size:22px;line-height:1.15;margin:0 0 4px}
    .sub{margin:0;color:var(--muted);font-size:12px}
    .stamp{font-size:12px;color:var(--muted);text-align:right;white-space:nowrap}
    .section{margin:14px 0}
    h2{font-size:16px;margin:0 0 8px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:8px}
    .card{border:1px solid var(--line);background:var(--bg);padding:10px;border-radius:6px}
    .card .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.02em}
    .card .value{font-size:14px;font-weight:700;color:var(--accent);margin-top:2px}
    table{width:100%;border-collapse:collapse;margin:0}
    th,td{border:1px solid var(--line);padding:6px 8px;font-size:12px;vertical-align:top}
    th{background:var(--head);text-align:left}
    .muted{color:var(--muted)}
    .chipline{margin-top:8px;font-size:12px}
    .chipline strong{color:#111827}
    .photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    figure{margin:0;border:1px solid var(--line);padding:6px;border-radius:6px}
    figure img{width:100%;height:auto;display:block;border-radius:4px}
    figcaption{font-size:11px;color:var(--muted);margin-top:4px}
    @media print {
      .page{padding:16px}
      .cards{grid-template-columns:repeat(2,minmax(0,1fr))}
      .section{page-break-inside:avoid}
    }
  </style></head><body>
  <div class='page'>
    <div class='header'>
      <div class='header-left'>
        <img src='${logoUrl}' alt='Fraxinus'/>
        <div>
          <h1>Wetland Delineation Report</h1>
          <p class='sub'>Nova Scotia Field Data Form</p>
        </div>
      </div>
      <div class='stamp'>Generated ${now}</div>
    </div>

    <div class='section'>
      <h2>Survey Metadata</h2>
      <table>
        <thead><tr><th style='width:38%'>Field</th><th>Value</th></tr></thead>
        <tbody>
          ${metadataRows.map(([k,v])=>`<tr><td>${k}</td><td>${v || '—'}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class='section'>
      <h2>Summary</h2>
      <div class='cards'>
        ${summaryItems.map(([k,v])=>`<div class='card'><div class='label'>${k}</div><div class='value'>${v}</div></div>`).join('')}
      </div>
    </div>

    <div class='section'>
      <h2>Disturbance & Problematic Conditions</h2>
      <table>
        <thead><tr><th>Condition</th><th>Value</th></tr></thead>
        <tbody>
          ${[
            'DistSoilYN','DistVegYN','DistHydroYN','ProbSoilYN','ProbVegYN','ProbHydroYN','ClimHydroNormalYN','CircNormalYN'
          ].map(k=>`<tr><td>${displayLabel(k)}</td><td>${yesNo(k)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class='section'>
      <h2>Vegetation</h2>
      <table>
        <thead><tr><th style='width:12%'>Layer</th><th>Species</th><th style='width:16%'>% Cover</th></tr></thead>
        <tbody>
          ${vegRows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('') || `<tr><td colspan='3' class='muted'>No vegetation records.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class='section'>
      <h2>Hydric Soils</h2>
      <table>
        <thead><tr><th>Horizon</th><th>Thickness (cm)</th><th>Texture</th><th>Matrix</th><th>Matrix %</th><th>Redox</th><th>Redox %</th><th>Type</th><th>Location</th></tr></thead>
        <tbody>${soils.map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      <p class='chipline'><strong>Hydric Soil Indicators:</strong> ${(s.HydricSoilIndicators||[]).join(', ') || '—'}</p>
    </div>

    <div class='section'>
      <h2>Wetland Hydrology</h2>
      <table>
        <thead><tr><th>Field</th><th>Value</th></tr></thead>
        <tbody>
          ${['RestrictiveLayer','RestrictiveLayerDepthCM','SurfaceWaterYN','SurfaceWaterDepthCM','WaterTableYN','WaterTableDepthCM','SaturationYN','SaturationDepthCM'].map(k=>`<tr><td>${displayLabel(k)}</td><td>${val(k)}</td></tr>`).join('')}
        </tbody>
      </table>
      <p class='chipline'><strong>Primary Indicators:</strong> ${(s.HydrologyPrimary||[]).join(', ') || '—'}</p>
      <p class='chipline'><strong>Secondary Indicators:</strong> ${(s.HydrologySecondary||[]).join(', ') || '—'}</p>
    </div>

    <div class='section'>
      <h2>Notes</h2>
      <p>${s.notes || '—'}</p>
    </div>

    ${photoBlock}
  </div>
  </body></html>`;
}

let jsPdfCtorPromise = null;
async function loadJsPdfCtor() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  if (!jsPdfCtorPromise) {
    jsPdfCtorPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      script.async = true;
      script.onload = () => {
        if (window.jspdf?.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error('jsPDF loaded but constructor missing'));
      };
      script.onerror = () => reject(new Error('Failed to load jsPDF library'));
      document.head.appendChild(script);
    });
  }
  return jsPdfCtorPromise;
}

function normalizePhotoObjects(s) {
  return (s.photos || []).map((p, idx) => {
    if (typeof p === 'string') return { name: `Photo ${idx + 1}`, dataUrl: '', missing: true };
    return {
      name: p?.name || `Photo ${idx + 1}`,
      dataUrl: p?.dataUrl || '',
      missing: !p?.dataUrl
    };
  });
}

async function measureImage(dataUrl) {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => reject(new Error('Unable to decode image'));
    img.src = dataUrl;
  });
}

let pdfLogoDataUrlCache = null;
async function loadPdfLogoDataUrl() {
  if (pdfLogoDataUrlCache) return pdfLogoDataUrlCache;
  try {
    const logoUrl = new URL('icon-192.png', window.location.href).href;
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error || new Error('Failed to read logo blob'));
      fr.readAsDataURL(blob);
    });
    pdfLogoDataUrlCache = String(dataUrl || '');
    return pdfLogoDataUrlCache;
  } catch {
    return '';
  }
}

async function normalizePhotoForPdf(dataUrl) {
  if (!dataUrl) return '';
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.92);
    }
  } catch {}
  return dataUrl;
}

async function exportRecordPdf(s, base) {
  const jsPDF = await loadJsPdfCtor();
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentW = pageW - margin * 2;
  const bottom = pageH - margin;
  const logoDataUrl = await loadPdfLogoDataUrl();

  const colors = {
    ink: [15, 23, 42],
    muted: [71, 85, 105],
    line: [203, 213, 225],
    head: [226, 232, 240],
    accent: [11, 107, 80],
    black: [0, 0, 0],
    white: [255, 255, 255]
  };

  let y = margin;

  const newPage = () => { doc.addPage(); y = margin; };
  const ensureSpace = (need = 12) => { if (y + need > bottom) newPage(); };

  const drawHeader = () => {
    ensureSpace(60);
    if (logoDataUrl) {
      try { doc.addImage(logoDataUrl, 'PNG', margin, y + 2, 24, 24); } catch {}
    }

    doc.setDrawColor(...colors.line);
    doc.line(margin, y + 40, pageW - margin, y + 40);

    doc.setTextColor(...colors.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Wetland Delineation Report', margin + 30, y + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...colors.muted);
    doc.text('Nova Scotia Field Data Form', margin + 30, y + 30);
    doc.text(`Generated ${new Date().toLocaleString()}`, pageW - margin, y + 16, { align: 'right' });
    y += 52;
  };

  const sectionTitle = (title) => {
    const barH = 14;
    ensureSpace(barH + 10);
    doc.setFillColor(...colors.black);
    doc.rect(margin, y, contentW, barH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...colors.white);
    doc.text(String(title || '').toUpperCase(), margin + 4, y + 9.5);
    y += barH + 8;
  };

  const drawTable = (title, headers, rows, widths, opts = {}) => {
    const fontSize = opts.fontSize ?? 8;
    const rowH = opts.rowH ?? 12;
    const headerH = opts.showHeader === false ? 0 : (opts.headerH ?? 14);
    const titleH = 12;
    const totalH = titleH + headerH + rows.length * rowH + 4;

    if (totalH > (bottom - margin)) {
      newPage();
    } else {
      ensureSpace(totalH);
    }

    sectionTitle(title);

    const x = opts.x ?? margin;
    const tableW = opts.tableW ?? contentW;
    const colW = widths || headers.map(() => tableW / headers.length);

    doc.setDrawColor(...colors.line);

    if (headerH > 0) {
      doc.setFillColor(...colors.head);
      doc.rect(x, y, tableW, headerH, 'FD');

      let cx = x;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      doc.setTextColor(...colors.ink);
      headers.forEach((h, i) => {
        doc.text(String(h), cx + 4, y + 9);
        cx += colW[i];
        if (i < headers.length - 1) doc.line(cx, y, cx, y + headerH + rows.length * rowH);
      });
    }

    let ry = y + headerH;
    rows.forEach((r) => {
      const stratum = String(r?.[0] || '').toLowerCase();
      if (opts.shadeByStratum) {
        if (stratum === 'tree') doc.setFillColor(232, 245, 233);
        else if (stratum === 'shrub') doc.setFillColor(243, 232, 245);
        else if (stratum === 'herb') doc.setFillColor(232, 240, 252);
        else doc.setFillColor(255, 255, 255);
        doc.rect(x, ry, tableW, rowH, 'FD');
      } else {
        doc.rect(x, ry, tableW, rowH);
      }
      let rx = x;
      r.forEach((cell, i) => {
        const text = String(cell ?? '—');
        const clipped = doc.splitTextToSize(text, colW[i] - 6)[0] || '—';
        const makeBold = opts.boldLeftColumn && i === 0;
        const makeItalic = Array.isArray(opts.italicCols) && opts.italicCols.includes(i);
        doc.setFont('helvetica', makeBold ? 'bold' : (makeItalic ? 'italic' : 'normal'));
        doc.setFontSize(fontSize);
        doc.setTextColor(...colors.ink);
        doc.text(clipped, rx + 3, ry + 8.5);
        rx += colW[i];
      });
      ry += rowH;
    });

    y = ry + 6;
  };

  const drawTopPairTables = (leftTitle, leftRows, rightTitle, rightRows) => {
    const sectionH = 14;
    const gap = 10;
    const pairW = (contentW - gap) / 2;
    const rowH = 12;
    const leftTotal = leftRows.length * rowH;
    const rightTotal = rightRows.length * rowH;
    const innerTitleSpace = 12;
    const totalH = sectionH + 8 + innerTitleSpace + Math.max(leftTotal, rightTotal) + 10;

    ensureSpace(totalH);

    // Major section bar
    doc.setFillColor(...colors.black);
    doc.rect(margin, y, contentW, sectionH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...colors.white);
    doc.text('SURVEY OVERVIEW', margin + 4, y + 9.5);
    y += sectionH + 6;

    const wetlandLabel = (s.PLOT_TYPE || '').toLowerCase().includes('upland') ? 'UPLAND' : 'WETLAND';
    const badges = [
      `Wetland ID: ${s.WetlandID || '—'}`,
      wetlandLabel
    ];
    let bx = margin;
    badges.forEach((txt, idx) => {
      const bw = Math.min(contentW * 0.55, Math.max(150, doc.getTextWidth(txt) + 22));
      if (idx === 1) {
        if (wetlandLabel === 'UPLAND') doc.setFillColor(98, 108, 124);
        else doc.setFillColor(11, 107, 80);
      } else {
        doc.setFillColor(33, 33, 33);
      }
      doc.roundedRect(bx, y, bw, 18, 4, 4, 'F');
      doc.setTextColor(...colors.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(txt, bx + 8, y + 12);
      bx += bw + 10;
    });
    y += 24;

    const startY = y;
    const leftX = margin;
    const rightX = margin + pairW + gap;

    // small titles
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...colors.accent);
    doc.text(leftTitle.toUpperCase(), leftX, y + 8);
    doc.text(rightTitle.toUpperCase(), rightX, y + 8);
    y += innerTitleSpace;

    const drawSimple = (x, rows) => {
      let ry = y;
      const colW = [pairW * 0.44, pairW * 0.56];
      rows.forEach((r) => {
        doc.setDrawColor(...colors.line);
        doc.rect(x, ry, pairW, rowH);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...colors.ink);
        doc.text(String(r[0] ?? '—'), x + 3, ry + 8.5);

        doc.line(x + colW[0], ry, x + colW[0], ry + rowH);
        doc.setFont('helvetica', 'normal');
        const txt = doc.splitTextToSize(String(r[1] ?? '—'), colW[1] - 6)[0] || '—';
        doc.text(txt, x + colW[0] + 3, ry + 8.5);
        ry += rowH;
      });
      return ry;
    };

    const lyEnd = drawSimple(leftX, leftRows);
    const ryEnd = drawSimple(rightX, rightRows);
    y = Math.max(lyEnd, ryEnd) + 8;
  };

  drawHeader();

  const metadataRows = [
    ['Site Name', s.SiteID || '—'],
    ['Plot ID', s.PLOT_ID || '—'],
    ['Wetland ID', s.WetlandID || '—'],
    ['Surveyor', s.observer || '—'],
    ['Locale', s.LocaleName || '—'],
    ['Province', s.Province || '—'],
    ['Date', s.date || '—'],
    ['Time', s.time || '—'],
    ['Latitude', s.latitude || '—'],
    ['Longitude', s.longitude || '—'],
    ['Plot Type', s.PLOT_TYPE || '—']
  ];

  const summaryRows = [
    ['Hydrophytic Vegetation?', s.SummaryHydroVegYN || '—'],
    ['Wetland Hydrology?', s.SummaryHydrologyYN || '—'],
    ['Hydric Soil?', s.SummaryHydricSoilYN || '—'],
    ['Point in Wetland?', s.SummaryInWetlandYN || '—']
  ];

  drawTopPairTables('Survey Metadata', metadataRows, 'Summary Conditions', summaryRows);

  const disturbanceRows = ['DistSoilYN','DistVegYN','DistHydroYN','ProbSoilYN','ProbVegYN','ProbHydroYN','ClimHydroNormalYN','CircNormalYN']
    .map(k => [displayLabel(k), s[k] || '—']);
  drawTable('Disturbance & Problematic Conditions', ['Condition', 'Value'], disturbanceRows, [contentW * 0.66, contentW * 0.34], { showHeader: false, boldLeftColumn: true });

  const vegEntries = vegetationEntriesFromSurvey(s);
  const vegAuto = autoDominantSet(vegEntries);
  const vegRows = vegEntries.map(e => [
    e.group,
    extractCommonName(e.species || '—'),
    extractScientificName(e.species || '—'),
    e.status || '—',
    e.cover || '—',
    vegAuto.has(`${e.group}:${e.i}`) ? 'Y' : 'N'
  ]);
  drawTable('Vegetation', ['Layer', 'Common Name', 'Scientific Name', 'Status', '% Cover', 'Dom'], vegRows.length ? vegRows : [['—','—','—','—','—','—']], [contentW * 0.10, contentW * 0.28, contentW * 0.30, contentW * 0.12, contentW * 0.14, contentW * 0.06], { italicCols: [2], shadeByStratum: true });

  const vMetrics = vegetationMetricsFromSurvey(s);
  drawTable('Vegetation Indices', ['Metric', 'Value'], [
    ['Dominance Test', `${vMetrics.dominanceA}/${vMetrics.dominanceB} (${vMetrics.dominancePct.toFixed(1)}%)`],
    ['Dominance Pass (>50%)', vMetrics.dominancePass ? 'Yes' : 'No'],
    ['Prevalence Index', vMetrics.prevalenceIndex.toFixed(2)],
    ['Prevalence Pass (<=3.0)', vMetrics.prevalencePass ? 'Yes' : 'No']
  ], [contentW * 0.45, contentW * 0.55], { showHeader: false, boldLeftColumn: true });

  ensureSpace(44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...colors.muted);
  const fp1 = 'Dominance Test uses the 50/20 rule by stratum (Tree/Shrub/Herb): rank by absolute cover, include species cumulatively exceeding 50% of stratum cover, plus any additional species at >=20% of stratum cover.';
  const fp2 = 'Prevalence Index is a weighted cover score using indicator-status classes (OBL, FACW, FAC, FACU, UPL).';
  const fp1Lines = doc.splitTextToSize(fp1, contentW);
  const fp2Lines = doc.splitTextToSize(fp2, contentW);
  doc.text(fp1Lines, margin, y + 7);
  y += fp1Lines.length * 7 + 3;
  doc.text(fp2Lines, margin, y + 7);
  y += fp2Lines.length * 7 + 5;

  // Force page 2 start for soils/hydrology/remarks
  newPage();
  drawHeader();

  const soilsRows = soilRows(s);
  drawTable('Hydric Soils', ['Hor','Thk','Texture','Matrix','M%','Redox','R%','Type','Loc'], soilsRows,
    [contentW*0.07,contentW*0.09,contentW*0.12,contentW*0.14,contentW*0.07,contentW*0.14,contentW*0.07,contentW*0.14,contentW*0.16]);

  const hydroRows = [
    ['Restrictive Layer', s.RestrictiveLayer || '—'],
    ['Restrictive Layer Depth (cm)', s.RestrictiveLayerDepthCM || '—'],
    ['Surface Water', s.SurfaceWaterYN || '—'],
    ['Surface Water Depth (cm)', s.SurfaceWaterDepthCM || '—'],
    ['Water Table', s.WaterTableYN || '—'],
    ['Water Table Depth (cm)', s.WaterTableDepthCM || '—'],
    ['Saturation', s.SaturationYN || '—'],
    ['Saturation Depth (cm)', s.SaturationDepthCM || '—'],
    ['Primary Indicators', (s.HydrologyPrimary || []).join(', ') || '—'],
    ['Secondary Indicators', (s.HydrologySecondary || []).join(', ') || '—']
  ];
  drawTable('Wetland Hydrology', ['Field', 'Value'], hydroRows, [contentW * 0.45, contentW * 0.55], { showHeader: false, boldLeftColumn: true });

  drawTable('Notes', ['Field', 'Value'], [['Notes', s.notes || '—']], [contentW * 0.2, contentW * 0.8], { showHeader: false, boldLeftColumn: true });

  // Photos start on a new page; max 2 stacked per page, preserve aspect ratio.
  const photos = normalizePhotoObjects(s);
  if (photos.length) {
    newPage();
    drawHeader();
    sectionTitle('Field Photos');

    const slotsPerPage = 2;
    const gap = 16;
    const captionH = 12;
    const slotH = ((bottom - y) - gap) / slotsPerPage;

    for (let i = 0; i < photos.length; i++) {
      if (i > 0 && i % slotsPerPage === 0) {
        newPage();
        drawHeader();
        sectionTitle('Field Photos (continued)');
      }

      const p = photos[i];
      const slotIndex = i % slotsPerPage;
      const top = y + slotIndex * (slotH + gap);
      const boxY = top + captionH;
      const boxH = slotH - captionH;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...colors.ink);
      doc.text(`${i + 1}. ${p.name}`, margin, top + 8);

      doc.setDrawColor(...colors.line);
      doc.rect(margin, boxY, contentW, boxH);

      if (!p.dataUrl) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...colors.muted);
        doc.text('Image data not available in this stored record.', margin + 6, boxY + 14);
        continue;
      }

      try {
        const normalizedUrl = await normalizePhotoForPdf(p.dataUrl);
        const dims = await measureImage(normalizedUrl);
        const iw = Math.max(1, dims.width);
        const ih = Math.max(1, dims.height);
        const scale = Math.min(contentW / iw, boxH / ih);
        const drawW = iw * scale;
        const drawH = ih * scale;
        const dx = margin + (contentW - drawW) / 2;
        const dy = boxY + (boxH - drawH) / 2;

        let format = 'JPEG';
        if (normalizedUrl.includes('image/png')) format = 'PNG';
        else if (normalizedUrl.includes('image/webp')) format = 'WEBP';

        doc.addImage(normalizedUrl, format, dx, dy, drawW, drawH);
      } catch {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...colors.muted);
        doc.text('Could not decode this image.', margin + 6, boxY + 14);
      }
    }
  }

  doc.save(`${base}.pdf`);
}

async function exportRecordPdfFormStyle(s, base) {
  const jsPDF = await loadJsPdfCtor();
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 34;
  const contentW = pageW - margin * 2;
  const bottom = pageH - margin;
  const logoDataUrl = await loadPdfLogoDataUrl();

  let y = margin;
  const newPage = () => { doc.addPage(); y = margin; };
  const ensureSpace = (h = 12) => { if (y + h > bottom) newPage(); };

  const sectionBar = (title) => {
    ensureSpace(24);
    doc.setFillColor(0, 0, 0);
    doc.rect(margin, y, contentW, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(String(title).toUpperCase(), margin + 4, y + 9.5);
    y += 22;
  };

  const drawKV = (rows, leftRatio = 0.42) => {
    const rowH = 12;
    const leftW = contentW * leftRatio;
    const rightW = contentW - leftW;
    ensureSpace(rows.length * rowH + 4);
    rows.forEach(([k, v]) => {
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, contentW, rowH);
      doc.line(margin + leftW, y, margin + leftW, y + rowH);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(String(k || '—'), margin + 3, y + 8.5);
      doc.setFont('helvetica', 'normal');
      const clipped = doc.splitTextToSize(String(v || '—'), rightW - 6)[0] || '—';
      doc.text(clipped, margin + leftW + 3, y + 8.5);
      y += rowH;
    });
    y += 6;
  };

  const drawTable = (headers, rows, widths, opts = {}) => {
    const rowH = 12;
    const headerH = 14;
    const totalH = headerH + rows.length * rowH + 4;
    ensureSpace(totalH);

    doc.setFillColor(226, 232, 240);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentW, headerH, 'FD');

    let cx = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    headers.forEach((h, i) => {
      doc.text(String(h), cx + 3, y + 9);
      cx += widths[i];
      if (i < headers.length - 1) doc.line(cx, y, cx, y + headerH + rows.length * rowH);
    });

    y += headerH;
    rows.forEach((r) => {
      doc.rect(margin, y, contentW, rowH);
      let rx = margin;
      r.forEach((cell, i) => {
        const txt = doc.splitTextToSize(String(cell ?? '—'), widths[i] - 6)[0] || '—';
        const italic = Array.isArray(opts.italicCols) && opts.italicCols.includes(i);
        doc.setFont('helvetica', i === 0 ? 'bold' : (italic ? 'italic' : 'normal'));
        doc.text(txt, rx + 3, y + 8.5);
        rx += widths[i];
      });
      y += rowH;
    });
    y += 6;
  };

  // Header block
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', margin, y, 24, 24); } catch {}
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('WETLAND DELINEATION DATA FORM – NOVA SCOTIA', margin + 30, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('Adapted workflow output for field reporting (aesthetic form-style export)', margin + 30, y + 22);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageW - margin, y + 12, { align: 'right' });
  y += 32;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  sectionBar('Project / Site Metadata');
  drawKV([
    ['Project / Site', s.SiteID || '—'],
    ['Municipality / County', s.LocaleName || '—'],
    ['Sampling Date', s.date || '—'],
    ['Sampling Time', s.time || '—'],
    ['Investigator(s)', s.observer || '—'],
    ['Sampling Point', s.PLOT_ID || '—'],
    ['Plot Type', s.PLOT_TYPE || '—'],
    ['Province', s.Province || '—'],
    ['Latitude', s.latitude || '—'],
    ['Longitude', s.longitude || '—']
  ]);

  sectionBar('Site Conditions');
  drawKV([
    ['Typical climatic/hydrologic conditions for this time of year?', s.ClimHydroNormalYN || '—'],
    ['Are normal circumstances present?', s.CircNormalYN || '—'],
    ['Vegetation significantly disturbed?', s.DistVegYN || '—'],
    ['Soil significantly disturbed?', s.DistSoilYN || '—'],
    ['Hydrology significantly disturbed?', s.DistHydroYN || '—'],
    ['Vegetation naturally problematic?', s.ProbVegYN || '—'],
    ['Soil naturally problematic?', s.ProbSoilYN || '—'],
    ['Hydrology naturally problematic?', s.ProbHydroYN || '—']
  ], 0.62);

  sectionBar('Summary of Findings');
  drawKV([
    ['Hydrophytic Vegetation Present?', s.SummaryHydroVegYN || '—'],
    ['Hydric Soil Present?', s.SummaryHydricSoilYN || '—'],
    ['Wetland Hydrology Present?', s.SummaryHydrologyYN || '—'],
    ['Is the sampled area within a wetland?', s.SummaryInWetlandYN || '—']
  ], 0.62);

  const vegEntries = vegetationEntriesFromSurvey(s);
  const vegAuto = autoDominantSet(vegEntries);
  const vegRows = vegEntries.map(e => [e.group, extractCommonName(e.species || '—'), extractScientificName(e.species || '—'), e.status || '—', e.cover || '—', vegAuto.has(`${e.group}:${e.i}`) ? 'Y' : 'N']);
  sectionBar('Vegetation');
  drawTable(['Stratum', 'Common Name', 'Scientific Name', 'Status', '% Cover', 'Dom'], vegRows.length ? vegRows : [['—','—','—','—','—','—'],], [contentW * 0.12, contentW * 0.26, contentW * 0.30, contentW * 0.12, contentW * 0.14, contentW * 0.06], { italicCols: [2] });

  const vMetrics = vegetationMetricsFromSurvey(s);
  drawKV([
    ['Dominance Test (A/B)', `${vMetrics.dominanceA}/${vMetrics.dominanceB} (${vMetrics.dominancePct.toFixed(1)}%)`],
    ['Dominance Pass (>50%)', vMetrics.dominancePass ? 'Yes' : 'No'],
    ['Prevalence Index (B/A)', vMetrics.prevalenceIndex.toFixed(2)],
    ['Prevalence Pass (<=3.0)', vMetrics.prevalencePass ? 'Yes' : 'No']
  ], 0.45);

  ensureSpace(44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  const fp1 = 'Dominance Test uses the 50/20 rule by stratum (Tree/Shrub/Herb): include species cumulatively exceeding 50% of stratum cover, plus any additional species at >=20% of stratum cover.';
  const fp2 = 'Prevalence Index = (OBL*1 + FACW*2 + FAC*3 + FACU*4 + UPL*5) / total cover in those indicator classes.';
  const fp1Lines = doc.splitTextToSize(fp1, contentW);
  const fp2Lines = doc.splitTextToSize(fp2, contentW);
  doc.text(fp1Lines, margin, y + 7);
  y += fp1Lines.length * 7 + 3;
  doc.text(fp2Lines, margin, y + 7);
  y += fp2Lines.length * 7 + 5;

  sectionBar('Soils');
  drawTable(['Hor', 'Thk (cm)', 'Texture', 'Matrix', 'M%', 'Redox', 'R%', 'Type', 'Loc'], soilRows(s),
    [contentW*0.07,contentW*0.1,contentW*0.12,contentW*0.14,contentW*0.07,contentW*0.14,contentW*0.07,contentW*0.14,contentW*0.15]);
  drawKV([
    ['Hydric Soil Indicators', (s.HydricSoilIndicators || []).join(', ') || '—'],
    ['Restrictive Layer', s.RestrictiveLayer || '—'],
    ['Restrictive Layer Depth (cm)', s.RestrictiveLayerDepthCM || '—']
  ], 0.38);

  sectionBar('Hydrology');
  drawKV([
    ['Surface Water Present?', s.SurfaceWaterYN || '—'],
    ['Surface Water Depth (cm)', s.SurfaceWaterDepthCM || '—'],
    ['Water Table Present?', s.WaterTableYN || '—'],
    ['Water Table Depth (cm)', s.WaterTableDepthCM || '—'],
    ['Saturation Present?', s.SaturationYN || '—'],
    ['Saturation Depth (cm)', s.SaturationDepthCM || '—'],
    ['Primary Indicators (minimum one expected)', (s.HydrologyPrimary || []).join(', ') || '—'],
    ['Secondary Indicators (minimum two expected)', (s.HydrologySecondary || []).join(', ') || '—']
  ], 0.5);

  sectionBar('Remarks');
  drawKV([
    ['Notes', s.notes || '—']
  ], 0.18);

  const photos = normalizePhotoObjects(s);
  if (photos.length) {
    newPage();
    sectionBar('Field Photos');

    const gap = 16;
    const captionH = 12;
    const slotH = ((bottom - y) - gap) / 2;

    for (let i = 0; i < photos.length; i++) {
      if (i > 0 && i % 2 === 0) {
        newPage();
        sectionBar('Field Photos (continued)');
      }
      const p = photos[i];
      const slot = i % 2;
      const top = y + slot * (slotH + gap);
      const boxY = top + captionH;
      const boxH = slotH - captionH;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`${i + 1}. ${p.name}`, margin, top + 8);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, boxY, contentW, boxH);

      if (!p.dataUrl) continue;
      try {
        const normalizedUrl = await normalizePhotoForPdf(p.dataUrl);
        const dims = await measureImage(normalizedUrl);
        const iw = Math.max(1, dims.width);
        const ih = Math.max(1, dims.height);
        const scale = Math.min(contentW / iw, boxH / ih);
        const w = iw * scale;
        const h = ih * scale;
        const dx = margin + (contentW - w) / 2;
        const dy = boxY + (boxH - h) / 2;
        let format = 'JPEG';
        if (normalizedUrl.includes('image/png')) format = 'PNG';
        else if (normalizedUrl.includes('image/webp')) format = 'WEBP';
        doc.addImage(normalizedUrl, format, dx, dy, w, h);
      } catch {}
    }
  }

  doc.save(`${base}_form_style.pdf`);
}

async function exportRecord(fmt, raw) {
  const full = cloneData(raw);
  const clean = exportCleanRecord(raw);
  const base = `${full.SiteID || 'Survey'}_${full.PLOT_ID || 'plot'}_${dateStamp()}`.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (fmt === 'geojson') {
    const payload = JSON.stringify(toGeoJSON([clean]), null, 2);
    return smartExport({ content: payload, filename: `${base}.geojson`, mime: 'application/geo+json' });
  }
  if (fmt === 'md') {
    const payload = recordMarkdown(clean);
    return smartExport({ content: payload, filename: `${base}.md`, mime: 'text/markdown;charset=utf-8' });
  }
  if (fmt === 'csv') {
    const payload = toCSV([clean]);
    return smartExport({ content: payload, filename: `${base}.csv`, mime: 'text/csv;charset=utf-8' });
  }
  if (fmt === 'html') {
    const payload = recordHTML(full);
    return smartExport({ content: payload, filename: `${base}.html`, mime: 'text/html;charset=utf-8' });
  }
  if (fmt === 'pdf') {
    try {
      return await exportRecordPdf(full, base);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('PDF export failed in this browser. Downloading printable HTML fallback.');
      const payload = recordHTML(full);
      return smartExport({ content: payload, filename: `${base}_printable.html`, mime: 'text/html;charset=utf-8' });
    }
  }
}

function smartExport({ content, filename, mime }) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  // Download-only path (no pop-ups/new tabs).
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function dateStamp(){ const d=new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`; }

function setupPWA() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('btn-install');
    if (btn) btn.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('btn-install');
    if (btn) btn.hidden = true;
  });
}

setupPWA();
init().catch(err => { console.error(err); alert('App failed to initialize. Please refresh.'); });
