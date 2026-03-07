const yesNo = ["", "Yes", "No"];
const observers = ["", "IB", "ZS", "SD", "CN", "Other"];
const provinces = ["", "NS", "PEI", "NB", "NL"];
const plotTypes = ["", "Control", "Test", "Reference", "Other"];

const hydricSoilIndicators = [
  "Histosol (A1)", "Histic Epipedon (A2)", "Black Histic (A3)", "Hydrogen Sulfide (A4)",
  "Stratified Layers (A5)", "Depleted Below Dark Surface (A11)", "Thick Dark Surface (A12)",
  "Sandy Mucky Mineral (S1)", "Sandy Gleyed Matrix (S4)", "Sandy Redox (S5)",
  "Polyvalue Below Surface (S8)", "Thin Dark Surface (S9)", "Loamy Gleyed Matrix (F2)",
  "Depleted Matrix (F3)", "Redox Dark Surface (F6)", "Depleted Dark Surface (F7)", "Redox Depressions (F8)"
];

const wetlandHydrologyPrimary = [
  "Surface Water (A1)", "High Water Table (A2)", "Saturation (A3)", "Water Marks (B1)",
  "Sediment Deposits (B2)", "Drift Deposits (B3)", "Algal Mat or Crust (B4)", "Iron Deposits (B5)",
  "Inundation Visible on Aerial Imagery (B7)", "Sparsely Vegetated Concave Surface (B8)",
  "Water-Stained Leaves (B9)", "Aquatic Fauna (B13)", "Marl Deposits (B15)",
  "Hydrogen Sulfide Odor (C1)", "Oxidized Rhizospheres on Living Roots (C3)",
  "Presence of Reduced Iron (C4)", "Recent Iron Reduction in Tilled Soils (C6)",
  "Thin Muck Surface (C7)", "Other (Explain in Remarks)"
];

const wetlandHydrologySecondary = [
  "Surface Soil Cracks (B6)", "Drainage Patterns (B10)", "Moss Trim Lines (B16)",
  "Dry-Season Water Table (C2)", "Saturation Visible on Aerial Imagery (C9)",
  "Stunted or Stressed Plants (D1)", "Geomorphic Position (D2)",
  "Shallow Aquitard (D3)", "Microtopographic Relief (D4)", "FAC-Neutral Test (D5)"
];

const metadataFields = [
  ["SiteID", "text"], ["LocaleName", "text"], ["Province", "select", provinces],
  ["date", "date"], ["time", "time"], ["observer", "select", observers],
  ["PLOT_ID", "text"], ["PLOT_TYPE", "select", plotTypes],
  ["latitude", "number"], ["longitude", "number"],
  ["DistSoilYN", "select", yesNo], ["DistVegYN", "select", yesNo], ["DistHydroYN", "select", yesNo],
  ["ProbSoilYN", "select", yesNo], ["ProbVegYN", "select", yesNo], ["ProbHydroYN", "select", yesNo],
  ["ClimHydroNormalYN", "select", yesNo], ["CircNormalYN", "select", yesNo],
  ["SummaryHydroVegYN", "select", yesNo], ["SummaryHydricSoilYN", "select", yesNo],
  ["SummaryHydrologyYN", "select", yesNo], ["SummaryInWetlandYN", "select", yesNo]
];

let state = defaultSurvey();
let surveys = JSON.parse(localStorage.getItem("wetlandSurveys") || "[]");

function defaultSurvey() {
  const now = new Date();
  const obj = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    SiteID: "", LocaleName: "", Province: "",
    date: now.toISOString().slice(0,10),
    time: now.toTimeString().slice(0,5),
    observer: "", PLOT_ID: "", PLOT_TYPE: "",
    latitude: "", longitude: "",
    DistSoilYN: "", DistVegYN: "", DistHydroYN: "",
    ProbSoilYN: "", ProbVegYN: "", ProbHydroYN: "",
    ClimHydroNormalYN: "", CircNormalYN: "",
    SummaryHydroVegYN: "", SummaryHydricSoilYN: "", SummaryHydrologyYN: "", SummaryInWetlandYN: "",
    notes: "",
    RestrictiveLayer: "", RestrictiveLayerDepthCM: "",
    SurfaceWaterYN: "", SurfaceWaterDepthCM: "",
    WaterTableYN: "", WaterTableDepthCM: "",
    SaturationYN: "", SaturationDepthCM: "",
    HydricSoilIndicators: [], HydrologyPrimary: [], HydrologySecondary: []
  };

  ["Tree", "Shrub"].forEach(group => {
    for (let i=1;i<=6;i++) { obj[`${group}Sp${i}`] = ""; obj[`${group}Sp${i}Cov`] = ""; }
  });
  for (let i=1;i<=10;i++) { obj[`HerbSp${i}`] = ""; obj[`HerbSp${i}Cov`] = ""; }

  for (let h=1; h<=4; h++) {
    obj[`SoilH${h}ThickCM`] = "";
    obj[`SoilH${h}Texture`] = "";
    obj[`SoilH${h}Matrix`] = "";
    obj[`SoilH${h}MatrixPC`] = "";
    obj[`SoilH${h}Redox`] = "";
    obj[`SoilH${h}RedoxPC`] = "";
    obj[`SoilH${h}RedoxType`] = "";
    obj[`SoilH${h}RedoxLoc`] = "";
  }
  return obj;
}

function init() {
  buildTabs();
  renderMetadata();
  renderVegetation();
  renderHydrology();
  renderSoils();
  bindActions();
}

function buildTabs() {
  const tabs = document.getElementById("tabs");
  ["metadata","vegetation","hydrology","soils"].forEach((p, i) => {
    const b = document.createElement("button");
    b.textContent = p[0].toUpperCase() + p.slice(1);
    if (i === 0) b.classList.add("active");
    b.onclick = () => {
      document.querySelectorAll(".tabs button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));
      document.querySelector(`[data-page='${p}']`).classList.add("active");
    };
    tabs.appendChild(b);
  });
}

function fieldEl(name, type, options) {
  const w = document.createElement("div"); w.className = "field";
  const l = document.createElement("label"); l.textContent = name; w.appendChild(l);
  let input;

  if (type === "select") {
    input = document.createElement("select");
    options.forEach(v => {
      const o = document.createElement("option"); o.value = v; o.textContent = v || "—";
      input.appendChild(o);
    });
  } else if (type === "textarea") {
    input = document.createElement("textarea");
  } else {
    input = document.createElement("input");
    input.type = type;
    if (type === "number") input.step = "any";
  }

  input.value = state[name] ?? "";
  input.oninput = () => state[name] = input.value;
  w.appendChild(input);
  return w;
}

function renderMetadata() {
  const root = document.getElementById("metadata-fields");
  metadataFields.forEach(([name, type, options]) => root.appendChild(fieldEl(name, type, options)));
  root.appendChild(fieldEl("notes", "textarea"));
}

function renderVegetation() {
  const root = document.getElementById("vegetation-fields");

  [["Tree", 6], ["Shrub", 6], ["Herb", 10]].forEach(([group, n]) => {
    const title = document.createElement("h3");
    title.className = "group-title";
    title.textContent = `${group} Species`;
    root.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "grid two";
    for (let i=1; i<=n; i++) {
      grid.appendChild(fieldEl(`${group}Sp${i}`, "text"));
      grid.appendChild(fieldEl(`${group}Sp${i}Cov`, "number"));
    }
    root.appendChild(grid);
  });
}

function renderHydrology() {
  const root = document.getElementById("hydrology-fields");
  [
    ["RestrictiveLayer","text"], ["RestrictiveLayerDepthCM","number"],
    ["SurfaceWaterYN","select",yesNo], ["SurfaceWaterDepthCM","number"],
    ["WaterTableYN","select",yesNo], ["WaterTableDepthCM","number"],
    ["SaturationYN","select",yesNo], ["SaturationDepthCM","number"]
  ].forEach(([n,t,o]) => root.appendChild(fieldEl(n,t,o)));

  root.appendChild(checkGroup("HydrologyPrimary", wetlandHydrologyPrimary));
  root.appendChild(checkGroup("HydrologySecondary", wetlandHydrologySecondary));
}

function renderSoils() {
  const root = document.getElementById("soil-fields");
  for (let h=1; h<=4; h++) {
    const title = document.createElement("h3");
    title.className = "group-title";
    title.textContent = `Soil Horizon ${h}`;
    root.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "grid two";
    ["ThickCM","Texture","Matrix","MatrixPC","Redox","RedoxPC","RedoxType","RedoxLoc"].forEach(s => {
      grid.appendChild(fieldEl(`SoilH${h}${s}`, s.includes("PC") ? "number" : "text"));
    });
    root.appendChild(grid);
  }
  root.appendChild(checkGroup("HydricSoilIndicators", hydricSoilIndicators));
}

function checkGroup(key, options) {
  const wrap = document.createElement("div");
  const title = document.createElement("h3");
  title.className = "group-title";
  title.textContent = key;
  wrap.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "grid";
  options.forEach(opt => {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.gap = ".5rem";
    const cb = document.createElement("input"); cb.type = "checkbox";
    cb.checked = (state[key] || []).includes(opt);
    cb.onchange = () => {
      const set = new Set(state[key] || []);
      cb.checked ? set.add(opt) : set.delete(opt);
      state[key] = [...set];
    };
    row.append(cb, document.createTextNode(opt));
    grid.appendChild(row);
  });
  wrap.appendChild(grid);
  return wrap;
}

function bindActions() {
  document.getElementById("btn-location").onclick = () => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        state.latitude = pos.coords.latitude;
        state.longitude = pos.coords.longitude;
        alert("Location captured.");
        location.reload();
      },
      () => alert("Could not read location.")
    );
  };

  document.getElementById("btn-submit").onclick = () => {
    state.timestamp = new Date().toISOString();
    state.id = crypto.randomUUID();
    surveys.push(structuredClone(state));
    localStorage.setItem("wetlandSurveys", JSON.stringify(surveys));
    alert(`Survey submitted. Saved count: ${surveys.length}`);
    state = defaultSurvey();
    location.reload();
  };

  document.getElementById("btn-reset").onclick = () => {
    if (!confirm("Reset current form?")) return;
    state = defaultSurvey();
    location.reload();
  };

  document.getElementById("btn-save-json").onclick = () => {
    localStorage.setItem("wetlandCurrentDraft", JSON.stringify(state));
    alert("Draft saved in localStorage (wetlandCurrentDraft)");
  };

  document.getElementById("btn-csv").onclick = () => {
    if (!surveys.length) return alert("No submitted surveys to export.");
    downloadFile(toCSV(surveys), `Survey_${dateStamp()}.csv`, "text/csv");
  };

  document.getElementById("btn-geojson").onclick = () => {
    if (!surveys.length) return alert("No submitted surveys to export.");
    downloadFile(JSON.stringify(toGeoJSON(surveys), null, 2), `Survey_${dateStamp()}.geojson`, "application/geo+json");
  };
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
}

function toCSV(rows) {
  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const esc = (v) => {
    if (Array.isArray(v)) v = v.join(";");
    if (v == null) v = "";
    const s = String(v).replaceAll('"', "''");
    return `"${s}"`;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
}

function toGeoJSON(rows) {
  return {
    type: "FeatureCollection",
    features: rows.map(r => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(r.longitude) || 0, Number(r.latitude) || 0]
      },
      properties: r
    }))
  };
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

init();
