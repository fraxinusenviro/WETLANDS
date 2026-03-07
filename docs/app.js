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

let speciesList = ["ACERrubr", "PICErube", "QUERrubr", "KALMangu", "VIBUcass", "PTERaqui"];
let state = loadDraft() || defaultSurvey();
let surveys = readStore("wetlandSurveys", []);
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
  await loadSpecies();
  buildSpeciesDatalist();
  buildTabs();
  renderFormPages();
  bindActions();
  refreshDashboard();
  renderSubmissions();
  showView("home");
}

function defaultSurvey() {
  const now = new Date();
  const obj = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), SiteID:"", LocaleName:"", Province:"", date: now.toISOString().slice(0,10), time: now.toTimeString().slice(0,5), observer:"", PLOT_ID:"", PLOT_TYPE:"", latitude:"", longitude:"", DistSoilYN:"", DistVegYN:"", DistHydroYN:"", ProbSoilYN:"", ProbVegYN:"", ProbHydroYN:"", ClimHydroNormalYN:"", CircNormalYN:"", SummaryHydroVegYN:"", SummaryHydricSoilYN:"", SummaryHydrologyYN:"", SummaryInWetlandYN:"", notes:"", RestrictiveLayer:"", RestrictiveLayerDepthCM:"", SurfaceWaterYN:"", SurfaceWaterDepthCM:"", WaterTableYN:"", WaterTableDepthCM:"", SaturationYN:"", SaturationDepthCM:"", HydricSoilIndicators:[], HydrologyPrimary:[], HydrologySecondary:[], photos:[] };
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
  document.getElementById('btn-home').onclick = () => { refreshDashboard(); showView('home'); };
  document.getElementById('btn-launch-new').onclick = () => { state = defaultSurvey(); renderFormPages(); queueAutosave(true); showView('form'); };
  document.getElementById('btn-open-submissions').onclick = () => { renderSubmissions(); showView('submissions'); };
  document.getElementById('btn-refresh-submissions').onclick = () => renderSubmissions();

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

  document.getElementById('btn-submit').onclick = () => {
    state.timestamp = new Date().toISOString(); state.id = crypto.randomUUID();
    surveys.push(structuredClone(state)); localStorage.setItem('wetlandSurveys', JSON.stringify(surveys));
    localStorage.removeItem('wetlandCurrentDraft');
    alert(`Survey submitted. Saved count: ${surveys.length}`);
    state = defaultSurvey(); renderFormPages(); refreshDashboard(); renderSubmissions(); queueAutosave(true); showView('home');
  };

  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) resetBtn.onclick = () => { if (!confirm('Reset current form?')) return; state = defaultSurvey(); renderFormPages(); queueAutosave(true); };
  const saveBtn = document.getElementById('btn-save-json');
  if (saveBtn) saveBtn.onclick = () => { localStorage.setItem('wetlandCurrentDraft', JSON.stringify(state)); alert('Draft saved.'); };
  const csvBtn = document.getElementById('btn-csv');
  if (csvBtn) csvBtn.onclick = () => surveys.length
    ? smartExport({ content: toCSV(surveys), filename: `Survey_${dateStamp()}.csv`, mime: 'text/csv;charset=utf-8', preview: 'text' })
    : alert('No submitted surveys.');
  const gjBtn = document.getElementById('btn-geojson');
  if (gjBtn) gjBtn.onclick = () => surveys.length
    ? smartExport({ content: JSON.stringify(toGeoJSON(surveys), null, 2), filename: `Survey_${dateStamp()}.geojson`, mime: 'application/geo+json', preview: 'text' })
    : alert('No submitted surveys.');

  const installBtn = document.getElementById('btn-install');
  if (installBtn) installBtn.onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installBtn.hidden = true; };
}

function renderSubmissions() {
  surveys = readStore('wetlandSurveys', []);
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

  list.querySelectorAll('button[data-load]').forEach(b => b.onclick = () => {
    const id = b.dataset.load; const s = surveys.find(x => x.id === id); if (!s) return;
    state = structuredClone(s); localStorage.setItem('wetlandCurrentDraft', JSON.stringify(state));
    renderFormPages(); showView('form'); setActiveTab(0);
  });

  list.querySelectorAll('button[data-delete]').forEach(b => b.onclick = () => {
    const id = b.dataset.delete;
    if (!confirm('Delete this submission?')) return;
    surveys = surveys.filter(x => x.id !== id);
    localStorage.setItem('wetlandSurveys', JSON.stringify(surveys));
    renderSubmissions(); refreshDashboard();
  });

  list.querySelectorAll('button[data-export]').forEach(b => b.onclick = () => {
    const [fmt, id] = b.dataset.export.split(':');
    const s = surveys.find(x => x.id === id);
    if (!s) return;
    exportRecord(fmt, s);
  });
}

function refreshDashboard() {
  const stats = document.getElementById('dashboard-stats');
  const draft = loadDraft();
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

function readStore(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { localStorage.removeItem(key); return fallback; } }
function loadDraft() { return readStore('wetlandCurrentDraft', null); }
function queueAutosave(immediate=false) {
  if (immediate) return localStorage.setItem('wetlandCurrentDraft', JSON.stringify(state));
  clearTimeout(autosaveTimer); autosaveTimer = setTimeout(() => localStorage.setItem('wetlandCurrentDraft', JSON.stringify(state)), 350);
}

function toCSV(rows) {
  const normalized = rows.map(r => ({ ...r, photos:(r.photos||[]).map(p=>p.name).join(';') }));
  const headers = [...new Set(normalized.flatMap(r => Object.keys(r)))];
  const esc = v => `"${String(Array.isArray(v)?v.join(';'):(v??'')).replaceAll('"', "''")}"`;
  return [headers.join(','), ...normalized.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}
function toGeoJSON(rows) { return { type:'FeatureCollection', features:rows.map(r => ({ type:'Feature', geometry:{ type:'Point', coordinates:[Number(r.longitude)||0, Number(r.latitude)||0] }, properties:r })) }; }

function exportCleanRecord(s) {
  return { ...s, photos: (s.photos || []).map(p => p.name) };
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
  const veg = (title, rows) => `
    <h3>${title}</h3>
    <table><thead><tr><th>Species</th><th>% Cover</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</tbody></table>`;
  const soils = soilRows(s);
  const row = (k) => `<p><strong>${displayLabel(k)}:</strong> ${s[k] || '—'}</p>`;
  const photoBlock = (s.photos || []).length
    ? `<h2>8. Field Photos</h2><div style='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px'>${(s.photos||[]).map((p,idx)=>`<figure style='margin:0;border:1px solid #ddd;padding:6px;border-radius:6px'><img src='${p.dataUrl || ''}' alt='${p.name || `Photo ${idx+1}`}' style='width:100%;height:auto;display:block'/><figcaption style='font-size:11px;color:#444;margin-top:4px'>${p.name || `Photo ${idx+1}`}</figcaption></figure>`).join('')}</div>`
    : `<h2>8. Field Photos</h2><p>—</p>`;

  return `<!doctype html><html><head><meta charset='utf-8'/><title>${s.PLOT_ID||'Wetland Form'}</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;padding:26px;color:#111;line-height:1.35}
    .brand{display:flex;align-items:center;gap:12px;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:14px}
    .brand img{width:42px;height:42px;object-fit:contain}
    h1{font-size:22px;margin:0} h2{font-size:16px;margin:18px 0 8px} h3{font-size:14px;margin:10px 0 6px}
    p{margin:4px 0} table{width:100%;border-collapse:collapse;margin:8px 0 12px} th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px;text-align:left}
  </style></head><body>
    <div class='brand'><img src='assets/fraxinus-logo.svg' alt='Fraxinus'/><div><h1>WETLAND DELINEATION DATA FORM – NOVA SCOTIA</h1><p><strong>Plot ID:</strong> ${s.PLOT_ID || '—'}</p></div></div>
    <h2>1. Survey Metadata</h2>
    ${['SiteID','LocaleName','observer','latitude','longitude','Province','date','time','PLOT_TYPE'].map(row).join('')}
    <h2>2. Disturbance & Problematic Conditions</h2>
    ${['DistSoilYN','DistVegYN','DistHydroYN','ProbSoilYN','ProbVegYN','ProbHydroYN','ClimHydroNormalYN','CircNormalYN'].map(row).join('')}
    <h2>3. Summary Conditions</h2>
    ${['SummaryHydroVegYN','SummaryHydrologyYN','SummaryHydricSoilYN','SummaryInWetlandYN'].map(row).join('')}
    <h2>4. Vegetation</h2>
    ${veg('A. Tree Species', speciesRows(s,'Tree',6))}
    ${veg('B. Shrub Species', speciesRows(s,'Shrub',6))}
    ${veg('C. Herb Species', speciesRows(s,'Herb',10))}
    <h2>5. Hydric Soils</h2>
    <table><thead><tr><th>Horizon</th><th>Thickness (cm)</th><th>Texture</th><th>Matrix</th><th>Matrix %</th><th>Redox</th><th>Redox %</th><th>Type</th><th>Location</th></tr></thead><tbody>${soils.map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <p><strong>Hydric Soil Indicators:</strong> ${(s.HydricSoilIndicators||[]).join(', ') || '—'}</p>
    <h2>6. Wetland Hydrology</h2>
    ${['RestrictiveLayer','RestrictiveLayerDepthCM','SurfaceWaterYN','SurfaceWaterDepthCM','WaterTableYN','WaterTableDepthCM','SaturationYN','SaturationDepthCM'].map(row).join('')}
    <p><strong>Primary Indicators:</strong> ${(s.HydrologyPrimary||[]).join(', ') || '—'}</p>
    <p><strong>Secondary Indicators:</strong> ${(s.HydrologySecondary||[]).join(', ') || '—'}</p>
    <h2>7. Notes</h2><p>${s.notes || '—'}</p>
    ${photoBlock}
  </body></html>`;
}

function exportRecord(fmt, raw) {
  const s = exportCleanRecord(raw);
  const base = `${s.SiteID || 'Survey'}_${s.PLOT_ID || 'plot'}_${dateStamp()}`.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (fmt === 'geojson') {
    const payload = JSON.stringify(toGeoJSON([s]), null, 2);
    return smartExport({ content: payload, filename: `${base}.geojson`, mime: 'application/geo+json', preview: 'text' });
  }
  if (fmt === 'md') {
    const payload = recordMarkdown(s);
    return smartExport({ content: payload, filename: `${base}.md`, mime: 'text/markdown;charset=utf-8', preview: 'text' });
  }
  if (fmt === 'csv') {
    const payload = toCSV([s]);
    return smartExport({ content: payload, filename: `${base}.csv`, mime: 'text/csv;charset=utf-8', preview: 'text' });
  }
  if (fmt === 'html') {
    const payload = recordHTML(s);
    return smartExport({ content: payload, filename: `${base}.html`, mime: 'text/html;charset=utf-8', preview: 'html' });
  }
  if (fmt === 'pdf') {
    // Reliable HTML->PDF path: open printable HTML and trigger print dialog.
    const html = recordHTML(s);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'noopener');
    if (!w) return alert('Pop-up blocked. Allow pop-ups to export PDF.');
    w.addEventListener('load', () => setTimeout(() => w.print(), 500));
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
}

function smartExport({ content, filename, mime, preview = 'text' }) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  // Attempt direct download first.
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Fallback for restrictive mobile/webview clients: also open preview tab.
  const w = window.open(url, '_blank', 'noopener');
  if (!w) {
    alert(`Export prepared (${filename}) but your browser blocked opening the file preview. Please allow pop-ups/downloads.`);
  }

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
