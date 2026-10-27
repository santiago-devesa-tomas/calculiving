/**
 * Calculiving - Client Application Logic (v2.0)
 * Linear flow, fullscreen bot, connected portal inputs, street-by-street polygon drawing,
 * 25/75 draggable & resizable floor planner, and default vertical list results.
 */

// Global State
const appState = {
  currentScreen: "screen-home",
  screenHistory: ["screen-home"],
  salary: 1500000, // ARS
  portals: [
    { id: "p-1", name: "Zonaprop", domain: "zonaprop.com.ar", status: "ok" },
    { id: "p-2", name: "Argenprop", domain: "argenprop.com", status: "ok" },
    { id: "p-3", name: "MercadoLibre Inmuebles", domain: "mercadolibre.com.ar/inmuebles", status: "ok" }
  ],
  properties: [],
  selectedOperation: "alquiler",
  maxPrice: 1600000,
  minRooms: 1,
  activeFloor: 1,
  floorsCount: 1,
  // 2D Spatial Floor Plan: each room has position (x, y) and dimensions (w, l in meters)
  floorRooms: [
    { id: "room-1", type: "living", name: "Living", floor: 1, x: 50, y: 50, width: 5.5, length: 4.0, priority: true },
    { id: "room-2", type: "cocina", name: "Cocina", floor: 1, x: 340, y: 50, width: 3.2, length: 2.8, priority: true },
    { id: "room-3", type: "baño", name: "Baño", floor: 1, x: 340, y: 220, width: 2.2, length: 1.8, priority: true },
    { id: "room-4", type: "habitacion", name: "Habitación", floor: 1, x: 50, y: 270, width: 3.8, length: 3.2, priority: true },
    { id: "room-5", type: "cochera", name: "Cochera", floor: 1, x: 520, y: 50, width: 5.0, length: 2.5, priority: false }
  ],
  selectedRoomId: "room-1",
  pois: [
    { id: "poi-1", code: "A", label: "Punto A", lat: -34.5985, lng: -58.3830, color: "#ef4444" },
    { id: "poi-2", code: "B", label: "Punto B", lat: -34.5880, lng: -58.4100, color: "#3b82f6" },
    { id: "poi-3", code: "C", label: "Punto C", lat: -34.5760, lng: -58.4265, color: "#10b981" }
  ],
  activeHighlightedPoiId: null,
  drawnPolygonPoints: [],
  drawnPolygonLayer: null,
  isDrawingMode: false,
  sortOption: "cercania_todos"
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadPropertiesData();
  setupNavigationFlow();
  setupSalaryBanner();
  setupFullscreenBot();
  setupConnectedPortalsInput();
  setupInteractiveMap();
  setupFloorPlanCanvasEditor();
  setupResultsListing();
  renderConnectedPortalsList();
});

/* ----------------------------------------------------
   1. NAVIGATION & LINEAR STEP FLOW
---------------------------------------------------- */
function navigateTo(screenId) {
  if (appState.currentScreen === screenId) return;

  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add("active");
    appState.screenHistory.push(screenId);
    appState.currentScreen = screenId;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  updateHeaderStepIndicator(screenId);

  if (screenId === "screen-metodo") {
    ensureMapReadyAndVisible();
  }
}

function navigateBack() {
  if (appState.screenHistory.length <= 1) return;
  appState.screenHistory.pop(); // Remove current
  const prevScreen = appState.screenHistory[appState.screenHistory.length - 1];

  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(prevScreen);
  if (target) {
    target.classList.add("active");
    appState.currentScreen = prevScreen;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  updateHeaderStepIndicator(prevScreen);

  if (prevScreen === "screen-metodo") {
    ensureMapReadyAndVisible();
  }
}

function updateHeaderStepIndicator(screenId) {
  const badge = document.getElementById("current-step-label");
  const backBtn = document.getElementById("header-back-btn");

  if (screenId === "screen-home") {
    if (badge) badge.textContent = "Tipo de Búsqueda";
    if (backBtn) backBtn.classList.remove("visible");
  } else {
    if (backBtn) backBtn.classList.add("visible");

    if (screenId === "screen-bot-fullscreen") {
      if (badge) badge.textContent = "Asistente Guiado (Opción A)";
    } else if (screenId === "screen-portales") {
      if (badge) badge.textContent = "Cargar Sitios de Búsqueda";
    } else if (screenId === "screen-metodo") {
      if (badge) badge.textContent = "Dónde Buscar (Delimitar Límites)";
    } else if (screenId === "screen-editor") {
      if (badge) badge.textContent = "Editor de Plano (Opción C)";
    } else if (screenId === "screen-resultados") {
      if (badge) badge.textContent = "Resultados";
    }
  }
}

function setupNavigationFlow() {
  document.getElementById("nav-brand-btn")?.addEventListener("click", () => {
    appState.screenHistory = ["screen-home"];
    navigateTo("screen-home");
  });

  document.getElementById("header-back-btn")?.addEventListener("click", navigateBack);

  // Home 3 Options
  document.getElementById("btn-option-a")?.addEventListener("click", () => navigateTo("screen-bot-fullscreen"));
  document.getElementById("btn-option-b")?.addEventListener("click", () => navigateTo("screen-portales"));
  document.getElementById("btn-option-c")?.addEventListener("click", () => navigateTo("screen-editor"));

  // Flow forward buttons
  document.getElementById("bot-proceed-portales-btn")?.addEventListener("click", () => navigateTo("screen-portales"));
  document.getElementById("bot-back-home-btn")?.addEventListener("click", navigateBack);
  document.getElementById("portales-back-btn")?.addEventListener("click", navigateBack);
  document.getElementById("portals-ready-btn")?.addEventListener("click", () => navigateTo("screen-metodo"));
  document.getElementById("btn-map-go-results")?.addEventListener("click", () => {
    const mapOp = document.getElementById("map-filter-operation")?.value;
    const mapMax = parseFloat(document.getElementById("map-filter-max-price")?.value);
    if (mapOp) appState.selectedOperation = mapOp;
    if (!isNaN(mapMax) && mapMax > 0) appState.maxPrice = mapMax;
    executeFilterAndRender();
    navigateTo("screen-resultados");
  });
  document.getElementById("btn-filter-go-results")?.addEventListener("click", () => {
    appState.selectedOperation = document.getElementById("filter-operation").value;
    appState.maxPrice = parseFloat(document.getElementById("filter-max-price").value) || 2000000;
    appState.minRooms = parseInt(document.getElementById("filter-min-rooms").value) || 1;
    executeFilterAndRender();
    navigateTo("screen-resultados");
  });
  document.getElementById("btn-editor-search-results")?.addEventListener("click", () => {
    executeFilterAndRender();
    navigateTo("screen-resultados");
  });
}

/* ----------------------------------------------------
   2. SPEECH BUBBLE SALARY ON MAP & COST MODAL
---------------------------------------------------- */
function setupSalaryBanner() {
  const salaryInput = document.getElementById("global-salary-input");
  const applyBtn = document.getElementById("apply-salary-btn");
  const explainBtn = document.getElementById("open-cost-bot-btn");

  const updateSalary = () => {
    const val = parseFloat(salaryInput.value);
    if (!isNaN(val) && val > 0) {
      appState.salary = val;
      renderAffordabilityZonesOnMap();
      if (activePolygonLayer && appState.drawnPolygonPoints.length >= 3) {
        updateDrawnPolygonStyleAndHover();
      }
      if (appState.currentScreen === "screen-resultados") {
        executeFilterAndRender();
      }
    }
  };

  applyBtn?.addEventListener("click", updateSalary);
  salaryInput?.addEventListener("input", updateSalary);
  salaryInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") updateSalary();
  });

  explainBtn?.addEventListener("click", () => showCostExplanationModal());
  document.getElementById("close-cost-modal-btn")?.addEventListener("click", () => {
    document.getElementById("cost-explanation-modal")?.classList.remove("open");
  });
  document.getElementById("cost-modal-ok-btn")?.addEventListener("click", () => {
    document.getElementById("cost-explanation-modal")?.classList.remove("open");
  });
}

function showCostExplanationModal(prop = null) {
  const modal = document.getElementById("cost-explanation-modal");
  const body = document.getElementById("cost-modal-body");
  const salary = appState.salary;

  const rent = prop ? prop.costo_real.alquiler_ars : 850000;
  const expensas = prop ? prop.costo_real.expensas_ars : 150000;
  const services = prop ? prop.costo_real.servicios_estimados_ars : 65000;
  const basket = prop ? prop.costo_real.canasta_barrial_ars : 280000;
  const transit = prop ? prop.costo_real.transporte_estimado_ars : 38000;

  // Cálculo 1: Alquiler + Expensas
  const alquilerTotal = rent + expensas;
  const pctAlquiler = ((alquilerTotal / salary) * 100).toFixed(1);
  let colorAlquiler = "var(--success)";
  let semaforoAlquiler = "VERDE (≤35%)";
  if (pctAlquiler > 35 && pctAlquiler <= 45) { colorAlquiler = "var(--warning)"; semaforoAlquiler = "AMARILLO (35-45%)"; }
  else if (pctAlquiler > 45 && pctAlquiler <= 55) { colorAlquiler = "#f97316"; semaforoAlquiler = "NARANJA (45-55%)"; }
  else if (pctAlquiler > 55) { colorAlquiler = "var(--danger)"; semaforoAlquiler = "ROJO (>55%)"; }

  // Cálculo 2: Estilo de Vida
  const estiloVidaTotal = services + basket + transit;
  const pctEstiloVida = ((estiloVidaTotal / salary) * 100).toFixed(1);
  let colorEstiloVida = "var(--success)";
  let semaforoEstiloVida = "VERDE (0-25%)";
  if (pctEstiloVida > 25 && pctEstiloVida <= 50) { colorEstiloVida = "var(--warning)"; semaforoEstiloVida = "AMARILLO (25-50%)"; }
  else if (pctEstiloVida > 50 && pctEstiloVida <= 75) { colorEstiloVida = "#f97316"; semaforoEstiloVida = "NARANJA (50-75%)"; }
  else if (pctEstiloVida > 75) { colorEstiloVida = "var(--danger)"; semaforoEstiloVida = "ROJO (75-100%)"; }

  const total = alquilerTotal + estiloVidaTotal;
  const pctTotal = ((total / salary) * 100).toFixed(1);

  body.innerHTML = `
    <p style="margin-bottom: 0.75rem;">
      Calculiving evalúa cuánto cuesta genuinamente mantener la vivienda y cuánto hay que manejar en los negocios del barrio para tu sueldo declarado ($${salary.toLocaleString("es-AR")} ARS):
    </p>

    <!-- ALQUILER Y VIVIENDA -->
    <div style="background:var(--bg-primary); padding:0.85rem; border-radius:var(--radius-sm); border-left:4px solid ${colorAlquiler}; margin-bottom:1rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
        <strong style="color:#fff; font-size:0.95rem;">🏠 Costo de Alquiler + Expensas (+ Impuestos y Servicios Fijos)</strong>
        <span style="font-weight:700; color:${colorAlquiler}; font-size:0.85rem;">${semaforoAlquiler}</span>
      </div>
      <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.4rem;">
        Alquiler ($${rent.toLocaleString("es-AR")}) + Expensas ($${expensas.toLocaleString("es-AR")}) = <strong>$${alquilerTotal.toLocaleString("es-AR")} ARS</strong> (+ Impuestos y Servicios fijos de la vivienda: $${services.toLocaleString("es-AR")} ARS).
      </p>
      <div style="font-size:0.8rem; color:#fff;">
        El alquiler + expensas representa el <strong>${pctAlquiler}%</strong> de tu sueldo.<br>
        <span style="color:var(--text-muted); font-size:0.75rem;">Escala Alquiler: Verde (≤35%) | Amarillo (35-45%) | Naranja (45-55%) | Rojo (>55%)</span>
      </div>
    </div>

    <!-- COMERCIOS Y COSTE DE VIDA -->
    <div style="background:var(--bg-primary); padding:0.85rem; border-radius:var(--radius-sm); border-left:4px solid ${colorEstiloVida}; margin-bottom:1rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
        <strong style="color:#fff; font-size:0.95rem;">🏪 Costo de Vivir en los Comercios de los Alrededores y Servicios</strong>
        <span style="font-weight:700; color:${colorEstiloVida}; font-size:0.85rem;">${semaforoEstiloVida}</span>
      </div>
      <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.4rem;">
        Comercios cercanos ($${basket.toLocaleString("es-AR")}) + Impuestos/Servicios ($${services.toLocaleString("es-AR")}) + Transporte SUBE ($${transit.toLocaleString("es-AR")}) = <strong>$${estiloVidaTotal.toLocaleString("es-AR")} ARS</strong>
      </p>
      <div style="font-size:0.8rem; color:#fff;">
        Representa el <strong>${pctEstiloVida}%</strong> de tu sueldo.<br>
        <span style="color:var(--text-muted); font-size:0.75rem;">Escala Coste de Vida: Verde (0-25%) | Amarillo (25-50%) | Naranja (50-75%) | Rojo (75-100%)</span>
      </div>
    </div>

    <div style="background:rgba(6,182,212,0.1); border:1px solid var(--accent-cyan); padding:0.75rem; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:0.85rem; font-weight:700;">Gasto Mensual Total Proyectado:</span>
      <span style="font-size:0.95rem; font-weight:800; color:var(--accent-cyan);">$${total.toLocaleString("es-AR")} ARS (${pctTotal}% del sueldo)</span>
    </div>
  `;

  modal.classList.add("open");
}

/* ----------------------------------------------------
   3. SCREEN A: FULLSCREEN BOT (TIPO GEMINI)
---------------------------------------------------- */
function setupFullscreenBot() {
  const thread = document.getElementById("fullscreen-chat-thread");
  const input = document.getElementById("fullscreen-bot-input");
  const sendBtn = document.getElementById("fullscreen-bot-send-btn");

  const handleSend = (textOverride = null) => {
    const text = (textOverride || input.value).trim();
    if (!text) return;

    if (!textOverride) input.value = "";

    // Append user message
    appendChatMsg(thread, "user", text);

    // Bot processing & response
    setTimeout(() => {
      const reply = generateBotGoalAnalysis(text);
      appendChatMsg(thread, "bot", reply);
    }, 400);
  };

  sendBtn?.addEventListener("click", () => handleSend());
  input?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSend();
  });

  document.querySelectorAll(".suggestion-pill").forEach(pill => {
    pill.addEventListener("click", (e) => {
      const prompt = e.currentTarget.getAttribute("data-prompt");
      handleSend(prompt);
    });
  });
}

function appendChatMsg(thread, role, htmlText) {
  if (!thread) return;
  const msg = document.createElement("div");
  msg.className = `chat-msg ${role}`;
  msg.innerHTML = `
    <div class="avatar">${role === 'bot' ? '🤖' : '👤'}</div>
    <div class="chat-bubble-content">${htmlText}</div>
  `;
  thread.appendChild(msg);
  thread.scrollTop = thread.scrollHeight;
}

function generateBotGoalAnalysis(userInput) {
  const lower = userInput.toLowerCase();
  let analysis = `<strong>Comprendido.</strong> Registré tus prioridades: `;

  if (lower.includes("home office") || lower.includes("teletrabajo") || lower.includes("escritorio")) {
    analysis += `<br>• <strong>Espacio de trabajo:</strong> Priorizaremos departamentos con distribución que permita aislar un escritorio o segundo ambiente luminoso.`;
  }
  if (lower.includes("subte") || lower.includes("transporte") || lower.includes("colectivo")) {
    analysis += `<br>• <strong>Conectividad:</strong> Ponderaremos cercanía a bocas de subte y corredores de Metrobus para optimizar tu tiempo de viaje.`;
  }
  if (lower.includes("balcón") || lower.includes("balcon") || lower.includes("luminoso") || lower.includes("terraza")) {
    analysis += `<br>• <strong>Luz y aire:</strong> Filtraremos inmuebles con orientación abierta y espacio exterior propio.`;
  }
  if (lower.includes("cochera") || lower.includes("auto")) {
    analysis += `<br>• <strong>Cochera:</strong> Asignada como ambiente prioritario en el ranking.`;
  }

  analysis += `<br><br>Cuando estés listo, hacé click abajo en <strong>"Continuar a Cargar Sitios de Portales"</strong> para elegir qué plataformas consultar y luego trazar tu zona en el mapa.`;
  return analysis;
}

/* ----------------------------------------------------
   4. SCREEN 2: CARGAR PORTALES (RECTÁNGULO CON LISTA CONECTADA ARRIBA)
---------------------------------------------------- */
function setupConnectedPortalsInput() {
  const input = document.getElementById("portal-site-input");
  const addBtn = document.getElementById("portal-add-circle-btn");

  const addPortal = (siteName, domain) => {
    const rawVal = domain || input.value.trim();
    if (!rawVal) return;

    if (!domain) input.value = "";

    const name = siteName || detectSiteName(rawVal);
    const cleanDomain = rawVal.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

    appState.portals.push({
      id: "p-" + Date.now(),
      name: name,
      domain: cleanDomain,
      status: "ok"
    });

    renderConnectedPortalsList();
  };

  addBtn?.addEventListener("click", () => addPortal());
  input?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addPortal();
  });

  // Preset chips
  document.querySelectorAll(".portal-chip-btn").forEach(chip => {
    chip.addEventListener("click", (e) => {
      const site = e.currentTarget.getAttribute("data-site");
      const url = e.currentTarget.getAttribute("data-url");
      addPortal(site, url);
    });
  });
}

function detectSiteName(val) {
  const lower = val.toLowerCase();
  if (lower.includes("zonaprop")) return "Zonaprop";
  if (lower.includes("argenprop")) return "Argenprop";
  if (lower.includes("mercadolibre")) return "MercadoLibre Inmuebles";
  if (lower.includes("remax")) return "Remax Argentina";
  if (lower.includes("properati")) return "Properati";
  return "Portal Inmobiliario (" + val.slice(0, 15) + ")";
}

function renderConnectedPortalsList() {
  const listContainer = document.getElementById("connected-portals-list");
  if (!listContainer) return;

  if (appState.portals.length === 0) {
    listContainer.classList.remove("has-items");
    listContainer.innerHTML = "";
    return;
  }

  listContainer.classList.add("has-items");

  listContainer.innerHTML = appState.portals.map((p, idx) => {
    const cleanHref = p.domain.startsWith("http") ? p.domain : `https://${p.domain}`;
    return `
      <div class="portal-list-item" data-id="${p.id}">
        <a href="${escapeHtml(cleanHref)}" target="_blank" rel="noopener noreferrer" class="portal-item-info" style="text-decoration:none; flex:1;" title="Click para abrir ${escapeHtml(p.domain)} en pestaña nueva">
          <span class="portal-item-icon">🌐</span>
          <div>
            <div class="portal-item-name">${escapeHtml(p.name)} <span style="font-size:0.75rem; color:var(--accent-cyan);">↗</span></div>
            <div class="portal-item-domain">${escapeHtml(p.domain)} (click para verificar sitio)</div>
          </div>
        </a>
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <a href="${escapeHtml(cleanHref)}" target="_blank" rel="noopener noreferrer" class="portal-item-status ok" style="text-decoration:none;" title="Abrir portal">✓ cargado OK ↗</a>
          <button class="btn-sm btn-secondary delete-portal-btn" data-id="${p.id}" style="padding:0.2rem 0.5rem; font-size:0.75rem;" title="Eliminar sitio">✕</button>
        </div>
      </div>
      ${idx < appState.portals.length - 1 ? '<div class="portal-list-divider"></div>' : ''}
    `;
  }).join("");

  listContainer.querySelectorAll(".delete-portal-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      appState.portals = appState.portals.filter(p => p.id !== id);
      renderConnectedPortalsList();
    });
  });
}

/* ----------------------------------------------------
   5. SCREEN 3: MAPA REAL LIBRE DE USO (LEAFLET + OPENSTREETMAP / CARTO / ESRI CON CACHÉ LOCAL)
   - Límites orgánicos siguiendo avenidas, vías de tren, puentes y autopistas (Norte/Sur dentro de cada barrio)
   - Múltiples Puntos de Interés sumables con "+"
   - Al pasar el mouse o tocar un Punto de Interés: el mapa se atenúa (grisáceo) y resaltan con colores nítidos las rutas en Auto, Subte, Colectivo y Caminando
---------------------------------------------------- */
let leafletMap = null;
let activeTileLayer = null;
let currentTileProvider = "osm";
let zonesLayerGroup = null;
let poisLayerGroup = null;
let routesLayerGroup = null;
let drawnPolygonLayerGroup = null;
let drawingPoints = [];
let activePolygonLayer = false;
let hoverNavigateTimer = null;
let selectedZoneForDeepDive = null;

const POI_PALETTE = [
  "#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
];

// Catálogo de 10 Sub-Zonas Orgánicas (Polígonos multi-vértice que siguen avenidas reales, puentes ferroviarios y autopistas donde cambian los precios)
const MAP_AFFORDABILITY_ZONES = [
  {
    id: "zona-almagro-norte",
    slug: "almagro",
    name: "Almagro Norte (Córdoba / Corrientes / Medrano)",
    urban_boundary_note: "Delimitado por Av. Córdoba, Av. Estado de Israel, Av. Ángel Gallardo, Av. Díaz Vélez, Vías del Ferrocarril Sarmiento y Av. Sánchez de Bustamante.",
    bridge_price_effect: "Al norte de las vías del Tren Sarmiento (eje Av. Corrientes y Subte B Medrano/Gallardo) el alquiler es un 14% más alto que cruzando el puente ferroviario hacia Almagro Sur.",
    coords: [
      [-34.5975, -58.4125],
      [-34.5988, -58.4235],
      [-34.5998, -58.4312],
      [-34.6032, -58.4335],
      [-34.6062, -58.4310],
      [-34.6088, -58.4258],
      [-34.6085, -58.4190],
      [-34.6082, -58.4122],
      [-34.6025, -58.4120]
    ],
    alquiler_ars: 475000,
    expensas_ars: 86000,
    servicios_ars: 52000,
    canasta_comercios_ars: 215000,
    transporte_ars: 32000,
    impuestos_y_servicios: {
      abl_municipal_ars: 11500,
      luz_edenor_edesur_ars: 14500,
      gas_metrogas_ars: 8500,
      agua_aysa_ars: 7500,
      internet_fibra_ars: 10000
    },
    locales_cercanos: [
      { tipo: "🛒 Supermercados de Barrio y Avenidas (Av. Córdoba / Av. Medrano)", valores: "Leche 1L: $1.380 | Arroz 1kg: $1.650 | Fideos 500g: $1.100 | Aceite 1.5L: $2.600", mensual_ars: 82000 },
      { tipo: "🥩 Carnicerías y Granjas (Rocamora / Guardia Vieja)", valores: "Asado/Vacío 1kg: $8.600 | Suprema pollo 1kg: $5.900 | Carne picada 1kg: $6.400 | Maple 30 huevos: $3.900", mensual_ars: 54000 },
      { tipo: "🥬 Verdulerías y Feria Barrial Parque Centenario / Bulnes", valores: "Papa 1kg: $950 | Tomate 1kg: $1.800 | Banana 1kg: $1.750 | Manzana 1kg: $1.900", mensual_ars: 29000 },
      { tipo: "🥖 Panaderías y Cafeterías de Cuadra", valores: "Pan flauta 1kg: $2.400 | Docena facturas: $5.800 | Café + 2 medialunas: $3.600", mensual_ars: 18000 },
      { tipo: "🧴 Artículos de Limpieza Sueltos y Perfumería", valores: "Jabón líquido 5L: $5.200 | Shampoo/Acond.: $4.100 | Papel higiénico x4: $2.800", mensual_ars: 14000 },
      { tipo: "🏋️ Gimnasios de Barrio / Club Almagro", valores: "Cuota mensual libre: $24.000 | Clase suelta: $4.500", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Eje comercial Av. Corrientes y Av. Medrano (Subte B), Hospital Italiano y ferias barriales con precios medios-bajos."
  },
  {
    id: "zona-almagro-sur",
    slug: "almagro",
    name: "Almagro Sur (Cruzando Vías Sarmiento / Rivadavia a Independencia)",
    urban_boundary_note: "Delimitado al norte por la traza del Ferrocarril Sarmiento y Av. Rivadavia, Av. Boedo, Av. Independencia y Av. Sánchez de Bustamante / Loria.",
    bridge_price_effect: "Cruzando el puente/vías del Sarmiento y Av. Rivadavia hacia Av. Belgrano e Independencia, el alquiler baja un ~14% y los comercios barriales son un 10% más económicos.",
    coords: [
      [-34.6088, -58.4258],
      [-34.6085, -58.4190],
      [-34.6082, -58.4122],
      [-34.6145, -58.4125],
      [-34.6188, -58.4132],
      [-34.6195, -58.4205],
      [-34.6202, -58.4268],
      [-34.6140, -58.4265]
    ],
    alquiler_ars: 415000,
    expensas_ars: 71000,
    servicios_ars: 47000,
    canasta_comercios_ars: 194000,
    transporte_ars: 31000,
    impuestos_y_servicios: {
      abl_municipal_ars: 9800,
      luz_edenor_edesur_ars: 13200,
      gas_metrogas_ars: 7800,
      agua_aysa_ars: 6800,
      internet_fibra_ars: 9400
    },
    locales_cercanos: [
      { tipo: "🛒 Autoservicios y Almacenes (Av. Belgrano / Av. Boedo)", valores: "Leche 1L: $1.310 | Arroz 1kg: $1.520 | Fideos 500g: $990 | Aceite 1.5L: $2.450", mensual_ars: 74000 },
      { tipo: "🥩 Carnicerías Tradicionales (México / Venezuela)", valores: "Asado 1kg: $7.900 | Suprema pollo 1kg: $5.400 | Picada especial 1kg: $5.900 | Maple 30 huevos: $3.600", mensual_ars: 49000 },
      { tipo: "🥬 Verdulerías Mayoristas de Barrio (Av. Independencia)", valores: "Papa 1kg: $850 | Tomate 1kg: $1.600 | Cebolla 1kg: $900 | Naranja 1kg: $1.150", mensual_ars: 26000 },
      { tipo: "🥖 Panaderías de Cuadra y Pastas Frescas", valores: "Pan 1kg: $2.150 | Ravioles caseros x2 planchas: $3.800 | Docena facturas: $5.100", mensual_ars: 16000 },
      { tipo: "🧴 Limpieza por Litro y Farmacias Sindicales / Barriales", valores: "Combo detergente + lavandina + jabón 5L: $6.800 | Papel higiénico x4: $2.500", mensual_ars: 13000 },
      { tipo: "🏋️ Clubes de Barrio ( Mariano Moreno / Gimnasios Boedo)", valores: "Cuota social + musculación: $20.000", mensual_ars: 16000 }
    ],
    gastos_alrededor_detalle: "Subte A (Castro Barros / Loria), líneas de colectivo por Av. Belgrano e Independencia, edificios de bajas expensas y PHs."
  },
  {
    id: "zona-caballito-norte",
    slug: "caballito",
    name: "Caballito Norte (Parque Centenario / Cid Campeador / Acoyte)",
    urban_boundary_note: "Sigue el contorno curvo de Parque Centenario, Av. Ángel Gallardo, Av. Gaona, Av. Honorio Pueyrredón, Vías del Sarmiento y Av. Acoyte.",
    bridge_price_effect: "Entre Parque Centenario, Av. Acoyte y el norte de las vías del Sarmiento concentra alta demanda comercial y médica; es un 12% más caro que Caballito Sur pasando el puente ferroviario.",
    coords: [
      [-34.6020, -58.4455],
      [-34.6002, -58.4365],
      [-34.6032, -58.4335],
      [-34.6062, -58.4310],
      [-34.6140, -58.4315],
      [-34.6182, -58.4368],
      [-34.6198, -58.4465],
      [-34.6145, -58.4525],
      [-34.6075, -58.4502]
    ],
    alquiler_ars: 535000,
    expensas_ars: 98000,
    servicios_ars: 58000,
    canasta_comercios_ars: 235000,
    transporte_ars: 35000,
    impuestos_y_servicios: {
      abl_municipal_ars: 13500,
      luz_edenor_edesur_ars: 16000,
      gas_metrogas_ars: 9200,
      agua_aysa_ars: 8300,
      internet_fibra_ars: 11000
    },
    locales_cercanos: [
      { tipo: "🛒 Mercado del Progreso y Supermercados (Rivadavia y Del Barco Centenera)", valores: "Leche 1L: $1.420 | Queso cremoso 1kg: $7.400 | Café molido 500g: $6.800 | Yerba 1kg: $3.600", mensual_ars: 89000 },
      { tipo: "🥩 Puestos de Carnicería del Mercado / Av. Díaz Vélez", valores: "Bife de chorizo/Asado 1kg: $9.200 | Pechuga 1kg: $6.300 | Maple 30 huevos: $4.100", mensual_ars: 59000 },
      { tipo: "🥬 Verdulerías de Av. Acoyte y Feria Parque Centenario", valores: "Papa 1kg: $1.050 | Tomate 1kg: $1.950 | Palta c/u: $1.400 | Naranja 1kg: $1.300", mensual_ars: 31000 },
      { tipo: "🥖 Confiterías y Panaderías (Acoyte / Hidalgo)", valores: "Pan 1kg: $2.650 | Docena facturas: $6.400 | Café con leche + tostado: $5.900", mensual_ars: 21000 },
      { tipo: "🧺 Lavaderos Receptores y Farmacias sobre Av. Rivadavia", valores: "Valet lavadero (canasto): $4.800 | Kit limpieza mensual: $11.500", mensual_ars: 15000 },
      { tipo: "🏋️ Club Ferro Carril Oeste / Gimnasios Av. Avellaneda", valores: "Cuota mensual gimnasio: $28.000 | Cuota social club: $31.000", mensual_ars: 20000 }
    ],
    gastos_alrededor_detalle: "Parque Centenario, Mercado del Progreso, Subte A (Acoyte / Primera Junta) y Estación Caballito del Tren Sarmiento."
  },
  {
    id: "zona-caballito-sur",
    slug: "caballito",
    name: "Caballito Sur (Pasando Puente Sarmiento / Pedro Goyena a Au. 25 de Mayo)",
    urban_boundary_note: "Desde el puente y traza del Tren Sarmiento / Av. Alberdi hacia el sur por Av. Pedro Goyena, Av. Directorio hasta el borde de la Autopista 25 de Mayo.",
    bridge_price_effect: "Al cruzar el puente del Sarmiento, el corredor Pedro Goyena tiene torres nuevas pero bajando 4 cuadras hacia Av. Directorio y la Autopista 25 de Mayo el alquiler y los comercios bajan un ~15%.",
    coords: [
      [-34.6182, -58.4368],
      [-34.6195, -58.4268],
      [-34.6265, -58.4275],
      [-34.6318, -58.4335],
      [-34.6335, -58.4455],
      [-34.6295, -58.4520],
      [-34.6225, -58.4505],
      [-34.6198, -58.4465]
    ],
    alquiler_ars: 465000,
    expensas_ars: 84000,
    servicios_ars: 53000,
    canasta_comercios_ars: 212000,
    transporte_ars: 34000,
    impuestos_y_servicios: {
      abl_municipal_ars: 12000,
      luz_edenor_edesur_ars: 14800,
      gas_metrogas_ars: 8600,
      agua_aysa_ars: 7600,
      internet_fibra_ars: 10000
    },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Autoservicios (Av. Alberdi / Av. Directorio)", valores: "Leche 1L: $1.360 | Arroz 1kg: $1.590 | Yerba 1kg: $3.400 | Aceite 1.5L: $2.550", mensual_ars: 80000 },
      { tipo: "🥩 Carnicerías de Barrio (José María Moreno / Valle)", valores: "Asado 1kg: $8.500 | Milanesa bola de lomo 1kg: $7.400 | Maple 30 huevos: $3.850", mensual_ars: 53000 },
      { tipo: "🥬 Verdulerías (Eje Av. Directorio y Feria Parque Chacabuco)", valores: "Papa 1kg: $920 | Tomate 1kg: $1.750 | Manzana 1kg: $1.800", mensual_ars: 28000 },
      { tipo: "🥖 Panaderías de Barrio y Cafés en Pedro Goyena", valores: "Pan 1kg: $2.400 | Facturas docena: $5.900 | Café en Pedro Goyena: $3.400", mensual_ars: 19000 },
      { tipo: "🧴 Limpieza, Ferretería y Farmacias de Barrio", valores: "Valet lavadero: $4.400 | Insumos limpieza hogar: $10.200", mensual_ars: 14000 },
      { tipo: "🏋️ Gimnasios y Entrenamiento en Parque Chacabuco / Goyena", valores: "Cuota mensual gimnasio: $24.500", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Subte E (José María Moreno / Emilio Mitre), Subte A (Puán / Carabobo), acceso rápido a Autopista 25 de Mayo y polo gastronómico Pedro Goyena."
  },
  {
    id: "zona-villa-crespo",
    slug: "villa-crespo",
    name: "Villa Crespo (Corrientes / Scalabrini Ortiz / Arroyo Maldonado)",
    urban_boundary_note: "Polígono delimitado por Av. Córdoba, Av. Scalabrini Ortiz, Av. Ángel Gallardo, Av. Gaona, Vías del San Martín y Av. Dorrego.",
    bridge_price_effect: "Separado de Palermo por Av. Córdoba y del sector norte por el viaducto del Tren San Martín y el arroyo Maldonado (Av. Juan B. Justo); cuesta un 25% menos que Palermo Soho a solo 5 cuadras.",
    coords: [
      [-34.5895, -58.4425],
      [-34.5938, -58.4325],
      [-34.5988, -58.4235],
      [-34.5998, -58.4312],
      [-34.6032, -58.4335],
      [-34.6002, -58.4365],
      [-34.6020, -58.4455],
      [-34.5975, -58.4535],
      [-34.5918, -58.4495]
    ],
    alquiler_ars: 540000,
    expensas_ars: 98000,
    servicios_ars: 56000,
    canasta_comercios_ars: 230000,
    transporte_ars: 33000,
    impuestos_y_servicios: {
      abl_municipal_ars: 13000,
      luz_edenor_edesur_ars: 15500,
      gas_metrogas_ars: 8800,
      agua_aysa_ars: 8200,
      internet_fibra_ars: 10500
    },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Mayoristas (Av. Corrientes / Av. Warnes)", valores: "Leche 1L: $1.400 | Pan lactal: $2.300 | Aceite girasol 1.5L: $2.650", mensual_ars: 86000 },
      { tipo: "🥩 Carnicerías y Pollerías (Serrano / Murillo)", valores: "Asado 1kg: $8.900 | Milanesa ternera 1kg: $7.800 | Maple huevos: $4.000", mensual_ars: 56000 },
      { tipo: "🥬 Verdulerías y Dietéticas (Av. Scalabrini Ortiz)", valores: "Mix frutos secos 250g: $3.800 | Tomate 1kg: $1.850 | Papa 1kg: $1.000", mensual_ars: 30000 },
      { tipo: "🥖 Panaderías de Masa Madre y Cafés (Thames / Loyola)", valores: "Hogaza masa madre: $3.900 | Pan común 1kg: $2.500 | Flat white + croissant: $4.900", mensual_ars: 22000 },
      { tipo: "👕 Outlets de Indumentaria y Blanquería (Aguirre / Gurruchaga)", valores: "Remera básica outlet: $14.000 | Jean discontinuo: $34.000 | Juego sábanas: $29.000", mensual_ars: 18000 },
      { tipo: "🏋️ Club Atlanta y Gimnasios de Barrio (Humboldt)", valores: "Cuota gimnasio barrial: $26.000 | Cadena fitness: $38.000", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Subte B (Malabia / Dorrego), Metrobus Juan B. Justo, Tren San Martín (Est. Villa Crespo) y zona comercial de outlets en calle Aguirre."
  },
  {
    id: "zona-palermo-soho",
    slug: "palermo",
    name: "Palermo Soho (De Córdoba a Puente Pacífico / Juan B. Justo)",
    urban_boundary_note: "Delimitado por Av. Santa Fe, Av. Coronel Díaz, Av. Córdoba, Av. Scalabrini Ortiz y el eje de Av. Juan B. Justo / Puente Pacífico.",
    bridge_price_effect: "Hacia el este de Juan B. Justo y el Puente Pacífico predomina el turismo y la gastronomía intensiva, encareciendo un ~18% los comercios de cercanía respecto a Villa Crespo.",
    coords: [
      [-34.5785, -58.4260],
      [-34.5842, -58.4150],
      [-34.5885, -58.4105],
      [-34.5975, -58.4125],
      [-34.5988, -58.4235],
      [-34.5938, -58.4325],
      [-34.5895, -58.4365],
      [-34.5835, -58.4310]
    ],
    alquiler_ars: 710000,
    expensas_ars: 142000,
    servicios_ars: 71000,
    canasta_comercios_ars: 305000,
    transporte_ars: 38000,
    impuestos_y_servicios: {
      abl_municipal_ars: 19000,
      luz_edenor_edesur_ars: 19200,
      gas_metrogas_ars: 10300,
      agua_aysa_ars: 10500,
      internet_fibra_ars: 12000
    },
    locales_cercanos: [
      { tipo: "🛒 Supermercados sobre Av. Santa Fe / Av. Córdoba", valores: "Leche 1L: $1.540 | Queso tybo 1kg: $9.800 | Café grano 500g: $8.800", mensual_ars: 110000 },
      { tipo: "🥩 Carnicerías y Granja (Honduras / Cabrera)", valores: "Asado/Lomo 1kg: $10.800 | Pechuga 1kg: $7.100 | Maple huevos: $4.800", mensual_ars: 72000 },
      { tipo: "🥬 Verdulerías y Almacenes Naturales (Charcas / Gurruchaga)", valores: "Tomate cherry 500g: $2.350 | Papa 1kg: $1.320 | Fruta estación 1kg: $2.400", mensual_ars: 41000 },
      { tipo: "☕ Cafeterías y Panaderías de Autor (Plaza Serrano / Armenia)", valores: "Pan masa madre: $4.200 | Café + laminado: $6.200 | Menú mediodía: $11.500", mensual_ars: 38000 },
      { tipo: "🧺 Tintorerías Express y Farmacias 24hs", valores: "Valet lavado + planchado: $6.800 | Cuidado personal mensual: $17.500", mensual_ars: 20000 },
      { tipo: "🏋️ Gimnasios y Centros de Entrenamiento (Av. Santa Fe / Coronel Díaz)", valores: "Pase mensual: $43.000", mensual_ars: 24000 }
    ],
    gastos_alrededor_detalle: "Subte D (Plaza Italia / Scalabrini Ortiz / Bulnes), Alto Palermo y alta densidad gastronómica."
  },
  {
    id: "zona-palermo-hollywood",
    slug: "palermo",
    name: "Palermo Hollywood (Cruzando Puente Pacífico / Juan B. Justo a Dorrego)",
    urban_boundary_note: "Al norte/oeste del viaducto y Puente Pacífico (Av. Juan B. Justo), entre Av. Santa Fe / Cabildo, Vías del Mitre, Av. Dorrego y Av. Córdoba.",
    bridge_price_effect: "Cruzando el Puente Pacífico y las vías del San Martín hacia el norte (Ravignani, Arévalo, Dorrego) predominan edificios modernos con amenities (expensas +12% más altas que en Soho).",
    coords: [
      [-34.5715, -58.4365],
      [-34.5785, -58.4260],
      [-34.5835, -58.4310],
      [-34.5895, -58.4365],
      [-34.5895, -58.4425],
      [-34.5845, -58.4455],
      [-34.5768, -58.4435]
    ],
    alquiler_ars: 745000,
    expensas_ars: 158000,
    servicios_ars: 74000,
    canasta_comercios_ars: 315000,
    transporte_ars: 38000,
    impuestos_y_servicios: {
      abl_municipal_ars: 20500,
      luz_edenor_edesur_ars: 20000,
      gas_metrogas_ars: 10500,
      agua_aysa_ars: 11000,
      internet_fibra_ars: 12000
    },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Mercados (Av. Juan B. Justo / Av. Cabildo)", valores: "Leche 1L: $1.560 | Queso tybo 1kg: $10.100 | Yerba 1kg: $3.950", mensual_ars: 114000 },
      { tipo: "🥩 Carnicerías y Charcuterías (Niceto Vega / Fitz Roy)", valores: "Ojo de bife/Asado 1kg: $11.100 | Suprema 1kg: $7.300 | Huevos campo x30: $5.000", mensual_ars: 75000 },
      { tipo: "🥬 Verdulerías y Feria Sabe la Tierra / Mercado Bonpland", valores: "Bolsón agroecológico: $9.800 | Tomate 1kg: $2.300 | Palta: $1.650", mensual_ars: 43000 },
      { tipo: "☕ Bistrós, Panaderías y Cafeterías (Bonpland / Gorriti)", valores: "Hogaza campo: $4.300 | Café + avo toast: $9.900", mensual_ars: 39000 },
      { tipo: "🧺 Lavanderías y Farmacias sobre Av. Córdoba / Santa Fe", valores: "Valet ropa: $7.000 | Limpieza y perfumería: $18.500", mensual_ars: 20000 },
      { tipo: "🏋️ Estudios de Crossfit, Yoga y Gimnasios con Pileta", valores: "Pase mensual: $45.000", mensual_ars: 24000 }
    ],
    gastos_alrededor_detalle: "Subte D (Ministro Carranza / Palermo), Tren Mitre y San Martín, Metrobus Juan B. Justo y Mercado Solidario Bonpland."
  },
  {
    id: "zona-colegiales",
    slug: "colegiales",
    name: "Colegiales (Pasando Paso Bajo Nivel Lacroze / Álvarez Thomas)",
    urban_boundary_note: "Delimitado por Av. Dorrego, Av. Álvarez Thomas, Av. Elcano, Vías del Tren Mitre y Av. Cabildo.",
    bridge_price_effect: "Cruzando Av. Dorrego y las vías del Tren Mitre por el paso bajo nivel de Federico Lacroze, el alquiler baja un ~14% respecto a Palermo Hollywood manteniendo excelente arbolado y tranquilidad.",
    coords: [
      [-34.5665, -58.4510],
      [-34.5715, -58.4365],
      [-34.5768, -58.4435],
      [-34.5845, -58.4455],
      [-34.5815, -58.4565],
      [-34.5735, -58.4605],
      [-34.5685, -58.4565]
    ],
    alquiler_ars: 640000,
    expensas_ars: 115000,
    servicios_ars: 62000,
    canasta_comercios_ars: 265000,
    transporte_ars: 36000,
    impuestos_y_servicios: {
      abl_municipal_ars: 15500,
      luz_edenor_edesur_ars: 17000,
      gas_metrogas_ars: 9500,
      agua_aysa_ars: 9000,
      internet_fibra_ars: 11000
    },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Proveedurías (Av. Federico Lacroze / Elcano)", valores: "Leche 1L: $1.480 | Queso pategrás 1kg: $11.500 | Yerba 1kg: $3.800", mensual_ars: 98000 },
      { tipo: "🥩 Carnicerías de Barrio (Av. Álvarez Thomas / Conde)", valores: "Ojo de bife/Asado 1kg: $9.800 | Suprema 1kg: $6.700 | Maple huevos campo: $4.500", mensual_ars: 65000 },
      { tipo: "🥬 Verdulerías y Feria Plaza Mafalda", valores: "Bolsón verdura 6kg: $9.500 | Tomate 1kg: $2.200 | Palta: $1.600", mensual_ars: 36000 },
      { tipo: "🥖 Panaderías Artesanales y Cafés (Ciudad de la Paz / Delgado)", valores: "Pan campo 1kg: $3.100 | Menú mediodía: $8.900 | Café + laminado: $5.400", mensual_ars: 26000 },
      { tipo: "🧺 Lavaderos, Veterinarias y Farmacias de Barrio", valores: "Valet ropa: $5.500 | Limpieza hogar mensual: $13.500", mensual_ars: 18000 },
      { tipo: "🏋️ Estudios de Entrenamiento y Gimnasios Barriales", valores: "Cuota mensual: $32.000", mensual_ars: 22000 }
    ],
    gastos_alrededor_detalle: "Subte D (Olleros), Estación Colegiales (Tren Mitre a Retiro en 12 min) y corredor comercial de Av. Federico Lacroze."
  },
  {
    id: "zona-belgrano",
    slug: "belgrano",
    name: "Belgrano C / Barrancas (Av. Cabildo / Juramento / Viaducto Mitre)",
    urban_boundary_note: "Delimitado por Av. Virrey del Pino, Av. del Libertador, Calle Monroe, Av. Crámer y Av. Cabildo.",
    bridge_price_effect: "Bajo el viaducto elevado del Tren Mitre (Barrio Chino / Barrancas) y sobre Av. Cabildo hay gran oferta comercial y pescaderías/almacenes un 15% más baratos, aunque las torres tienen expensas altas.",
    coords: [
      [-34.5525, -58.4620],
      [-34.5485, -58.4505],
      [-34.5565, -58.4405],
      [-34.5655, -58.4360],
      [-34.5695, -58.4455],
      [-34.5665, -58.4510],
      [-34.5685, -58.4565],
      [-34.5615, -58.4645]
    ],
    alquiler_ars: 820000,
    expensas_ars: 175000,
    servicios_ars: 82000,
    canasta_comercios_ars: 330000,
    transporte_ars: 40000,
    impuestos_y_servicios: {
      abl_municipal_ars: 23000,
      luz_edenor_edesur_ars: 22000,
      gas_metrogas_ars: 12000,
      agua_aysa_ars: 12500,
      internet_fibra_ars: 12500
    },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Mercados del Barrio Chino (Arribeños / Cabildo)", valores: "Pescado fresco 1kg: $12.500 | Arroz/Insumos Barrio Chino: -15% | Leche 1L: $1.550", mensual_ars: 118000 },
      { tipo: "🥩 Carnicerías y Granja (Juramento / Monroe)", valores: "Bife angosto/Asado 1kg: $11.200 | Suprema 1kg: $7.400 | Huevos x30: $5.100", mensual_ars: 78000 },
      { tipo: "🥬 Mercado de Belgrano (Juramento 2527) y Fruterías", valores: "Caja pastas frescas: $5.800 | Tomate 1kg: $2.400 | Fruta estación 1kg: $2.300", mensual_ars: 46000 },
      { tipo: "🥖 Confiterías y Panaderías (Vuelta de Obligado / Echeverría)", valores: "Pan 1kg: $3.300 | Merienda completa: $8.500", mensual_ars: 36000 },
      { tipo: "🧺 Tintorerías y Farmacias en Centro Comercial Cabildo", valores: "Valet tintorería: $7.200 | Artículos limpieza y perfumería: $22.000", mensual_ars: 24000 },
      { tipo: "🏋️ Gimnasios y Clubes en Barrancas / Bajo Belgrano", valores: "Cuota gimnasio: $46.000", mensual_ars: 28000 }
    ],
    gastos_alrededor_detalle: "Subte D (José Hernández / Juramento / Congreso de Tucumán), Metrobus Norte y Estación Belgrano C del Tren Mitre."
  },
  {
    id: "zona-palermo-norte-recoleta",
    slug: "recoleta",
    name: "Palermo Chico / Botánico / Recoleta Norte (Las Heras a Libertador)",
    urban_boundary_note: "Corredor entre Av. Santa Fe, Av. Las Heras, Av. Coronel Díaz, Parque Las Heras, Av. Figueroa Alcorta y Av. Pueyrredón.",
    bridge_price_effect: "Cruzando Av. Las Heras hacia Av. del Libertador el ABL municipal, AySA zonal y las expensas de edificios con vigilancia 24hs suben más de un 35%.",
    coords: [
      [-34.5735, -58.4145],
      [-34.5785, -58.4005],
      [-34.5845, -58.3895],
      [-34.5935, -58.3935],
      [-34.5955, -58.4045],
      [-34.5885, -58.4105],
      [-34.5842, -58.4150],
      [-34.5785, -58.4210]
    ],
    alquiler_ars: 1120000,
    expensas_ars: 250000,
    servicios_ars: 95000,
    canasta_comercios_ars: 390000,
    transporte_ars: 42000,
    impuestos_y_servicios: {
      abl_municipal_ars: 31000,
      luz_edenor_edesur_ars: 25000,
      gas_metrogas_ars: 13500,
      agua_aysa_ars: 15000,
      internet_fibra_ars: 10500
    },
    locales_cercanos: [
      { tipo: "🛒 Supermercados de Cercanía (Av. Las Heras / Av. Pueyrredón)", valores: "Leche 1L: $1.650 | Agua mineral pack: $6.200 | Fiambres 200g: $4.800", mensual_ars: 140000 },
      { tipo: "🥩 Carnicerías y Rotiserías (Pacheco de Melo / Peña)", valores: "Lomo/Ojo de bife 1kg: $12.800 | Tartas/Platos del día: $7.900", mensual_ars: 92000 },
      { tipo: "🥬 Fruterías y Almacenes Naturales (Juncal / Ugarteche)", valores: "Frutas seleccionadas 1kg: $2.900 | Verduras bandeja lista: $2.600", mensual_ars: 52000 },
      { tipo: "🥐 Panaderías Francesas y Confiterías (Av. Las Heras / Salguero)", valores: "Baguette: $2.400 | Desayuno completo: $10.500", mensual_ars: 44000 },
      { tipo: "👔 Tintorerías Tradicionales y Farmacias", valores: "Tintorería camisa/traje: $9.500 | Farmacia/Higiene: $24.000", mensual_ars: 30000 },
      { tipo: "🏋️ Clubes y Gimnasios con Piscina Climatizada", valores: "Cuota mensual: $54.000", mensual_ars: 32000 }
    ],
    gastos_alrededor_detalle: "Subte D (Bulnes / Pueyrredón) y Subte H (Las Heras / Parque Las Heras). Alícuota máxima de ABL y expensas."
  }
];

function getZoneCenter(zone) {
  const pts = zone.coords || [];
  if (pts.length === 0) return [-34.6037, -58.4116];
  const lat = pts.reduce((s, c) => s + c[0], 0) / pts.length;
  const lng = pts.reduce((s, c) => s + c[1], 0) / pts.length;
  return [lat, lng];
}

function setupInteractiveMap() {
  selectedZoneForDeepDive = MAP_AFFORDABILITY_ZONES[0];

  // Tabs: Mapa vs Filtro Común
  const tabMapa = document.getElementById("tab-btn-mapa");
  const tabFiltros = document.getElementById("tab-btn-filtros");
  const contentMapa = document.getElementById("tab-content-mapa");
  const contentFiltros = document.getElementById("tab-content-filtros");

  tabMapa?.addEventListener("click", () => {
    tabMapa.classList.add("active");
    tabFiltros.classList.remove("active");
    contentMapa.style.display = "block";
    contentFiltros.style.display = "none";
    ensureMapReadyAndVisible();
  });

  tabFiltros?.addEventListener("click", () => {
    tabFiltros.classList.add("active");
    tabMapa.classList.remove("active");
    contentFiltros.style.display = "block";
    contentMapa.style.display = "none";
  });

  // Map Budget Filter Live Sync
  document.getElementById("map-filter-operation")?.addEventListener("change", (e) => {
    appState.selectedOperation = e.target.value;
    renderAffordabilityZonesOnMap();
  });
  document.getElementById("map-filter-max-price")?.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val > 0) {
      appState.maxPrice = val;
      renderAffordabilityZonesOnMap();
    }
  });

  // Polygon Drawing Actions
  document.getElementById("btn-draw-freehand-polygon")?.addEventListener("click", startPolygonDrawing);
  document.getElementById("btn-clear-freehand-polygon")?.addEventListener("click", clearDrawnPolygon);
  document.getElementById("btn-finish-drawn-polygon")?.addEventListener("click", finishPolygonDrawing);
  document.getElementById("btn-cancel-drawn-polygon")?.addEventListener("click", cancelPolygonDrawing);

  // Botón "+" para sumar múltiples Puntos de Interés
  const addPoiBtn = document.getElementById("btn-add-poi");
  const newPoiInput = document.getElementById("new-poi-name-input");
  const handleAddPoi = () => {
    const rawName = (newPoiInput?.value || "").trim();
    const nextIdx = appState.pois.length;
    const nextCode = String.fromCharCode(65 + (nextIdx % 26));
    const color = POI_PALETTE[nextIdx % POI_PALETTE.length];
    const center = leafletMap ? leafletMap.getCenter() : { lat: -34.6015, lng: -58.4280 };
    // Pequeño desplazamiento para que no se superponga exactamente si agrega varios seguidos
    const jitterLat = ( (nextIdx % 5) - 2 ) * 0.0045;
    const jitterLng = ( ((nextIdx * 2) % 5) - 2 ) * 0.0055;

    const newPoi = {
      id: "poi-" + Date.now() + "-" + nextIdx,
      code: nextCode,
      label: rawName || `Punto ${nextCode}`,
      lat: parseFloat((center.lat + jitterLat).toFixed(5)),
      lng: parseFloat((center.lng + jitterLng).toFixed(5)),
      color
    };
    appState.pois.push(newPoi);
    if (newPoiInput) newPoiInput.value = "";
    renderPoisSidebarList();
    renderPoisOnLeafletMap();
    updateSortPoisSelectOptions();
  };

  addPoiBtn?.addEventListener("click", handleAddPoi);
  newPoiInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddPoi();
    }
  });

  // Switcher de proveedor de mapa libre de uso (OpenStreetMap / Carto / Esri)
  document.querySelectorAll(".map-tile-switch").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".map-tile-switch").forEach(b => {
        b.classList.remove("active");
        b.style.background = "transparent";
        b.style.color = "#cbd5e1";
      });
      btn.classList.add("active");
      btn.style.background = "#0284c7";
      btn.style.color = "#ffffff";
      const prov = btn.getAttribute("data-provider") || "osm";
      setMapTileProvider(prov);
    });
  });

  document.getElementById("btn-back-to-map-direct")?.addEventListener("click", () => {
    navigateTo("screen-metodo");
  });

  renderPoisSidebarList();
  updateSortPoisSelectOptions();
  initLeafletRealMap();
}

function initLeafletRealMap() {
  const mapEl = document.getElementById("leaflet-map");
  if (!mapEl || typeof L === "undefined") return;
  if (leafletMap) return;

  leafletMap = L.map("leaflet-map", {
    center: [-34.5965, -58.4265],
    zoom: 13,
    minZoom: 11,
    maxZoom: 18,
    zoomControl: true
  });

  zonesLayerGroup = L.layerGroup().addTo(leafletMap);
  drawnPolygonLayerGroup = L.layerGroup().addTo(leafletMap);
  routesLayerGroup = L.layerGroup().addTo(leafletMap);
  poisLayerGroup = L.layerGroup().addTo(leafletMap);

  setMapTileProvider("osm");

  // Click en el mapa para agregar vértices cuando está en modo dibujo, o para limpiar rutas bloqueadas en celular
  leafletMap.on("click", (e) => {
    if (appState.isDrawingMode) {
      addDrawingVertex(e.latlng);
      return;
    }
    if (appState.activeHighlightedPoiId) {
      appState.activeHighlightedPoiId = null;
      clearPoiRoutesHighlight();
    }
  });

  // Asegurar que siempre recalcule dimensiones cuando el contenedor cambie de tamaño
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      if (leafletMap) leafletMap.invalidateSize();
    });
    ro.observe(mapEl);
  }

  renderAffordabilityZonesOnMap();
  renderPoisOnLeafletMap();
}

function setMapTileProvider(provider) {
  if (!leafletMap) return;
  currentTileProvider = provider;
  if (activeTileLayer) {
    leafletMap.removeLayer(activeTileLayer);
  }

  const directUrls = {
    osm: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    carto: "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    esri: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
  };

  // Si está en GitHub Pages o cualquier hosting estático, carga directo del CDN oficial HTTPS; si está en localhost:8080 usa la caché local con fallback al CDN
  const isLocalPythonServer =
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
    window.location.port === "8080";

  const primaryUrl = isLocalPythonServer
    ? `/api/tile/${provider}/{z}/{x}/{y}.png`
    : (directUrls[provider] || directUrls.osm);

  activeTileLayer = L.tileLayer(primaryUrl, {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors (Fair Use)'
  });

  activeTileLayer.on("tileerror", function (errEvent) {
    const img = errEvent.tile;
    const coords = errEvent.coords;
    if (img && coords) {
      const stage = parseInt(img.getAttribute("data-fallback-stage") || "0", 10);
      if (stage === 0) {
        img.setAttribute("data-fallback-stage", "1");
        const fb1 = directUrls[provider] || directUrls.osm;
        img.src = fb1.replace("{z}", coords.z).replace("{x}", coords.x).replace("{y}", coords.y);
      } else if (stage === 1) {
        img.setAttribute("data-fallback-stage", "2");
        img.src = directUrls.carto.replace("{z}", coords.z).replace("{x}", coords.x).replace("{y}", coords.y);
      }
    }
  });

  activeTileLayer.addTo(leafletMap);
}

function ensureMapReadyAndVisible() {
  if (!leafletMap) {
    initLeafletRealMap();
  }
  [50, 180, 400].forEach(ms => {
    setTimeout(() => {
      if (leafletMap) {
        leafletMap.invalidateSize();
        renderAffordabilityZonesOnMap();
        renderPoisOnLeafletMap();
      }
    }, ms);
  });
}

// Renderiza la lista de Puntos de Interés en la barra lateral con soporte de Hover y Touch para iluminar rutas
function renderPoisSidebarList() {
  const container = document.getElementById("pois-list-container");
  const badge = document.getElementById("pois-count-badge");
  if (badge) {
    badge.textContent = `${appState.pois.length} activo${appState.pois.length === 1 ? "" : "s"}`;
  }
  if (!container) return;

  container.innerHTML = appState.pois.map(poi => `
    <div class="poi-item-row ${appState.activeHighlightedPoiId === poi.id ? 'active-poi-route' : ''}" data-poi-id="${poi.id}">
      <span style="background:${poi.color}; color:#fff; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.72rem; flex-shrink:0;">
        ${escapeHtml(poi.code)}
      </span>
      <input type="text" class="poi-name-input" data-poi-id="${poi.id}" value="${escapeHtml(poi.label)}"
        style="background:transparent; border:none; color:#fff; font-size:0.78rem; font-weight:600; flex:1; min-width:0;" />
      <button type="button" class="btn-sm btn-secondary poi-route-btn" data-poi-id="${poi.id}" title="Ver rutas en Auto, Subte, Colectivo y Caminando" style="font-size:0.66rem; padding:0.15rem 0.38rem;">
        🛣️ Rutas
      </button>
      <button type="button" class="btn-sm btn-secondary poi-center-btn" data-poi-id="${poi.id}" title="Traer al centro del mapa" style="font-size:0.66rem; padding:0.15rem 0.35rem;">
        📍
      </button>
      ${appState.pois.length > 1 ? `
        <button type="button" class="btn-sm btn-secondary poi-delete-btn" data-poi-id="${poi.id}" title="Quitar punto" style="font-size:0.66rem; padding:0.15rem 0.35rem; color:#f87171;">
          ✕
        </button>
      ` : ""}
    </div>
  `).join("");

  // Eventos de cada fila de Punto de Interés
  container.querySelectorAll(".poi-item-row").forEach(row => {
    const poiId = row.getAttribute("data-poi-id");
    const poiObj = appState.pois.find(p => p.id === poiId);
    if (!poiObj) return;

    row.addEventListener("mouseenter", () => {
      highlightRoutesFromPoi(poiObj);
    });
    row.addEventListener("mouseleave", () => {
      if (appState.activeHighlightedPoiId !== poiObj.id) {
        clearPoiRoutesHighlight();
      }
    });
  });

  container.querySelectorAll(".poi-name-input").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const pId = inp.getAttribute("data-poi-id");
      const found = appState.pois.find(p => p.id === pId);
      if (found) {
        found.label = e.target.value;
        renderPoisOnLeafletMap();
        updateSortPoisSelectOptions();
      }
    });
  });

  container.querySelectorAll(".poi-route-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const pId = btn.getAttribute("data-poi-id");
      const found = appState.pois.find(p => p.id === pId);
      if (!found) return;
      if (appState.activeHighlightedPoiId === found.id) {
        appState.activeHighlightedPoiId = null;
        clearPoiRoutesHighlight();
      } else {
        appState.activeHighlightedPoiId = found.id;
        highlightRoutesFromPoi(found);
      }
      renderPoisSidebarList();
    });
  });

  container.querySelectorAll(".poi-center-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const pId = btn.getAttribute("data-poi-id");
      const found = appState.pois.find(p => p.id === pId);
      if (found && leafletMap) {
        const c = leafletMap.getCenter();
        found.lat = parseFloat(c.lat.toFixed(5));
        found.lng = parseFloat(c.lng.toFixed(5));
        renderPoisOnLeafletMap();
        highlightRoutesFromPoi(found);
      }
    });
  });

  container.querySelectorAll(".poi-delete-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const pId = btn.getAttribute("data-poi-id");
      appState.pois = appState.pois.filter(p => p.id !== pId);
      if (appState.activeHighlightedPoiId === pId) {
        appState.activeHighlightedPoiId = null;
        clearPoiRoutesHighlight();
      }
      renderPoisSidebarList();
      renderPoisOnLeafletMap();
      updateSortPoisSelectOptions();
    });
  });
}

function updateSortPoisSelectOptions() {
  const optgroup = document.getElementById("sort-pois-optgroup");
  if (!optgroup) return;

  const singleOptions = appState.pois.map(p =>
    `<option value="poi_${p.id}">Cercanía a ${escapeHtml(p.code)}: ${escapeHtml(p.label)}</option>`
  ).join("");

  optgroup.innerHTML = `
    <option value="cercania_todos" ${appState.sortOption === "cercania_todos" ? "selected" : ""}>
      Cercanía promedio a tus ${appState.pois.length} puntos marcados
    </option>
    ${singleOptions}
    <option value="perm_orden_lista">Prioridad secuencial según orden de tu lista (${appState.pois.map(p => p.code).join(" > ")})</option>
  `;
}

// Renderiza los marcadores arrastrables de Puntos de Interés en el mapa Leaflet
function renderPoisOnLeafletMap() {
  if (!leafletMap || !poisLayerGroup) return;
  poisLayerGroup.clearLayers();

  appState.pois.forEach(poi => {
    const iconHtml = `
      <div style="position:relative; display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -50%);">
        <div style="
          width:30px; height:30px; border-radius:50%;
          background:${poi.color}; color:#fff;
          border:2.5px solid #ffffff;
          box-shadow:0 3px 10px rgba(0,0,0,0.65);
          display:flex; align-items:center; justify-content:center;
          font-weight:900; font-size:13px;">
          ${escapeHtml(poi.code)}
        </div>
        <div style="
          margin-top:2px; background:rgba(15,23,42,0.92); color:#f8fafc;
          border:1px solid ${poi.color}; border-radius:5px;
          padding:1px 6px; font-size:10.5px; font-weight:800; white-space:nowrap;
          box-shadow:0 2px 6px rgba(0,0,0,0.5);">
          ${escapeHtml(poi.label)}
        </div>
      </div>
    `;

    const divIcon = L.divIcon({
      className: "calculiving-poi-marker",
      html: iconHtml,
      iconSize: [0, 0]
    });

    const marker = L.marker([poi.lat, poi.lng], {
      icon: divIcon,
      draggable: true
    });

    marker.on("mouseover", () => {
      if (!appState.isDrawingMode) {
        highlightRoutesFromPoi(poi);
      }
    });

    marker.on("mouseout", () => {
      if (!appState.isDrawingMode && appState.activeHighlightedPoiId !== poi.id) {
        clearPoiRoutesHighlight();
      }
    });

    // En celular o click: fija/alterna la visualización nítida de las rutas de viaje desde ese punto
    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      if (appState.activeHighlightedPoiId === poi.id) {
        appState.activeHighlightedPoiId = null;
        clearPoiRoutesHighlight();
      } else {
        appState.activeHighlightedPoiId = poi.id;
        highlightRoutesFromPoi(poi);
      }
      renderPoisSidebarList();
    });

    marker.on("dragend", (e) => {
      const newPos = e.target.getLatLng();
      poi.lat = parseFloat(newPos.lat.toFixed(5));
      poi.lng = parseFloat(newPos.lng.toFixed(5));
      if (appState.activeHighlightedPoiId === poi.id) {
        highlightRoutesFromPoi(poi);
      }
    });

    marker.addTo(poisLayerGroup);
  });
}

// Atenúa el resto del mapa (grisáceo/apagado) y dibuja con colores ultra nítidos las rutas en Auto, Subte, Colectivo y Caminando desde el Punto de Interés
function highlightRoutesFromPoi(poi) {
  if (!leafletMap || !routesLayerGroup) return;
  const mapEl = document.getElementById("leaflet-map");
  if (mapEl) mapEl.classList.add("map-dimmed-mode");

  // Atenuar polígonos de zonas para que las rutas brillen con máximo contraste
  zonesLayerGroup?.eachLayer(layer => {
    if (layer.setStyle) {
      layer.setStyle({ fillOpacity: 0.08, opacity: 0.25, weight: 1.2 });
    }
  });

  routesLayerGroup.clearLayers();

  // Seleccionar las 4 sub-zonas más relevantes/cercanas o la zona activa para trazar los 4 corredores multimodales con claridad
  const targetZones = [...MAP_AFFORDABILITY_ZONES]
    .map(z => {
      const [zLat, zLng] = getZoneCenter(z);
      return { zone: z, center: [zLat, zLng], distKm: getDistanceKm(poi.lat, poi.lng, zLat, zLng) };
    })
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 4);

  const modesSummaryRows = [];

  targetZones.forEach((item, idx) => {
    const [zLat, zLng] = item.center;
    const dKm = Math.max(0.5, item.distKm);

    // Tiempos realistas en CABA según modalidad
    const minAuto = Math.max(4, Math.round(dKm * 3.1 + 3));
    const minSubte = Math.max(5, Math.round(dKm * 2.4 + 4));
    const minColectivo = Math.max(7, Math.round(dKm * 4.4 + 5));
    const minCaminando = Math.max(8, Math.round(dKm * 12.2));

    // Puntos intermedios siguiendo la traza urbana (L-shapes y diagonales de avenidas/subtes)
    const midAuto = [poi.lat + (zLat - poi.lat) * 0.55 + 0.0032, poi.lng + (zLng - poi.lng) * 0.45 - 0.0028];
    const midSubte = [poi.lat + (zLat - poi.lat) * 0.50 - 0.0022, poi.lng + (zLng - poi.lng) * 0.50 + 0.0025];
    const midBus = [poi.lat + (zLat - poi.lat) * 0.35, zLng];
    const midWalk = [zLat, poi.lng + (zLng - poi.lng) * 0.65];

    // 1. RUTA EN AUTO / AUTOPISTA (Magenta Neón Nítido)
    L.polyline([[poi.lat, poi.lng], midAuto, [zLat, zLng]], {
      color: "#ff2e93",
      weight: 5,
      opacity: 0.98
    }).addTo(routesLayerGroup);

    // 2. RUTA EN SUBTE / TREN (Turquesa Ciano Ultra Brillante)
    L.polyline([[poi.lat, poi.lng], midSubte, [zLat, zLng]], {
      color: "#00f5d4",
      weight: 4.5,
      opacity: 0.98,
      dashArray: "10, 6"
    }).addTo(routesLayerGroup);

    // 3. RUTA EN COLECTIVO / METROBUS (Amarillo Intenso)
    L.polyline([[poi.lat, poi.lng], midBus, [zLat, zLng]], {
      color: "#facc15",
      weight: 4,
      opacity: 0.96,
      dashArray: "4, 7"
    }).addTo(routesLayerGroup);

    // 4. RUTA CAMINANDO / CICLOVÍA (Verde Lima Nítido)
    L.polyline([[poi.lat, poi.lng], midWalk, [zLat, zLng]], {
      color: "#a3e635",
      weight: 3.5,
      opacity: 0.95,
      dashArray: "2, 6"
    }).addTo(routesLayerGroup);

    // Etiqueta nítida en el destino con los 4 tiempos de viaje
    const badgeHtml = `
      <div style="
        background:rgba(15,23,42,0.96);
        border:1.5px solid #38bdf8;
        color:#fff;
        padding:4px 8px;
        border-radius:8px;
        font-size:10.5px;
        font-weight:700;
        white-space:nowrap;
        box-shadow:0 4px 14px rgba(0,0,0,0.85);
        transform:translate(-50%, -50%);">
        <div style="color:#38bdf8; font-weight:800; margin-bottom:2px;">→ ${escapeHtml(item.zone.name.split(" (")[0])} (${dKm.toFixed(1)} km)</div>
        <span style="color:#ff2e93;">🚗 ${minAuto}'</span> ·
        <span style="color:#00f5d4;">🚇 ${minSubte}'</span> ·
        <span style="color:#facc15;">🚌 ${minColectivo}'</span> ·
        <span style="color:#a3e635;">🚶 ${minCaminando}'</span>
      </div>
    `;
    L.marker([zLat, zLng], {
      icon: L.divIcon({ className: "route-dest-badge", html: badgeHtml, iconSize: [0, 0] }),
      interactive: false
    }).addTo(routesLayerGroup);

    if (idx < 3) {
      modesSummaryRows.push(`
        <div style="display:flex; justify-content:space-between; gap:0.75rem; font-size:0.74rem; padding:0.22rem 0; border-bottom:1px solid rgba(255,255,255,0.08);">
          <strong style="color:#e2e8f0;">Hacia ${escapeHtml(item.zone.name.split(" (")[0])}:</strong>
          <span>
            <strong style="color:#ff2e93;">🚗 ${minAuto} min</strong> |
            <strong style="color:#00f5d4;">🚇 ${minSubte} min</strong> |
            <strong style="color:#facc15;">🚌 ${minColectivo} min</strong> |
            <strong style="color:#a3e635;">🚶 ${minCaminando} min</strong>
          </span>
        </div>
      `);
    }
  });

  const legendEl = document.getElementById("map-routes-legend");
  if (legendEl) {
    legendEl.style.display = "block";
    legendEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:0.4rem;">
        <div style="font-size:0.82rem; font-weight:800; color:#fff;">
          🛣️ Rutas nítidas desde <span style="color:${poi.color};">${escapeHtml(poi.code)} (${escapeHtml(poi.label)})</span>
        </div>
        <div style="display:flex; gap:0.55rem; font-size:0.72rem; font-weight:800;">
          <span style="color:#ff2e93;">━━ 🚗 Auto</span>
          <span style="color:#00f5d4;">┅┅ 🚇 Subte/Tren</span>
          <span style="color:#facc15;">┈┈ 🚌 Colectivo</span>
          <span style="color:#a3e635;">·· 🚶 Caminando</span>
        </div>
      </div>
      <div>${modesSummaryRows.join("")}</div>
    `;
  }
}

function clearPoiRoutesHighlight() {
  const mapEl = document.getElementById("leaflet-map");
  if (mapEl) mapEl.classList.remove("map-dimmed-mode");

  if (routesLayerGroup) {
    routesLayerGroup.clearLayers();
  }
  const legendEl = document.getElementById("map-routes-legend");
  if (legendEl) {
    legendEl.style.display = "none";
  }

  // Restaurar opacidad original de las sub-zonas
  renderAffordabilityZonesOnMap();
}

// Evalúa los 2 cálculos separados (Alquiler vs Estilo de Vida) y el Costo Genuino de Vivienda (Alquiler + Expensas + Impuestos/Servicios Fijos)
function computeZoneAffordabilityMetrics(zone) {
  const salary = appState.salary || 1500000;

  // Costo de Alquiler + Expensas (Escala: <=35% Verde, 35-45% Amarillo, 45-55% Naranja, >55% Rojo)
  const rentTotal = zone.alquiler_ars + zone.expensas_ars;
  const pctRent = (rentTotal / salary) * 100;
  let rentHex = "#10b981";
  let rentLabel = "🟢 Verde (≤35%)";
  if (pctRent > 35 && pctRent <= 45) { rentHex = "#eab308"; rentLabel = "🟡 Amarillo (35-45%)"; }
  else if (pctRent > 45 && pctRent <= 55) { rentHex = "#f97316"; rentLabel = "🟠 Naranja (45-55%)"; }
  else if (pctRent > 55) { rentHex = "#ef4444"; rentLabel = "🔴 Rojo (>55%)"; }

  // Costo Genuino Total de la Vivienda = Alquiler + Expensas + Impuestos y Servicios Fijos (ABL, Luz, Gas, Agua, Internet, SUBE)
  const housingGenuineTotal = rentTotal + zone.servicios_ars + zone.transporte_ars;
  const pctHousingGenuine = (housingGenuineTotal / salary) * 100;

  // Costo de Vida separado (0-25% Verde, 25-50% Amarillo, 50-75% Naranja, 75-100% Rojo)
  const lifestyleTotal = zone.servicios_ars + zone.canasta_comercios_ars + zone.transporte_ars;
  const pctLifestyle = (lifestyleTotal / salary) * 100;
  let lifeHex = "#10b981";
  let lifeLabel = "🟢 Verde (0-25%)";
  if (pctLifestyle > 25 && pctLifestyle <= 50) { lifeHex = "#eab308"; lifeLabel = "🟡 Amarillo (25-50%)"; }
  else if (pctLifestyle > 50 && pctLifestyle <= 75) { lifeHex = "#f97316"; lifeLabel = "🟠 Naranja (50-75%)"; }
  else if (pctLifestyle > 75) { lifeHex = "#ef4444"; lifeLabel = "🔴 Rojo (75-100%)"; }

  let verdictText = "✅ Te conviene vivir en esta sub-zona";
  if (pctRent > 55 || pctLifestyle > 75) {
    verdictText = "⛔ Supera el rango recomendado para tu sueldo";
  } else if (pctRent > 45 || pctLifestyle > 50) {
    verdictText = "⚠️ Exigente para tu sueldo mensual";
  } else if (pctRent > 35 || pctLifestyle > 25) {
    verdictText = "👌 Viable con presupuesto moderado";
  }

  return {
    rentTotal,
    pctRent: pctRent.toFixed(1),
    rentHex,
    rentLabel,
    housingGenuineTotal,
    pctHousingGenuine: pctHousingGenuine.toFixed(1),
    lifestyleTotal,
    pctLifestyle: pctLifestyle.toFixed(1),
    lifeHex,
    lifeLabel,
    verdictText,
    totalMensual: rentTotal + lifestyleTotal,
    pctTotal: (((rentTotal + lifestyleTotal) / salary) * 100).toFixed(1)
  };
}

// Renderiza los polígonos orgánicos multi-vértice sobre el mapa Leaflet real
function renderAffordabilityZonesOnMap() {
  if (!leafletMap || !zonesLayerGroup) return;
  zonesLayerGroup.clearLayers();

  MAP_AFFORDABILITY_ZONES.forEach(zone => {
    const m = computeZoneAffordabilityMetrics(zone);
    const poly = L.polygon(zone.coords, {
      color: m.rentHex,
      weight: 2.8,
      opacity: 0.92,
      fillColor: m.rentHex,
      fillOpacity: 0.32
    });

    poly.on("mouseover", (e) => {
      if (appState.isDrawingMode || appState.activeHighlightedPoiId) return;
      poly.setStyle({ fillOpacity: 0.52, weight: 3.8 });
      if (e.originalEvent) {
        showZoneHoverTooltip(zone, e.originalEvent);
      }
      const autoNav = document.getElementById("hover-auto-navigate-toggle");
      if (autoNav && autoNav.checked) {
        if (hoverNavigateTimer) clearTimeout(hoverNavigateTimer);
        hoverNavigateTimer = setTimeout(() => {
          hideZoneHoverTooltip();
          openZoneDetailedBreakdown(zone);
        }, 850);
      }
    });

    poly.on("mousemove", (e) => {
      if (appState.isDrawingMode || appState.activeHighlightedPoiId) return;
      if (e.originalEvent) moveZoneHoverTooltip(e.originalEvent);
    });

    poly.on("mouseout", () => {
      poly.setStyle({ fillOpacity: 0.32, weight: 2.8 });
      if (hoverNavigateTimer) {
        clearTimeout(hoverNavigateTimer);
        hoverNavigateTimer = null;
      }
      hideZoneHoverTooltip();
    });

    poly.on("click", (e) => {
      if (appState.isDrawingMode) {
        addDrawingVertex(e.latlng);
        return;
      }
      L.DomEvent.stopPropagation(e);
      if (hoverNavigateTimer) clearTimeout(hoverNavigateTimer);
      hideZoneHoverTooltip();
      openZoneDetailedBreakdown(zone);
    });

    poly.addTo(zonesLayerGroup);

    // Etiqueta compacta en el centroide del polígono orgánico
    const [cLat, cLng] = getZoneCenter(zone);
    const shortTitle = zone.name.split(" (")[0];
    const labelIcon = L.divIcon({
      className: "zone-centroid-marker",
      html: `
        <div class="zone-label-leaflet" style="border-color:${m.rentHex}; transform:translate(-50%, -50%);">
          <span>${escapeHtml(shortTitle)}</span>
          <span style="color:${m.rentHex}; margin-left:4px;">${m.pctRent}%</span>
        </div>
      `,
      iconSize: [0, 0]
    });
    L.marker([cLat, cLng], { icon: labelIcon, interactive: false }).addTo(zonesLayerGroup);
  });

  renderDrawnPolygonOnLeaflet();
}

function renderDrawnPolygonOnLeaflet() {
  if (!leafletMap || !drawnPolygonLayerGroup) return;
  drawnPolygonLayerGroup.clearLayers();

  if (drawingPoints.length > 0) {
    L.polyline(drawingPoints, {
      color: "#38bdf8",
      weight: 3.5,
      dashArray: "6, 6"
    }).addTo(drawnPolygonLayerGroup);

    drawingPoints.forEach(pt => {
      L.circleMarker(pt, {
        radius: 5,
        color: "#0284c7",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 2.5
      }).addTo(drawnPolygonLayerGroup);
    });
  } else if (appState.drawnPolygonPoints && appState.drawnPolygonPoints.length >= 3) {
    const customZone = buildCustomDrawnZoneObject();
    const m = computeZoneAffordabilityMetrics(customZone);
    const userPoly = L.polygon(appState.drawnPolygonPoints, {
      color: "#ffffff",
      weight: 3,
      dashArray: "7, 5",
      fillColor: m.rentHex,
      fillOpacity: 0.45
    });

    userPoly.on("mouseover", (e) => {
      if (e.originalEvent) showZoneHoverTooltip(customZone, e.originalEvent);
    });
    userPoly.on("mousemove", (e) => {
      if (e.originalEvent) moveZoneHoverTooltip(e.originalEvent);
    });
    userPoly.on("mouseout", () => hideZoneHoverTooltip());
    userPoly.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      hideZoneHoverTooltip();
      openZoneDetailedBreakdown(customZone);
    });

    userPoly.addTo(drawnPolygonLayerGroup);
  }
}

function buildCustomDrawnZoneObject() {
  const base = MAP_AFFORDABILITY_ZONES[2];
  return {
    id: "custom-drawn-zone",
    slug: "capital-federal",
    name: "Tu Área Delimitada Calle por Calle",
    urban_boundary_note: "Perímetro personalizado trazado calle por calle sobre el mapa de la ciudad.",
    bridge_price_effect: "Área ajustada exactamente a las avenidas, vías o puentes que marcaste.",
    coords: appState.drawnPolygonPoints,
    alquiler_ars: 545000,
    expensas_ars: 99000,
    servicios_ars: 57000,
    canasta_comercios_ars: 232000,
    transporte_ars: 34000,
    impuestos_y_servicios: base.impuestos_y_servicios,
    locales_cercanos: base.locales_cercanos,
    gastos_alrededor_detalle: "Área libre trazada por vos con conexión de transporte público y comercios barriales."
  };
}

function openZoneDetailedBreakdown(zoneObj) {
  selectedZoneForDeepDive = zoneObj;
  executeFilterAndRender();
  navigateTo("screen-resultados");
}

function showZoneHoverTooltip(zone, domEvent) {
  const tooltip = document.getElementById("map-hover-tooltip");
  if (!tooltip) return;

  const m = computeZoneAffordabilityMetrics(zone);

  tooltip.innerHTML = `
    <div style="border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:0.4rem; margin-bottom:0.45rem;">
      <div style="font-weight:800; font-size:0.9rem; color:#fff;">📍 ${escapeHtml(zone.name)}</div>
      <div style="font-size:0.75rem; font-weight:700; color:${m.rentHex}; margin-top:2px;">${m.verdictText}</div>
    </div>

    <!-- ARRIBA: VIVIENDA GENUINA (ALQUILER + EXPENSAS + IMPUESTOS Y SERVICIOS) -->
    <div style="background:rgba(255,255,255,0.04); border-left:3.5px solid ${m.rentHex}; padding:0.4rem 0.6rem; border-radius:4px; margin-bottom:0.45rem;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:700; color:#e2e8f0; font-size:0.76rem;">🏠 Alquiler + Expensas</span>
        <span style="font-weight:800; color:${m.rentHex}; font-size:0.84rem;">$${m.rentTotal.toLocaleString("es-AR")} (${m.pctRent}%)</span>
      </div>
      <div style="font-size:0.71rem; color:#94a3b8; margin-top:2px;">
        + Impuestos y Servicios fijos ($${zone.servicios_ars.toLocaleString("es-AR")}) = <strong style="color:#fff;">Vivienda genuina: $${(m.rentTotal + zone.servicios_ars).toLocaleString("es-AR")}/mes</strong>
      </div>
    </div>

    <!-- ABAJO: COMERCIOS DE LOS ALREDEDORES Y COSTO DE VIDA -->
    <div style="background:rgba(255,255,255,0.04); border-left:3.5px solid ${m.lifeHex}; padding:0.4rem 0.6rem; border-radius:4px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:700; color:#e2e8f0; font-size:0.76rem;">🛒 Coste de Vida y Comercios</span>
        <span style="font-weight:800; color:${m.lifeHex}; font-size:0.84rem;">$${m.lifestyleTotal.toLocaleString("es-AR")} (${m.pctLifestyle}%)</span>
      </div>
      <div style="font-size:0.71rem; color:#94a3b8; margin-top:3px;">
        Plata mensual en comercios del barrio: <strong style="color:#fff;">$${zone.canasta_comercios_ars.toLocaleString("es-AR")}</strong> | SUBE: $${zone.transporte_ars.toLocaleString("es-AR")}<br>
        <span style="color:#cbd5e1;">${escapeHtml(zone.bridge_price_effect || "")}</span>
      </div>
      <div style="margin-top:0.35rem; padding-top:0.35rem; border-top:1px dashed rgba(56,189,248,0.35); font-size:0.71rem; color:#38bdf8; font-weight:700;">
        👉 Hacé click o tocá la zona para ver precios en comercios y los links filtrados al final
      </div>
    </div>
  `;

  tooltip.classList.add("visible");
  moveZoneHoverTooltip(domEvent);
}

function moveZoneHoverTooltip(domEvent) {
  const tooltip = document.getElementById("map-hover-tooltip");
  const outerBox = document.getElementById("map-outer-box");
  if (!tooltip || !outerBox || !domEvent) return;

  const rect = outerBox.getBoundingClientRect();
  let x = domEvent.clientX - rect.left + 18;
  let y = domEvent.clientY - rect.top + 18;

  if (x + 355 > rect.width) {
    x = Math.max(10, domEvent.clientX - rect.left - 360);
  }
  if (y + 275 > rect.height) {
    y = Math.max(10, rect.height - 285);
  }

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideZoneHoverTooltip() {
  const tooltip = document.getElementById("map-hover-tooltip");
  if (tooltip) tooltip.classList.remove("visible");
}

function startPolygonDrawing() {
  appState.isDrawingMode = true;
  drawingPoints = [];
  hideZoneHoverTooltip();

  const helperBar = document.getElementById("map-drawing-helper-bar");
  if (helperBar) {
    helperBar.classList.add("active");
    updateDrawingCountLabel();
  }
  renderDrawnPolygonOnLeaflet();
}

function addDrawingVertex(latlng) {
  drawingPoints.push([latlng.lat, latlng.lng]);
  updateDrawingCountLabel();
  renderDrawnPolygonOnLeaflet();
}

function updateDrawingCountLabel() {
  const lbl = document.getElementById("drawing-points-count-label");
  if (lbl) {
    lbl.textContent = `📍 Trazando límite calle por calle: ${drawingPoints.length} esquinas marcadas (hacé click en el mapa para sumar)`;
  }
}

function finishPolygonDrawing() {
  if (drawingPoints.length < 3) {
    alert("Hacé click en al menos 3 esquinas/calles del mapa para cerrar tu área.");
    return;
  }

  appState.isDrawingMode = false;
  const helperBar = document.getElementById("map-drawing-helper-bar");
  if (helperBar) helperBar.classList.remove("active");

  appState.drawnPolygonPoints = [...drawingPoints];
  drawingPoints = [];
  activePolygonLayer = true;
  renderDrawnPolygonOnLeaflet();

  openZoneDetailedBreakdown(buildCustomDrawnZoneObject());
}

function updateDrawnPolygonStyleAndHover() {
  renderDrawnPolygonOnLeaflet();
}

function cancelPolygonDrawing() {
  appState.isDrawingMode = false;
  const helperBar = document.getElementById("map-drawing-helper-bar");
  if (helperBar) helperBar.classList.remove("active");
  drawingPoints = [];
  renderDrawnPolygonOnLeaflet();
}

function clearDrawnPolygon() {
  cancelPolygonDrawing();
  activePolygonLayer = false;
  appState.drawnPolygonPoints = [];
  renderDrawnPolygonOnLeaflet();
}

/* ----------------------------------------------------
   6. SCREEN 4: 25/75 DRAGGABLE & RESIZABLE FLOOR PLANNER
---------------------------------------------------- */
const PIXELS_PER_METER = 24; // 1 meter = 24px

function setupFloorPlanCanvasEditor() {
  // Floor selector
  renderFloorButtons();

  document.getElementById("btn-add-floor-pill")?.addEventListener("click", () => {
    appState.floorsCount += 1;
    appState.activeFloor = appState.floorsCount;
    renderFloorButtons();
    renderRoomsOnCanvas();
  });

  document.getElementById("btn-delete-floor")?.addEventListener("click", () => {
    if (appState.floorsCount <= 1) {
      alert("No podés eliminar el único piso existente.");
      return;
    }
    // Remove rooms on active floor
    appState.floorRooms = appState.floorRooms.filter(r => r.floor !== appState.activeFloor);
    appState.floorsCount -= 1;
    appState.activeFloor = Math.max(1, appState.activeFloor - 1);
    renderFloorButtons();
    renderRoomsOnCanvas();
  });

  // Piece Buttons (Clean Names)
  document.querySelectorAll(".piece-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const type = e.currentTarget.getAttribute("data-type");
      addRoomToCanvas(type);
    });
  });

  // Inspector Sliders
  const widthSlider = document.getElementById("inspector-width-slider");
  const lengthSlider = document.getElementById("inspector-length-slider");
  const priorityToggle = document.getElementById("inspector-priority-toggle");
  const deleteRoomBtn = document.getElementById("inspector-delete-room");

  widthSlider?.addEventListener("input", (e) => {
    const room = appState.floorRooms.find(r => r.id === appState.selectedRoomId);
    if (room) {
      room.width = parseFloat(e.target.value);
      document.getElementById("inspector-width-val").textContent = `${room.width} m`;
      updateRoomBoxDOM(room);
      updateCanvasSummary();
    }
  });

  lengthSlider?.addEventListener("input", (e) => {
    const room = appState.floorRooms.find(r => r.id === appState.selectedRoomId);
    if (room) {
      room.length = parseFloat(e.target.value);
      document.getElementById("inspector-length-val").textContent = `${room.length} m`;
      updateRoomBoxDOM(room);
      updateCanvasSummary();
    }
  });

  priorityToggle?.addEventListener("change", (e) => {
    const room = appState.floorRooms.find(r => r.id === appState.selectedRoomId);
    if (room) {
      room.priority = e.target.checked;
      updateRoomBoxDOM(room);
    }
  });

  deleteRoomBtn?.addEventListener("click", () => {
    if (appState.selectedRoomId) {
      appState.floorRooms = appState.floorRooms.filter(r => r.id !== appState.selectedRoomId);
      appState.selectedRoomId = appState.floorRooms[0] ? appState.floorRooms[0].id : null;
      renderRoomsOnCanvas();
      syncInspectorWithSelected();
    }
  });

  renderRoomsOnCanvas();
  syncInspectorWithSelected();
}

function renderFloorButtons() {
  const container = document.getElementById("floor-tabs-row");
  if (!container) return;

  const buttonsHtml = Array.from({ length: appState.floorsCount }, (_, i) => i + 1).map(f => `
    <button class="floor-btn-pill ${appState.activeFloor === f ? 'active' : ''}" data-floor="${f}">
      Piso ${f}
    </button>
  `).join("");

  container.innerHTML = buttonsHtml + `<button class="btn-sm btn-secondary" id="btn-add-floor-pill">+ Agregar piso</button>`;

  container.querySelectorAll(".floor-btn-pill").forEach(pill => {
    pill.addEventListener("click", (e) => {
      appState.activeFloor = parseInt(e.currentTarget.getAttribute("data-floor"));
      renderFloorButtons();
      renderRoomsOnCanvas();
    });
  });

  document.getElementById("btn-add-floor-pill")?.addEventListener("click", () => {
    appState.floorsCount += 1;
    appState.activeFloor = appState.floorsCount;
    renderFloorButtons();
    renderRoomsOnCanvas();
  });

  const canvasLabel = document.getElementById("canvas-floor-label");
  if (canvasLabel) canvasLabel.textContent = `Piso ${appState.activeFloor}`;
}

function addRoomToCanvas(type) {
  const defaults = {
    cocina: { name: "Cocina", w: 3.2, l: 2.8, priority: true },
    baño: { name: "Baño", w: 2.2, l: 1.8, priority: true },
    pasillo: { name: "Pasillo", w: 3.0, l: 1.2, priority: false },
    living: { name: "Living", w: 5.5, l: 4.0, priority: true },
    habitacion: { name: "Habitación", w: 3.8, l: 3.2, priority: true },
    cochera: { name: "Cochera", w: 5.0, l: 2.5, priority: false }
  };

  const def = defaults[type] || { name: "Ambiente", w: 3.0, l: 3.0, priority: false };

  // Offset position
  const currentFloorRooms = appState.floorRooms.filter(r => r.floor === appState.activeFloor);
  const offset = (currentFloorRooms.length * 35) % 250;

  const newRoom = {
    id: "room-" + Date.now(),
    type: type,
    name: def.name,
    floor: appState.activeFloor,
    x: 60 + offset,
    y: 70 + offset,
    width: def.w,
    length: def.l,
    priority: def.priority
  };

  appState.floorRooms.push(newRoom);
  appState.selectedRoomId = newRoom.id;
  renderRoomsOnCanvas();
  syncInspectorWithSelected();
}

function renderRoomsOnCanvas() {
  const canvas = document.getElementById("canvas-rooms-container");
  if (!canvas) return;

  const currentRooms = appState.floorRooms.filter(r => r.floor === appState.activeFloor);
  canvas.innerHTML = "";

  const icons = {
    cocina: "🍳", baño: "🚿", pasillo: "🚪", living: "🛋️", habitacion: "🛏️", cochera: "🚗"
  };

  currentRooms.forEach(room => {
    const box = document.createElement("div");
    box.className = `canvas-room-box ${room.priority ? 'is-priority' : ''} ${room.id === appState.selectedRoomId ? 'selected' : ''}`;
    box.id = `box-${room.id}`;
    box.style.left = `${room.x}px`;
    box.style.top = `${room.y}px`;
    box.style.width = `${room.width * PIXELS_PER_METER}px`;
    box.style.height = `${room.length * PIXELS_PER_METER}px`;

    const area = (room.width * room.length).toFixed(1);

    box.innerHTML = `
      <div class="room-box-header">
        <span class="room-box-title">
          <span>${icons[room.type] || '📦'}</span>
          <span>${escapeHtml(room.name)}</span>
        </span>
        ${room.priority ? '<span class="room-box-priority-tag">⭐</span>' : ''}
      </div>
      <div class="room-box-meta">
        ${room.width}m x ${room.length}m (${area}m²)
      </div>
      <div class="resize-handle-se" title="Arrastrá para estirar/achicar medidas"></div>
    `;

    // Click to select
    box.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("resize-handle-se")) return; // Let resize handle handle it
      appState.selectedRoomId = room.id;
      document.querySelectorAll(".canvas-room-box").forEach(b => b.classList.remove("selected"));
      box.classList.add("selected");
      syncInspectorWithSelected();
      initDrag(e, room, box);
    });

    // Resize handle
    const resizeHandle = box.querySelector(".resize-handle-se");
    resizeHandle?.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      appState.selectedRoomId = room.id;
      document.querySelectorAll(".canvas-room-box").forEach(b => b.classList.remove("selected"));
      box.classList.add("selected");
      syncInspectorWithSelected();
      initResize(e, room, box);
    });

    canvas.appendChild(box);
  });

  updateCanvasSummary();
}

function updateRoomBoxDOM(room) {
  const box = document.getElementById(`box-${room.id}`);
  if (!box) return;

  box.style.width = `${room.width * PIXELS_PER_METER}px`;
  box.style.height = `${room.length * PIXELS_PER_METER}px`;
  if (room.priority) box.classList.add("is-priority");
  else box.classList.remove("is-priority");

  const area = (room.width * room.length).toFixed(1);
  const meta = box.querySelector(".room-box-meta");
  if (meta) meta.textContent = `${room.width}m x ${room.length}m (${area}m²)`;

  const header = box.querySelector(".room-box-header");
  if (header) {
    let pTag = header.querySelector(".room-box-priority-tag");
    if (room.priority && !pTag) {
      header.insertAdjacentHTML("beforeend", '<span class="room-box-priority-tag">⭐</span>');
    } else if (!room.priority && pTag) {
      pTag.remove();
    }
  }
}

function syncInspectorWithSelected() {
  const room = appState.floorRooms.find(r => r.id === appState.selectedRoomId);
  const title = document.getElementById("inspector-room-title");
  const widthSlider = document.getElementById("inspector-width-slider");
  const lengthSlider = document.getElementById("inspector-length-slider");
  const widthVal = document.getElementById("inspector-width-val");
  const lengthVal = document.getElementById("inspector-length-val");
  const priorityToggle = document.getElementById("inspector-priority-toggle");

  if (!room) {
    if (title) title.textContent = "Ningún ambiente seleccionado";
    return;
  }

  if (title) title.textContent = `${room.name} (${room.type})`;
  if (widthSlider) widthSlider.value = room.width;
  if (lengthSlider) lengthSlider.value = room.length;
  if (widthVal) widthVal.textContent = `${room.width} m`;
  if (lengthVal) lengthVal.textContent = `${room.length} m`;
  if (priorityToggle) priorityToggle.checked = room.priority;
}

function updateCanvasSummary() {
  const currentRooms = appState.floorRooms.filter(r => r.floor === appState.activeFloor);
  const countEl = document.getElementById("editor-rooms-count");
  const areaEl = document.getElementById("editor-area-sum");

  const totalArea = currentRooms.reduce((acc, r) => acc + (r.width * r.length), 0).toFixed(1);

  if (countEl) countEl.textContent = currentRooms.length.toString();
  if (areaEl) areaEl.textContent = `${totalArea} m²`;
}

// Interactive Dragging on Canvas
function initDrag(e, room, boxEl) {
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const initialLeft = room.x;
  const initialTop = room.y;

  const onMouseMove = (moveEvent) => {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;
    room.x = Math.max(10, initialLeft + dx);
    room.y = Math.max(10, initialTop + dy);
    boxEl.style.left = `${room.x}px`;
    boxEl.style.top = `${room.y}px`;
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

// Interactive Resizing on Canvas
function initResize(e, room, boxEl) {
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const initialW = room.width * PIXELS_PER_METER;
  const initialH = room.length * PIXELS_PER_METER;

  const onMouseMove = (moveEvent) => {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;

    const newWPixels = Math.max(48, initialW + dx);
    const newHPixels = Math.max(40, initialH + dy);

    room.width = parseFloat((newWPixels / PIXELS_PER_METER).toFixed(1));
    room.length = parseFloat((newHPixels / PIXELS_PER_METER).toFixed(1));

    updateRoomBoxDOM(room);
    syncInspectorWithSelected();
    updateCanvasSummary();
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

/* ----------------------------------------------------
   7. SCREEN 5: DESGLOSE GENUINO DE VIVIENDA (ALQUILER + IMPUESTOS/SERVICIOS),
      COMERCIOS DE LOS ALREDEDORES (SIN COLUMNA OBVIA DE PRODUCTOS) Y LINKS AL FINAL
---------------------------------------------------- */
async function loadPropertiesData() {
  if (window.CALCULIVING_PROPERTIES && Array.isArray(window.CALCULIVING_PROPERTIES)) {
    appState.properties = [...window.CALCULIVING_PROPERTIES];
    return;
  }
  try {
    const res = await fetch("data.json");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) appState.properties = data;
    }
  } catch (e) {
    // Already loaded preloaded dataset
  }
}

function setupResultsListing() {
  const sortSelect = document.getElementById("sort-select-input");
  sortSelect?.addEventListener("change", (e) => {
    appState.sortOption = e.target.value;
    executeFilterAndRender();
  });
}

function getZoneDistanceMetricsToPois(zone) {
  const [zLat, zLng] = getZoneCenter(zone);
  const perPoi = appState.pois.map(poi => {
    const dKm = getDistanceKm(zLat, zLng, poi.lat, poi.lng);
    return {
      poi,
      distKm: dKm,
      minAuto: Math.max(4, Math.round(dKm * 3.1 + 3)),
      minSubte: Math.max(5, Math.round(dKm * 2.4 + 4)),
      minColectivo: Math.max(7, Math.round(dKm * 4.4 + 5)),
      minCaminando: Math.max(8, Math.round(dKm * 12.2))
    };
  });
  const avgDist = perPoi.length > 0
    ? perPoi.reduce((s, item) => s + item.distKm, 0) / perPoi.length
    : 0;
  return { perPoi, avgDist };
}

function getSortedSubZones() {
  const list = [...MAP_AFFORDABILITY_ZONES];
  const opt = appState.sortOption || "cercania_todos";

  return list.sort((zA, zB) => {
    const dA = getZoneDistanceMetricsToPois(zA);
    const dB = getZoneDistanceMetricsToPois(zB);
    const mA = computeZoneAffordabilityMetrics(zA);
    const mB = computeZoneAffordabilityMetrics(zB);

    if (opt === "cercania_todos") {
      return dA.avgDist - dB.avgDist;
    }
    if (opt.startsWith("poi_")) {
      const targetId = opt.replace("poi_", "");
      const foundA = dA.perPoi.find(x => x.poi.id === targetId)?.distKm ?? dA.avgDist;
      const foundB = dB.perPoi.find(x => x.poi.id === targetId)?.distKm ?? dB.avgDist;
      return foundA - foundB;
    }
    if (opt === "cercania_a" && dA.perPoi[0] && dB.perPoi[0]) {
      return dA.perPoi[0].distKm - dB.perPoi[0].distKm;
    }
    if (opt === "cercania_b" && dA.perPoi[1] && dB.perPoi[1]) {
      return dA.perPoi[1].distKm - dB.perPoi[1].distKm;
    }
    if (opt === "cercania_c" && dA.perPoi[2] && dB.perPoi[2]) {
      return dA.perPoi[2].distKm - dB.perPoi[2].distKm;
    }
    if (opt === "perm_orden_lista" || opt.startsWith("perm_")) {
      let weightSumA = 0;
      let weightSumB = 0;
      dA.perPoi.forEach((item, idx) => {
        const w = 1 / Math.pow(2, idx);
        weightSumA += item.distKm * w;
      });
      dB.perPoi.forEach((item, idx) => {
        const w = 1 / Math.pow(2, idx);
        weightSumB += item.distKm * w;
      });
      return weightSumA - weightSumB;
    }
    if (opt === "precio_asc") {
      return mA.housingGenuineTotal - mB.housingGenuineTotal;
    }
    if (opt === "precio_desc") {
      return mB.housingGenuineTotal - mA.housingGenuineTotal;
    }
    return dA.avgDist - dB.avgDist;
  });
}

function executeFilterAndRender() {
  const sortedZones = getSortedSubZones();
  const activeZone = selectedZoneForDeepDive || sortedZones[0] || MAP_AFFORDABILITY_ZONES[0];
  selectedZoneForDeepDive = activeZone;

  const pillsBar = document.getElementById("results-zones-pills-bar");
  if (pillsBar) {
    pillsBar.innerHTML = sortedZones.map((z, idx) => {
      const zm = computeZoneAffordabilityMetrics(z);
      const isActive = z.id === activeZone.id;
      return `
        <button type="button" class="zone-switch-pill" data-zone-id="${z.id}" style="
          background:${isActive ? zm.rentHex : 'var(--bg-primary)'};
          color:${isActive ? '#0f172a' : '#e2e8f0'};
          border:1.5px solid ${zm.rentHex};
          padding:0.4rem 0.8rem;
          border-radius:999px;
          font-size:0.76rem;
          font-weight:800;
          cursor:pointer;">
          #${idx + 1} · 📍 ${escapeHtml(z.name.split(" (")[0])} (Alq: ${zm.pctRent}% | Vida: ${zm.pctLifestyle}%)
        </button>
      `;
    }).join("");

    pillsBar.querySelectorAll(".zone-switch-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        const zId = btn.getAttribute("data-zone-id");
        const found = MAP_AFFORDABILITY_ZONES.find(z => z.id === zId);
        if (found) {
          selectedZoneForDeepDive = found;
          executeFilterAndRender();
        }
      });
    });
  }

  renderFocusedZoneDeepDive(activeZone);

  const metaEl = document.getElementById("results-meta-count");
  if (metaEl) {
    metaEl.textContent = `Sub-zona analizada: ${activeZone.name} | Sueldo: $${appState.salary.toLocaleString("es-AR")} ARS | Puntos marcados: ${appState.pois.length} | Sitios cargados: ${appState.portals.length}`;
  }
}

// Construye los links reales con los filtros ya aplicados (Zona + Operación + Ambientes del Plano + Presupuesto) para cada portal que el usuario añadió
function buildFilteredPortalUrl(portalDomain, zoneNameOrSlug) {
  const d = (portalDomain || "").toLowerCase();
  const op = appState.selectedOperation === "venta" ? "venta" : "alquiler";
  const maxP = appState.maxPrice || 1500000;

  const mainRooms = appState.floorRooms.filter(r => r.type === "living" || r.type === "habitacion").length;
  const ambCount = Math.max(1, Math.min(5, mainRooms || 2));

  let slug = (zoneNameOrSlug || "palermo").toLowerCase();
  if (slug.includes("almagro")) slug = "almagro";
  else if (slug.includes("caballito")) slug = "caballito";
  else if (slug.includes("villa crespo") || slug.includes("villa-crespo")) slug = "villa-crespo";
  else if (slug.includes("colegiales")) slug = "colegiales";
  else if (slug.includes("belgrano")) slug = "belgrano";
  else if (slug.includes("recoleta") || slug.includes("chico")) slug = "recoleta";
  else if (slug.includes("palermo")) slug = "palermo";
  else slug = "capital-federal";

  if (d.includes("zonaprop")) {
    return `https://www.zonaprop.com.ar/departamentos-${op}-${slug}-${ambCount}-ambientes-menos-${maxP}-pesos.html`;
  }
  if (d.includes("argenprop")) {
    return `https://www.argenprop.com/departamentos/${op}/${slug}/${ambCount}-ambientes-hasta-${maxP}-pesos`;
  }
  if (d.includes("mercadolibre")) {
    return `https://inmuebles.mercadolibre.com.ar/departamentos/${op}/capital-federal/${slug}/_${ambCount}-ambientes`;
  }
  if (d.includes("remax")) {
    return `https://www.remax.com.ar/listings/${op === 'venta' ? 'buy' : 'rent'}?address=${encodeURIComponent(slug)}&rooms=${ambCount}`;
  }
  if (d.includes("properati")) {
    return `https://www.properati.com.ar/s/${slug}/departamento/${op}`;
  }
  const cleanHost = portalDomain.startsWith("http") ? portalDomain : `https://${portalDomain}`;
  return `${cleanHost}/?zona=${encodeURIComponent(slug)}&operacion=${op}&ambientes=${ambCount}&max_precio=${maxP}`;
}

function renderFocusedZoneDeepDive(zone) {
  const container = document.getElementById("focused-zone-deep-dive");
  if (!container || !zone) return;

  const m = computeZoneAffordabilityMetrics(zone);
  const imp = zone.impuestos_y_servicios || MAP_AFFORDABILITY_ZONES[0].impuestos_y_servicios;
  const locales = zone.locales_cercanos || MAP_AFFORDABILITY_ZONES[0].locales_cercanos;
  const distInfo = getZoneDistanceMetricsToPois(zone);

  const mainRooms = Math.max(1, appState.floorRooms.filter(r => r.type === "living" || r.type === "habitacion").length || 2);
  const priorityRooms = appState.floorRooms.filter(r => r.priority).map(r => r.name).join(", ") || "Living, Cocina, Baño, Habitación";
  const opLabel = appState.selectedOperation === "venta" ? "Compra-Venta" : "Alquiler";

  // Vivienda Genuina Total = Alquiler + Expensas + Impuestos Municipales y Servicios Domiciliarios Fijos
  const viviendaGenuinaArs = m.rentTotal + zone.servicios_ars;
  const pctViviendaGenuina = ((viviendaGenuinaArs / (appState.salary || 1500000)) * 100).toFixed(1);

  // Filas de Comercios Cercanos: SIN columna obvia de "qué productos venden", manteniendo los precios esperables en productos de esa zona y la plata mensual a manejar
  const localesRowsHtml = locales.map(loc => `
    <tr>
      <td><strong style="color:#fff;">${escapeHtml(loc.tipo)}</strong></td>
      <td><span style="color:#38bdf8; font-weight:600;">${escapeHtml(loc.valores)}</span></td>
      <td style="text-align:right; font-weight:800; color:#fff;">$${loc.mensual_ars.toLocaleString("es-AR")} /mes</td>
    </tr>
  `).join("");

  // Conexión hacia todos los Puntos de Interés que el usuario sumó
  const poisRoutesRowsHtml = distInfo.perPoi.map(item => `
    <div style="background:var(--bg-tertiary); padding:0.55rem 0.75rem; border-radius:6px; border-left:3.5px solid ${item.poi.color}; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
      <div>
        <strong style="color:#fff; font-size:0.82rem;">Punto ${escapeHtml(item.poi.code)}: ${escapeHtml(item.poi.label)}</strong>
        <span style="color:var(--text-muted); font-size:0.75rem; margin-left:6px;">(${item.distKm.toFixed(1)} km)</span>
      </div>
      <div style="font-size:0.76rem; font-weight:700; display:flex; gap:0.65rem; flex-wrap:wrap;">
        <span style="color:#ff2e93;">🚗 Auto: ${item.minAuto} min</span>
        <span style="color:#00f5d4;">🚇 Subte/Tren: ${item.minSubte} min</span>
        <span style="color:#facc15;">🚌 Colectivo: ${item.minColectivo} min</span>
        <span style="color:#a3e635;">🚶 Caminando: ${item.minCaminando} min</span>
      </div>
    </div>
  `).join("");

  // Tarjetas de Links a las Páginas que el Usuario Añadió con los Filtros Ya Aplicados (ubicadas AL FINAL del desglose)
  const activePortals = appState.portals.length > 0 ? appState.portals : [
    { id: "p-1", name: "Zonaprop", domain: "zonaprop.com.ar" },
    { id: "p-2", name: "Argenprop", domain: "argenprop.com" },
    { id: "p-3", name: "MercadoLibre Inmuebles", domain: "mercadolibre.com.ar/inmuebles" }
  ];

  const portalLinksHtml = activePortals.map(p => {
    const filteredUrl = buildFilteredPortalUrl(p.domain, zone.slug || zone.name);
    return `
      <div class="portal-filtered-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <strong style="font-size:0.95rem; color:#fff;">🌐 ${escapeHtml(p.name)}</strong>
            <span style="font-size:0.7rem; background:rgba(16,185,129,0.18); color:#34d399; padding:2px 7px; border-radius:999px; font-weight:700;">Filtros aplicados</span>
          </div>
          <div style="font-size:0.74rem; color:var(--text-secondary); line-height:1.45;">
            • <strong>Sub-zona:</strong> ${escapeHtml(zone.name)}<br>
            • <strong>Operación:</strong> ${opLabel} | <strong>Tope:</strong> $${(appState.maxPrice || 1500000).toLocaleString("es-AR")} ARS<br>
            • <strong>Layout buscado:</strong> ${mainRooms} ambientes (${escapeHtml(priorityRooms)})
          </div>
        </div>
        <a href="${escapeHtml(filteredUrl)}" target="_blank" rel="noopener noreferrer" class="btn-portal-link" style="justify-content:center; width:100%;">
          🔗 Ir a ${escapeHtml(p.name)} con estos filtros aplicados ↗
        </a>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div style="background:var(--card-bg); border:1.5px solid ${m.rentHex}; border-radius:var(--radius-md); padding:1.4rem; box-shadow:var(--shadow-lg);">
      <!-- Cabecera de la Sub-Zona Activa -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid var(--card-border);">
        <div>
          <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--accent-cyan); font-weight:800;">
            Análisis de Sub-Zona Delimitada por Avenidas, Vías y Puentes
          </span>
          <h3 style="font-size:1.5rem; font-weight:800; color:#fff; margin-top:0.15rem;">📍 ${escapeHtml(zone.name)}</h3>
          <p style="font-size:0.83rem; color:var(--text-secondary); margin-top:0.2rem;">${escapeHtml(zone.urban_boundary_note || zone.gastos_alrededor_detalle)}</p>
        </div>
        <div style="background:var(--bg-primary); border:1.5px solid ${m.rentHex}; padding:0.65rem 1rem; border-radius:var(--radius-sm); text-align:right;">
          <div style="font-size:0.84rem; font-weight:800; color:${m.rentHex};">${m.verdictText}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">Tu sueldo cargado: <strong>$${appState.salary.toLocaleString("es-AR")} ARS</strong></div>
        </div>
      </div>

      <!-- BLOQUE SUPERIOR: CUÁNTO CUESTA GENUINAMENTE LA VIVIENDA (ALQUILER + EXPENSAS + DESGLOSE DE IMPUESTOS Y SERVICIOS TODO JUNTO) -->
      <div style="background:var(--bg-primary); border:1px solid var(--card-border); border-left:4px solid ${m.rentHex}; border-radius:var(--radius-sm); padding:1.15rem; margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.75rem; margin-bottom:0.85rem;">
          <div>
            <h4 style="font-size:1.05rem; font-weight:800; color:#fff;">
              🏠 Cuánto Cuesta Genuinamente la Vivienda (Alquiler, Expensas, Impuestos y Servicios Fijos)
            </h4>
            <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:0.15rem;">
              Todo lo que tenés que pagar obligatoriamente mes a mes para habitar y mantener el departamento abierto en esta sub-zona:
            </p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.35rem; font-weight:900; color:#fff;">
              $${viviendaGenuinaArs.toLocaleString("es-AR")} ARS / mes
            </div>
            <span style="font-size:0.76rem; color:var(--accent-cyan); font-weight:700;">
              Total vivienda genuina (${pctViviendaGenuina}% de tu sueldo)
            </span>
          </div>
        </div>

        <!-- Comparativa de las 2 escalas semafóricas individuales -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:0.85rem; margin-bottom:1rem;">
          <div style="background:var(--bg-tertiary); padding:0.85rem; border-radius:6px; border-left:3.5px solid ${m.rentHex};">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:#fff; font-size:0.86rem;">Alquiler (${mainRooms} amb) + Expensas</strong>
              <span style="font-size:0.76rem; font-weight:800; color:${m.rentHex};">${m.rentLabel}</span>
            </div>
            <div style="font-size:1.15rem; font-weight:800; color:#fff; margin:0.25rem 0;">
              $${m.rentTotal.toLocaleString("es-AR")} ARS <span style="font-size:0.8rem; color:${m.rentHex};">(${m.pctRent}% del sueldo)</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">
              Alquiler promedio: <strong>$${zone.alquiler_ars.toLocaleString("es-AR")}</strong> + Expensas ordinarias: <strong>$${zone.expensas_ars.toLocaleString("es-AR")}</strong><br>
              <span style="color:var(--text-muted); font-size:0.7rem;">Escala Alquiler: ≤35% Verde | 35-45% Amarillo | 45-55% Naranja | >55% Rojo</span>
            </div>
          </div>

          <div style="background:var(--bg-tertiary); padding:0.85rem; border-radius:6px; border-left:3.5px solid ${m.lifeHex};">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:#fff; font-size:0.86rem;">Coste de Vida (Servicios + Comercios + SUBE)</strong>
              <span style="font-size:0.76rem; font-weight:800; color:${m.lifeHex};">${m.lifeLabel}</span>
            </div>
            <div style="font-size:1.15rem; font-weight:800; color:#fff; margin:0.25rem 0;">
              $${m.lifestyleTotal.toLocaleString("es-AR")} ARS <span style="font-size:0.8rem; color:${m.lifeHex};">(${m.pctLifestyle}% del sueldo)</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">
              Impuestos/Servicios: <strong>$${zone.servicios_ars.toLocaleString("es-AR")}</strong> + Comercios: <strong>$${zone.canasta_comercios_ars.toLocaleString("es-AR")}</strong> + SUBE: <strong>$${zone.transporte_ars.toLocaleString("es-AR")}</strong><br>
              <span style="color:var(--text-muted); font-size:0.7rem;">Escala Coste de Vida: 0-25% Verde | 25-50% Amarillo | 50-75% Naranja | 75-100% Rojo</span>
            </div>
          </div>
        </div>

        <!-- Desglose de Impuestos Municipales y Gastos en Servicios Fijos de la Vivienda (Integrado arriba junto al alquiler) -->
        <div style="padding-top:0.75rem; border-top:1px solid var(--card-border);">
          <div style="font-size:0.82rem; font-weight:800; color:#bae6fd; margin-bottom:0.5rem;">
            ⚡ Desglose de Impuestos Municipales, Servicios Domiciliarios y Movilidad Fija en ${escapeHtml(zone.name.split(" (")[0])}:
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:0.55rem; font-size:0.78rem;">
            <div style="background:var(--bg-tertiary); padding:0.5rem 0.65rem; border-radius:4px;">
              <span style="color:var(--text-muted); display:block; font-size:0.7rem;">🏛️ ABL Municipal / Inmob.</span>
              <strong style="color:#fff; font-size:0.88rem;">$${imp.abl_municipal_ars.toLocaleString("es-AR")} /mes</strong>
            </div>
            <div style="background:var(--bg-tertiary); padding:0.5rem 0.65rem; border-radius:4px;">
              <span style="color:var(--text-muted); display:block; font-size:0.7rem;">💡 Luz (Edenor / Edesur)</span>
              <strong style="color:#fff; font-size:0.88rem;">$${imp.luz_edenor_edesur_ars.toLocaleString("es-AR")} /mes</strong>
            </div>
            <div style="background:var(--bg-tertiary); padding:0.5rem 0.65rem; border-radius:4px;">
              <span style="color:var(--text-muted); display:block; font-size:0.7rem;">🔥 Gas Natural (Metrogas)</span>
              <strong style="color:#fff; font-size:0.88rem;">$${imp.gas_metrogas_ars.toLocaleString("es-AR")} /mes</strong>
            </div>
            <div style="background:var(--bg-tertiary); padding:0.5rem 0.65rem; border-radius:4px;">
              <span style="color:var(--text-muted); display:block; font-size:0.7rem;">🚿 Agua (AySA Zonal)</span>
              <strong style="color:#fff; font-size:0.88rem;">$${imp.agua_aysa_ars.toLocaleString("es-AR")} /mes</strong>
            </div>
            <div style="background:var(--bg-tertiary); padding:0.5rem 0.65rem; border-radius:4px;">
              <span style="color:var(--text-muted); display:block; font-size:0.7rem;">🌐 Internet Fibra Hogar</span>
              <strong style="color:#fff; font-size:0.88rem;">$${imp.internet_fibra_ars.toLocaleString("es-AR")} /mes</strong>
            </div>
            <div style="background:var(--bg-tertiary); padding:0.5rem 0.65rem; border-radius:4px;">
              <span style="color:var(--text-muted); display:block; font-size:0.7rem;">🚇 Transporte SUBE</span>
              <strong style="color:#38bdf8; font-size:0.88rem;">$${zone.transporte_ars.toLocaleString("es-AR")} /mes</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- BLOQUE MEDIO: COSTO DE VIVIR EN CUANTO A LOS COMERCIOS DE LOS ALREDEDORES (QUÉ PLATA HAY QUE MANEJAR EN LOS NEGOCIOS DE LA ZONA) -->
      <div style="background:var(--bg-primary); border:1px solid var(--card-border); border-left:4px solid ${m.lifeHex}; border-radius:var(--radius-sm); padding:1.15rem; margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.4rem;">
          <h4 style="font-size:1rem; font-weight:800; color:#fff;">
            🏪 Costo de Vivir en los Comercios de los Alrededores (Qué Plata Hay que Manejar en el Barrio)
          </h4>
          <span style="font-size:0.9rem; font-weight:800; color:${m.lifeHex};">
            Total en negocios del barrio: $${zone.canasta_comercios_ars.toLocaleString("es-AR")} ARS / mes
          </span>
        </div>
        <p style="font-size:0.77rem; color:var(--text-secondary); margin-bottom:0.65rem;">
          Valores de referencia que podés esperar en los negocios de proximidad de ${escapeHtml(zone.name.split(" (")[0])}:
        </p>
        <div style="overflow-x:auto;">
          <table class="dense-table">
            <thead>
              <tr style="background:var(--bg-tertiary);">
                <th style="width:34%; color:#fff;">Comercio / Rubro en los Alrededores</th>
                <th style="width:48%; color:#fff;">Precios que Podés Esperar en Productos de Esta Zona</th>
                <th style="width:18%; text-align:right; color:#fff;">Plata Mensual a Manejar</th>
              </tr>
            </thead>
            <tbody>
              ${localesRowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- BLOQUE EVALUACIÓN: POR QUÉ CONVIENE O NO VIVIR EN ESTA ZONA (LÍMITES, PUENTES, AUTOPISTAS Y CONEXIÓN A TUS PUNTOS) -->
      <div style="background:var(--bg-primary); border:1px solid var(--card-border); border-radius:var(--radius-sm); padding:1.15rem; margin-bottom:1.25rem;">
        <h4 style="font-size:1rem; font-weight:800; color:#fff; margin-bottom:0.5rem;">
          ⚖️ Por Qué Conviene o No Vivir en ${escapeHtml(zone.name)}
        </h4>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:0.75rem; font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.85rem;">
          <div style="background:var(--bg-tertiary); padding:0.75rem; border-radius:6px;">
            <strong style="color:#38bdf8; display:block; margin-bottom:0.25rem;">🌉 Efecto de Límites Urbanos, Puentes, Vías y Autopistas</strong>
            ${escapeHtml(zone.bridge_price_effect || zone.gastos_alrededor_detalle)}
          </div>
          <div style="background:var(--bg-tertiary); padding:0.75rem; border-radius:6px;">
            <strong style="color:#34d399; display:block; margin-bottom:0.25rem;">🏢 Tipología de Edificios y Requisitos en Portales</strong>
            ${escapeHtml(zone.gastos_alrededor_detalle)} En los portales cargados suelen pedirse garantía propietaria de CABA o seguro de caución (Finaer / Garantina), 1 mes de adelanto y 1 mes de depósito.
          </div>
        </div>

        <div style="font-size:0.8rem; font-weight:800; color:#e2e8f0; margin-bottom:0.45rem;">
          🛣️ Tiempos de Viaje desde ${escapeHtml(zone.name.split(" (")[0])} hacia tus Puntos de Interés:
        </div>
        <div style="display:flex; flex-direction:column; gap:0.4rem;">
          ${poisRoutesRowsHtml}
        </div>
      </div>

      <!-- BLOQUE FINAL (AL FINAL DEL DESGLOSE): LINKS QUE REDIRIGEN A LAS PÁGINAS CARGADAS CON LOS FILTROS YA APLICADOS -->
      <div style="background:rgba(6,182,212,0.08); border:1.5px solid rgba(56,189,248,0.45); border-radius:var(--radius-sm); padding:1.15rem;">
        <h4 style="font-size:1rem; font-weight:800; color:#38bdf8; margin-bottom:0.25rem;">
          🔗 Links Directos a las Páginas que Cargaste con los Filtros Ya Aplicados en ${escapeHtml(zone.name.split(" (")[0])}
        </h4>
        <p style="font-size:0.78rem; color:var(--text-secondary); margin-bottom:0.65rem;">
          Hacé click en cualquiera de los sitios que sumaste al principio para ver las ofertas activas con la sub-zona, operación (${opLabel}), tope de presupuesto ($${(appState.maxPrice || 1500000).toLocaleString("es-AR")}) y cantidad de ambientes (${mainRooms} amb) ya filtrados:
        </p>
        <div class="portal-filtered-grid">
          ${portalLinksHtml}
        </div>
      </div>
    </div>
  `;
}

/* ----------------------------------------------------
   GEOMETRY & UTILS
---------------------------------------------------- */
function isPointInPolygon(point, vs) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
