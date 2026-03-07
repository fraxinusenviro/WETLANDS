const yesNo = ["", "Yes", "No"];
const observers = ["", "IB", "ZS", "SD", "CN", "Other"];
const provinces = ["", "NS", "PEI", "NB", "NL"];
const plotTypes = ["", "Control", "Test", "Reference", "Other"];
const pageOrder = ["metadata", "vegetation", "hydrology", "soils"];

const hydricSoilIndicators = ["Histosol (A1)","Histic Epipedon (A2)","Black Histic (A3)","Hydrogen Sulfide (A4)","Stratified Layers (A5)","Depleted Below Dark Surface (A11)","Thick Dark Surface (A12)","Sandy Mucky Mineral (S1)","Sandy Gleyed Matrix (S4)","Sandy Redox (S5)","Polyvalue Below Surface (S8)","Thin Dark Surface (S9)","Loamy Gleyed Matrix (F2)","Depleted Matrix (F3)","Redox Dark Surface (F6)","Depleted Dark Surface (F7)","Redox Depressions (F8)"];
const wetlandHydrologyPrimary = ["Surface Water (A1)","High Water Table (A2)","Saturation (A3)","Water Marks (B1)","Sediment Deposits (B2)","Drift Deposits (B3)","Algal Mat or Crust (B4)","Iron Deposits (B5)","Inundation Visible on Aerial Imagery (B7)","Sparsely Vegetated Concave Surface (B8)","Water-Stained Leaves (B9)","Aquatic Fauna (B13)","Marl Deposits (B15)","Hydrogen Sulfide Odor (C1)","Oxidized Rhizospheres on Living Roots (C3)","Presence of Reduced Iron (C4)","Recent Iron Reduction in Tilled Soils (C6)","Thin Muck Surface (C7)","Other (Explain in Remarks)"];
const wetlandHydrologySecondary = ["Surface Soil Cracks (B6)","Drainage Patterns (B10)","Moss Trim Lines (B16)","Dry-Season Water Table (C2)","Saturation Visible on Aerial Imagery (C9)","Stunted or Stressed Plants (D1)","Geomorphic Position (D2)","Shallow Aquitard (D3)","Microtopographic Relief (D4)","FAC-Neutral Test (D5)"];

const metadataFields = [
  ["SiteID", "text"], ["LocaleName", "text"], ["Province", "select", provinces], ["date", "date"], ["time", "time"], ["observer", "select", observers],
  ["PLOT_ID", "text"], ["PLOT_TYPE", "select", plotTypes], ["latitude", "number"], ["longitude", "number"],
  ["DistSoilYN", "select", yesNo], ["DistVegYN", "select", yesNo], ["DistHydroYN", "select", yesNo], ["ProbSoilYN", "select", yesNo], ["ProbVegYN", "select", yesNo], ["ProbHydroYN", "select", yesNo],
  ["ClimHydroNormalYN", "select", yesNo], ["CircNormalYN", "select", yesNo], ["SummaryHydroVegYN", "select", yesNo], ["SummaryHydricSoilYN", "select", yesNo], ["SummaryHydrologyYN", "select", yesNo], ["SummaryInWetlandYN", "select", yesNo]
];

const DB_NAME = 'wetlands-app-db';
const DB_VERSION = 1;
const KV_STORE = 'kv';
const DRAFT_KEY = 'wetlandCurrentDraft';
const SURVEYS_KEY = 'wetlandSurveys';

let speciesList = ["ACERrubr", "PICErube", "QUERrubr", "KALMangu", "VIBUcass", "PTERaqui"];
let state = defaultSurvey();
let surveys = [];
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
  state = (await loadDraft()) || defaultSurvey();

  await loadSpecies();
  buildSpeciesDatalist();
  buildTabs();
  renderFormPages();
  bindActions();
  await refreshDashboard();
  renderSubmissions();
  showView("home");
}

function defaultSurvey() {
  const now = new Date();
  const obj = { id: makeId(), timestamp: new Date().toISOString(), SiteID:"", LocaleName:"", Province:"", date: now.toISOString().slice(0,10), time: now.toTimeString().slice(0,5), observer:"", PLOT_ID:"", PLOT_TYPE:"", latitude:"", longitude:"", DistSoilYN:"", DistVegYN:"", DistHydroYN:"", ProbSoilYN:"", ProbVegYN:"", ProbHydroYN:"", ClimHydroNormalYN:"", CircNormalYN:"", SummaryHydroVegYN:"", SummaryHydricSoilYN:"", SummaryHydrologyYN:"", SummaryInWetlandYN:"", notes:"", RestrictiveLayer:"", RestrictiveLayerDepthCM:"", SurfaceWaterYN:"", SurfaceWaterDepthCM:"", WaterTableYN:"", WaterTableDepthCM:"", SaturationYN:"", SaturationDepthCM:"", HydricSoilIndicators:[], HydrologyPrimary:[], HydrologySecondary:[], photos:[] };
  ["Tree","Shrub"].forEach(g => { for (let i=1;i<=6;i++) { obj[`${g}Sp${i}`]=""; obj[`${g}Sp${i}Cov`]=""; } });
  for (let i=1;i<=10;i++) { obj[`HerbSp${i}`]=""; obj[`HerbSp${i}Cov`]=""; }
  for (let h=1;h<=4;h++) ["ThickCM","Texture","Matrix","MatrixPC","Redox","RedoxPC","RedoxType","RedoxLoc"].forEach(s => obj[`SoilH${h}${s}`]="");
  return obj;
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
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
      table.innerHTML = `<div class='veg-row veg-header'><div>#</div><div>Species</div><div>%</div></div>`;

      for (let i = 1; i <= Math.min(vegUi[g].count, n); i++) {
        const row = document.createElement('div');
        row.className = 'veg-row';
        row.innerHTML = `<div class='veg-idx'>${i}</div>`;

        const species = document.createElement('input');
        species.type = 'text';
        species.setAttribute('list', 'species-options');
        species.value = state[`${g}Sp${i}`] ?? '';
        species.oninput = () => { state[`${g}Sp${i}`] = species.value; queueAutosave(); };

        const cov = document.createElement('input');
        cov.type = 'number';
        cov.step = 'any';
        cov.value = state[`${g}Sp${i}Cov`] ?? '';
        cov.oninput = () => { state[`${g}Sp${i}Cov`] = cov.value; queueAutosave(); };

        row.appendChild(species);
        row.appendChild(cov);
        table.appendChild(row);
      }
      card.appendChild(table);
    }
    root.appendChild(card);
  });

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
  document.getElementById('btn-home').onclick = async () => { await refreshDashboard(); showView('home'); };
  document.getElementById('btn-launch-new').onclick = () => { state = defaultSurvey(); renderFormPages(); queueAutosave(true); showView('form'); };
  document.getElementById('btn-open-submissions').onclick = async () => { surveys = await loadSurveys(); renderSubmissions(); showView('submissions'); };
  document.getElementById('btn-refresh-submissions').onclick = async () => { surveys = await loadSurveys(); renderSubmissions(); };

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

async function refreshDashboard() {
  const stats = document.getElementById('dashboard-stats');
  const draft = await loadDraft();
  stats.innerHTML = [
    `<div class='card'><h3>${surveys.length}</h3><p class='muted'>Submitted Forms</p></div>`,
    `<div class='card'><h3>${draft ? 'Yes' : 'No'}</h3><p class='muted'>Draft Available</p></div>`,
    `<div class='card'><h3>${surveys.at(-1)?.SiteID || '-'}</h3><p class='muted'>Latest Site ID</p></div>`
  ].join('');
}

async function loadSpecies() {
  try {
    const res = await fetch('./VASC_names.json'); if (!res.ok) return;
    const data = await res.json();
    const values = Array.isArray(data) ? data : Object.values(data).flatMap(v => Array.isArray(v) ? v : [v]);
    speciesList = [...new Set(values.map(v => String(v).trim()).filter(Boolean))];
  } catch {}
}

function buildSpeciesDatalist() {
  const dl = document.createElement('datalist'); dl.id = 'species-options';
  speciesList.slice(0, 4000).forEach(s => { const o = document.createElement('option'); o.value = s; dl.appendChild(o); });
  document.body.appendChild(dl);
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
  const m = key.match(/^(Tree|Shrub|Herb)Sp(\d+)(Cov)?$/);
  if (m) return `${m[1]} Species #${m[2]}${m[3] ? ' % Cover' : ''}`;
  const h = key.match(/^SoilH(\d+)(ThickCM|Texture|Matrix|MatrixPC|Redox|RedoxPC|RedoxType|RedoxLoc)$/);
  if (h) {
    const map = { ThickCM: 'Thickness (cm)', Texture: 'Texture', Matrix: 'Matrix Color', MatrixPC: 'Matrix %', Redox: 'Redox Color', RedoxPC: 'Redox %', RedoxType: 'Redox Type', RedoxLoc: 'Redox Location' };
    return `Soil Horizon ${h[1]} ${map[h[2]]}`;
  }
  const fixed = {
    SiteID: 'Site ID', LocaleName: 'Locale', PLOT_ID: 'Plot ID', PLOT_TYPE: 'Plot Type',
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
  } catch (err) {
    console.warn('Legacy migration skipped:', err);
  }
}

async function loadDraft() { return await idbGet(DRAFT_KEY, null); }
async function loadSurveys() { return await idbGet(SURVEYS_KEY, []); }
async function saveDraft(draft) { await idbSet(DRAFT_KEY, draft); }
async function saveSurveys(rows) { await idbSet(SURVEYS_KEY, rows); }
async function clearDraft() { await idbDelete(DRAFT_KEY); }

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

  ['SiteID','LocaleName','observer','latitude','longitude','Province','date','time','PLOT_TYPE'].forEach(k => {
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
    ['Hydrophytic Vegetation', yesNo('SummaryHydroVegYN')],
    ['Wetland Hydrology', yesNo('SummaryHydrologyYN')],
    ['Hydric Soil', yesNo('SummaryHydricSoilYN')],
    ['Point in Wetland', yesNo('SummaryInWetlandYN')]
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

async function exportRecordPdf(s, base) {
  const jsPDF = await loadJsPdfCtor();
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 42;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (need = 14) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const line = (text = '', opts = {}) => {
    const size = opts.size ?? 10;
    const bold = !!opts.bold;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(text), maxW);
    const lineH = size + 3;
    for (const ln of lines) {
      ensureSpace(lineH);
      doc.text(ln, margin, y);
      y += lineH;
    }
  };

  const kv = (k, v) => line(`${k}: ${v || '—'}`);

  line('Wetland Delineation Report', { bold: true, size: 16 });
  line('Nova Scotia Field Data Form', { size: 11 });
  line(`Generated ${new Date().toLocaleString()}`, { size: 9 });
  y += 6;

  line('Survey Metadata', { bold: true, size: 12 });
  [
    ['Site Name', s.SiteID],
    ['Plot ID', s.PLOT_ID],
    ['Surveyor', s.observer],
    ['Locale', s.LocaleName],
    ['Province', s.Province],
    ['Date', s.date],
    ['Time', s.time],
    ['Latitude', s.latitude],
    ['Longitude', s.longitude],
    ['Plot Type', s.PLOT_TYPE]
  ].forEach(([k, v]) => kv(k, v));

  y += 6;
  line('Summary Conditions', { bold: true, size: 12 });
  [
    ['Hydrophytic Vegetation', s.SummaryHydroVegYN],
    ['Wetland Hydrology', s.SummaryHydrologyYN],
    ['Hydric Soil', s.SummaryHydricSoilYN],
    ['Point in Wetland', s.SummaryInWetlandYN]
  ].forEach(([k, v]) => kv(k, v));

  y += 6;
  line('Vegetation', { bold: true, size: 12 });
  [...speciesRows(s, 'Tree', 6).map(r => ['Tree', r]), ...speciesRows(s, 'Shrub', 6).map(r => ['Shrub', r]), ...speciesRows(s, 'Herb', 10).map(r => ['Herb', r])]
    .forEach(([layer, [sp, cov]]) => line(`${layer}: ${sp || '—'} (${cov || '—'}%)`));

  y += 6;
  line('Hydric Soil Indicators', { bold: true, size: 12 });
  line((s.HydricSoilIndicators || []).join(', ') || '—');

  y += 6;
  line('Wetland Hydrology', { bold: true, size: 12 });
  [
    ['Restrictive Layer', s.RestrictiveLayer],
    ['Restrictive Layer Depth (cm)', s.RestrictiveLayerDepthCM],
    ['Surface Water', s.SurfaceWaterYN],
    ['Surface Water Depth (cm)', s.SurfaceWaterDepthCM],
    ['Water Table', s.WaterTableYN],
    ['Water Table Depth (cm)', s.WaterTableDepthCM],
    ['Saturation', s.SaturationYN],
    ['Saturation Depth (cm)', s.SaturationDepthCM]
  ].forEach(([k, v]) => kv(k, v));
  kv('Primary Indicators', (s.HydrologyPrimary || []).join(', ') || '—');
  kv('Secondary Indicators', (s.HydrologySecondary || []).join(', ') || '—');

  y += 6;
  line('Notes', { bold: true, size: 12 });
  line(s.notes || '—');

  const photos = normalizePhotoObjects(s);
  y += 8;
  line('Field Photos', { bold: true, size: 12 });

  if (!photos.length) {
    line('No photos attached.');
  } else {
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      line(`${i + 1}. ${p.name}`);
      if (!p.dataUrl) {
        line('Image data not available in this stored record.', { size: 9 });
        y += 4;
        continue;
      }
      try {
        const dims = await measureImage(p.dataUrl);
        const ratio = dims.width > 0 ? (dims.height / dims.width) : 0.75;
        const w = maxW;
        const h = Math.min(260, Math.max(120, w * ratio));
        ensureSpace(h + 12);
        const format = p.dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(p.dataUrl, format, margin, y, w, h);
        y += h + 10;
      } catch {
        line('Could not decode this image.', { size: 9 });
      }
    }
  }

  doc.save(`${base}.pdf`);
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
