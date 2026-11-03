/**
 * Calculiving - Client Application Logic (v2.0)
 * Linear flow, fullscreen bot, connected portal inputs, street-by-street polygon drawing,
 * 25/75 draggable & resizable floor planner, and default vertical list results.
 */

// Global State (Empieza 100% limpio cada vez que el usuario entra a la página)
const appState = {
  currentScreen: "screen-home",
  screenHistory: ["screen-home"],
  salary: 0, // Sin sueldo precargado: el usuario ingresa el suyo de cero
  portals: [], // Sin sitios precargados: se agregan de cero
  properties: [],
  selectedOperation: "alquiler",
  maxPrice: 0,
  minRooms: 1,
  activeFloor: 1,
  floorsCount: 1,
  // 2D Spatial Floor Plan: each room has position (x, y) and dimensions (w, l in meters)
  floorRooms: [
    { id: "room-1", type: "living", name: "Living", floor: 1, x: 50, y: 50, width: 5.5, length: 4.0, priority: true },
    { id: "room-2", type: "cocina", name: "Cocina", floor: 1, x: 340, y: 50, width: 3.2, length: 2.8, priority: true },
    { id: "room-3", type: "baño", name: "Baño", floor: 1, x: 340, y: 220, width: 2.2, length: 1.8, priority: true },
    { id: "room-4", type: "habitacion", name: "Habitación", floor: 1, x: 50, y: 270, width: 3.8, length: 3.2, priority: true }
  ],
  selectedRoomId: "room-1",
  pois: [], // Sin puntos de interés precargados: el usuario suma los suyos (A, B, C...)
  userSelectedZones: [], // El mapa arranca 100% limpio; solo se muestran las zonas que el usuario elija o dibuje
  activeHighlightedPoiId: null,
  mentionedBarrioSlug: null,
  drawnPolygonPoints: [],
  drawnPolygonLayer: null,
  isDrawingMode: false,
  sortOption: "cercania_todos",
  // Perfil de la 2da conversación (hábitos reales, cómo se mueve, cilindrada, dieta, cocina vs delivery, gimnasio/hobbys, supermercados y prioridad)
  lifestyleProfile: {
    transportMode: "sube", // sube | auto_nafta | moto | bici_pie | apps_mix
    vehicleDisplacement: "auto_16_18", // auto_10_14 | auto_16_18 | auto_20_plus | auto_pickup | auto_gnc | moto_110_150 | moto_200_300 | moto_400_plus
    cookingHabit: "cocino", // cocino | mix | delivery
    dietType: "omnivora", // omnivora | economica | saludable | proteica
    hobbies: [], // ["gimnasio", "club_deporte", "salidas_cafe", "cursos_arte"]
    hobbyLocations: {}, // { gimnasio: "Palermo", club_deporte: "Nuñez" }
    selectedSupermarkets: ["dia", "coto", "carrefour"], // ["dia", "coto", "carrefour", "jumbo", "mayorista"]
    disabledLocalIndices: {}, // Permite activar/desactivar comercios específicos en la deconstrucción
    rankingPriority: "equilibrio_frecuentes", // equilibrio_frecuentes | menos_gasto | menos_viaje
    deconstructionExpanded: false
  },
  // Datos financieros e inflación real al día (IPC INDEC + Nafta real en surtidor + SUBE vigente)
  liveEconomicData: {
    ipcMensualPct: 2.7,
    ipcFecha: "Último corte oficial INDEC",
    sourceLabel: "INDEC IPC Oficial Vigente",
    naftaSuperLitroArs: 1195,
    naftaPremiumLitroArs: 1475,
    gasoilPremiumLitroArs: 1420,
    gncMetroCubicoArs: 560,
    subeBoletoMinArs: 425,
    boletoSubteArs: 832,
    boletoTrenArs: 320,
    dolarOficialArs: 1095,
    dolarMepArs: 1180,
    factorActualizacionReal: 1.0,
    lastUpdatedText: "Sincronizado con índices reales vigentes",
    zoneLiveStoresCache: {}
  },
  classicFilters: {
    operation: "alquiler",
    currency: "ARS",
    minPrice: 0,
    maxPrice: 0,
    maxExpensas: 0,
    propertyType: "departamento",
    disposition: "indistinto",
    orientation: "indistinto",
    antiquity: "indistinto",
    roomsList: [2],
    minRooms: 2,
    bedroomsList: ["1"],
    bedrooms: "1",
    bathroomsList: [1],
    bathrooms: "1",
    minM2Covered: 0,
    maxM2Total: 0,
    garage: "indistinto",
    garageCoveredCars: 0,
    garageUncoveredCars: 0,
    features: [],
    amenities: [],
    requirements: []
  }
};

/* ----------------------------------------------------
   FORMATEADOR DE MILES CON PUNTOS (1.000 / 1.500.000)
---------------------------------------------------- */
function parseArsNumber(rawVal) {
  if (typeof rawVal === "number") return isNaN(rawVal) ? 0 : rawVal;
  const digits = String(rawVal || "").replace(/[^\d]/g, "");
  if (!digits) return 0;
  const num = parseInt(digits, 10);
  return isNaN(num) ? 0 : num;
}

function formatArsThousands(rawVal) {
  const num = parseArsNumber(rawVal);
  if (!num || num <= 0) return "";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function attachLiveThousandsFormatter(inputEl) {
  if (!inputEl || inputEl.dataset.thousandsBound === "true") return;
  inputEl.dataset.thousandsBound = "true";

  const formatKeepCaret = () => {
    const raw = inputEl.value;
    const digitsOnly = raw.replace(/[^\d]/g, "");
    if (!digitsOnly) {
      inputEl.value = "";
      return;
    }
    const formatted = formatArsThousands(digitsOnly);
    if (inputEl.value !== formatted) {
      inputEl.value = formatted;
    }
  };

  inputEl.addEventListener("input", formatKeepCaret);
  inputEl.addEventListener("blur", formatKeepCaret);
}

function setupFormattedThousandsInputs() {
  document.querySelectorAll(".formatted-thousands-input").forEach(el => {
    attachLiveThousandsFormatter(el);
  });
}

// Borra cualquier búsqueda anterior, sueldo, puntos de interés, portales, zonas marcadas o polígonos para empezar de cero (conservando únicamente las correcciones de la Base de Datos Zonal si el usuario reportó algún dato obsoleto)
function resetEntireSessionState() {
  try {
    const savedDb = localStorage.getItem("calculiving_zonal_db_v1");
    localStorage.clear();
    sessionStorage.clear();
    if (savedDb) {
      localStorage.setItem("calculiving_zonal_db_v1", savedDb);
    }
  } catch (e) {}

  appState.salary = 0;
  appState.maxPrice = 0;
  appState.selectedOperation = "alquiler";
  appState.portals = [];
  appState.pois = [];
  appState.userSelectedZones = [];
  appState.activeHighlightedPoiId = null;
  appState.mentionedBarrioSlug = null;
  appState.drawnPolygonPoints = [];
  appState.isDrawingMode = false;
  appState.floorsCount = 1;
  appState.activeFloor = 1;
  appState.floorRooms = [
    { id: "room-1", type: "living", name: "Living", floor: 1, x: 50, y: 50, width: 5.5, length: 4.0, priority: true },
    { id: "room-2", type: "cocina", name: "Cocina", floor: 1, x: 340, y: 50, width: 3.2, length: 2.8, priority: true },
    { id: "room-3", type: "baño", name: "Baño", floor: 1, x: 340, y: 220, width: 2.2, length: 1.8, priority: true },
    { id: "room-4", type: "habitacion", name: "Habitación", floor: 1, x: 50, y: 270, width: 3.8, length: 3.2, priority: true }
  ];
  appState.selectedRoomId = "room-1";
  appState.lifestyleProfile = {
    transportMode: "sube",
    vehicleDisplacement: "auto_16_18",
    cookingHabit: "cocino",
    dietType: "omnivora",
    hobbies: [],
    hobbyLocations: {},
    selectedSupermarkets: ["dia", "coto", "carrefour"],
    disabledLocalIndices: {},
    rankingPriority: "equilibrio_frecuentes",
    deconstructionExpanded: false
  };

  // Limpiar inputs del DOM para que el navegador no recuerde valores viejos
  const emptyInputs = [
    "global-salary-input",
    "map-filter-max-price",
    "neighborhood-mention-input",
    "new-poi-name-input",
    "new-poi-address-input",
    "portal-site-input",
    "fullscreen-bot-input",
    "lifestyle-mini-chat-input"
  ];
  emptyInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const mapOp = document.getElementById("map-filter-operation");
  if (mapOp) mapOp.value = "alquiler";

  const hoverToggle = document.getElementById("hover-auto-navigate-toggle");
  if (hoverToggle) hoverToggle.checked = false;

  const subzonesBox = document.getElementById("neighborhood-internal-subzones-box");
  if (subzonesBox) {
    subzonesBox.style.display = "none";
    subzonesBox.innerHTML = "";
  }

  const alertsBox = document.getElementById("map-zonal-alerts-box");
  if (alertsBox) {
    alertsBox.style.display = "none";
    alertsBox.innerHTML = "";
  }

  const rankingBox = document.getElementById("map-convenience-ranking-box");
  const rankingList = document.getElementById("map-convenience-ranking-list");
  if (rankingBox) rankingBox.style.display = "none";
  if (rankingList) rankingList.innerHTML = "";

  // Reiniciar controles de la 2da conversación (Hábitos y Estilo de Vida)
  const trSel = document.getElementById("habit-transport-mode");
  if (trSel) trSel.value = "sube";
  const dispWrap = document.getElementById("habit-vehicle-displacement-wrap");
  if (dispWrap) dispWrap.style.display = "none";
  const dispSel = document.getElementById("habit-vehicle-displacement");
  if (dispSel) dispSel.value = "auto_16_18";
  const cookSel = document.getElementById("habit-cooking-mode");
  if (cookSel) cookSel.value = "cocino";
  const dietSel = document.getElementById("habit-diet-type");
  if (dietSel) dietSel.value = "omnivora";
  document.querySelectorAll(".habit-hobby-cb").forEach(cb => { cb.checked = false; });
  const hobbyPoiBox = document.getElementById("habit-hobbies-poi-autocreate-box");
  if (hobbyPoiBox) {
    hobbyPoiBox.style.display = "none";
    hobbyPoiBox.innerHTML = "";
  }
  document.querySelectorAll(".habit-supermarket-cb").forEach(cb => {
    cb.checked = ["dia", "coto", "carrefour"].includes(cb.value);
  });
  document.querySelectorAll('input[name="habit-priority-ranking"]').forEach(rb => {
    rb.checked = (rb.value === "equilibrio_frecuentes");
  });

  // Limpiar conversación del bot principal dejando solo el saludo inicial
  const chatThread = document.getElementById("fullscreen-chat-thread");
  if (chatThread) {
    chatThread.innerHTML = `
      <div class="chat-msg bot">
        <div class="avatar">🤖</div>
        <div class="chat-bubble-content">
          ¡Hola! Estoy acá para ayudarte a encontrar tu lugar ideal en cualquier punto de Buenos Aires (CABA, GBA o toda la Provincia). 
          Contame: <strong>¿qué estás buscando?</strong> (por ejemplo: si necesitás espacio para teletrabajo, balcón, cocina separada, cercanía a alguna línea de transporte o un presupuesto máximo mensual).
        </div>
      </div>
    `;
  }

  // Limpiar hilo de la mini conversación previa al mapa
  const miniThread = document.getElementById("lifestyle-mini-chat-thread");
  if (miniThread) {
    miniThread.innerHTML = `
      <div class="chat-msg bot">
        <div class="avatar">🤖</div>
        <div class="chat-bubble-content" style="font-size:0.83rem;">
          ¡Antes de pasar al mapa, ajustemos los números a tu vida real! Contame (escribiendo acá abajo o eligiendo en las tarjetas):<br>
          1️⃣ <strong>¿Cómo te movés y qué cilindrada tiene tu auto/moto?</strong> (auto/nafta, transporte público SUBE, moto, bici o caminando)<br>
          2️⃣ <strong>¿Cómo es tu dieta y si cocinás o vivís pidiendo comida?</strong><br>
          3️⃣ <strong>¿Practicás algún deporte, gimnasio o hobby fijo?</strong> (al marcarlo, te creamos automáticamente el Punto de Interés en el mapa para que lo ubiques)<br>
          4️⃣ <strong>¿En qué supermercados comprás y qué priorizás en el ranking del mapa?</strong>
        </div>
      </div>
    `;
  }

  if (typeof resetClassicFiltersForm === "function") {
    resetClassicFiltersForm();
  }
  if (typeof clearDrawnPolygon === "function") {
    clearDrawnPolygon();
  }
  if (typeof clearPoiRoutesHighlight === "function") {
    clearPoiRoutesHighlight();
  }
  if (typeof renderConnectedPortalsList === "function") {
    renderConnectedPortalsList();
  }
  if (typeof renderPoisSidebarList === "function") {
    renderPoisSidebarList();
  }
  if (typeof renderPoisOnLeafletMap === "function") {
    renderPoisOnLeafletMap();
  }
  if (typeof renderAffordabilityZonesOnMap === "function") {
    renderAffordabilityZonesOnMap();
  }
  if (typeof renderFloorButtons === "function" && typeof renderRoomsOnCanvas === "function") {
    renderFloorButtons();
    renderRoomsOnCanvas();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  initCalculivingZonalDatabase();
  setupFormattedThousandsInputs();
  await loadPropertiesData();
  setupNavigationFlow();
  setupSalaryBanner();
  setupFullscreenBot();
  setupConnectedPortalsInput();
  setupLifestyleMiniChat();
  setupClassicFiltersInteractions();
  setupInteractiveMap();
  setupFloorPlanCanvasEditor();
  setupResultsListing();
  setupZonalDatabaseModal();
  resetEntireSessionState();
  fetchLiveEconomicIndicators();
});

// Si el navegador restaura la página desde la caché al volver o recargar, limpiar todo igual
window.addEventListener("pageshow", () => {
  if (appState.currentScreen === "screen-home") {
    resetEntireSessionState();
  }
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

  if (prevScreen === "screen-home") {
    resetEntireSessionState();
  } else if (prevScreen === "screen-metodo") {
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
    } else if (screenId === "screen-busqueda-clasica") {
      if (badge) badge.textContent = "Buscar Personalmente · Búsqueda Clásica (Opción B)";
    } else if (screenId === "screen-editor") {
      if (badge) badge.textContent = "Armar tu Lugar Deseado (Opción C)";
    } else if (screenId === "screen-portales") {
      if (badge) badge.textContent = "Dónde Buscar · Cargar Sitios Web";
    } else if (screenId === "screen-estilo-vida-chat") {
      if (badge) badge.textContent = "Tus Hábitos, Comercios y Prioridad";
    } else if (screenId === "screen-metodo") {
      if (badge) badge.textContent = "Dónde Buscar · Mapa de Buenos Aires";
    } else if (screenId === "screen-resultados") {
      if (badge) badge.textContent = "Resultados y Costo Total";
    }
  }
}

function setupNavigationFlow() {
  document.getElementById("nav-brand-btn")?.addEventListener("click", () => {
    resetEntireSessionState();
    appState.screenHistory = ["screen-home"];
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById("screen-home")?.classList.add("active");
    appState.currentScreen = "screen-home";
    updateHeaderStepIndicator("screen-home");
  });

  document.getElementById("header-reset-all-btn")?.addEventListener("click", () => {
    resetEntireSessionState();
    appState.screenHistory = ["screen-home"];
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById("screen-home")?.classList.add("active");
    appState.currentScreen = "screen-home";
    updateHeaderStepIndicator("screen-home");
  });

  document.getElementById("header-back-btn")?.addEventListener("click", navigateBack);

  // Home 3 Options (Tipo de Búsqueda)
  document.getElementById("btn-option-a")?.addEventListener("click", () => {
    appState.activeTab = "bot";
    navigateTo("screen-bot-fullscreen");
  });
  document.getElementById("btn-option-b")?.addEventListener("click", () => {
    appState.activeTab = "filtros";
    navigateTo("screen-busqueda-clasica");
  });
  document.getElementById("btn-option-c")?.addEventListener("click", () => {
    appState.activeTab = "plano";
    navigateTo("screen-editor");
  });

  // Flow forward & back buttons
  document.getElementById("bot-proceed-portales-btn")?.addEventListener("click", () => navigateTo("screen-portales"));
  document.getElementById("bot-back-home-btn")?.addEventListener("click", navigateBack);

  document.getElementById("btn-classic-back-home")?.addEventListener("click", navigateBack);
  document.getElementById("btn-classic-proceed-portales")?.addEventListener("click", () => {
    const cf = readClassicFiltersFromDOM();
    const mapOp = document.getElementById("map-filter-operation");
    const mapMax = document.getElementById("map-filter-max-price");
    if (mapOp) mapOp.value = cf.operation === "venta" ? "venta" : "alquiler";
    if (mapMax && cf.maxPrice > 0) mapMax.value = formatArsThousands(cf.maxPrice);
    navigateTo("screen-portales");
  });
  document.getElementById("btn-reset-classic-filters")?.addEventListener("click", () => {
    resetClassicFiltersForm();
  });

  document.getElementById("btn-editor-search-results")?.addEventListener("click", () => {
    navigateTo("screen-portales");
  });

  document.getElementById("portales-back-btn")?.addEventListener("click", navigateBack);
  // Después de cargar los portales, pasa a la 2da conversación (Hábitos, Comercios y Prioridad) antes del Mapa
  document.getElementById("portals-ready-btn")?.addEventListener("click", () => navigateTo("screen-estilo-vida-chat"));
  document.getElementById("lifestyle-back-portales-btn")?.addEventListener("click", navigateBack);
  document.getElementById("lifestyle-proceed-map-btn")?.addEventListener("click", () => {
    syncLifestyleProfileFromDOM();
    navigateTo("screen-metodo");
  });

  document.getElementById("btn-map-go-results")?.addEventListener("click", () => {
    const mapOp = document.getElementById("map-filter-operation")?.value;
    const mapMax = parseArsNumber(document.getElementById("map-filter-max-price")?.value);
    if (mapOp) appState.selectedOperation = mapOp;
    if (mapMax > 0) appState.maxPrice = mapMax;
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
    const val = parseArsNumber(salaryInput?.value);
    appState.salary = val > 0 ? val : 0;
    renderAffordabilityZonesOnMap();
    renderUserSelectedZonesSidebar();
    if (activePolygonLayer && appState.drawnPolygonPoints.length >= 3) {
      updateDrawnPolygonStyleAndHover();
    }
    if (appState.currentScreen === "screen-resultados") {
      executeFilterAndRender();
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
   4.5. BASE DE DATOS PROPIA ACTUALIZABLE (MONETARIA, TRANSPORTE, CORTES, SUBTES Y ZONAL)
   + SEGUNDA CONVERSACIÓN (CILINDRADA AUTO/MOTO + AUTO-CREACIÓN DE PUNTOS POR DEPORTE/HOBBY)
   + CATÁLOGO COMPLETO DE TODO BUENOS AIRES (48 BARRIOS CABA + 135 MUNICIPIOS PBA)
---------------------------------------------------- */
const CALCULIVING_ZONAL_DB_DEFAULT = {
  lastSyncTimestamp: "Sincronizado con INDEC, YPF, Emova Subte, Trenes Argentinos y AUSA",
  monetario_y_combustible: [
    {
      id: "ipc_indec",
      nombre: "Inflación Mensual Oficial (IPC INDEC)",
      valor_num: 2.7,
      unidad: "% mensual",
      fuente_oficial: "INDEC / API ArgentinaDatos (https://api.argentinadatos.com/v1/finanzas/indices/inflacion)",
      por_que: "Se consulta en vivo el último Índice de Precios al Consumidor nacional y GBA publicado por INDEC para ajustar canasta de supermercados, servicios y contratos ICL/IPC."
    },
    {
      id: "nafta_super_ypf",
      nombre: "Nafta Súper (Surtidor YPF AMBA / Bs.As.)",
      valor_num: 1195,
      unidad: "ARS / Litro",
      fuente_oficial: "Secretaría de Energía / YPF Oficial Buenos Aires",
      por_que: "Base para calcular el gasto real mensual por kilómetro en autos de cilindrada 1.0L a 1.8L y motos urbanas según tu distancia a los puntos de interés."
    },
    {
      id: "nafta_premium_ypf",
      nombre: "Nafta Infinia / Premium (YPF Bs.As.)",
      valor_num: 1475,
      unidad: "ARS / Litro",
      fuente_oficial: "Secretaría de Energía / YPF Oficial Buenos Aires",
      por_que: "Utilizada para motores turbo o de cilindrada 2.0L+ (SUV / Alta gama) que requieren mayor octanaje."
    },
    {
      id: "gasoil_premium",
      nombre: "Infinia Diesel / Gasoil Grado 3",
      valor_num: 1420,
      unidad: "ARS / Litro",
      fuente_oficial: "YPF Oficial Buenos Aires",
      por_que: "Referencia para Pick-ups y utilitarios diésel (2.4L a 3.0L+)."
    },
    {
      id: "gnc_m3",
      nombre: "GNC (Metro Cúbico promedio AMBA/PBA)",
      valor_num: 560,
      unidad: "ARS / m³",
      fuente_oficial: "ENARGAS / Estaciones GNC Bs.As.",
      por_que: "Permite calcular el ahorro (~55% menos por km) cuando el usuario selecciona vehículo con equipo a GNC."
    }
  ],
  transporte_oficial_y_futuro: [
    {
      id: "sube_colectivo",
      nombre: "Boleto Mínimo Colectivo (SUBE registrada AMBA)",
      valor_num: 425,
      unidad: "ARS / viaje (0-3 km)",
      fuente_oficial: "Secretaría de Transporte / Argentina.gob.ar SUBE",
      cambio_futuro_previsto: "Actualización tarifaria en líneas de jurisdicción PBA y CABA atada a IPC mensual; descuento Red SUBE vigente en combinaciones de jurisdicción nacional/CABA.",
      por_que: "Determina el gasto mensual de quienes viajan en colectivo o combinan con tren/subte."
    },
    {
      id: "subte_emova",
      nombre: "Pasaje de Subte CABA (Emova / SBASE)",
      valor_num: 832,
      unidad: "ARS / viaje",
      fuente_oficial: "BuenosAires.gob.ar / Emova Movilidad",
      cambio_futuro_previsto: "Cuadro tarifario escalonado con descuentos por pasajero frecuente (20%, 30% y 40% al superar 20, 30 y 40 viajes mensuales con misma tarjeta/medio).",
      por_que: "Impacta directamente en barrios de CABA conectados a Líneas A, B, C, D, E y H."
    },
    {
      id: "trenes_amba",
      nombre: "Boleto Trenes Metropolitanos (Roca, Mitre, Sarmiento, San Martín, Belgrano)",
      valor_num: 320,
      unidad: "ARS / sección 1",
      fuente_oficial: "Trenes Argentinos Operaciones (SOFSE)",
      cambio_futuro_previsto: "Obras de renovación de vías y señalamiento en ramales Tigre (Mitre) y Roca (La Plata/Ezeiza) con cronogramas especiales de fin de semana.",
      por_que: "Clave para comparar el costo y tiempo real de vivir en GBA Norte, Oeste o Sur frente a CABA."
    },
    {
      id: "telepase_ausa",
      nombre: "Peaje Promedio Hora Pico (AUSA / Panamericana / Acceso Oeste)",
      valor_num: 3100,
      unidad: "ARS / pasada",
      fuente_oficial: "AUSA / Corredores Viales / Ausol",
      cambio_futuro_previsto: "Expansión de pórticos Free Flow (sin cabinas manuales, cobro automático por patente/TelePASE) en autopistas porteñas y accesos.",
      por_que: "Se pondera en el presupuesto de usuarios con Auto o Moto que cruzan entre GBA y CABA."
    }
  ],
  alertas_zonal_vial_subte: [
    {
      id: "alerta_subte_b_d_a",
      zona_afectada: "almagro, caballito, villa-crespo, palermo, recoleta, san-telmo, caba",
      categoria: "🚇 Estaciones de Subte / Tren",
      titulo: "Renovación de estaciones en Subte Líneas B, D y A + Pasos bajo nivel Tren Sarmiento",
      detalle: "Obras de puesta en valor y recambio de escaleras/accesos en estaciones seleccionadas de Líneas B, D y A (pueden operar con cierres parciales de andén). En el eje Caballito/Flores/Villa Luro/Ramos Mejía, las barreras del Tren Sarmiento generan demoras viales de 12 a 20 min en hora pico.",
      impacto_viaje_min: 6,
      fuente: "Emova / SBASE / Trenes Argentinos"
    },
    {
      id: "alerta_cortes_centro_congreso",
      zona_afectada: "san-telmo, monserrat, san-nicolas, balvanera, recoleta, retiro, caba",
      categoria: "🚧 Cortadas Típicas de Calles",
      titulo: "Cortes frecuentes en eje Congreso - Av. de Mayo - Obelisco (Av. 9 de Julio y Corrientes)",
      detalle: "Alta frecuencia de manifestaciones, eventos y desvíos de líneas de colectivo/Metrobus entre Plaza de Mayo, Av. 9 de Julio y Congreso (Callao y Rivadavia). El Subte (Líneas A, B, C, D) mantiene servicio subterráneo estable cuando se corta la superficie.",
      impacto_viaje_min: 14,
      fuente: "BA Tránsito / Secretaría de Transporte CABA"
    },
    {
      id: "alerta_acceso_sur_puente_pueyrredon",
      zona_afectada: "avellaneda, lanus, lomas-de-zamora, quilmes, berazategui, almirante-brown, la-plata, zona-sur",
      categoria: "🛣️ Accesos y Rutas (Zona Sur)",
      titulo: "Cuello de botella y cortes en Puente Pueyrredón / Au. Bs.As.-La Plata (Peaje Dock Sud y Hudson)",
      detalle: "El ingreso desde Zona Sur por Puente Pueyrredón y Autopista Bs.As.-La Plata (empalme Au. 25 de Mayo) registra congestión pesada de 7:30 a 10:00 hs y cortes ocasionales en accesos. Alternativa ferroviaria rápida: Tren Roca Eléctrico a Constitución (7 min desde Avellaneda, 14 min desde Lanús).",
      impacto_viaje_min: 15,
      fuente: "AUBASA / Vialidad / Trenes Argentinos Roca"
    },
    {
      id: "alerta_acceso_norte_panamericana",
      zona_afectada: "vicente-lopez, olivos, san-isidro, tigre, san-fernando, pilar, escobar, san-martin, zona-norte",
      categoria: "🛣️ Accesos y Rutas (Zona Norte)",
      titulo: "Congestión pesada en Autopista Panamericana (Empalme Gral. Paz / Márquez / Bifurcación Pilar-Tigre)",
      detalle: "Entre las 7:30 y 9:45 hs (mano a CABA) y 17:30 a 19:45 hs (mano a Provincia), el nodo Panamericana y Av. Gral. Paz presenta demoras de 20 a 35 min. Obras periódicas de repavimentación nocturna. Alternativa estable: Tren Mitre (Retiro) y Metrobus Norte (Av. Maipú).",
      impacto_viaje_min: 12,
      fuente: "Autopistas del Sol (Ausol) / BA Tránsito"
    },
    {
      id: "alerta_acceso_oeste_sarmiento",
      zona_afectada: "ramos-mejia, moron, castelar, ituzaingo, hurlingham, merlo, moreno, caseros, tres-de-febrero, lujan, zona-oeste",
      categoria: "🛣️ Accesos y Rutas (Zona Oeste)",
      titulo: "Embudo en Autopista Acceso Oeste (Peaje Ituzaingó / Haedo / Empalme Av. Gral. Paz y Perito Moreno)",
      detalle: "Reducción de carriles al ingresar a CABA por Au. Perito Moreno / 25 de Mayo genera demoras fuertes en hora pico. En superficie, Av. Rivadavia tiene tránsito lento por semáforos y pasos a nivel del FFCC Sarmiento.",
      impacto_viaje_min: 13,
      fuente: "Acceso Oeste / Vialidad Nacional"
    },
    {
      id: "alerta_rutas_interior_costa",
      zona_afectada: "mar-del-plata, miramar, pinamar, villa-gesell, necochea, tandil, bahia-blanca, chascomus, pba-interior",
      categoria: "🛣️ Rutas Provinciales 2, 11, 226 y RN 3",
      titulo: "Operativos viales y obras en Autovía Ruta 2, Ruta 11 Interbalnearia y RN 226 (Mar del Plata - Miramar - Tandil)",
      detalle: "En temporada alta y fines de semana largos se aplican restricciones de camiones y desvíos en Autovía 2 y RP 11 (corredor Costa Atlántica: Mar del Plata, Miramar, Pinamar, Gesell). En cascos urbanos del interior bonaerense el tránsito diario es fluido (<12 min de punta a punta).",
      impacto_viaje_min: 4,
      fuente: "AUBASA / Vialidad Provincia de Buenos Aires"
    }
  ],
  reportes_usuario: []
};

let CALCULIVING_ZONAL_DB = JSON.parse(JSON.stringify(CALCULIVING_ZONAL_DB_DEFAULT));

function initCalculivingZonalDatabase() {
  try {
    const raw = localStorage.getItem("calculiving_zonal_db_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        CALCULIVING_ZONAL_DB = {
          ...JSON.parse(JSON.stringify(CALCULIVING_ZONAL_DB_DEFAULT)),
          ...parsed
        };
      }
    }
  } catch (e) {
    CALCULIVING_ZONAL_DB = JSON.parse(JSON.stringify(CALCULIVING_ZONAL_DB_DEFAULT));
  }
  syncZonalDbToLiveEconomicState();
}

function saveCalculivingZonalDatabase() {
  try {
    localStorage.setItem("calculiving_zonal_db_v1", JSON.stringify(CALCULIVING_ZONAL_DB));
  } catch (e) {}
  syncZonalDbToLiveEconomicState();
}

function syncZonalDbToLiveEconomicState() {
  const getVal = (id, fallback) => {
    const item = CALCULIVING_ZONAL_DB.monetario_y_combustible?.find(x => x.id === id) ||
                 CALCULIVING_ZONAL_DB.transporte_oficial_y_futuro?.find(x => x.id === id);
    return item && typeof item.valor_num === "number" ? item.valor_num : fallback;
  };
  appState.liveEconomicData.ipcMensualPct = getVal("ipc_indec", 2.7);
  appState.liveEconomicData.naftaSuperLitroArs = getVal("nafta_super_ypf", 1195);
  appState.liveEconomicData.naftaPremiumLitroArs = getVal("nafta_premium_ypf", 1475);
  appState.liveEconomicData.gasoilPremiumLitroArs = getVal("gasoil_premium", 1420);
  appState.liveEconomicData.gncMetroCubicoArs = getVal("gnc_m3", 560);
  appState.liveEconomicData.subeBoletoMinArs = getVal("sube_colectivo", 425);
  appState.liveEconomicData.boletoSubteArs = getVal("subte_emova", 832);
  appState.liveEconomicData.boletoTrenArs = getVal("trenes_amba", 320);
}

// Perfiles de Cilindrada / Motorización para Auto y Moto
const VEHICLE_DISPLACEMENT_PROFILES = {
  auto_10_14: { label: "Auto 1.0L-1.4L (Compacto/Híbrido)", litersPer100Km: 7.2, fuelKey: "naftaSuperLitroArs", fixedMaintArs: 32000 },
  auto_16_18: { label: "Auto 1.6L-1.8L (Mediano Estándar)", litersPer100Km: 9.6, fuelKey: "naftaSuperLitroArs", fixedMaintArs: 38000 },
  auto_20_plus: { label: "Auto 2.0L-2.5L+ (SUV/Turbo Premium)", litersPer100Km: 12.8, fuelKey: "naftaPremiumLitroArs", fixedMaintArs: 52000 },
  auto_pickup: { label: "Pick-up / Utilitario 2.8L+ Diesel", litersPer100Km: 13.5, fuelKey: "gasoilPremiumLitroArs", fixedMaintArs: 58000 },
  auto_gnc: { label: "Auto con Equipo a GNC", litersPer100Km: 8.8, fuelKey: "gncMetroCubicoArs", fixedMaintArs: 29000 },
  moto_110_150: { label: "Moto 110cc a 150cc Urbana", litersPer100Km: 2.5, fuelKey: "naftaSuperLitroArs", fixedMaintArs: 12000 },
  moto_200_300: { label: "Moto 200cc a 300cc Media", litersPer100Km: 3.6, fuelKey: "naftaSuperLitroArs", fixedMaintArs: 16500 },
  moto_400_plus: { label: "Moto 400cc+ Alta Cilindrada", litersPer100Km: 5.2, fuelKey: "naftaPremiumLitroArs", fixedMaintArs: 24000 }
};

const ALL_BUENOS_AIRES_ZONES_CATALOG = [
  // 48 Barrios de CABA
  "Agronomía (CABA)", "Almagro (CABA)", "Balvanera (CABA)", "Barracas (CABA)", "Belgrano (CABA)",
  "Boedo (CABA)", "Caballito (CABA)", "Chacarita (CABA)", "Coghlan (CABA)", "Colegiales (CABA)",
  "Constitución (CABA)", "Flores (CABA)", "Floresta (CABA)", "La Boca (CABA)", "La Paternal (CABA)",
  "Liniers (CABA)", "Mataderos (CABA)", "Monte Castro (CABA)", "Monserrat (CABA)", "Nueva Pompeya (CABA)",
  "Núñez (CABA)", "Palermo (CABA)", "Parque Avellaneda (CABA)", "Parque Chacabuco (CABA)", "Parque Chas (CABA)",
  "Parque Patricios (CABA)", "Puerto Madero (CABA)", "Recoleta (CABA)", "Retiro (CABA)", "Saavedra (CABA)",
  "San Cristóbal (CABA)", "San Nicolás (CABA)", "San Telmo (CABA)", "Vélez Sársfield (CABA)", "Versalles (CABA)",
  "Villa Crespo (CABA)", "Villa del Parque (CABA)", "Villa Devoto (CABA)", "Villa General Mitre (CABA)", "Villa Lugano (CABA)",
  "Villa Luro (CABA)", "Villa Ortúzar (CABA)", "Villa Pueyrredón (CABA)", "Villa Real (CABA)", "Villa Riachuelo (CABA)",
  "Villa Santa Rita (CABA)", "Villa Soldati (CABA)", "Villa Urquiza (CABA)",
  // GBA Zona Norte
  "Vicente López", "Olivos", "Florida", "La Lucila", "Munro", "Villa Martelli",
  "San Isidro", "Martínez", "Acassuso", "Beccar", "Boulogne",
  "San Fernando", "Victoria", "Virreyes",
  "Tigre", "General Pacheco", "Don Torcuato", "Nordelta", "Benavídez",
  "San Martín", "Villa Ballester", "San Andrés",
  "San Miguel", "Muñiz", "Bella Vista", "Malvinas Argentinas", "Los Polvorines", "José C. Paz",
  "Pilar", "Del Viso", "Escobar", "Belén de Escobar", "Ingeniero Maschwitz", "Garín",
  // GBA Zona Oeste
  "Tres de Febrero", "Caseros", "Santos Lugares", "Ciudad Jardín", "Sáenz Peña",
  "La Matanza", "Ramos Mejía", "San Justo", "Ciudad Evita", "Lomas del Mirador", "Tapiales", "Isidro Casanova", "Gregorio de Laferrere",
  "Morón", "Haedo", "Castelar", "El Palomar",
  "Hurlingham", "Villa Tesei", "William Morris",
  "Ituzaingó", "Parque Leloir",
  "Merlo", "San Antonio de Padua", "Moreno", "Paso del Rey", "General Rodríguez", "Marcos Paz",
  // GBA Zona Sur
  "Avellaneda", "Wilde", "Sarandí", "Piñeyro", "Dock Sud",
  "Lanús", "Remedios de Escalada", "Valentín Alsina", "Gerli", "Monte Chingolo",
  "Lomas de Zamora", "Banfield", "Temperley", "Llavallol",
  "Almirante Brown", "Adrogué", "Burzaco", "Rafael Calzada", "Longchamps", "Glew",
  "Quilmes", "Bernal", "Don Bosco", "Ezpeleta", "Solano",
  "Berazategui", "Ranelagh", "Hudson", "Florencio Varela",
  "Esteban Echeverría", "Monte Grande", "Canning", "Ezeiza", "Tristán Suárez", "Presidente Perón", "Guernica", "San Vicente", "Cañuelas",
  // Gran La Plata
  "La Plata", "City Bell", "Manuel B. Gonnet", "Tolosa", "Ringuelet", "Los Hornos", "Berisso", "Ensenada",
  // Interior de la Provincia de Buenos Aires (135 Municipios / Ciudades principales)
  "Miramar (General Alvarado)", "Mar del Plata (General Pueyrredón)", "Bahía Blanca", "Tandil", "Olavarría", "Junín", "Pergamino",
  "San Nicolás de los Arroyos", "Zárate", "Campana", "Luján", "Mercedes", "Chivilcoy", "Chacabuco",
  "Chascomús", "Dolores", "Pinamar", "Villa Gesell", "Partido de La Costa (San Bernardo / Mar de Ajó / Santa Teresita)",
  "Necochea", "Balcarce", "Azul", "Tres Arroyos", "Coronel Suárez",
  "Trenque Lauquen", "Pehuajó", "9 de Julio", "Bragado", "Lincoln", "San Pedro", "Baradero", "Ramallo",
  "Arrecifes", "Salto", "Rojas", "Colón", "San Antonio de Areco", "Exaltación de la Cruz (Capilla del Señor)",
  "Carmen de Areco", "San Andrés de Giles", "Lobos", "Navarro", "Monte (San Miguel del Monte)", "Brandsen",
  "Magdalena", "Punta Indio", "Castelli", "Lezama", "General Belgrano", "Las Flores", "Rauch", "Ayacucho",
  "Maipú", "General Madariaga", "Mar Chiquita (Santa Clara del Mar)", "Lobería", "San Cayetano", "Benito Juárez", "Gonzales Chaves",
  "Coronel Pringles", "Coronel Dorrego", "Monte Hermoso", "Coronel Rosales (Punta Alta)", "Villarino",
  "Patagones (Carmen de Patagones)", "Tornquist (Sierra de la Ventana)", "Saavedra (Pigüé)", "Puán",
  "Adolfo Alsina (Carhué)", "Guaminí", "Daireaux", "Bolívar", "Hipólito Yrigoyen (Henderson)", "Carlos Casares",
  "Carlos Tejedor", "General Villegas", "Rivadavia (América)", "Florentino Ameghino", "General Pinto",
  "Leandro N. Alem (Vedia)", "General Arenales", "General Viamonte (Los Toldos)", "25 de Mayo", "Saladillo",
  "Roque Pérez", "General Alvear", "Tapalqué", "General La Madrid", "Laprida", "Pellegrini", "Tres Lomas", "Salliqueló", "Suipacha"
];

function populateBuenosAiresAllZonesDatalist() {
  const dl = document.getElementById("buenos-aires-all-zones-datalist");
  if (!dl) return;
  dl.innerHTML = ALL_BUENOS_AIRES_ZONES_CATALOG
    .map(name => `<option value="${escapeHtml(name)}"></option>`)
    .join("");
}

// Consulta en vivo el último índice IPC (INDEC) y cotizaciones desde ArgentinaDatos API y sincroniza con nuestra Base de Datos Propia
async function fetchLiveEconomicIndicators() {
  populateBuenosAiresAllZonesDatalist();
  const badgeChat = document.getElementById("live-inflation-badge");
  const badgeMap = document.getElementById("map-live-econ-text");

  try {
    const res = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion", {
      headers: { "Accept": "application/json" }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const latest = data[data.length - 1];
        const prev = data.length > 1 ? data[data.length - 2] : latest;
        const ipcVal = typeof latest.valor === "number" ? latest.valor : parseFloat(latest.valor) || 2.7;
        const ipcDate = latest.fecha || "Último corte oficial INDEC";

        appState.liveEconomicData.ipcMensualPct = ipcVal;
        appState.liveEconomicData.ipcFecha = ipcDate;
        appState.liveEconomicData.sourceLabel = `INDEC IPC (${ipcDate}: ${ipcVal.toFixed(1)}% mensual | Ant: ${(parseFloat(prev.valor) || ipcVal).toFixed(1)}%)`;
        appState.liveEconomicData.lastUpdated = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

        const ipcItem = CALCULIVING_ZONAL_DB.monetario_y_combustible?.find(x => x.id === "ipc_indec");
        if (ipcItem && !ipcItem.userOverridden) {
          ipcItem.valor_num = ipcVal;
          ipcItem.fuente_oficial = `INDEC Oficial (${ipcDate}) sincronizado en vivo`;
        }
        CALCULIVING_ZONAL_DB.lastSyncTimestamp = `Actualizado hoy ${appState.liveEconomicData.lastUpdated} con API INDEC ArgentinaDatos`;
        saveCalculivingZonalDatabase();
      }
    }
  } catch (err) {
    // Si está sin conexión o bloquea CORS, mantiene los valores de la base de datos local
  }

  syncZonalDbToLiveEconomicState();
  const econ = appState.liveEconomicData;
  const summaryText = `📡 Datos al día (${econ.sourceLabel}) · Nafta Súper: $${econ.naftaSuperLitroArs.toLocaleString("es-AR")}/L · SUBE: $${econ.subeBoletoMinArs}`;
  if (badgeChat) badgeChat.textContent = summaryText;
  if (badgeMap) badgeMap.textContent = summaryText;
}

// Consulta en vivo OpenStreetMap Overpass API cuando el usuario marca una zona en el mapa para detectar comercios y supermercados reales de esa zona
async function fetchLiveStoresInZoneFromOSM(zone) {
  if (!zone || !zone.coords || zone.coords.length < 3 || zone.liveOsmStoresFetched) return;
  zone.liveOsmStoresFetched = true;

  try {
    const [cLat, cLng] = getZoneCenter(zone);
    const overpassQuery = `[out:json][timeout:6];(node["shop"~"supermarket|convenience|bakery|butcher|greengrocer"](around:950,${cLat},${cLng}););out body 18;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    if (data && Array.isArray(data.elements) && data.elements.length > 0) {
      const names = [];
      data.elements.forEach(el => {
        const n = el.tags?.name || el.tags?.brand;
        if (n && !names.includes(n)) names.push(n);
      });
      if (names.length > 0) {
        zone.liveDetectedStoreNames = names.slice(0, 10);
        if (selectedZoneForDeepDive && selectedZoneForDeepDive.id === zone.id && appState.currentScreen === "screen-resultados") {
          renderFocusedZoneDeepDive(zone);
        }
      }
    }
  } catch (err) {
    // Fallback silencioso
  }
}

const SUPERMARKET_CHAINS_INFO = {
  dia: { id: "dia", label: "Supermercados Día", mult: 0.84, badge: "-16% vs prom." },
  coto: { id: "coto", label: "Coto", mult: 0.96, badge: "-4% vs prom." },
  carrefour: { id: "carrefour", label: "Carrefour / Market", mult: 1.00, badge: "Precio promedio" },
  jumbo: { id: "jumbo", label: "Jumbo / Disco / Vea", mult: 1.15, badge: "+15% vs prom." },
  mayorista: { id: "mayorista", label: "Mayorista / Barrio", mult: 0.80, badge: "-20% vs prom." }
};

const HOBBY_POI_META = {
  gimnasio: { label: "🏋️ Mi Gimnasio / Entrenamiento", defaultAddress: "Parque Centenario, CABA", defaultLat: -34.6065, defaultLng: -58.4355 },
  club_deporte: { label: "⚽ Mi Club / Deporte", defaultAddress: "Av. del Libertador 7300, Núñez", defaultLat: -34.5455, defaultLng: -58.4585 },
  salidas_cafe: { label: "☕ Salidas / Cafés Frecuentes", defaultAddress: "Plaza Serrano, Palermo", defaultLat: -34.5885, defaultLng: -58.4305 },
  cursos_arte: { label: "🎨 Clases / Curso / Estudio", defaultAddress: "Av. Corrientes 2000, CABA", defaultLat: -34.6042, defaultLng: -58.3960 }
};

function updateVehicleDisplacementUI() {
  const trEl = document.getElementById("habit-transport-mode");
  const wrap = document.getElementById("habit-vehicle-displacement-wrap");
  const dispSel = document.getElementById("habit-vehicle-displacement");
  const hint = document.getElementById("habit-vehicle-consumption-hint");
  if (!trEl || !wrap || !dispSel) return;

  const mode = trEl.value;
  if (mode === "auto_nafta" || mode === "moto") {
    wrap.style.display = "block";
    const autoGroup = document.getElementById("optgroup-disp-auto");
    const motoGroup = document.getElementById("optgroup-disp-moto");
    if (mode === "auto_nafta") {
      if (autoGroup) autoGroup.disabled = false;
      if (motoGroup) motoGroup.disabled = true;
      if (!dispSel.value.startsWith("auto_")) {
        dispSel.value = "auto_16_18";
      }
    } else {
      if (autoGroup) autoGroup.disabled = true;
      if (motoGroup) motoGroup.disabled = false;
      if (!dispSel.value.startsWith("moto_")) {
        dispSel.value = "moto_110_150";
      }
    }
    const prof = VEHICLE_DISPLACEMENT_PROFILES[dispSel.value];
    if (hint && prof) {
      const fuelPrice = appState.liveEconomicData[prof.fuelKey] || 1195;
      hint.textContent = `Consumo estimado: ~${prof.litersPer100Km} L/100km ($${fuelPrice.toLocaleString("es-AR")}/unidad hoy en Base de Datos).`;
    }
  } else {
    wrap.style.display = "none";
  }
}

// Auto-crea y sincroniza Puntos de Interés en el mapa en el momento mismo en que el usuario marca un deporte o hobby en su rutina
function syncHobbyPoisWithMap() {
  const checkedHobbies = Array.from(document.querySelectorAll(".habit-hobby-cb:checked")).map(cb => cb.value);
  appState.lifestyleProfile.hobbies = checkedHobbies;

  // 1. Quitar los POIs auto-creados de hobbies que el usuario haya desmarcado
  appState.pois = appState.pois.filter(p => !p.hobbyKey || checkedHobbies.includes(p.hobbyKey));

  // 2. Crear inmediatamente el POI en el mapa para cada hobby/deporte marcado si todavía no existe
  checkedHobbies.forEach(hKey => {
    const meta = HOBBY_POI_META[hKey];
    if (!meta) return;
    let existing = appState.pois.find(p => p.hobbyKey === hKey);
    if (!existing) {
      const savedLoc = appState.lifestyleProfile.hobbyLocations?.[hKey] || meta.defaultAddress;
      const nextIdx = appState.pois.length;
      const nextCode = String.fromCharCode(65 + (nextIdx % 26));
      const color = POI_PALETTE[nextIdx % POI_PALETTE.length];
      existing = {
        id: `poi-hobby-${hKey}`,
        hobbyKey: hKey,
        code: nextCode,
        label: meta.label,
        address: savedLoc,
        lat: meta.defaultLat,
        lng: meta.defaultLng,
        color
      };
      appState.pois.push(existing);
    }
  });

  reindexPois();
  renderHobbyPoiAutocreateControls();
  renderPoisSidebarList();
  renderPoisOnLeafletMap();
  updateSortPoisSelectOptions();
}

function renderHobbyPoiAutocreateControls() {
  const box = document.getElementById("habit-hobbies-poi-autocreate-box");
  if (!box) return;

  const hobbyPois = appState.pois.filter(p => Boolean(p.hobbyKey));
  if (hobbyPois.length === 0) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  box.style.display = "flex";
  box.innerHTML = `
    <div style="font-size:0.72rem; font-weight:800; color:#34d399;">
      📍 Puntos de Interés creados automáticamente para el mapa (podés indicar acá la dirección/barrio o correr el pin en el mapa):
    </div>
    ${hobbyPois.map(poi => `
      <div style="display:flex; align-items:center; gap:0.35rem; background:rgba(15,23,42,0.75); padding:0.35rem 0.5rem; border-radius:6px; border:1px solid ${poi.color}; flex-wrap:wrap;">
        <span style="background:${poi.color}; color:#fff; width:20px; height:20px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:0.68rem; font-weight:900; flex-shrink:0;">
          ${escapeHtml(poi.code)}
        </span>
        <strong style="font-size:0.73rem; color:#fff; min-width:135px;">${escapeHtml(poi.label)}:</strong>
        <input type="text" class="salary-input hobby-poi-inline-addr" data-hobby-key="${poi.hobbyKey}" value="${escapeHtml(poi.address)}"
          placeholder="Dirección, club o localidad (ej: Caballito, Miramar, Núñez)..."
          style="flex:1; min-width:160px; font-size:0.72rem; padding:0.25rem 0.45rem;" autocomplete="off" />
        <button type="button" class="btn-sm btn-primary hobby-poi-locate-btn" data-hobby-key="${poi.hobbyKey}" style="font-size:0.68rem; padding:0.22rem 0.5rem;">
          📍 Ubicar punto
        </button>
      </div>
    `).join("")}
  `;

  box.querySelectorAll(".hobby-poi-locate-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const hKey = btn.getAttribute("data-hobby-key");
      const inp = box.querySelector(`.hobby-poi-inline-addr[data-hobby-key="${hKey}"]`);
      const poi = appState.pois.find(p => p.hobbyKey === hKey);
      if (!poi || !inp) return;
      const rawAddr = inp.value.trim();
      if (!rawAddr) return;
      btn.textContent = "⏳";
      const geo = await geocodeAddressInCaba(rawAddr);
      btn.textContent = "✓ Ubicado";
      setTimeout(() => { btn.textContent = "📍 Ubicar punto"; }, 1200);
      if (geo) {
        poi.lat = geo.lat;
        poi.lng = geo.lng;
        poi.address = geo.formatted;
        appState.lifestyleProfile.hobbyLocations[hKey] = geo.formatted;
        renderPoisSidebarList();
        renderPoisOnLeafletMap();
      }
    });
  });

  box.querySelectorAll(".hobby-poi-inline-addr").forEach(inp => {
    inp.addEventListener("change", async () => {
      const hKey = inp.getAttribute("data-hobby-key");
      const poi = appState.pois.find(p => p.hobbyKey === hKey);
      const rawAddr = inp.value.trim();
      if (!poi || !rawAddr) return;
      appState.lifestyleProfile.hobbyLocations[hKey] = rawAddr;
      poi.address = rawAddr;
      const geo = await geocodeAddressInCaba(rawAddr);
      if (geo) {
        poi.lat = geo.lat;
        poi.lng = geo.lng;
        poi.address = geo.formatted;
      }
      renderPoisSidebarList();
      renderPoisOnLeafletMap();
    });
  });
}

function syncLifestyleProfileFromDOM() {
  const lp = appState.lifestyleProfile;
  const transportEl = document.getElementById("habit-transport-mode");
  const dispEl = document.getElementById("habit-vehicle-displacement");
  const cookingEl = document.getElementById("habit-cooking-mode");
  const dietEl = document.getElementById("habit-diet-type");

  if (transportEl) lp.transportMode = transportEl.value;
  updateVehicleDisplacementUI();
  if (dispEl) lp.vehicleDisplacement = dispEl.value;
  if (cookingEl) lp.cookingHabit = cookingEl.value;
  if (dietEl) lp.dietType = dietEl.value;

  syncHobbyPoisWithMap();

  const supers = Array.from(document.querySelectorAll(".habit-supermarket-cb:checked")).map(cb => cb.value);
  lp.selectedSupermarkets = supers.length > 0 ? supers : ["carrefour"];

  const prioRadio = document.querySelector('input[name="habit-priority-ranking"]:checked');
  if (prioRadio) lp.rankingPriority = prioRadio.value;

  renderMapConvenienceRanking();
  if (leafletMap && zonesLayerGroup) {
    renderAffordabilityZonesOnMap();
  }
}

function setupLifestyleMiniChat() {
  const sendBtn = document.getElementById("lifestyle-mini-chat-send") || document.getElementById("btn-lifestyle-mini-chat-send");
  const chatInput = document.getElementById("lifestyle-mini-chat-input");
  const chatThread = document.getElementById("lifestyle-mini-chat-thread");

  // Sincronizar cambios en los selectores interactivos de la 2da conversación
  document.getElementById("habit-transport-mode")?.addEventListener("change", syncLifestyleProfileFromDOM);
  document.getElementById("habit-vehicle-displacement")?.addEventListener("change", syncLifestyleProfileFromDOM);
  document.getElementById("habit-cooking-mode")?.addEventListener("change", syncLifestyleProfileFromDOM);
  document.getElementById("habit-diet-type")?.addEventListener("change", syncLifestyleProfileFromDOM);
  document.querySelectorAll(".habit-hobby-cb, .habit-supermarket-cb, input[name='habit-priority-ranking']").forEach(el => {
    el.addEventListener("change", syncLifestyleProfileFromDOM);
  });

  const handleMiniChatTurn = () => {
    const raw = (chatInput?.value || "").trim();
    if (!raw) return;
    if (chatInput) chatInput.value = "";

    if (chatThread) {
      const uMsg = document.createElement("div");
      uMsg.className = "chat-msg user";
      uMsg.innerHTML = `<div class="avatar">👤</div><div class="chat-bubble-content">${escapeHtml(raw)}</div>`;
      chatThread.appendChild(uMsg);
    }

    const low = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const detectedChanges = [];

    // Detectar movilidad y cilindrada (auto o moto)
    const trEl = document.getElementById("habit-transport-mode");
    const dispEl = document.getElementById("habit-vehicle-displacement");
    if (low.includes("auto") || low.includes("nafta") || low.includes("manejo") || low.includes("coche") || low.includes("camioneta") || low.includes("gnc")) {
      if (trEl) trEl.value = "auto_nafta";
      updateVehicleDisplacementUI();
      if (low.includes("gnc")) {
        if (dispEl) dispEl.value = "auto_gnc";
      } else if (low.includes("2.0") || low.includes("2.4") || low.includes("2.5") || low.includes("suv") || low.includes("grande")) {
        if (dispEl) dispEl.value = "auto_20_plus";
      } else if (low.includes("pickup") || low.includes("camioneta") || low.includes("hilux") || low.includes("amarok") || low.includes("ranger")) {
        if (dispEl) dispEl.value = "auto_pickup";
      } else if (low.includes("1.0") || low.includes("1.2") || low.includes("1.4") || low.includes("chico") || low.includes("hibrido")) {
        if (dispEl) dispEl.value = "auto_10_14";
      } else {
        if (dispEl) dispEl.value = "auto_16_18";
      }
      const p = VEHICLE_DISPLACEMENT_PROFILES[dispEl?.value || "auto_16_18"];
      detectedChanges.push(`🚗 Movilidad: ${p ? p.label : "Auto propio"} (~${p ? p.litersPer100Km : 9.6}L/100km)`);
    } else if (low.includes("moto") || /\b(110|125|150|200|250|300|400|500|600)\s*cc\b/.test(low)) {
      if (trEl) trEl.value = "moto";
      updateVehicleDisplacementUI();
      if (/\b(400|450|500|600|650|750|1000)\s*cc\b/.test(low) || low.includes("grande") || low.includes("alta cilindrada")) {
        if (dispEl) dispEl.value = "moto_400_plus";
      } else if (/\b(200|250|300)\s*cc\b/.test(low)) {
        if (dispEl) dispEl.value = "moto_200_300";
      } else {
        if (dispEl) dispEl.value = "moto_110_150";
      }
      const p = VEHICLE_DISPLACEMENT_PROFILES[dispEl?.value || "moto_110_150"];
      detectedChanges.push(`🛵 Movilidad: ${p ? p.label : "Moto propia"} (~${p ? p.litersPer100Km : 2.5}L/100km)`);
    } else if (low.includes("bici") || low.includes("caminando") || low.includes("pie")) {
      if (trEl) trEl.value = "bici_pie";
      detectedChanges.push("🚲 Movilidad: Bicicleta / Caminando");
    } else if (low.includes("uber") || low.includes("cabify") || low.includes("didi")) {
      if (trEl) trEl.value = "apps_mix";
      detectedChanges.push("🚕 Movilidad: Mix Transporte Público + Apps");
    } else if (low.includes("sube") || low.includes("colectivo") || low.includes("subte") || low.includes("tren")) {
      if (trEl) trEl.value = "sube";
      detectedChanges.push("🚇 Movilidad: Transporte público SUBE");
    }

    // Detectar cocina vs delivery
    const ckEl = document.getElementById("habit-cooking-mode");
    if (low.includes("delivery") || low.includes("pido comida") || low.includes("pedir comida") || low.includes("pedidosya") || low.includes("rappi")) {
      if (ckEl) ckEl.value = "delivery";
      detectedChanges.push("🛵 Alimentación: Frecuente por delivery / locales gastronómicos");
    } else if (low.includes("cocino") || low.includes("cocinar") || low.includes("casero")) {
      if (ckEl) ckEl.value = "cocino";
      detectedChanges.push("🍳 Alimentación: Cocino casi siempre en casa");
    } else if (low.includes("mitad") || low.includes("mix")) {
      if (ckEl) ckEl.value = "mix";
      detectedChanges.push("🥘 Alimentación: Mitad cocino y mitad pido/salgo");
    }

    // Detectar dieta
    const dtEl = document.getElementById("habit-diet-type");
    if (low.includes("proteica") || low.includes("proteina") || low.includes("carne")) {
      if (dtEl) dtEl.value = "proteica";
      detectedChanges.push("🥩 Dieta: Alta en proteínas / deportista");
    } else if (low.includes("veggie") || low.includes("vegetari") || low.includes("vegan") || low.includes("saludable")) {
      if (dtEl) dtEl.value = "saludable";
      detectedChanges.push("🥗 Dieta: Saludable / Veggie");
    } else if (low.includes("ahorro") || low.includes("economica") || low.includes("barato")) {
      if (dtEl) dtEl.value = "economica";
      detectedChanges.push("🥖 Dieta: Económica / Ahorro");
    }

    // Detectar supermercados específicos (ej: "no compro en jumbo o coto y solo en dia")
    const mentionsDia = /\bdia\b/.test(low);
    const mentionsCoto = /\bcoto\b/.test(low);
    const mentionsCarrefour = /\bcarrefour\b/.test(low);
    const mentionsJumbo = /\bjumbo\b|\bdisco\b|\bvea\b/.test(low);
    const mentionsMayorista = /\bmayorista\b|\bchino\b|\bvital\b|\bdiarco\b/.test(low);

    if (mentionsDia || mentionsCoto || mentionsCarrefour || mentionsJumbo || mentionsMayorista) {
      if (low.includes("solo en dia") || (mentionsDia && (low.includes("no compro en") || low.includes("ni coto") || low.includes("ni jumbo")))) {
        document.querySelectorAll(".habit-supermarket-cb").forEach(cb => {
          cb.checked = (cb.value === "dia");
        });
        detectedChanges.push("🛒 Supermercados: Ajustado exclusivamente a <strong>Día</strong> (-16% en tu canasta mensual)");
      } else {
        const chosen = [];
        if (mentionsDia && !low.includes("no compro en dia") && !low.includes("ni dia")) chosen.push("dia");
        if (mentionsCoto && !low.includes("no compro en coto") && !low.includes("ni coto")) chosen.push("coto");
        if (mentionsCarrefour && !low.includes("no compro en carrefour") && !low.includes("ni carrefour")) chosen.push("carrefour");
        if (mentionsJumbo && !low.includes("no compro en jumbo") && !low.includes("ni jumbo")) chosen.push("jumbo");
        if (mentionsMayorista) chosen.push("mayorista");
        if (chosen.length > 0) {
          document.querySelectorAll(".habit-supermarket-cb").forEach(cb => {
            cb.checked = chosen.includes(cb.value);
          });
          detectedChanges.push(`🛒 Supermercados activos: ${chosen.map(c => SUPERMARKET_CHAINS_INFO[c]?.label || c).join(", ")}`);
        }
      }
    }

    // Detectar gimnasio / deporte / hobbies y auto-crear su Punto de Interés en el mapa
    if (low.includes("gimnasio") || low.includes("gym") || low.includes("entreno") || low.includes("crossfit") || low.includes("pilates")) {
      const gymCb = document.querySelector('.habit-hobby-cb[value="gimnasio"]');
      if (gymCb) gymCb.checked = true;
      detectedChanges.push("🏋️ Rutina: Gimnasio / Crossfit (<strong>creamos automáticamente su Punto de Interés en el mapa</strong> para que puedas ubicarlo o correrlo)");
    }
    if (low.includes("deporte") || low.includes("futbol") || low.includes("tenis") || low.includes("padel") || low.includes("club") || low.includes("natacion") || low.includes("rugby") || low.includes("basquet") || low.includes("hockey") || low.includes("correr")) {
      const clubCb = document.querySelector('.habit-hobby-cb[value="club_deporte"]');
      if (clubCb) clubCb.checked = true;
      detectedChanges.push("⚽ Rutina: Deporte / Club (<strong>creamos automáticamente su Punto de Interés en el mapa</strong> para que puedas ubicarlo o correrlo)");
    }
    if (low.includes("cafe") || low.includes("bares") || low.includes("cine") || low.includes("salir") || low.includes("teatro")) {
      const cafeCb = document.querySelector('.habit-hobby-cb[value="salidas_cafe"]');
      if (cafeCb) cafeCb.checked = true;
      detectedChanges.push("☕ Hobby activo: Salidas / Cafeterías (Punto creado en el mapa)");
    }
    if (low.includes("curso") || low.includes("idioma") || low.includes("musica") || low.includes("clases") || low.includes("arte")) {
      const arteCb = document.querySelector('.habit-hobby-cb[value="cursos_arte"]');
      if (arteCb) arteCb.checked = true;
      detectedChanges.push("🎨 Hobby activo: Clases / Cursos (Punto creado en el mapa)");
    }

    // Detectar prioridad de ranking
    if (low.includes("menos tiempo") || low.includes("viajar menos") || low.includes("cerca")) {
      const r = document.querySelector('input[name="habit-priority-ranking"][value="menos_viaje"]');
      if (r) r.checked = true;
      detectedChanges.push("⏱️ Ranking priorizado por: <strong>Menos tiempo en viaje</strong>");
    } else if (low.includes("menos gasto") || low.includes("mas barato") || low.includes("ahorrar")) {
      const r = document.querySelector('input[name="habit-priority-ranking"][value="menos_gasto"]');
      if (r) r.checked = true;
      detectedChanges.push("💰 Ranking priorizado por: <strong>Menos gasto mensual total</strong>");
    } else if (low.includes("todos los lugares") || low.includes("equilibrio") || low.includes("frecuento")) {
      const r = document.querySelector('input[name="habit-priority-ranking"][value="equilibrio_frecuentes"]');
      if (r) r.checked = true;
      detectedChanges.push("🎯 Ranking priorizado por: <strong>Mejor lugar para todos los sitios que frecuentás</strong>");
    }

    syncLifestyleProfileFromDOM();

    if (chatThread) {
      const bMsg = document.createElement("div");
      bMsg.className = "chat-msg bot";
      const innerHtml = detectedChanges.length > 0
        ? `¡Perfecto! Actualicé tu perfil y tus puntos para el mapa:<br>• ${detectedChanges.join("<br>• ")}<br><span style="font-size:0.75rem; color:#38bdf8;">Fijate en la tarjeta 3 que ya podés ajustar la ubicación de tus puntos o tocar <strong>Ir al Mapa Limpio de Buenos Aires →</strong>.</span>`
        : `Anotado. Tus preferencias quedaron guardadas para armar el ranking de conveniencia y calcular tu costo de vida real cuando elijas tus zonas en el mapa.`;
      bMsg.innerHTML = `<div class="avatar">🤖</div><div class="chat-bubble-content" style="font-size:0.82rem;">${innerHtml}</div>`;
      chatThread.appendChild(bMsg);
      chatThread.scrollTop = chatThread.scrollHeight;
    }
  };

  sendBtn?.addEventListener("click", handleMiniChatTurn);
  chatInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleMiniChatTurn();
    }
  });
}

/* ----------------------------------------------------
   MODAL INTERACTIVO DE BASE DE DATOS PROPIA Y REPORTE DE DATOS OBSOLETOS
---------------------------------------------------- */
function setupZonalDatabaseModal() {
  document.getElementById("btn-open-zonal-db-from-chat")?.addEventListener("click", () => openZonalDatabaseModal());
  document.getElementById("btn-open-zonal-db-from-map")?.addEventListener("click", () => openZonalDatabaseModal());
  document.getElementById("btn-refresh-live-econ")?.addEventListener("click", async () => {
    await fetchLiveEconomicIndicators();
    renderAffordabilityZonesOnMap();
  });
  document.getElementById("close-zonal-db-modal-btn")?.addEventListener("click", () => {
    document.getElementById("zonal-database-modal")?.classList.remove("open");
  });
  document.getElementById("btn-sync-zonal-db-live")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-sync-zonal-db-live");
    if (btn) btn.textContent = "⏳ Consultando APIs oficiales...";
    await fetchLiveEconomicIndicators();
    if (btn) btn.textContent = "✓ Sincronizado al día";
    setTimeout(() => {
      if (btn) btn.textContent = "🔄 Sincronizar con Sitios Oficiales Ahora";
    }, 1500);
    openZonalDatabaseModal();
  });
}

function openZonalDatabaseModal(preselectReportTarget = "") {
  const modal = document.getElementById("zonal-database-modal");
  const body = document.getElementById("zonal-database-modal-body");
  if (!modal || !body) return;

  const monRows = (CALCULIVING_ZONAL_DB.monetario_y_combustible || []).map(item => `
    <tr>
      <td>
        <strong style="color:#fff;">${escapeHtml(item.nombre)}</strong>
        <div style="font-size:0.68rem; color:#38bdf8;">Fuente: ${escapeHtml(item.fuente_oficial)}</div>
      </td>
      <td style="font-weight:800; color:#34d399; white-space:nowrap;">
        ${item.unidad.includes("ARS") ? "$" : ""}${item.valor_num.toLocaleString("es-AR")} ${escapeHtml(item.unidad)}
        ${item.userOverridden ? `<span style="display:block; font-size:0.63rem; color:#facc15;">✏️ Actualizado por usuario</span>` : ""}
      </td>
      <td style="font-size:0.72rem; color:var(--text-secondary);">${escapeHtml(item.por_que)}</td>
      <td style="text-align:right;">
        <button type="button" class="btn-sm btn-secondary db-flag-item-btn" data-item-id="${escapeHtml(item.id)}" data-item-name="${escapeHtml(item.nombre)}" data-item-val="${item.valor_num}" style="font-size:0.66rem; padding:0.2rem 0.45rem; color:#fde68a; border-color:rgba(245,158,11,0.5);">
          ⚠️ Avisar obsoleto / Editar
        </button>
      </td>
    </tr>
  `).join("");

  const trRows = (CALCULIVING_ZONAL_DB.transporte_oficial_y_futuro || []).map(item => `
    <tr>
      <td>
        <strong style="color:#fff;">${escapeHtml(item.nombre)}</strong>
        <div style="font-size:0.68rem; color:#38bdf8;">Fuente: ${escapeHtml(item.fuente_oficial)}</div>
      </td>
      <td style="font-weight:800; color:#34d399; white-space:nowrap;">
        $${item.valor_num.toLocaleString("es-AR")} <span style="font-size:0.68rem; color:#94a3b8;">(${escapeHtml(item.unidad)})</span>
        ${item.userOverridden ? `<span style="display:block; font-size:0.63rem; color:#facc15;">✏️ Actualizado por usuario</span>` : ""}
      </td>
      <td style="font-size:0.71rem; color:var(--text-secondary);">
        <div><strong style="color:#bae6fd;">Por qué:</strong> ${escapeHtml(item.por_que)}</div>
        <div style="margin-top:2px; color:#fde68a;">🔮 <strong>Cambio a futuro / Obra oficial:</strong> ${escapeHtml(item.cambio_futuro_previsto)}</div>
      </td>
      <td style="text-align:right;">
        <button type="button" class="btn-sm btn-secondary db-flag-item-btn" data-item-id="${escapeHtml(item.id)}" data-item-name="${escapeHtml(item.nombre)}" data-item-val="${item.valor_num}" style="font-size:0.66rem; padding:0.2rem 0.45rem; color:#fde68a; border-color:rgba(245,158,11,0.5);">
          ⚠️ Avisar obsoleto / Editar
        </button>
      </td>
    </tr>
  `).join("");

  const alertRows = (CALCULIVING_ZONAL_DB.alertas_zonal_vial_subte || []).map(al => `
    <div style="background:var(--bg-primary); border-left:3.5px solid #f59e0b; border:1px solid var(--card-border); border-radius:6px; padding:0.6rem 0.75rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem;">
        <strong style="color:#fff; font-size:0.78rem;">${escapeHtml(al.categoria)} · ${escapeHtml(al.titulo)}</strong>
        <span style="font-size:0.67rem; background:rgba(245,158,11,0.18); color:#fde68a; padding:2px 6px; border-radius:999px; font-weight:700;">
          +${al.impacto_viaje_min || 5} min demora típica · Fuente: ${escapeHtml(al.fuente)}
        </span>
      </div>
      <p style="font-size:0.73rem; color:var(--text-secondary); margin-top:0.25rem;">${escapeHtml(al.detalle)}</p>
    </div>
  `).join("");

  const userReportsHtml = (CALCULIVING_ZONAL_DB.reportes_usuario && CALCULIVING_ZONAL_DB.reportes_usuario.length > 0)
    ? `<div style="margin-top:0.75rem; padding:0.6rem; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.4); border-radius:6px;">
         <div style="font-size:0.74rem; font-weight:800; color:#34d399; margin-bottom:0.3rem;">✓ Correcciones y Alertas cargadas por vos en tu Base de Datos:</div>
         ${CALCULIVING_ZONAL_DB.reportes_usuario.map(r => `<div style="font-size:0.71rem; color:#d1fae5;">• <strong>[${escapeHtml(r.fecha)}] ${escapeHtml(r.item)}:</strong> ${escapeHtml(r.detalle)}</div>`).join("")}
       </div>`
    : "";

  body.innerHTML = `
    <div style="background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.4); border-radius:6px; padding:0.65rem 0.8rem; margin-bottom:0.9rem; font-size:0.75rem; color:#e2e8f0;">
      📌 <strong>¿Por qué usamos esta Base de Datos Propia?</strong> Calculiving almacena y actualiza en tiempo real los índices monetarios (IPC INDEC), precios de nafta/GNC en surtidor, boletos SUBE/Subte/Tren, valores de alquileres y expensas zonales, y alertas de <strong>obras en estaciones de subte/tren, cortadas típicas de calles y cortes pesados en accesos o rutas</strong>. Si ves algún dato desactualizado o un corte nuevo en tu barrio, podés actualizarlo acá abajo y recalcula todo al instante.
    </div>

    <h4 style="font-size:0.86rem; font-weight:800; color:#38bdf8; margin-bottom:0.4rem;">
      💵 1. Indicadores Monetarios, Inflación (INDEC) y Combustibles (El Porqué de cada valor)
    </h4>
    <div style="overflow-x:auto; margin-bottom:1rem;">
      <table class="dense-table">
        <thead>
          <tr style="background:var(--bg-tertiary);">
            <th>Indicador y Fuente Oficial</th>
            <th>Valor Actual</th>
            <th>¿Por qué se usa en tu cálculo?</th>
            <th style="text-align:right;">Acción</th>
          </tr>
        </thead>
        <tbody>${monRows}</tbody>
      </table>
    </div>

    <h4 style="font-size:0.86rem; font-weight:800; color:#38bdf8; margin-bottom:0.4rem;">
      🚇 2. Tarifas Oficiales de Transporte y Cambios a Futuro Anunciados
    </h4>
    <div style="overflow-x:auto; margin-bottom:1rem;">
      <table class="dense-table">
        <thead>
          <tr style="background:var(--bg-tertiary);">
            <th>Medio de Transporte</th>
            <th>Tarifa Vigente</th>
            <th>Por qué + Cambios a futuro que modificarían tu gasto</th>
            <th style="text-align:right;">Acción</th>
          </tr>
        </thead>
        <tbody>${trRows}</tbody>
      </table>
    </div>

    <h4 style="font-size:0.86rem; font-weight:800; color:#fde68a; margin-bottom:0.4rem;">
      🚧 3. Información Zonal: Estaciones de Subte/Tren en Obra, Cortadas Típicas de Calles y Cortes en Accesos/Rutas
    </h4>
    <div style="display:flex; flex-direction:column; gap:0.45rem; margin-bottom:1rem;">
      ${alertRows}
    </div>

    <!-- FORMULARIO PARA AVISAR DATO OBSOLETO O SUMAR CORTE / ACTUALIZAR PRECIO ZONAL -->
    <div id="db-report-outdated-form-box" style="background:var(--bg-primary); border:1.5px solid #f59e0b; border-radius:8px; padding:0.85rem;">
      <h4 style="font-size:0.84rem; font-weight:800; color:#fde68a; margin-bottom:0.35rem;">
        ⚠️ Avisar Dato Obsoleto / Actualizar Precio o Agregar Corte de Calle, Ruta o Estación
      </h4>
      <p style="font-size:0.72rem; color:var(--text-secondary); margin-bottom:0.55rem;">
        Si un valor de nafta, boleto, alquiler zonal o estado de una estación/ruta cambió, ingresalo acá para actualizar nuestra Base de Datos y recalcular tus resultados:
      </p>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:0.5rem; margin-bottom:0.55rem;">
        <div>
          <label style="font-size:0.7rem; color:#bae6fd; display:block; margin-bottom:2px;">¿Qué dato querés actualizar o reportar?</label>
          <select id="db-report-target-select" class="salary-input" style="width:100%; font-size:0.75rem; padding:0.32rem 0.45rem;">
            <option value="nafta_super_ypf">⛽ Precio Nafta Súper ($/L)</option>
            <option value="nafta_premium_ypf">⛽ Precio Nafta Premium ($/L)</option>
            <option value="sube_colectivo">🚌 Boleto Mínimo Colectivo SUBE ($)</option>
            <option value="subte_emova">🚇 Pasaje de Subte CABA ($)</option>
            <option value="trenes_amba">🚆 Boleto de Tren AMBA ($)</option>
            <option value="ipc_indec">📈 Inflación Mensual IPC (%)</option>
            <option value="nueva_alerta_vial">🚧 Nuevo corte de calle / acceso a ruta / estación de subte cerrada</option>
            <option value="ajuste_alquiler_zonal">🏠 Alquiler o Expensas obsoletas en mi zona/barrio</option>
          </select>
        </div>
        <div>
          <label style="font-size:0.7rem; color:#bae6fd; display:block; margin-bottom:2px;">Nuevo Valor Numérico (o demora en min):</label>
          <input type="text" inputmode="numeric" id="db-report-new-val" class="salary-input formatted-thousands-input" placeholder="Ej: 1.250 o 480.000" style="width:100%; font-size:0.75rem; padding:0.32rem 0.45rem;">
        </div>
        <div>
          <label style="font-size:0.7rem; color:#bae6fd; display:block; margin-bottom:2px;">Zona / Barrio o Detalle del aviso:</label>
          <input type="text" id="db-report-note" class="salary-input" placeholder="Ej: Cerraron estación Pueyrredón Subte B / Corte en Ruta 2..." style="width:100%; font-size:0.75rem; padding:0.32rem 0.45rem;">
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <button type="button" id="btn-reset-db-defaults" class="btn-sm btn-secondary" style="font-size:0.7rem;">Restaurar valores oficiales por defecto</button>
        <button type="button" id="btn-submit-db-report" class="btn-sm btn-primary" style="font-size:0.75rem; padding:0.4rem 0.85rem;">
          💾 Guardar en Base de Datos y Recalcular Todo
        </button>
      </div>
      ${userReportsHtml}
    </div>
  `;

  if (preselectReportTarget) {
    const sel = document.getElementById("db-report-target-select");
    if (sel) sel.value = preselectReportTarget;
  }

  attachLiveThousandsFormatter(document.getElementById("db-report-new-val"));

  body.querySelectorAll(".db-flag-item-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-item-id");
      const val = btn.getAttribute("data-item-val");
      const sel = document.getElementById("db-report-target-select");
      const valInp = document.getElementById("db-report-new-val");
      if (sel && id) sel.value = id;
      if (valInp && val) valInp.value = formatArsThousands(val);
      document.getElementById("db-report-outdated-form-box")?.scrollIntoView({ behavior: "smooth" });
      valInp?.focus();
    });
  });

  document.getElementById("btn-submit-db-report")?.addEventListener("click", () => {
    const targetId = document.getElementById("db-report-target-select")?.value || "";
    const rawNum = document.getElementById("db-report-new-val")?.value || "";
    const parsedNum = parseArsNumber(rawNum);
    const note = (document.getElementById("db-report-note")?.value || "").trim();

    if (!parsedNum && !note) {
      alert("Ingresá el nuevo valor actualizado o la descripción del corte/cambio para guardarlo en la base de datos.");
      return;
    }

    const nowStr = new Date().toLocaleDateString("es-AR");

    const monItem = CALCULIVING_ZONAL_DB.monetario_y_combustible?.find(x => x.id === targetId);
    const trItem = CALCULIVING_ZONAL_DB.transporte_oficial_y_futuro?.find(x => x.id === targetId);

    if (monItem && parsedNum > 0) {
      monItem.valor_num = parsedNum;
      monItem.userOverridden = true;
      if (note) monItem.por_que = `${note} (Actualizado por usuario)`;
    } else if (trItem && parsedNum > 0) {
      trItem.valor_num = parsedNum;
      trItem.userOverridden = true;
      if (note) trItem.cambio_futuro_previsto = note;
    } else if (targetId === "nueva_alerta_vial" && note) {
      CALCULIVING_ZONAL_DB.alertas_zonal_vial_subte.unshift({
        id: "alerta-user-" + Date.now(),
        zona_afectada: note.toLowerCase(),
        categoria: "⚠️ Alerta Reportada por Usuario",
        titulo: note.slice(0, 75),
        detalle: note,
        impacto_viaje_min: parsedNum > 0 && parsedNum < 180 ? parsedNum : 10,
        fuente: "Reporte directo de usuario en Calculiving"
      });
    } else if (targetId === "ajuste_alquiler_zonal" && parsedNum > 0) {
      const targetZone = selectedZoneForDeepDive || appState.userSelectedZones[0];
      if (targetZone) {
        targetZone.alquiler_ars = parsedNum;
      }
      appState.userSelectedZones.forEach(z => {
        if (note && z.name.toLowerCase().includes(note.toLowerCase())) {
          z.alquiler_ars = parsedNum;
        }
      });
    }

    if (!Array.isArray(CALCULIVING_ZONAL_DB.reportes_usuario)) {
      CALCULIVING_ZONAL_DB.reportes_usuario = [];
    }
    CALCULIVING_ZONAL_DB.reportes_usuario.unshift({
      fecha: nowStr,
      item: targetId,
      detalle: `${parsedNum > 0 ? "$" + parsedNum.toLocaleString("es-AR") + " — " : ""}${note || "Valor actualizado"}`
    });

    saveCalculivingZonalDatabase();
    fetchLiveEconomicIndicators();
    renderAffordabilityZonesOnMap();
    renderUserSelectedZonesSidebar();
    if (appState.currentScreen === "screen-resultados" && selectedZoneForDeepDive) {
      renderFocusedZoneDeepDive(selectedZoneForDeepDive);
    }
    openZonalDatabaseModal();
  });

  document.getElementById("btn-reset-db-defaults")?.addEventListener("click", () => {
    try { localStorage.removeItem("calculiving_zonal_db_v1"); } catch (e) {}
    CALCULIVING_ZONAL_DB = JSON.parse(JSON.stringify(CALCULIVING_ZONAL_DB_DEFAULT));
    syncZonalDbToLiveEconomicState();
    fetchLiveEconomicIndicators();
    renderAffordabilityZonesOnMap();
    openZonalDatabaseModal();
  });

  modal.classList.add("open");
}

function getZonalAlertsForZone(zone) {
  if (!zone) return [];
  const raw = `${zone.slug || ""} ${zone.name || ""} ${zone.region || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (CALCULIVING_ZONAL_DB.alertas_zonal_vial_subte || []).filter(al => {
    const keys = (al.zona_afectada || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    return keys.some(k => raw.includes(k));
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
  },
  {
    id: "zona-belgrano-r",
    slug: "belgrano",
    name: "Belgrano R / Coghlan (Cruzando Av. Crámer y Vías del Mitre al Oeste)",
    urban_boundary_note: "Delimitado por Av. Crámer, Av. Monroe, Av. de los Incas, Av. Álvarez Thomas y Vías del Ferrocarril Mitre (Ramal José León Suárez).",
    bridge_price_effect: "Cruzando Av. Crámer y las vías del Tren Mitre hacia Belgrano R / Melián, baja la densidad comercial respecto a Av. Cabildo y el alquiler de departamentos de 2-3 amb baja un ~16% con expensas menores.",
    coords: [
      [-34.5615, -58.4645],
      [-34.5685, -58.4565],
      [-34.5735, -58.4605],
      [-34.5765, -58.4725],
      [-34.5665, -58.4775],
      [-34.5585, -58.4715]
    ],
    alquiler_ars: 690000,
    expensas_ars: 135000,
    servicios_ars: 68000,
    canasta_comercios_ars: 285000,
    transporte_ars: 37000,
    impuestos_y_servicios: {
      abl_municipal_ars: 18500,
      luz_edenor_edesur_ars: 18500,
      gas_metrogas_ars: 10500,
      agua_aysa_ars: 9500,
      internet_fibra_ars: 11000
    },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Almacenes (Av. Crámer / Av. Monroe)", valores: "Leche 1L: $1.490 | Queso tybo 1kg: $9.400 | Yerba 1kg: $3.750", mensual_ars: 102000 },
      { tipo: "🥩 Carnicerías y Granja (Juramento / Superí)", valores: "Asado/Vacío 1kg: $10.100 | Suprema 1kg: $6.900 | Maple huevos: $4.600", mensual_ars: 68000 },
      { tipo: "🥬 Verdulerías y Fruterías (Plaza Castelli / Av. de los Incas)", valores: "Papa 1kg: $1.100 | Tomate 1kg: $2.150 | Fruta estación 1kg: $2.100", mensual_ars: 39000 },
      { tipo: "🥖 Panaderías y Cafeterías frente a Estación Belgrano R", valores: "Pan artesanal 1kg: $3.000 | Café + medialunas: $4.600", mensual_ars: 29000 },
      { tipo: "🧺 Tintorerías, Veterinarias y Farmacias (Conde / Freire)", valores: "Valet ropa: $5.900 | Insumos limpieza y cuidado: $16.500", mensual_ars: 21000 },
      { tipo: "🏋️ Club Belgrano Athletic y Gimnasios de Barrio", valores: "Cuota mensual: $36.000", mensual_ars: 26000 }
    ],
    gastos_alrededor_detalle: "Estación Belgrano R (Tren Mitre), cercanía a Subte B (De los Incas) y Subte D (Juramento por Crámer). Calles residenciales arboladas."
  },
  // --- RESTO DE CAPITAL FEDERAL (CABA) ---
  {
    id: "zona-villa-urquiza-saavedra",
    slug: "villa-urquiza",
    region: "caba",
    name: "Villa Urquiza / Saavedra / Coghlan Norte (Av. Triunvirato / Congreso a Gral. Paz)",
    urban_boundary_note: "Delimitado por Av. Congreso, Av. Triunvirato, Av. Olazábal, Av. Crisólogo Larralde, Parque Sarmiento y Av. Gral. Paz.",
    bridge_price_effect: "Sobre el eje del Subte B (Rosas / Echeverría) y DoHo el alquiler es un ~15% más alto que hacia Saavedra / Parque Sarmiento cruzando Av. Crisólogo Larralde.",
    coords: [
      [-34.5445, -58.4895],
      [-34.5525, -58.4685],
      [-34.5685, -58.4765],
      [-34.5815, -58.4825],
      [-34.5765, -58.5015],
      [-34.5575, -58.5045]
    ],
    alquiler_ars: 610000,
    expensas_ars: 118000,
    servicios_ars: 60000,
    canasta_comercios_ars: 255000,
    transporte_ars: 35000,
    impuestos_y_servicios: { abl_municipal_ars: 15000, luz_edenor_edesur_ars: 16500, gas_metrogas_ars: 9500, agua_aysa_ars: 8500, internet_fibra_ars: 10500 },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Mayoristas (Av. Triunvirato / Av. Álvarez Thomas)", valores: "Leche 1L: $1.420 | Fideos 500g: $1.150 | Yerba 1kg: $3.650", mensual_ars: 94000 },
      { tipo: "🥩 Carnicerías y Pollerías (Av. Monroe / Olazábal)", valores: "Asado 1kg: $9.400 | Suprema 1kg: $6.400 | Maple huevos: $4.400", mensual_ars: 62000 },
      { tipo: "🥬 Verdulerías y Ferias (Plaza Echeverría / Parque Saavedra)", valores: "Papa 1kg: $1.000 | Tomate 1kg: $1.950 | Bolsón verdura: $8.800", mensual_ars: 35000 },
      { tipo: "🥖 Panaderías y Cafés (Corredor DoHo / Holmberg)", valores: "Pan 1kg: $2.750 | Café + medialunas: $4.200", mensual_ars: 25000 },
      { tipo: "🧺 Farmacias y Lavaderos de Barrio", valores: "Valet ropa: $5.200 | Limpieza hogar: $14.000", mensual_ars: 18000 },
      { tipo: "🏋️ Gimnasios y Polideportivo Parque Sarmiento", valores: "Cuota mensual: $29.000", mensual_ars: 21000 }
    ],
    gastos_alrededor_detalle: "Cabecera Subte B (Juan Manuel de Rosas), Tren Mitre (Est. Urquiza y Saavedra) y salida rápida a Gral. Paz / Panamericana."
  },
  {
    id: "zona-nunez",
    slug: "nunez",
    region: "caba",
    name: "Núñez / Bajo Núñez (Av. Cabildo / Libertador a Gral. Paz)",
    urban_boundary_note: "Delimitado por Av. Congreso, Av. Cabildo, Av. del Libertador, Av. Gral. Paz y Costanera Norte / Ciudad Universitaria.",
    bridge_price_effect: "Entre Av. Cabildo y las vías del Tren Mitre predominan edificios modernos, mientras que del lado de Av. del Libertador (Bajo Núñez / Lomas de Núñez) el alquiler sube ~18%.",
    coords: [
      [-34.5355, -58.4665],
      [-34.5415, -58.4495],
      [-34.5525, -58.4505],
      [-34.5565, -58.4685],
      [-34.5445, -58.4785]
    ],
    alquiler_ars: 760000,
    expensas_ars: 155000,
    servicios_ars: 74000,
    canasta_comercios_ars: 305000,
    transporte_ars: 38000,
    impuestos_y_servicios: { abl_municipal_ars: 20500, luz_edenor_edesur_ars: 19500, gas_metrogas_ars: 11000, agua_aysa_ars: 11000, internet_fibra_ars: 12000 },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Proveedurías (Av. Cabildo 3500-4800 / Crisólogo Larralde)", valores: "Leche 1L: $1.520 | Queso cremoso 1kg: $8.900 | Yerba 1kg: $3.850", mensual_ars: 112000 },
      { tipo: "🥩 Carnicerías y Granjas (Manuela Pedraza / Juara)", valores: "Asado/Vacío 1kg: $10.600 | Suprema 1kg: $7.100", mensual_ars: 72000 },
      { tipo: "🥬 Verdulerías y Almacenes Naturales (O'Higgins / Arcos)", valores: "Tomate 1kg: $2.300 | Fruta estación 1kg: $2.200", mensual_ars: 42000 },
      { tipo: "🥖 Panaderías y Cafeterías de Especialidad (Bajo Núñez)", valores: "Pan masa madre: $3.500 | Café + pastelería: $6.800", mensual_ars: 33000 },
      { tipo: "🧺 Tintorerías y Farmacias", valores: "Valet ropa: $6.500 | Higiene y limpieza: $18.000", mensual_ars: 21000 },
      { tipo: "🏋️ Clubes Deportivos y Gimnasios sobre Libertador", valores: "Cuota mensual: $41.000", mensual_ars: 25000 }
    ],
    gastos_alrededor_detalle: "Subte D (Congreso de Tucumán), Metrobus Norte, Estación Núñez / Rivadavia (Tren Mitre) y cercanía a Ciudad Universitaria."
  },
  {
    id: "zona-devoto-villa-del-parque",
    slug: "villa-devoto",
    region: "caba",
    name: "Villa Devoto / Villa del Parque / Paternal (Plaza Arenales / Av. Beiró / Cuenca)",
    urban_boundary_note: "Delimitado por Av. San Martín, Av. Francisco Beiró, Av. Nazca, Av. Segurola y Av. Gral. Paz.",
    bridge_price_effect: "Alrededor de Plaza Arenales (Devoto Centro) el polo gastronómico eleva los alquileres, mientras que cruzando las vías del Tren San Martín hacia Villa del Parque o Monte Castro bajan un ~17%.",
    coords: [
      [-34.5885, -58.5015],
      [-34.5895, -58.4745],
      [-34.6095, -58.4715],
      [-34.6185, -58.4985],
      [-34.6055, -58.5225]
    ],
    alquiler_ars: 560000,
    expensas_ars: 98000,
    servicios_ars: 56000,
    canasta_comercios_ars: 242000,
    transporte_ars: 35000,
    impuestos_y_servicios: { abl_municipal_ars: 13500, luz_edenor_edesur_ars: 15500, gas_metrogas_ars: 9000, agua_aysa_ars: 8000, internet_fibra_ars: 10000 },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Centros Comerciales (Calle Cuenca / Av. Beiró)", valores: "Leche 1L: $1.390 | Fideos 500g: $1.100 | Yerba 1kg: $3.550", mensual_ars: 89000 },
      { tipo: "🥩 Carnicerías y Frigoríficos (Av. Nazca / Lope de Vega)", valores: "Asado 1kg: $8.900 | Suprema 1kg: $6.100 | Maple huevos: $4.200", mensual_ars: 58000 },
      { tipo: "🥬 Verdulerías y Ferias Barriales", valores: "Papa 1kg: $920 | Tomate 1kg: $1.800 | Fruta 1kg: $1.750", mensual_ars: 34000 },
      { tipo: "🥖 Panaderías Tradicionales y Cafés (Plaza Arenales / Cuenca)", valores: "Pan 1kg: $2.550 | Facturas docena: $5.800", mensual_ars: 24000 },
      { tipo: "🧺 Farmacias y Lavaderos", valores: "Valet ropa: $4.800 | Limpieza mensual: $12.500", mensual_ars: 17000 },
      { tipo: "🏋️ Clubes de Barrio (Racing de Villa del Parque / Kimberley)", valores: "Cuota social/gimnasio: $26.000", mensual_ars: 20000 }
    ],
    gastos_alrededor_detalle: "Tren San Martín (Est. Devoto y Villa del Parque a Palermo en 14 min), Tren Urquiza y rápido acceso a Gral. Paz."
  },
  {
    id: "zona-flores-floresta-liniers",
    slug: "flores",
    region: "caba",
    name: "Flores / Floresta / Liniers / Mataderos (Eje Av. Rivadavia / Subte A vs Sur Autopista)",
    urban_boundary_note: "Corredor Oeste de CABA a lo largo de Av. Rivadavia, Av. Avellaneda, Av. Gaona, Av. Juan B. Alberdi y Av. Emilio Castro.",
    bridge_price_effect: "Entre Av. Rivadavia y Av. Gaona (Flores Norte / Subte A) hay edificios con expensas moderadas; cruzando Autopista Perito Moreno / Av. Eva Perón hacia el sur los precios bajan un ~22%.",
    coords: [
      [-34.6185, -58.4985],
      [-34.6195, -58.4525],
      [-34.6425, -58.4545],
      [-34.6585, -58.5085],
      [-34.6395, -58.5285]
    ],
    alquiler_ars: 465000,
    expensas_ars: 82000,
    servicios_ars: 49000,
    canasta_comercios_ars: 215000,
    transporte_ars: 34000,
    impuestos_y_servicios: { abl_municipal_ars: 10500, luz_edenor_edesur_ars: 14000, gas_metrogas_ars: 8000, agua_aysa_ars: 7000, internet_fibra_ars: 9500 },
    locales_cercanos: [
      { tipo: "🛒 Mayoristas y Supermercados (Av. Rivadavia / Av. Juan B. Alberdi)", valores: "Leche 1L: $1.320 | Aceite 1.5L: $2.500 | Yerba 1kg: $3.350", mensual_ars: 79000 },
      { tipo: "🥩 Frigoríficos y Carnicerías (Polo Mataderos / Emilio Castro)", valores: "Asado/Vacío 1kg: $8.100 | Milanesa 1kg: $6.400 | Maple huevos: $3.900", mensual_ars: 52000 },
      { tipo: "🥬 Mercados y Verdulerías (Liniers / Av. Avellaneda)", valores: "Papa 1kg: $800 | Cebolla 1kg: $900 | Fruta estación 1kg: $1.500", mensual_ars: 29000 },
      { tipo: "🥖 Panaderías y Casas de Pastas de Barrio", valores: "Pan 1kg: $2.200 | Ravioles x2 cajas: $4.200", mensual_ars: 21000 },
      { tipo: "🧺 Artículos de Limpieza Sueltos e Indumentaria (Polo Avellaneda)", valores: "Limpieza mensual: $9.800 | Valet ropa: $4.200", mensual_ars: 16000 },
      { tipo: "🏋️ Gimnasios y Clubes Barriales", valores: "Cuota mensual: $22.000", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Subte A (Carabobo / San José de Flores / San Pedrito), Tren Sarmiento (Flores, Floresta, Villa Luro, Liniers) y centro comercial mayorista."
  },
  {
    id: "zona-centro-san-telmo-barracas",
    slug: "san-telmo",
    region: "caba",
    name: "Centro / Monserrat / San Telmo / Parque Patricios / Barracas (Eje Subtes A, C, E y H)",
    urban_boundary_note: "Corredor Este y Sur de CABA: Av. Córdoba, Av. 9 de Julio, Av. Paseo Colón, Casco Histórico San Telmo, Av. Caseros y Av. Montes de Oca.",
    bridge_price_effect: "Sobre Boulevard Caseros y San Telmo subió la demanda gastronómica, mientras que en Monserrat, Constitución Oeste y Parque Patricios (Distrito Tecnológico) los alquileres son un ~18% más bajos con conexión a todas las líneas de Subte.",
    coords: [
      [-34.5985, -58.3915],
      [-34.5965, -58.3665],
      [-34.6385, -58.3625],
      [-34.6485, -58.3985],
      [-34.6295, -58.4145]
    ],
    alquiler_ars: 495000,
    expensas_ars: 95000,
    servicios_ars: 51000,
    canasta_comercios_ars: 228000,
    transporte_ars: 32000,
    impuestos_y_servicios: { abl_municipal_ars: 11500, luz_edenor_edesur_ars: 14500, gas_metrogas_ars: 8000, agua_aysa_ars: 7500, internet_fibra_ars: 9500 },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Autoservicios (Av. Independencia / Av. Entre Ríos / Montes de Oca)", valores: "Leche 1L: $1.360 | Fideos 500g: $1.100 | Yerba 1kg: $3.450", mensual_ars: 84000 },
      { tipo: "🥩 Mercado de San Telmo y Carnicerías de Barrio (Av. Caseros)", valores: "Asado 1kg: $8.600 | Suprema 1kg: $6.000 | Maple huevos: $4.100", mensual_ars: 55000 },
      { tipo: "🥬 Verdulerías y Ferias de Abastecimiento", valores: "Papa 1kg: $880 | Tomate 1kg: $1.750 | Fruta 1kg: $1.650", mensual_ars: 31000 },
      { tipo: "🥖 Panaderías y Menús Ejecutivos de Mediodía", valores: "Pan 1kg: $2.400 | Menú del día: $6.800", mensual_ars: 23000 },
      { tipo: "🧺 Farmacias y Lavaderos", valores: "Valet ropa: $4.600 | Limpieza mensual: $11.500", mensual_ars: 17000 },
      { tipo: "🏋️ Gimnasios y Clubes Históricos", valores: "Cuota mensual: $24.000", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Nodo central de Subtes A, B, C, D, E y H + Metrobus 9 de Julio y Bajo. Mínimo gasto de tiempo y transporte hacia oficinas y facultades."
  },

  // --- GRAN BUENOS AIRES: ZONA NORTE ---
  {
    id: "zona-gba-norte-vicente-lopez-este",
    slug: "vicente-lopez",
    region: "zona-norte",
    name: "Vicente López Este: Olivos / La Lucila / Florida Este (Av. Maipú al Río)",
    urban_boundary_note: "Partido de Vicente López entre Av. Gral. Paz, Calle Paraná, Av. Mitre / Av. Maipú, Av. del Libertador y Paseo de la Costa (Río de la Plata).",
    bridge_price_effect: "Entre Av. Maipú y el Río (Tren Mitre ramal Tigre y Paseo de la Costa) los alquileres son un ~25% más altos que cruzando Av. Mitre y Panamericana hacia Florida Oeste y Munro.",
    coords: [
      [-34.4885, -58.4795],
      [-34.5025, -58.4685],
      [-34.5345, -58.4655],
      [-34.5395, -58.4885],
      [-34.5065, -58.4965]
    ],
    alquiler_ars: 680000,
    expensas_ars: 130000,
    servicios_ars: 66000,
    canasta_comercios_ars: 278000,
    transporte_ars: 38000,
    impuestos_y_servicios: { abl_municipal_ars: 18000, luz_edenor_edesur_ars: 18000, gas_metrogas_ars: 10000, agua_aysa_ars: 9000, internet_fibra_ars: 11000 },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Centros Comerciales (Av. Maipú / Ugarte / Rawson)", valores: "Leche 1L: $1.480 | Queso cremoso 1kg: $8.800 | Yerba 1kg: $3.750", mensual_ars: 101000 },
      { tipo: "🥩 Carnicerías y Granjas (Olivos / Florida)", valores: "Asado 1kg: $9.900 | Suprema 1kg: $6.700 | Maple huevos: $4.500", mensual_ars: 66000 },
      { tipo: "🥬 Verdulerías y Almacenes (Calle Córdoba / Paraná)", valores: "Papa 1kg: $1.050 | Tomate 1kg: $2.100 | Fruta 1kg: $2.000", mensual_ars: 38000 },
      { tipo: "🥖 Panaderías y Cafeterías (Estación Olivos / La Lucila)", valores: "Pan 1kg: $2.950 | Café + medialunas: $4.500", mensual_ars: 28000 },
      { tipo: "🧺 Farmacias y Lavaderos", valores: "Valet ropa: $5.600 | Limpieza mensual: $15.000", mensual_ars: 20000 },
      { tipo: "🏋️ Gimnasios y Deportes en el Vial Costero", valores: "Cuota mensual: $34.000", mensual_ars: 25000 }
    ],
    gastos_alrededor_detalle: "Metrobus Norte por Av. Maipú (conecta directo con Puente Saavedra y Subte D), Tren Mitre (Ramales Tigre y Bartolomé Mitre) y Tren de la Costa."
  },
  {
    id: "zona-gba-norte-vicente-lopez-oeste-san-martin",
    slug: "san-martin",
    region: "zona-norte",
    name: "Florida Oeste / Munro / Villa Martelli / Gral. San Martín / Villa Ballester (Cruzando Panamericana)",
    urban_boundary_note: "Corredor Noroeste cruzando Autopista Panamericana: Munro, Florida Oeste, Villa Martelli, San Martín Centro, San Andrés y Villa Ballester.",
    bridge_price_effect: "Cruzando Autopista Panamericana hacia el oeste (Munro, Florida Oeste y San Martín / Villa Ballester) el alquiler de 2 y 3 ambientes baja entre un 24% y 32% con comercios y ferias mucho más económicos.",
    coords: [
      [-34.5065, -58.4965],
      [-34.5395, -58.4885],
      [-34.5765, -58.5045],
      [-34.5815, -58.5625],
      [-34.5255, -58.5685]
    ],
    alquiler_ars: 470000,
    expensas_ars: 72000,
    servicios_ars: 52000,
    canasta_comercios_ars: 220000,
    transporte_ars: 36000,
    impuestos_y_servicios: { abl_municipal_ars: 11500, luz_edenor_edesur_ars: 14500, gas_metrogas_ars: 8500, agua_aysa_ars: 7500, internet_fibra_ars: 10000 },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Mayoristas (Av. Vélez Sársfield / Peatonal Belgrano San Martín)", valores: "Leche 1L: $1.340 | Fideos 500g: $1.080 | Yerba 1kg: $3.400", mensual_ars: 81000 },
      { tipo: "🥩 Carnicerías y Frigoríficos (Munro / Villa Ballester)", valores: "Asado 1kg: $8.300 | Suprema 1kg: $5.900 | Maple huevos: $4.000", mensual_ars: 54000 },
      { tipo: "🥬 Verdulerías y Ferias Municipales", valores: "Papa 1kg: $820 | Tomate 1kg: $1.650 | Fruta estación 1kg: $1.550", mensual_ars: 30000 },
      { tipo: "🥖 Panaderías y Confiterías (Alvear Ballester / Mitre Munro)", valores: "Pan 1kg: $2.300 | Facturas docena: $5.200", mensual_ars: 21000 },
      { tipo: "🧺 Outlets e Indumentaria (Centro Comercial Munro) y Limpieza", valores: "Limpieza suelta mensual: $10.500 | Valet ropa: $4.400", mensual_ars: 16000 },
      { tipo: "🏋️ Gimnasios y Clubes Deportivos", valores: "Cuota mensual: $22.000", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Tren Belgrano Norte (Munro / Florida Oeste a Retiro), Tren Mitre Ramal Suárez (San Martín, San Andrés, Malaver, Villa Ballester) y UNSAM."
  },
  {
    id: "zona-gba-norte-san-isidro-tigre-pilar",
    slug: "san-isidro",
    region: "zona-norte",
    name: "San Isidro / Martínez / Tigre / San Fernando / Pilar (Corredor Norte)",
    urban_boundary_note: "Partidos de San Isidro, San Fernando, Tigre y corredor Panamericana hacia Pacheco y Pilar.",
    bridge_price_effect: "En San Isidro Centro / Acassuso / Martínez hacia el río predominan valores altos, pero en San Fernando, Tigre Centro (cerca de estación Mitre/Río) o hacia Boulogne y Pilar Centro los alquileres bajan un ~22% con más metraje y verde.",
    coords: [
      [-34.4155, -58.5925],
      [-34.4325, -58.5325],
      [-34.4885, -58.4795],
      [-34.5065, -58.5355],
      [-34.4625, -58.6125]
    ],
    alquiler_ars: 590000,
    expensas_ars: 105000,
    servicios_ars: 61000,
    canasta_comercios_ars: 258000,
    transporte_ars: 41000,
    impuestos_y_servicios: { abl_municipal_ars: 16000, luz_edenor_edesur_ars: 17000, gas_metrogas_ars: 9500, agua_aysa_ars: 8500, internet_fibra_ars: 10000 },
    locales_cercanos: [
      { tipo: "🛒 Hipermercados y Centros Comerciales (Av. Centenario / Av. Cazón Tigre)", valores: "Leche 1L: $1.420 | Queso tybo 1kg: $8.600 | Yerba 1kg: $3.600", mensual_ars: 95000 },
      { tipo: "🥩 Carnicerías y Granjas (Martínez / San Fernando / Tigre)", valores: "Asado 1kg: $9.200 | Suprema 1kg: $6.300 | Maple huevos: $4.300", mensual_ars: 62000 },
      { tipo: "🥬 Puerto de Frutos / Mercados y Verdulerías Zonal", valores: "Papa 1kg: $950 | Tomate 1kg: $1.900 | Fruta estación 1kg: $1.800", mensual_ars: 35000 },
      { tipo: "🥖 Panaderías y Cafés (Casco Histórico San Isidro / Paseo Victorica)", valores: "Pan 1kg: $2.700 | Merienda: $5.800", mensual_ars: 25000 },
      { tipo: "🧺 Farmacias y Servicios Barriales", valores: "Valet ropa: $5.100 | Limpieza hogar: $13.500", mensual_ars: 19000 },
      { tipo: "🏋️ Clubes Náuticos, Remo y Gimnasios", valores: "Cuota mensual: $30.000", mensual_ars: 22000 }
    ],
    gastos_alrededor_detalle: "Tren Mitre (Acassuso, San Isidro, Victoria, Virreyes, San Fernando, Carupá, Tigre), Tren de la Costa y Autopista Panamericana (Ramales Tigre y Pilar)."
  },

  // --- GRAN BUENOS AIRES: ZONA OESTE ---
  {
    id: "zona-gba-oeste-ramos-haedo-caseros",
    slug: "ramos-mejia",
    region: "zona-oeste",
    name: "Ramos Mejía / Haedo / Caseros / Ciudad Jardín (La Matanza Norte y Tres de Febrero)",
    urban_boundary_note: "Cruzando Av. Gral. Paz al Oeste: Ramos Mejía Norte y Sur (Av. de Mayo / Av. Rivadavia), Haedo, Caseros y Ciudad Jardín El Palomar.",
    bridge_price_effect: "Ramos Mejía Centro (Av. de Mayo) tiene el mayor polo comercial y gastronómico del primer cordón oeste; cruzando hacia Haedo Chico, Villa Luzuriaga o Caseros (Tren San Martín) el alquiler baja entre un 15% y 22%.",
    coords: [
      [-34.5885, -58.5925],
      [-34.5885, -58.5185],
      [-34.6555, -58.5225],
      [-34.6685, -58.5985]
    ],
    alquiler_ars: 460000,
    expensas_ars: 68000,
    servicios_ars: 50000,
    canasta_comercios_ars: 218000,
    transporte_ars: 36000,
    impuestos_y_servicios: { abl_municipal_ars: 11000, luz_edenor_edesur_ars: 14000, gas_metrogas_ars: 8000, agua_aysa_ars: 7500, internet_fibra_ars: 9500 },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Mayoristas (Av. Rivadavia / Av. de Mayo / Av. San Martín Caseros)", valores: "Leche 1L: $1.330 | Fideos 500g: $1.050 | Yerba 1kg: $3.350", mensual_ars: 80000 },
      { tipo: "🥩 Carnicerías y Frigoríficos del Oeste", valores: "Asado 1kg: $8.200 | Suprema 1kg: $5.800 | Maple huevos: $3.950", mensual_ars: 53000 },
      { tipo: "🥬 Verdulerías y Ferias Barriales", valores: "Papa 1kg: $800 | Tomate 1kg: $1.600 | Fruta estación 1kg: $1.500", mensual_ars: 29000 },
      { tipo: "🥖 Panaderías y Polo Gastronómico (Ramos / Plaza Plate Ciudad Jardín)", valores: "Pan 1kg: $2.250 | Café + medialunas: $3.900", mensual_ars: 21000 },
      { tipo: "🧺 Farmacias, Limpieza Suelta y Lavaderos", valores: "Valet ropa: $4.200 | Limpieza mensual: $10.000", mensual_ars: 16000 },
      { tipo: "🏋️ Gimnasios y Clubes (Estudiantes / AFALP / Estudiantil Porteño)", valores: "Cuota mensual: $23.000", mensual_ars: 19000 }
    ],
    gastos_alrededor_detalle: "Tren Sarmiento (Ramos Mejía y Haedo a Once en 22 min), Tren San Martín (Caseros / El Palomar a Palermo), Autopista Acceso Oeste y cercanía a UNLaM y UNTREF."
  },
  {
    id: "zona-gba-oeste-moron-castelar-ituzaingo",
    slug: "moron",
    region: "zona-oeste",
    name: "Morón / Castelar / Ituzaingó / Hurlingham / Merlo / Moreno (Corredor Sarmiento y Acceso Oeste)",
    urban_boundary_note: "Partidos de Morón, Hurlingham, Ituzaingó, Merlo y Moreno a lo largo del Ferrocarril Sarmiento y Autopista del Oeste.",
    bridge_price_effect: "Castelar Norte y Parque Leloir manejan valores residenciales más altos; en Morón Sur, Ituzaingó, Hurlingham, Padua, Merlo y Moreno los alquileres de PHs y casas con patio o departamentos bajan entre un 20% y 35%.",
    coords: [
      [-34.5855, -58.7455],
      [-34.5855, -58.5955],
      [-34.6855, -58.5985],
      [-34.6855, -58.7455]
    ],
    alquiler_ars: 410000,
    expensas_ars: 55000,
    servicios_ars: 46000,
    canasta_comercios_ars: 202000,
    transporte_ars: 38000,
    impuestos_y_servicios: { abl_municipal_ars: 9500, luz_edenor_edesur_ars: 13500, gas_metrogas_ars: 7500, agua_aysa_ars: 6500, internet_fibra_ars: 9000 },
    locales_cercanos: [
      { tipo: "🛒 Hipermercados y Mayoristas (Av. Vergara / Av. Rivadavia Morón / Castelar)", valores: "Leche 1L: $1.280 | Aceite 1.5L: $2.400 | Yerba 1kg: $3.250", mensual_ars: 74000 },
      { tipo: "🥩 Frigoríficos y Carnicerías (Morón / Castelar / Ituzaingó)", valores: "Asado 1kg: $7.800 | Suprema 1kg: $5.500 | Maple huevos: $3.800", mensual_ars: 49000 },
      { tipo: "🥬 Verdulerías y Quintas Directas del Oeste", valores: "Bolsón verdura 7kg: $7.200 | Papa 1kg: $750 | Tomate 1kg: $1.450", mensual_ars: 26000 },
      { tipo: "🥖 Panaderías y Cafeterías (Calle Arias Castelar / Centro Morón)", valores: "Pan 1kg: $2.100 | Facturas docena: $4.800", mensual_ars: 19000 },
      { tipo: "🧺 Limpieza Suelta, Farmacias y Servicios", valores: "Limpieza mensual: $9.200 | Valet ropa: $3.900", mensual_ars: 16000 },
      { tipo: "🏋️ Gimnasios y Polideportivos (Gorki Grana / Club Morón)", valores: "Cuota mensual: $20.000", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Tren Sarmiento (Morón, Castelar, Ituzaingó, San Antonio de Padua, Merlo, Moreno), Tren San Martín / Urquiza (Hurlingham) y Acceso Oeste."
  },

  // --- GRAN BUENOS AIRES: ZONA SUR Y LA PLATA ---
  {
    id: "zona-gba-sur-avellaneda-lanus",
    slug: "lanus",
    region: "zona-sur",
    name: "Avellaneda / Wilde / Lanús Este y Oeste / Remedios de Escalada (Primer Cordón Sur)",
    urban_boundary_note: "Cruzando el Riachuelo (Puente Pueyrredón): Av. Mitre (Avellaneda, Sarandí, Wilde) y Av. Hipólito Yrigoyen / Pavón (Lanús Oeste, Lanús Este, Escalada).",
    bridge_price_effect: "A 10 minutos de CABA por Puente Pueyrredón o Tren Roca (1 parada desde Constitución a Avellaneda y 2 a Lanús): Lanúsita (Del Valle Iberlucea) tiene edificios nuevos, mientras que en Lanús Este, Escalada, Piñeyro y Wilde el alquiler baja un ~22%.",
    coords: [
      [-34.6525, -58.4285],
      [-34.6485, -58.3185],
      [-34.7385, -58.3225],
      [-34.7385, -58.4355]
    ],
    alquiler_ars: 430000,
    expensas_ars: 64000,
    servicios_ars: 47000,
    canasta_comercios_ars: 208000,
    transporte_ars: 34000,
    impuestos_y_servicios: { abl_municipal_ars: 10000, luz_edenor_edesur_ars: 13500, gas_metrogas_ars: 7500, agua_aysa_ars: 7000, internet_fibra_ars: 9000 },
    locales_cercanos: [
      { tipo: "🛒 Mayoristas y Supermercados (Av. Mitre Avellaneda / 9 de Julio Lanús Este)", valores: "Leche 1L: $1.290 | Fideos 500g: $1.020 | Yerba 1kg: $3.300", mensual_ars: 76000 },
      { tipo: "🥩 Frigoríficos y Carnicerías (Lanús / Gerli / Wilde)", valores: "Asado 1kg: $7.900 | Suprema 1kg: $5.600 | Maple huevos: $3.850", mensual_ars: 51000 },
      { tipo: "🥬 Verdulerías y Ferias Francas", valores: "Papa 1kg: $780 | Tomate 1kg: $1.500 | Fruta estación 1kg: $1.450", mensual_ars: 27000 },
      { tipo: "🥖 Panaderías y Polo Gastronómico Lanúsita", valores: "Pan 1kg: $2.150 | Café + medialunas: $3.800", mensual_ars: 20000 },
      { tipo: "🧺 Limpieza Suelta, Farmacias y Lavaderos", valores: "Limpieza mensual: $9.500 | Valet ropa: $4.000", mensual_ars: 16000 },
      { tipo: "🏋️ Club Atlético Lanús, Racing, Independiente y Gimnasios", valores: "Cuota mensual: $21.000", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Tren Roca eléctrico a Constitución en 7 a 14 min (Darío Santillán y Maximiliano Kosteki, Gerli, Lanús, Remedios de Escalada, Sarandí, Wilde), UNDAV y UNLa."
  },
  {
    id: "zona-gba-sur-lomas-banfield-quilmes-adrogue",
    slug: "lomas-de-zamora",
    region: "zona-sur",
    name: "Lomas de Zamora / Banfield / Temperley / Adrogué / Quilmes / Bernal (Corredor Roca Sur)",
    urban_boundary_note: "Partidos de Lomas de Zamora, Almirante Brown (Adrogué / Burzaco), Esteban Echeverría (Monte Grande) y Quilmes / Bernal / Berazategui.",
    bridge_price_effect: "Las Lomitas, Banfield Este, Adrogué Centro y Quilmes Centro/Chico concentran edificios de categoría; cruzando hacia Banfield Oeste, Temperley, Turdera, Bernal Oeste o Ezpeleta los alquileres bajan entre un 20% y 30%.",
    coords: [
      [-34.7025, -58.4485],
      [-34.6955, -58.2325],
      [-34.8255, -58.2225],
      [-34.8285, -58.4585]
    ],
    alquiler_ars: 445000,
    expensas_ars: 69000,
    servicios_ars: 48000,
    canasta_comercios_ars: 212000,
    transporte_ars: 37000,
    impuestos_y_servicios: { abl_municipal_ars: 10500, luz_edenor_edesur_ars: 14000, gas_metrogas_ars: 7500, agua_aysa_ars: 7000, internet_fibra_ars: 9000 },
    locales_cercanos: [
      { tipo: "🛒 Centros Comerciales (Peatonal Laprida Lomas / Rivadavia Quilmes / Maipú Banfield)", valores: "Leche 1L: $1.310 | Queso cremoso 1kg: $7.900 | Yerba 1kg: $3.350", mensual_ars: 78000 },
      { tipo: "🥩 Carnicerías y Granjas (Banfield / Temperley / Bernal)", valores: "Asado 1kg: $8.100 | Suprema 1kg: $5.700 | Maple huevos: $3.900", mensual_ars: 52000 },
      { tipo: "🥬 Verdulerías y Productores del Cinturón Hortícola Sur", valores: "Bolsón verdura 7kg: $7.000 | Papa 1kg: $750 | Tomate 1kg: $1.450", mensual_ars: 27000 },
      { tipo: "🥖 Panaderías y Cafeterías (Las Lomitas / Plaza Brown Adrogué / Bernal)", valores: "Pan 1kg: $2.200 | Merienda: $4.900", mensual_ars: 21000 },
      { tipo: "🧺 Farmacias y Artículos de Limpieza", valores: "Limpieza mensual: $9.400 | Valet ropa: $4.100", mensual_ars: 16000 },
      { tipo: "🏋️ Clubes (Banfield, Lomas Athletic, Quilmes) y Gimnasios", valores: "Cuota mensual: $22.000", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Tren Roca Ramales Ezeiza / Alejandro Korn (Banfield, Lomas, Temperley, Adrogué, Monte Grande) y Ramal La Plata / Bosques (Don Bosco, Bernal, Quilmes, Berazategui). Cercanía a UNLZ y UNQ."
  },
  {
    id: "zona-la-plata-pba",
    slug: "la-plata",
    region: "la-plata",
    name: "La Plata: Casco Urbano Universitario vs City Bell / Gonnet / Tolosa",
    urban_boundary_note: "Capital de la Provincia de Buenos Aires: Casco Urbano (Av. 1 a 31 y de 32 a 72, Plaza Moreno / Plaza Paso / Facultades UNLP) y corredor Norte (Tolosa, Gonnet, City Bell, Villa Elisa).",
    bridge_price_effect: "En el eje de Plaza Moreno / Calle 8 y 12 y zona de Facultades (Bosque / 1 y 47) se concentra la demanda de departamentos; hacia Tolosa, Ringuelet o el sur de Av. 60 el alquiler baja un ~20%, mientras que en City Bell y Gonnet predominan casas con parque.",
    coords: [
      [-34.8625, -58.0755],
      [-34.8755, -57.9325],
      [-34.9585, -57.9055],
      [-34.9625, -58.0255]
    ],
    alquiler_ars: 395000,
    expensas_ars: 58000,
    servicios_ars: 45000,
    canasta_comercios_ars: 198000,
    transporte_ars: 35000,
    impuestos_y_servicios: { abl_municipal_ars: 9000, luz_edenor_edesur_ars: 13500, gas_metrogas_ars: 7500, agua_aysa_ars: 6500, internet_fibra_ars: 8500 },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Centros Comerciales (Calle 8, Calle 12 y Cantilo City Bell)", valores: "Leche 1L: $1.260 | Fideos 500g: $1.000 | Yerba 1kg: $3.200", mensual_ars: 72000 },
      { tipo: "🥩 Carnicerías y Pollerías Platenses", valores: "Asado 1kg: $7.700 | Suprema 1kg: $5.400 | Maple huevos: $3.700", mensual_ars: 48000 },
      { tipo: "🥬 Quintas del Cordón Hortícola Platense (Verdura directa de quinta)", valores: "Bolsón verdura 8kg: $6.200 | Tomate platense 1kg: $1.300 | Lechuga: $900", mensual_ars: 24000 },
      { tipo: "🥖 Panaderías, Comedores Universitarios y Cafés (Diagonal 74 / Plaza Paso)", valores: "Pan 1kg: $2.050 | Menú estudiantil/ejecutivo: $5.500", mensual_ars: 21000 },
      { tipo: "🧺 Lavaderos de Ropa y Farmacias", valores: "Valet ropa: $3.800 | Limpieza mensual: $9.000", mensual_ars: 16000 },
      { tipo: "🏋️ Gimnasios y Clubes (Estudiantes, Gimnasia, Universitario)", valores: "Cuota mensual: $19.000", mensual_ars: 17000 }
    ],
    gastos_alrededor_detalle: "Universidad Nacional de La Plata (UNLP), Tren Roca eléctrico a Constitución, Autopista Buenos Aires - La Plata y diagonales con transporte directo."
  }
];

function getZoneCenter(zone) {
  const pts = zone.coords || [];
  if (pts.length === 0) return [-34.6037, -58.4116];
  const lat = pts.reduce((s, c) => s + c[0], 0) / pts.length;
  const lng = pts.reduce((s, c) => s + c[1], 0) / pts.length;
  return [lat, lng];
}

// Re-indexa siempre los Puntos de Interés en orden correlativo (A, B, C, D...) cada vez que se borra o agrega uno
function reindexPois() {
  appState.pois.forEach((poi, idx) => {
    const newCode = String.fromCharCode(65 + (idx % 26));
    const oldCode = poi.code;
    poi.code = newCode;
    poi.color = POI_PALETTE[idx % POI_PALETTE.length];
    // Si tenía el nombre genérico "Punto X", lo actualiza a la nueva letra ("Punto A", "Punto B", etc.)
    if (!poi.label || /^Punto [A-Z]$/i.test(poi.label.trim()) || poi.label.trim() === `Punto ${oldCode}`) {
      poi.label = `Punto ${newCode}`;
    }
  });
}

// Base de datos offline + online de coordenadas y valores reales de TODA la Provincia de Buenos Aires (135 municipios) y los 48 barrios de CABA
const BUENOS_AIRES_COMPLETE_LOCATIONS_DB = [
  // Costa Atlántica e Interior de la Provincia de Buenos Aires
  { keys: ["miramar", "general alvarado", "alvarado"], name: "Miramar (General Alvarado)", slug: "miramar", lat: -38.2719, lng: -57.8389, rent: 365000, exp: 42000, coastOrientation: "se" },
  { keys: ["mar del plata", "general pueyrredon", "mdq", "mardel"], name: "Mar del Plata (Gral. Pueyrredón)", slug: "mar-del-plata", lat: -38.0055, lng: -57.5426, rent: 420000, exp: 58000, coastOrientation: "se" },
  { keys: ["necochea", "quequen"], name: "Necochea", slug: "necochea", lat: -38.5545, lng: -58.7396, rent: 350000, exp: 39000, coastOrientation: "s" },
  { keys: ["pinamar", "ostende", "valeria del mar", "carilo"], name: "Pinamar", slug: "pinamar", lat: -37.1079, lng: -56.8614, rent: 490000, exp: 68000, coastOrientation: "e" },
  { keys: ["villa gesell", "gesell", "mar de las pampas", "mar azul"], name: "Villa Gesell", slug: "villa-gesell", lat: -37.2639, lng: -56.9730, rent: 390000, exp: 46000, coastOrientation: "e" },
  { keys: ["partido de la costa", "la costa", "san bernardo", "mar de ajo", "santa teresita", "san clemente", "las toninas"], name: "Partido de La Costa (San Bernardo / Mar de Ajó)", slug: "la-costa", lat: -36.6885, lng: -56.6775, rent: 345000, exp: 38000, coastOrientation: "e" },
  { keys: ["mar chiquita", "santa clara del mar", "coronel vidal"], name: "Mar Chiquita / Santa Clara del Mar", slug: "mar-chiquita", lat: -37.8385, lng: -57.5035, rent: 355000, exp: 36000, coastOrientation: "se" },
  { keys: ["monte hermoso"], name: "Monte Hermoso", slug: "monte-hermoso", lat: -38.9839, lng: -61.2897, rent: 360000, exp: 38000, coastOrientation: "s" },
  { keys: ["tandil"], name: "Tandil", slug: "tandil", lat: -37.3217, lng: -59.1332, rent: 395000, exp: 45000 },
  { keys: ["bahia blanca", "ingeniero white"], name: "Bahía Blanca", slug: "bahia-blanca", lat: -38.7183, lng: -62.2663, rent: 385000, exp: 48000 },
  { keys: ["olavarria"], name: "Olavarría", slug: "olavarria", lat: -36.8927, lng: -60.3225, rent: 355000, exp: 38000 },
  { keys: ["azul"], name: "Azul", slug: "azul", lat: -36.7770, lng: -59.8585, rent: 340000, exp: 34000 },
  { keys: ["balcarce"], name: "Balcarce", slug: "balcarce", lat: -37.8464, lng: -58.2556, rent: 345000, exp: 35000 },
  { keys: ["tres arroyos", "claromeco"], name: "Tres Arroyos", slug: "tres-arroyos", lat: -38.3739, lng: -60.2798, rent: 340000, exp: 34000 },
  { keys: ["junin"], name: "Junín", slug: "junin", lat: -34.5850, lng: -60.9489, rent: 360000, exp: 39000 },
  { keys: ["pergamino"], name: "Pergamino", slug: "pergamino", lat: -33.8900, lng: -60.5736, rent: 365000, exp: 41000 },
  { keys: ["san nicolas", "san nicolas de los arroyos"], name: "San Nicolás de los Arroyos", slug: "san-nicolas", lat: -33.3358, lng: -60.2252, rent: 370000, exp: 42000 },
  { keys: ["zarate"], name: "Zárate", slug: "zarate", lat: -34.0981, lng: -59.0286, rent: 380000, exp: 44000 },
  { keys: ["campana"], name: "Campana", slug: "campana", lat: -34.1687, lng: -58.9591, rent: 395000, exp: 48000 },
  { keys: ["lujan"], name: "Luján", slug: "lujan", lat: -34.5703, lng: -59.1050, rent: 385000, exp: 44000 },
  { keys: ["mercedes"], name: "Mercedes", slug: "mercedes", lat: -34.6515, lng: -59.4307, rent: 360000, exp: 38000 },
  { keys: ["chivilcoy"], name: "Chivilcoy", slug: "chivilcoy", lat: -34.8957, lng: -60.0167, rent: 350000, exp: 36000 },
  { keys: ["chacabuco"], name: "Chacabuco", slug: "chacabuco", lat: -34.6417, lng: -60.4739, rent: 345000, exp: 34000 },
  { keys: ["chascomus"], name: "Chascomús", slug: "chascomus", lat: -35.5750, lng: -58.0089, rent: 365000, exp: 38000 },
  { keys: ["dolores"], name: "Dolores", slug: "dolores", lat: -36.3132, lng: -57.6792, rent: 335000, exp: 32000 },
  { keys: ["canuelas", "cañuelas"], name: "Cañuelas", slug: "canuelas", lat: -35.0519, lng: -58.7606, rent: 380000, exp: 42000 },
  { keys: ["san vicente", "alejandro korn"], name: "San Vicente", slug: "san-vicente", lat: -35.0250, lng: -58.4231, rent: 375000, exp: 41000 },
  { keys: ["lobos"], name: "Lobos", slug: "lobos", lat: -35.1844, lng: -59.0947, rent: 355000, exp: 35000 },
  { keys: ["monte", "san miguel del monte"], name: "San Miguel del Monte", slug: "san-miguel-del-monte", lat: -35.4386, lng: -58.8067, rent: 350000, exp: 34000 },
  { keys: ["brandsen"], name: "Brandsen", slug: "brandsen", lat: -35.1669, lng: -58.2344, rent: 355000, exp: 35000 },
  { keys: ["san pedro"], name: "San Pedro", slug: "san-pedro", lat: -33.6792, lng: -59.6669, rent: 355000, exp: 36000 },
  { keys: ["baradero"], name: "Baradero", slug: "baradero", lat: -33.8089, lng: -59.5056, rent: 345000, exp: 34000 },
  { keys: ["ramallo"], name: "Ramallo", slug: "ramallo", lat: -33.4847, lng: -60.0069, rent: 350000, exp: 35000 },
  { keys: ["san antonio de areco", "areco"], name: "San Antonio de Areco", slug: "san-antonio-de-areco", lat: -34.2500, lng: -59.4719, rent: 375000, exp: 38000 },
  { keys: ["exaltacion de la cruz", "capilla del senor", "capilla del señor"], name: "Exaltación de la Cruz (Capilla del Señor)", slug: "exaltacion-de-la-cruz", lat: -34.2922, lng: -59.1019, rent: 385000, exp: 42000 },
  { keys: ["san andres de giles", "giles"], name: "San Andrés de Giles", slug: "san-andres-de-giles", lat: -34.4444, lng: -59.4428, rent: 355000, exp: 35000 },
  { keys: ["arrecifes"], name: "Arrecifes", slug: "arrecifes", lat: -34.0639, lng: -60.1036, rent: 340000, exp: 33000 },
  { keys: ["salto"], name: "Salto", slug: "salto", lat: -34.2928, lng: -60.2544, rent: 345000, exp: 34000 },
  { keys: ["rojas"], name: "Rojas", slug: "rojas", lat: -34.1978, lng: -60.7350, rent: 340000, exp: 32000 },
  { keys: ["colon"], name: "Colón", slug: "colon", lat: -33.8928, lng: -61.1008, rent: 340000, exp: 32000 },
  { keys: ["9 de julio", "nueve de julio"], name: "9 de Julio", slug: "9-de-julio", lat: -35.4444, lng: -60.8831, rent: 345000, exp: 34000 },
  { keys: ["bragado"], name: "Bragado", slug: "bragado", lat: -35.1186, lng: -60.4897, rent: 340000, exp: 33000 },
  { keys: ["lincoln"], name: "Lincoln", slug: "lincoln", lat: -34.8653, lng: -61.5292, rent: 340000, exp: 33000 },
  { keys: ["trenque lauquen"], name: "Trenque Lauquen", slug: "trenque-lauquen", lat: -35.9708, lng: -62.7317, rent: 355000, exp: 35000 },
  { keys: ["pehuajo"], name: "Pehuajó", slug: "pehuajo", lat: -35.8117, lng: -61.8978, rent: 340000, exp: 33000 },
  { keys: ["bolivar", "san carlos de bolivar"], name: "Bolívar", slug: "bolivar", lat: -36.2333, lng: -61.1167, rent: 340000, exp: 33000 },
  { keys: ["25 de mayo", "veinticinco de mayo"], name: "25 de Mayo", slug: "25-de-mayo", lat: -35.4322, lng: -60.1725, rent: 335000, exp: 32000 },
  { keys: ["saladillo"], name: "Saladillo", slug: "saladillo", lat: -35.6372, lng: -59.7778, rent: 340000, exp: 33000 },
  { keys: ["las flores"], name: "Las Flores", slug: "las-flores", lat: -36.0139, lng: -59.0997, rent: 335000, exp: 31000 },
  { keys: ["ayacucho"], name: "Ayacucho", slug: "ayacucho", lat: -37.1525, lng: -58.4886, rent: 330000, exp: 30000 },
  { keys: ["general madariaga", "madariaga"], name: "General Madariaga", slug: "general-madariaga", lat: -37.0019, lng: -57.1356, rent: 345000, exp: 32000 },
  { keys: ["coronel suarez"], name: "Coronel Suárez", slug: "coronel-suarez", lat: -37.4547, lng: -61.9333, rent: 345000, exp: 33000 },
  { keys: ["coronel pringles", "pringles"], name: "Coronel Pringles", slug: "coronel-pringles", lat: -37.9853, lng: -61.3536, rent: 335000, exp: 31000 },
  { keys: ["coronel rosales", "punta alta"], name: "Punta Alta (Coronel Rosales)", slug: "punta-alta", lat: -38.8758, lng: -62.0736, rent: 345000, exp: 33000 },
  { keys: ["tornquist", "sierra de la ventana", "villa ventana"], name: "Tornquist / Sierra de la Ventana", slug: "sierra-de-la-ventana", lat: -38.1389, lng: -61.7944, rent: 365000, exp: 36000 },
  { keys: ["patagones", "carmen de patagones"], name: "Carmen de Patagones", slug: "carmen-de-patagones", lat: -40.7969, lng: -62.9847, rent: 340000, exp: 32000 },
  // GBA Norte, Oeste y Sur adicionales
  { keys: ["pilar", "del viso", "champagnat"], name: "Pilar", slug: "pilar", lat: -34.4585, lng: -58.9145, rent: 465000, exp: 78000 },
  { keys: ["escobar", "belen de escobar", "ingeniero maschwitz", "maschwitz", "garin"], name: "Escobar / Ing. Maschwitz", slug: "escobar", lat: -34.3483, lng: -58.7931, rent: 445000, exp: 72000 },
  { keys: ["tigre", "nordelta", "benavidez", "general pacheco", "don torcuato"], name: "Tigre", slug: "tigre", lat: -34.4255, lng: -58.5795, rent: 510000, exp: 88000 },
  { keys: ["san fernando", "victoria", "virreyes"], name: "San Fernando", slug: "san-fernando", lat: -34.4422, lng: -58.5583, rent: 465000, exp: 74000 },
  { keys: ["san miguel", "muniz", "muñiz", "bella vista"], name: "San Miguel / Bella Vista", slug: "san-miguel", lat: -34.5431, lng: -58.7119, rent: 415000, exp: 62000 },
  { keys: ["malvinas argentinas", "los polvorines", "grand bourg", "tortuguitas"], name: "Malvinas Argentinas", slug: "malvinas-argentinas", lat: -34.5019, lng: -58.6989, rent: 390000, exp: 52000 },
  { keys: ["jose c paz", "jose c. paz"], name: "José C. Paz", slug: "jose-c-paz", lat: -34.5158, lng: -58.7658, rent: 355000, exp: 42000 },
  { keys: ["hurlingham", "villa tesei", "william morris"], name: "Hurlingham", slug: "hurlingham", lat: -34.5897, lng: -58.6386, rent: 410000, exp: 55000 },
  { keys: ["ituzaingo", "parque leloir"], name: "Ituzaingó", slug: "ituzaingo", lat: -34.6595, lng: -58.6675, rent: 425000, exp: 58000 },
  { keys: ["merlo", "san antonio de padua", "padua"], name: "Merlo / San Antonio de Padua", slug: "merlo", lat: -34.6653, lng: -58.7275, rent: 375000, exp: 45000 },
  { keys: ["moreno", "paso del rey", "francisco alvarez"], name: "Moreno", slug: "moreno", lat: -34.6497, lng: -58.7900, rent: 365000, exp: 44000 },
  { keys: ["general rodriguez"], name: "General Rodríguez", slug: "general-rodriguez", lat: -34.6083, lng: -58.9525, rent: 355000, exp: 41000 },
  { keys: ["marcos paz"], name: "Marcos Paz", slug: "marcos-paz", lat: -34.7731, lng: -58.8364, rent: 345000, exp: 38000 },
  { keys: ["san justo", "isidro casanova", "ciudad evita", "laferrere", "la matanza"], name: "San Justo / La Matanza", slug: "la-matanza", lat: -34.6833, lng: -58.5608, rent: 395000, exp: 52000 },
  { keys: ["quilmes", "bernal", "don bosco", "ezpeleta", "solano"], name: "Quilmes / Bernal", slug: "quilmes", lat: -34.7245, lng: -58.2565, rent: 435000, exp: 66000, coastOrientation: "ne" },
  { keys: ["berazategui", "ranelagh", "hudson"], name: "Berazategui / Ranelagh", slug: "berazategui", lat: -34.7633, lng: -58.2117, rent: 415000, exp: 59000 },
  { keys: ["florencio varela", "varela"], name: "Florencio Varela", slug: "florencio-varela", lat: -34.8069, lng: -58.2797, rent: 365000, exp: 44000 },
  { keys: ["almirante brown", "adrogue", "burzaco", "rafael calzada", "longchamps", "glew"], name: "Adrogué / Almirante Brown", slug: "almirante-brown", lat: -34.7985, lng: -58.3895, rent: 425000, exp: 62000 },
  { keys: ["esteban echeverria", "monte grande", "canning", "luis guillon"], name: "Monte Grande / Canning (E. Echeverría)", slug: "esteban-echeverria", lat: -34.8167, lng: -58.4667, rent: 435000, exp: 65000 },
  { keys: ["ezeiza", "tristan suarez", "speggazzini"], name: "Ezeiza", slug: "ezeiza", lat: -34.8539, lng: -58.5236, rent: 415000, exp: 58000 },
  { keys: ["presidente peron", "guernica"], name: "Guernica (Presidente Perón)", slug: "presidente-peron", lat: -34.9189, lng: -58.3869, rent: 350000, exp: 39000 },
  { keys: ["berisso", "ensenada"], name: "Berisso / Ensenada", slug: "berisso", lat: -34.8728, lng: -57.8858, rent: 360000, exp: 42000 }
];

function findBuenosAiresOfflineLocation(rawQuery) {
  const low = (rawQuery || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\(.*?\)/g, "").trim();
  if (!low) return null;
  for (const entry of BUENOS_AIRES_COMPLETE_LOCATIONS_DB) {
    if (entry.keys.some(k => low === k || low.includes(k) || k.includes(low))) {
      return entry;
    }
  }
  return null;
}

// Genera polígonos orgánicos multi-vértice (10 a 14 vértices siguiendo traza urbana / costa / vías, NUNCA cuadrados rígidos)
function buildOrganicSubzonePolygons(centerLat, centerLng, coastOrientation = null) {
  // Si es ciudad costera del Atlántico Sur/Sudeste (ej: Miramar, Mar del Plata, Necochea), recorta hacia tierra firme al noroeste para no pisar el mar
  const shiftLat = coastOrientation === "se" ? 0.0045 : (coastOrientation === "s" ? 0.0055 : 0);
  const shiftLng = coastOrientation === "se" ? -0.0045 : (coastOrientation === "e" ? -0.0055 : 0);
  const cLat = centerLat + shiftLat;
  const cLng = centerLng + shiftLng;

  // Polígono orgánico multi-vértice para el Casco Céntrico / Comercial (9 vértices siguiendo diagonales y avenidas)
  const centroCoords = [
    [cLat + 0.0068, cLng - 0.0082],
    [cLat + 0.0084, cLng - 0.0035],
    [cLat + 0.0076, cLng + 0.0018],
    [cLat + 0.0042, cLng + 0.0048],
    [cLat - 0.0008, cLng + 0.0042],
    [cLat - 0.0048, cLng + 0.0012],
    [cLat - 0.0062, cLng - 0.0038],
    [cLat - 0.0038, cLng - 0.0088],
    [cLat + 0.0018, cLng - 0.0098]
  ];

  // Polígono orgánico multi-vértice contiguo para el Sector Residencial / Barrios Periféricos (10 vértices)
  const resLat = cLat + (coastOrientation ? 0.0095 : -0.0035);
  const resLng = cLng + (coastOrientation ? -0.0115 : 0.0115);
  const residencialCoords = [
    [resLat + 0.0078, resLng - 0.0065],
    [resLat + 0.0095, resLng - 0.0010],
    [resLat + 0.0082, resLng + 0.0058],
    [resLat + 0.0045, resLng + 0.0092],
    [resLat - 0.0012, resLng + 0.0085],
    [resLat - 0.0062, resLng + 0.0052],
    [resLat - 0.0078, resLng - 0.0008],
    [resLat - 0.0058, resLng - 0.0062],
    [resLat - 0.0015, resLng - 0.0082],
    [resLat + 0.0038, resLng - 0.0078]
  ];

  return { centroCoords, residencialCoords };
}

// Extrae contornos reales GeoJSON de OpenStreetMap Nominatim (polygon_geojson=1) y los divide en 2 sub-zonas con límites reales de calles/ríos/municipios
function extractRealBoundaryRingsFromGeoJSON(geojson) {
  if (!geojson || !geojson.type || !geojson.coordinates) return null;
  let outerRing = null;
  if (geojson.type === "Polygon" && Array.isArray(geojson.coordinates[0])) {
    outerRing = geojson.coordinates[0];
  } else if (geojson.type === "MultiPolygon" && Array.isArray(geojson.coordinates[0]) && Array.isArray(geojson.coordinates[0][0])) {
    // Elegir el anillo con más vértices
    let best = geojson.coordinates[0][0];
    geojson.coordinates.forEach(poly => {
      if (Array.isArray(poly[0]) && poly[0].length > best.length) best = poly[0];
    });
    outerRing = best;
  }
  if (!outerRing || outerRing.length < 5) return null;

  // Convertir [lng, lat] de GeoJSON a [lat, lng] de Leaflet y simplificar a máximo ~45 vértices para fluidez
  const step = Math.max(1, Math.floor(outerRing.length / 44));
  const leafletPts = [];
  for (let i = 0; i < outerRing.length; i += step) {
    const pt = outerRing[i];
    if (Array.isArray(pt) && pt.length >= 2) {
      leafletPts.push([parseFloat(pt[1].toFixed(5)), parseFloat(pt[0].toFixed(5))]);
    }
  }
  if (leafletPts.length < 5) return null;

  // Si el polígono administrativo es gigantesco (ej: todo un partido rural de 60km), acotarlo al radio urbano manteniendo la forma multi-vértice real
  const lats = leafletPts.map(p => p[0]);
  const lngs = leafletPts.map(p => p[1]);
  const spanLat = Math.max(...lats) - Math.min(...lats);
  const spanLng = Math.max(...lngs) - Math.min(...lngs);
  if (spanLat > 0.14 || spanLng > 0.16) {
    const cLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const cLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    const scaleLat = 0.032 / Math.max(0.01, spanLat);
    const scaleLng = 0.038 / Math.max(0.01, spanLng);
    for (let i = 0; i < leafletPts.length; i++) {
      leafletPts[i] = [
        parseFloat((cLat + (leafletPts[i][0] - cLat) * scaleLat).toFixed(5)),
        parseFloat((cLng + (leafletPts[i][1] - cLng) * scaleLng).toFixed(5))
      ];
    }
  }

  // Dividir el contorno real en dos mitades orgánicas (Centro/Norte vs Residencial/Sur) siguiendo los vértices reales del mapa
  const midIdx = Math.floor(leafletPts.length / 2);
  const halfA = leafletPts.slice(0, midIdx + 1);
  const halfB = [leafletPts[0], ...leafletPts.slice(midIdx)];
  if (halfA.length >= 4 && halfB.length >= 4) {
    return { centroCoords: halfA, residencialCoords: halfB };
  }
  return null;
}

// Geocodificador de direcciones, avenidas con altura, esquinas y localidades de TODA CABA y PROVINCIA DE BUENOS AIRES
async function geocodeAddressInCaba(rawAddress) {
  const text = (rawAddress || "").trim();
  if (!text) return null;
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 0. Buscar en nuestra base completa de ciudades y municipios de toda la Provincia de Buenos Aires (Miramar, Tandil, Mar del Plata, Necochea, etc.)
  const offlineLoc = findBuenosAiresOfflineLocation(lower);
  if (offlineLoc && !/\d{2,5}/.test(lower)) {
    return { lat: offlineLoc.lat, lng: offlineLoc.lng, formatted: `${offlineLoc.name}, Provincia de Buenos Aires` };
  }

  // 1. Puntos de referencia, esquinas famosas, estaciones y centros urbanos de CABA y Provincia de Buenos Aires
  const landmarks = [
    { keys: ["obelisco", "9 de julio y corrientes", "corrientes y 9 de julio"], lat: -34.6037, lng: -58.3816, formatted: "Obelisco (Av. 9 de Julio y Av. Corrientes, CABA)" },
    { keys: ["cabildo y juramento", "juramento y cabildo"], lat: -34.5622, lng: -58.4565, formatted: "Av. Cabildo y Av. Juramento (Belgrano, CABA)" },
    { keys: ["acoyte y rivadavia", "rivadavia y acoyte", "primera junta"], lat: -34.6182, lng: -58.4368, formatted: "Av. Rivadavia y Av. Acoyte (Caballito, CABA)" },
    { keys: ["corrientes y medrano", "medrano y corrientes"], lat: -34.6036, lng: -58.4208, formatted: "Av. Corrientes y Av. Medrano (Almagro, CABA)" },
    { keys: ["cordoba y medrano", "medrano y cordoba"], lat: -34.5988, lng: -58.4205, formatted: "Av. Córdoba y Av. Medrano (Almagro Norte, CABA)" },
    { keys: ["corrientes y scalabrini", "scalabrini ortiz y corrientes", "malabia"], lat: -34.5982, lng: -58.4392, formatted: "Av. Corrientes y Av. Scalabrini Ortiz (Villa Crespo, CABA)" },
    { keys: ["santa fe y juan b justo", "puente pacifico", "pacifico", "palermo"], lat: -34.5782, lng: -58.4258, formatted: "Av. Santa Fe y Av. Juan B. Justo (Palermo, CABA)" },
    { keys: ["plaza italia", "santa fe y sarmiento", "rural"], lat: -34.5815, lng: -58.4208, formatted: "Plaza Italia (Palermo, CABA)" },
    { keys: ["plaza serrano", "cortazar", "serrano y honduras"], lat: -34.5885, lng: -58.4305, formatted: "Plaza Serrano / Honduras (Palermo Soho, CABA)" },
    { keys: ["parque centenario", "diaz velez", "angel gallardo"], lat: -34.6065, lng: -58.4355, formatted: "Parque Centenario (Caballito / Almagro, CABA)" },
    { keys: ["parque rivadavia"], lat: -34.6175, lng: -58.4342, formatted: "Parque Rivadavia (Caballito, CABA)" },
    { keys: ["pedro goyena", "goyena"], lat: -34.6242, lng: -58.4395, formatted: "Av. Pedro Goyena 800 (Caballito Sur, CABA)" },
    { keys: ["retiro", "estacion retiro", "libertador 100"], lat: -34.5912, lng: -58.3745, formatted: "Estación Retiro (CABA)" },
    { keys: ["constitucion", "estacion constitucion"], lat: -34.6275, lng: -58.3812, formatted: "Estación Constitución (CABA)" },
    { keys: ["once", "plaza miserere", "pueyrredon y rivadavia"], lat: -34.6098, lng: -58.4062, formatted: "Plaza Miserere / Once (CABA)" },
    { keys: ["congreso", "callao y rivadavia"], lat: -34.6092, lng: -58.3922, formatted: "Congreso (Av. Callao y Av. Rivadavia, CABA)" },
    { keys: ["ciudad universitaria", "fadu", "exactas", "nunez", "nuñez"], lat: -34.5425, lng: -58.4415, formatted: "Ciudad Universitaria / Núñez (CABA)" },
    { keys: ["facultad de medicina", "fmed", "economicas", "cordoba 2100", "plaza houssay"], lat: -34.5992, lng: -58.3978, formatted: "Plaza Houssay / Av. Córdoba 2100 (CABA)" },
    { keys: ["ingenieria", "fiuba", "paseo colon 850", "las heras 2200"], lat: -34.5885, lng: -58.3965, formatted: "Av. Las Heras 2200 (Recoleta, CABA)" },
    { keys: ["utn", "medrano 951"], lat: -34.5985, lng: -58.4202, formatted: "UTN (Av. Medrano 951, Almagro, CABA)" },
    { keys: ["puerto madero"], lat: -34.6085, lng: -58.3635, formatted: "Puerto Madero (CABA)" },
    { keys: ["recoleta", "las heras", "santa fe y callao"], lat: -34.5895, lng: -58.3935, formatted: "Recoleta (CABA)" },
    { keys: ["colegiales", "lacroze", "alvarez thomas"], lat: -34.5752, lng: -58.4492, formatted: "Colegiales (CABA)" },
    { keys: ["belgrano r", "melian", "cramer"], lat: -34.5675, lng: -58.4665, formatted: "Belgrano R (CABA)" },
    { keys: ["villa urquiza", "triunvirato", "saavedra"], lat: -34.5735, lng: -58.4865, formatted: "Villa Urquiza / Av. Triunvirato (CABA)" },
    { keys: ["devoto", "villa devoto", "plaza arenales", "villa del parque"], lat: -34.6005, lng: -58.5115, formatted: "Villa Devoto / Plaza Arenales (CABA)" },
    { keys: ["flores", "floresta", "carabobo", "san pedrito"], lat: -34.6285, lng: -58.4625, formatted: "Flores / Av. Rivadavia (CABA)" },
    { keys: ["liniers", "mataderos", "villa luro"], lat: -34.6395, lng: -58.5245, formatted: "Liniers / Av. Rivadavia y Gral. Paz (CABA)" },
    { keys: ["san telmo", "parque patricios", "barracas", "monserrat"], lat: -34.6215, lng: -58.3735, formatted: "San Telmo / Casco Histórico (CABA)" },
    // GBA Zona Norte
    { keys: ["olivos", "vicente lopez", "la lucila", "maipu", "puente saavedra"], lat: -34.5105, lng: -58.4865, formatted: "Olivos / Av. Maipú (Vicente López, GBA Norte)" },
    { keys: ["munro", "florida oeste", "villa martelli"], lat: -34.5315, lng: -58.5215, formatted: "Munro / Florida Oeste (Vicente López, GBA Norte)" },
    { keys: ["san isidro", "martinez", "acassuso", "beccar", "boulogne"], lat: -34.4725, lng: -58.5145, formatted: "San Isidro / Martínez (GBA Norte)" },
    { keys: ["tigre", "san fernando", "pacheco", "nordelta", "don torcuato"], lat: -34.4255, lng: -58.5795, formatted: "Tigre Centro (GBA Norte)" },
    { keys: ["pilar", "escobar", "campana", "zarate"], lat: -34.4585, lng: -58.9145, formatted: "Pilar Centro (Provincia de Buenos Aires)" },
    { keys: ["san martin", "villa ballester", "unsam", "san andres"], lat: -34.5755, lng: -58.5385, formatted: "General San Martín / Villa Ballester (GBA Noroeste)" },
    // GBA Zona Oeste
    { keys: ["ramos mejia", "ramos", "haedo", "unlam", "san justo"], lat: -34.6415, lng: -58.5645, formatted: "Ramos Mejía (La Matanza, GBA Oeste)" },
    { keys: ["caseros", "ciudad jardin", "palomar", "tres de febrero", "santos lugares"], lat: -34.6095, lng: -58.5635, formatted: "Caseros / Tres de Febrero (GBA Oeste)" },
    { keys: ["moron", "castelar", "hurlingham"], lat: -34.6515, lng: -58.6225, formatted: "Morón / Castelar (GBA Oeste)" },
    { keys: ["ituzaingo", "parque leloir", "padua", "merlo", "moreno", "lujan"], lat: -34.6595, lng: -58.6675, formatted: "Ituzaingó / Corredor Oeste (GBA Oeste)" },
    // GBA Zona Sur y La Plata / PBA
    { keys: ["avellaneda", "wilde", "sarandi", "gerli", "dock sud"], lat: -34.6625, lng: -58.3645, formatted: "Avellaneda Centro (Av. Mitre, GBA Sur)" },
    { keys: ["lanus", "remedios de escalada", "lanusita", "monte chingolo"], lat: -34.7075, lng: -58.3905, formatted: "Lanús (GBA Sur)" },
    { keys: ["lomas de zamora", "lomas", "las lomitas", "banfield", "temperley"], lat: -34.7605, lng: -58.4005, formatted: "Lomas de Zamora / Banfield (GBA Sur)" },
    { keys: ["adrogue", "burzaco", "monte grande", "ezeiza", "canning"], lat: -34.7985, lng: -58.3895, formatted: "Adrogué / Almirante Brown (GBA Sur)" },
    { keys: ["quilmes", "bernal", "berazategui", "ezpeleta", "florencio varela"], lat: -34.7245, lng: -58.2565, formatted: "Quilmes / Bernal (GBA Sur)" },
    { keys: ["la plata", "city bell", "gonnet", "tolosa", "unlp", "plaza moreno"], lat: -34.9215, lng: -57.9545, formatted: "La Plata (Casco Urbano, Provincia de Buenos Aires)" },
    { keys: ["miramar", "general alvarado"], lat: -38.2719, lng: -57.8389, formatted: "Miramar (General Alvarado, Provincia de Buenos Aires)" },
    { keys: ["mar del plata", "mdq"], lat: -38.0055, lng: -57.5426, formatted: "Mar del Plata (Provincia de Buenos Aires)" },
    { keys: ["tandil"], lat: -37.3217, lng: -59.1332, formatted: "Tandil (Provincia de Buenos Aires)" },
    { keys: ["bahia blanca"], lat: -38.7183, lng: -62.2663, formatted: "Bahía Blanca (Provincia de Buenos Aires)" }
  ];

  for (const lm of landmarks) {
    if (lm.keys.some(k => lower.includes(k))) {
      return { lat: lm.lat, lng: lm.lng, formatted: text };
    }
  }

  // 2. Interpolación por Avenida / Calle + Altura numérica (ej: "Av. Corrientes 3200", "Av. Maipú 1500", "Rivadavia 14000", "Hipólito Yrigoyen 4500")
  const numMatch = lower.match(/\b(\d{2,5})\b/);
  const streetNum = numMatch ? parseInt(numMatch[1], 10) : null;

  const streetCorridors = [
    { keys: ["corrientes"], startNum: 100, endNum: 6500, start: [-34.6036, -58.3700], end: [-34.5895, -58.4545] },
    { keys: ["cordoba"], startNum: 100, endNum: 6200, start: [-34.5990, -58.3700], end: [-34.5815, -58.4485] },
    { keys: ["santa fe"], startNum: 500, endNum: 5300, start: [-34.5955, -58.3755], end: [-34.5735, -58.4335] },
    { keys: ["cabildo"], startNum: 1, endNum: 4900, start: [-34.5735, -58.4335], end: [-34.5375, -58.4765] },
    { keys: ["maipu"], startNum: 1, endNum: 4200, start: [-34.5375, -58.4765], end: [-34.4925, -58.4935] },
    { keys: ["rivadavia"], startNum: 100, endNum: 18500, start: [-34.6082, -58.3720], end: [-34.6515, -58.6225] },
    { keys: ["hipolito yrigoyen", "pavon"], startNum: 100, endNum: 13500, start: [-34.6625, -58.3785], end: [-34.7985, -58.3895] },
    { keys: ["mitre"], startNum: 100, endNum: 6500, start: [-34.6605, -58.3665], end: [-34.7025, -58.3215] },
    { keys: ["libertador"], startNum: 100, endNum: 16500, start: [-34.5905, -58.3765], end: [-34.4705, -58.5085] },
    { keys: ["juan b justo", "juan b. justo"], startNum: 1000, endNum: 9000, start: [-34.5775, -58.4255], end: [-34.6365, -58.5245] },
    { keys: ["scalabrini", "scalabrini ortiz"], startNum: 100, endNum: 3400, start: [-34.6035, -58.4360], end: [-34.5715, -58.4105] },
    { keys: ["medrano"], startNum: 1, endNum: 2000, start: [-34.6112, -58.4205], end: [-34.5915, -58.4185] },
    { keys: ["boedo"], startNum: 1, endNum: 2100, start: [-34.6115, -58.4190], end: [-34.6325, -58.4175] },
    { keys: ["acoyte"], startNum: 1, endNum: 1700, start: [-34.6182, -58.4368], end: [-34.6025, -58.4425] },
    { keys: ["directorio"], startNum: 1, endNum: 4500, start: [-34.6262, -58.4265], end: [-34.6395, -58.4755] },
    { keys: ["independencia"], startNum: 100, endNum: 4400, start: [-34.6170, -58.3700], end: [-34.6210, -58.4285] },
    { keys: ["belgrano"], startNum: 100, endNum: 4300, start: [-34.6128, -58.3700], end: [-34.6152, -58.4275] },
    { keys: ["callao"], startNum: 1, endNum: 2100, start: [-34.6092, -58.3922], end: [-34.5865, -58.3905] },
    { keys: ["pueyrredon"], startNum: 1, endNum: 2600, start: [-34.6098, -58.4062], end: [-34.5825, -58.3970] }
  ];

  for (const st of streetCorridors) {
    if (st.keys.some(k => lower.includes(k))) {
      const n = streetNum !== null ? streetNum : Math.round((st.startNum + st.endNum) / 2);
      const t = Math.max(0, Math.min(1, (n - st.startNum) / Math.max(1, st.endNum - st.startNum)));
      const lat = parseFloat((st.start[0] + (st.end[0] - st.start[0]) * t).toFixed(5));
      const lng = parseFloat((st.start[1] + (st.end[1] - st.start[1]) * t).toFixed(5));
      return { lat, lng, formatted: text };
    }
  }

  // 3. Fallback a OpenStreetMap Nominatim (para cualquier calle, esquina o localidad de CABA y Provincia de Buenos Aires)
  try {
    const q = encodeURIComponent(`${text}, Buenos Aires, Argentina`);
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`);
    if (resp.ok) {
      const results = await resp.json();
      if (Array.isArray(results) && results.length > 0) {
        return {
          lat: parseFloat(parseFloat(results[0].lat).toFixed(5)),
          lng: parseFloat(parseFloat(results[0].lon).toFixed(5)),
          formatted: text
        };
      }
    }
  } catch (err) {
    // Fallback silencioso
  }

  if (offlineLoc) {
    return { lat: offlineLoc.lat, lng: offlineLoc.lng, formatted: `${offlineLoc.name}, Provincia de Buenos Aires` };
  }

  return null;
}

// Suma al mapa las sub-zonas de cualquier barrio de CABA o cualquier municipio/ciudad de TODA la Provincia de Buenos Aires (sin pre-marcar nada que el usuario no elija)
async function mentionNeighborhoodAndShowInternalSubzones(rawQuery) {
  const box = document.getElementById("neighborhood-internal-subzones-box");
  const input = document.getElementById("neighborhood-mention-input");
  const rawText = (rawQuery || input?.value || "").trim();
  const q = rawText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s*\(caba\)\s*/g, "").trim();

  if (!box) return;

  if (!q) {
    renderUserSelectedZonesSidebar();
    return;
  }

  let matchedZones = [];

  if (q === "caba" || q === "capital" || q === "capital federal") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => !z.region || z.region === "caba");
  } else if (q.includes("zona-norte") || q.includes("gba norte") || q.includes("zona norte")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.region === "zona-norte");
  } else if (q.includes("zona-oeste") || q.includes("gba oeste") || q.includes("zona oeste")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.region === "zona-oeste");
  } else if (q.includes("zona-sur") || q.includes("gba sur") || q.includes("zona sur")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.region === "zona-sur" || z.region === "la-plata");
  } else if (q.includes("la-plata") || q.includes("la plata") || q.includes("city bell") || q.includes("gonnet") || q.includes("tolosa")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "la-plata" || z.region === "la-plata");
  } else if (q.includes("almagro") || q.includes("boedo")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "almagro");
  } else if (q.includes("caballito") || q.includes("centenario") || q.includes("goyena") || q.includes("chacabuco")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "caballito");
  } else if (q.includes("palermo") || q.includes("soho") || q.includes("hollywood") || q.includes("botanico")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "palermo" || z.id.includes("palermo"));
  } else if (q.includes("belgrano") || q.includes("barrancas") || q.includes("coghlan")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "belgrano");
  } else if (q.includes("crespo") || q.includes("chacarita")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "villa-crespo");
  } else if (q.includes("colegiales") || q.includes("lacroze")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "colegiales");
  } else if (q.includes("recoleta") || q.includes("chico")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "recoleta");
  } else if (q.includes("urquiza") || q.includes("saavedra")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "villa-urquiza");
  } else if (q.includes("nunez") || q.includes("nuñez")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "nunez");
  } else if (q.includes("devoto") || q.includes("villa del parque") || q.includes("paternal")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "villa-devoto");
  } else if (q.includes("flores") || q.includes("floresta") || q.includes("liniers") || q.includes("mataderos") || q.includes("luro")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "flores");
  } else if (q.includes("telmo") || q.includes("monserrat") || q.includes("patricios") || q.includes("barracas") || q.includes("boca")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "san-telmo");
  } else if (q.includes("olivos") || q.includes("vicente lopez") || q.includes("lucila") || q.includes("florida") || q.includes("munro") || q.includes("martelli")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "vicente-lopez" || z.slug === "san-martin");
  } else if (q.includes("san martin") || q.includes("ballester")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "san-martin");
  } else if (q === "san isidro" || q.includes("martinez") || q.includes("acassuso")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "san-isidro");
  } else if (q.includes("ramos") || q.includes("haedo") || q.includes("caseros") || q.includes("palomar") || q.includes("san justo") || q.includes("tres de febrero")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "ramos-mejia");
  } else if (q === "moron" || q.includes("castelar")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "moron");
  } else if (q.includes("avellaneda") || q.includes("wilde") || q.includes("sarandi") || q.includes("lanus") || q.includes("escalada") || q.includes("gerli")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "lanus");
  } else if (q.includes("lomas") || q.includes("banfield") || q.includes("temperley")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === "lomas-de-zamora");
  } else {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z =>
      z.slug === q || z.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)
    );
  }

  // Si la ciudad, partido o barrio de Buenos Aires (ej: Miramar, Tandil, Mar del Plata, Necochea, Bahía Blanca, Pinamar, Pilar, etc.) aún no fue instanciado, crearlo con límites reales GeoJSON / polígonos orgánicos
  if (matchedZones.length === 0) {
    box.style.display = "flex";
    box.innerHTML = `<div style="font-size:0.73rem; color:#38bdf8;">🔎 Trazando límites reales de "${escapeHtml(rawText)}" en la Provincia de Buenos Aires y consultando comercios...</div>`;
    const dynamicZones = await createDynamicBuenosAiresSubzones(rawText);
    if (dynamicZones && dynamicZones.length > 0) {
      matchedZones = dynamicZones;
    } else {
      box.innerHTML = `<div style="font-size:0.73rem; color:#fca5a5;">No pudimos encontrar "${escapeHtml(rawText)}". Probá con cualquier localidad o partido de Buenos Aires (ej: Miramar, Mar del Plata, Tandil, Necochea, Bahía Blanca, Pilar, Tigre, Luján, Quilmes, Almagro) o dibujá el área en el mapa.</div>`;
      return;
    }
  }

  // Agregar las sub-zonas elegidas por el usuario sin duplicar y consultar comercios reales en vivo
  matchedZones.forEach(z => {
    if (!appState.userSelectedZones.some(existing => existing.id === z.id)) {
      appState.userSelectedZones.push(z);
    }
    fetchLiveStoresInZoneFromOSM(z);
  });

  if (input) input.value = "";
  appState.mentionedBarrioSlug = q;
  selectedZoneForDeepDive = matchedZones[0] || appState.userSelectedZones[0];

  renderAffordabilityZonesOnMap();
  renderUserSelectedZonesSidebar();

  // Ajustar zoom del mapa para mostrar las sub-zonas recién agregadas por el usuario
  if (leafletMap && matchedZones.length > 0) {
    const allCoords = matchedZones.flatMap(z => z.coords);
    leafletMap.fitBounds(allCoords, { padding: [40, 40], maxZoom: 14 });
  }
}

// Crea las sub-zonas internas (Centro Comercial/Costanera vs Residencial/Periferia) con polígonos reales (polygon_geojson=1) u orgánicos multi-vértice para cualquier municipio o ciudad de TODA la Provincia de Buenos Aires
async function createDynamicBuenosAiresSubzones(rawLocalityName) {
  const cleanName = rawLocalityName.replace(/\s*\(.*?\)\s*/g, "").trim();
  const offlineEntry = findBuenosAiresOfflineLocation(cleanName);

  let centerLat = offlineEntry ? offlineEntry.lat : NaN;
  let centerLng = offlineEntry ? offlineEntry.lng : NaN;
  let shortTitle = offlineEntry ? offlineEntry.name : cleanName;
  let slug = offlineEntry
    ? offlineEntry.slug
    : cleanName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
  let realRings = null;

  // Intentar obtener el polígono límite real desde OpenStreetMap Nominatim con polygon_geojson=1
  try {
    const q = encodeURIComponent(`${cleanName}, Provincia de Buenos Aires, Argentina`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&limit=3&q=${q}`;
    const res = await fetch(url, { headers: { "Accept-Language": "es" } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const bestHit = data.find(d => d.geojson && (d.geojson.type === "Polygon" || d.geojson.type === "MultiPolygon")) || data[0];
        if (isNaN(centerLat) || isNaN(centerLng)) {
          centerLat = parseFloat(bestHit.lat);
          centerLng = parseFloat(bestHit.lon);
        }
        if (!offlineEntry && bestHit.display_name) {
          shortTitle = bestHit.display_name.split(",")[0].trim();
        }
        if (bestHit.geojson) {
          realRings = extractRealBoundaryRingsFromGeoJSON(bestHit.geojson);
        }
      }
    }
  } catch (err) {
    // Si falla la red o CORS, usa directamente las coordenadas y polígonos orgánicos de BUENOS_AIRES_COMPLETE_LOCATIONS_DB
  }

  if (isNaN(centerLat) || isNaN(centerLng)) return null;

  const baseTemplate = MAP_AFFORDABILITY_ZONES[0];
  const distFromCabaKm = getDistanceKm(centerLat, centerLng, -34.6037, -58.3816);
  const isInteriorPba = distFromCabaKm > 55;
  const baseRent = offlineEntry?.rent || (isInteriorPba ? 360000 : (distFromCabaKm > 22 ? 395000 : 465000));
  const baseExpensas = offlineEntry?.exp || (isInteriorPba ? 42000 : (distFromCabaKm > 22 ? 54000 : 78000));
  const baseCanasta = isInteriorPba ? 192000 : 208000;

  const polygons = realRings || buildOrganicSubzonePolygons(centerLat, centerLng, offlineEntry?.coastOrientation || null);

  const zoneCentro = {
    id: `zona-dyn-${slug}-centro`,
    slug: slug,
    region: isInteriorPba ? "pba-interior" : "gba",
    name: `${shortTitle} Centro / Corredor Principal`,
    urban_boundary_note: `Delimitación urbana real del casco céntrico, comercial y costero/ferroviario de ${shortTitle}, Provincia de Buenos Aires.`,
    bridge_price_effect: `El casco céntrico y corredor principal de ${shortTitle} concentra la mayor oferta comercial, bancaria y gastronómica; los alquileres son un ~15% superiores a las cuadras residenciales internas.`,
    coords: polygons.centroCoords,
    alquiler_ars: baseRent,
    expensas_ars: baseExpensas,
    servicios_ars: 46000,
    canasta_comercios_ars: baseCanasta,
    transporte_ars: 31000,
    impuestos_y_servicios: { ...baseTemplate.impuestos_y_servicios },
    locales_cercanos: baseTemplate.locales_cercanos.map(l => ({ ...l })),
    gastos_alrededor_detalle: `Casco comercial y administrativo de ${shortTitle} con acceso directo a supermercados, transporte y servicios.`
  };

  const zoneResidencial = {
    id: `zona-dyn-${slug}-residencial`,
    slug: slug,
    region: isInteriorPba ? "pba-interior" : "gba",
    name: `${shortTitle} Residencial / Barrios Internos`,
    urban_boundary_note: `Delimitación de los barrios residenciales de casas bajas, chalets y PHs de ${shortTitle}, Provincia de Buenos Aires.`,
    bridge_price_effect: `Alejándose unas cuadras de las avenidas principales de ${shortTitle} hacia las zonas residenciales, el alquiler baja un ~16% y predominan casas o PHs con cochera y sin expensas altas.`,
    coords: polygons.residencialCoords,
    alquiler_ars: Math.round(baseRent * 0.84),
    expensas_ars: Math.round(baseExpensas * 0.55),
    servicios_ars: 43000,
    canasta_comercios_ars: Math.round(baseCanasta * 0.93),
    transporte_ars: 32500,
    impuestos_y_servicios: { ...baseTemplate.impuestos_y_servicios },
    locales_cercanos: baseTemplate.locales_cercanos.map(l => ({ ...l })),
    gastos_alrededor_detalle: `Barrios residenciales de ${shortTitle} con almacenes de cercanía, clubes deportivos y casas con patio/cochera.`
  };

  MAP_AFFORDABILITY_ZONES.push(zoneCentro, zoneResidencial);
  return [zoneCentro, zoneResidencial];
}

function renderUserSelectedZonesSidebar() {
  const box = document.getElementById("neighborhood-internal-subzones-box");
  const alertsBox = document.getElementById("map-zonal-alerts-box");
  if (!box) return;

  if (!appState.userSelectedZones || appState.userSelectedZones.length === 0) {
    box.style.display = "none";
    box.innerHTML = "";
    if (alertsBox) {
      alertsBox.style.display = "none";
      alertsBox.innerHTML = "";
    }
    return;
  }

  box.style.display = "flex";
  box.innerHTML = `
    <div style="font-size:0.73rem; font-weight:800; color:#bae6fd; margin-bottom:0.15rem;">
      📌 ${appState.userSelectedZones.length} sub-zona${appState.userSelectedZones.length === 1 ? "" : "s"} elegida${appState.userSelectedZones.length === 1 ? "" : "s"} por vos en el mapa:
    </div>
    ${appState.userSelectedZones.map(z => {
      const zm = computeZoneAffordabilityMetrics(z);
      return `
        <div style="background:var(--bg-primary); border-left:3.5px solid ${zm.rentHex}; padding:0.45rem 0.55rem; border-radius:4px; border:1px solid var(--card-border);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.35rem;">
            <strong style="color:#fff; font-size:0.75rem;">${escapeHtml(z.name.split(" (")[0])}</strong>
            <button type="button" class="subzone-remove-btn" data-zone-id="${z.id}" title="Quitar esta zona del mapa" style="background:transparent; border:none; color:#fca5a5; cursor:pointer; font-size:0.72rem; font-weight:800;">✕</button>
          </div>
          <div style="font-size:0.71rem; color:#e2e8f0; margin-top:2px;">
            Costo Total (Vivienda + Vida): <strong style="color:${zm.rentHex};">$${zm.totalMensual.toLocaleString("es-AR")}/mes</strong> ${zm.hasSalary ? `(${zm.pctTotal}%)` : ""}
          </div>
          <div style="font-size:0.68rem; color:var(--text-secondary); margin:0.2rem 0 0.35rem; line-height:1.25;">
            ${escapeHtml(z.bridge_price_effect)}
          </div>
          <div style="display:flex; gap:0.35rem;">
            <button type="button" class="btn-sm btn-secondary subzone-focus-map-btn" data-zone-id="${z.id}" style="font-size:0.65rem; padding:0.15rem 0.45rem;">🗺️ Enfocar</button>
            <button type="button" class="btn-sm btn-primary subzone-open-detail-btn" data-zone-id="${z.id}" style="font-size:0.65rem; padding:0.15rem 0.45rem;">📊 Desconstruir costo</button>
          </div>
        </div>
      `;
    }).join("")}
  `;

  // Renderizar alertas zonales (obras de subte/tren, cortadas típicas de calles y cortes en accesos/rutas) para las zonas activas
  if (alertsBox) {
    const matchedAlerts = [];
    appState.userSelectedZones.forEach(z => {
      getZonalAlertsForZone(z).forEach(al => {
        if (!matchedAlerts.some(x => x.id === al.id)) matchedAlerts.push(al);
      });
    });
    if (matchedAlerts.length > 0) {
      alertsBox.style.display = "flex";
      alertsBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#fde68a; font-size:0.72rem;">🚧 Alertas Zonales (Subtes, Calles y Accesos):</strong>
          <button type="button" class="btn-link-mini" id="btn-inline-alert-report" style="font-size:0.64rem; color:#38bdf8;">⚠️ Avisar cambio</button>
        </div>
        ${matchedAlerts.slice(0, 3).map(al => `
          <div style="background:rgba(15,23,42,0.65); padding:0.35rem 0.45rem; border-radius:4px; border-left:2.5px solid #f59e0b; line-height:1.3;">
            <strong style="color:#fff;">${escapeHtml(al.titulo)}</strong>
            <div style="color:#cbd5e1; font-size:0.67rem; margin-top:2px;">${escapeHtml(al.detalle)}</div>
          </div>
        `).join("")}
      `;
      document.getElementById("btn-inline-alert-report")?.addEventListener("click", () => {
        openZonalDatabaseModal("nueva_alerta_vial");
      });
    } else {
      alertsBox.style.display = "none";
      alertsBox.innerHTML = "";
    }
  }

  box.querySelectorAll(".subzone-remove-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const zId = btn.getAttribute("data-zone-id");
      appState.userSelectedZones = appState.userSelectedZones.filter(z => z.id !== zId);
      renderAffordabilityZonesOnMap();
      renderUserSelectedZonesSidebar();
    });
  });

  box.querySelectorAll(".subzone-focus-map-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const zId = btn.getAttribute("data-zone-id");
      const found = appState.userSelectedZones.find(z => z.id === zId) || MAP_AFFORDABILITY_ZONES.find(z => z.id === zId);
      if (found && leafletMap) {
        selectedZoneForDeepDive = found;
        leafletMap.fitBounds(found.coords, { padding: [40, 40], maxZoom: 15 });
      }
    });
  });

  box.querySelectorAll(".subzone-open-detail-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const zId = btn.getAttribute("data-zone-id");
      const found = appState.userSelectedZones.find(z => z.id === zId) || MAP_AFFORDABILITY_ZONES.find(z => z.id === zId);
      if (found) {
        openZoneDetailedBreakdown(found);
      }
    });
  });
}

function setupInteractiveMap() {
  selectedZoneForDeepDive = null;

  // Map Budget Filter Live Sync
  document.getElementById("map-filter-operation")?.addEventListener("change", (e) => {
    appState.selectedOperation = e.target.value;
    renderAffordabilityZonesOnMap();
  });
  document.getElementById("map-filter-max-price")?.addEventListener("input", (e) => {
    const val = parseArsNumber(e.target.value);
    appState.maxPrice = val > 0 ? val : 0;
    renderAffordabilityZonesOnMap();
  });

  // Mencionar Barrio o Localidad de Todo Buenos Aires
  const mentionBtn = document.getElementById("btn-mention-neighborhood");
  const mentionInput = document.getElementById("neighborhood-mention-input");
  mentionBtn?.addEventListener("click", () => mentionNeighborhoodAndShowInternalSubzones());
  mentionInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      mentionNeighborhoodAndShowInternalSubzones();
    }
  });
  document.getElementById("btn-clear-all-map-zones")?.addEventListener("click", () => {
    appState.userSelectedZones = [];
    appState.mentionedBarrioSlug = null;
    if (mentionInput) mentionInput.value = "";
    renderAffordabilityZonesOnMap();
    renderUserSelectedZonesSidebar();
  });
  document.querySelectorAll(".barrio-quick-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const b = chip.getAttribute("data-barrio") || "";
      if (mentionInput) mentionInput.value = chip.textContent;
      mentionNeighborhoodAndShowInternalSubzones(b);
    });
  });

  // Polygon Drawing Actions
  document.getElementById("btn-draw-freehand-polygon")?.addEventListener("click", startPolygonDrawing);
  document.getElementById("btn-clear-freehand-polygon")?.addEventListener("click", clearDrawnPolygon);
  document.getElementById("btn-finish-drawn-polygon")?.addEventListener("click", finishPolygonDrawing);
  document.getElementById("btn-cancel-drawn-polygon")?.addEventListener("click", cancelPolygonDrawing);

  // Botón "+" para sumar múltiples Puntos de Interés (con nombre + dirección editable + re-indexado A, B, C...)
  const addPoiBtn = document.getElementById("btn-add-poi");
  const newPoiInput = document.getElementById("new-poi-name-input");
  const newPoiAddressInput = document.getElementById("new-poi-address-input");

  const handleAddPoi = async () => {
    const rawName = (newPoiInput?.value || "").trim();
    const rawAddr = (newPoiAddressInput?.value || "").trim();

    const nextIdx = appState.pois.length;
    const nextCode = String.fromCharCode(65 + (nextIdx % 26));
    const color = POI_PALETTE[nextIdx % POI_PALETTE.length];

    let lat = -34.6015;
    let lng = -58.4280;
    let resolvedAddr = rawAddr || "Centro del mapa (arrastrable)";

    if (rawAddr) {
      const geo = await geocodeAddressInCaba(rawAddr);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        resolvedAddr = geo.formatted;
      }
    } else if (leafletMap) {
      const center = leafletMap.getCenter();
      const jitterLat = ((nextIdx % 5) - 2) * 0.0038;
      const jitterLng = (((nextIdx * 2) % 5) - 2) * 0.0045;
      lat = parseFloat((center.lat + jitterLat).toFixed(5));
      lng = parseFloat((center.lng + jitterLng).toFixed(5));
    }

    const newPoi = {
      id: "poi-" + Date.now() + "-" + nextIdx,
      code: nextCode,
      label: rawName || `Punto ${nextCode}`,
      address: resolvedAddr,
      lat,
      lng,
      color
    };
    appState.pois.push(newPoi);
    reindexPois();

    if (newPoiInput) newPoiInput.value = "";
    if (newPoiAddressInput) newPoiAddressInput.value = "";

    renderPoisSidebarList();
    renderPoisOnLeafletMap();
    updateSortPoisSelectOptions();

    if (rawAddr && leafletMap) {
      leafletMap.panTo([lat, lng]);
    }
  };

  addPoiBtn?.addEventListener("click", handleAddPoi);
  newPoiInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddPoi();
    }
  });
  newPoiAddressInput?.addEventListener("keypress", (e) => {
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

  reindexPois();
  renderPoisSidebarList();
  updateSortPoisSelectOptions();
  initLeafletRealMap();
}

function initLeafletRealMap() {
  const mapEl = document.getElementById("leaflet-map");
  if (!mapEl || typeof L === "undefined") return;
  if (leafletMap) return;

  leafletMap = L.map("leaflet-map", {
    center: [-34.6150, -58.4450],
    zoom: 11,
    minZoom: 6,
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

// Renderiza la lista de Puntos de Interés en la barra lateral con Nombre, Dirección Editable, Re-indexado Automático (A, B, C...) y Rutas
function renderPoisSidebarList() {
  reindexPois();
  const container = document.getElementById("pois-list-container");
  const badge = document.getElementById("pois-count-badge");
  if (badge) {
    badge.textContent = `${appState.pois.length} activo${appState.pois.length === 1 ? "" : "s"}`;
  }
  if (!container) return;

  container.innerHTML = appState.pois.map(poi => `
    <div class="poi-item-row ${appState.activeHighlightedPoiId === poi.id ? 'active-poi-route' : ''}" data-poi-id="${poi.id}" style="flex-direction:column; align-items:stretch; gap:0.35rem; padding:0.45rem 0.55rem;">
      <div style="display:flex; align-items:center; gap:0.4rem;">
        <span style="background:${poi.color}; color:#fff; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.72rem; flex-shrink:0;">
          ${escapeHtml(poi.code)}
        </span>
        <input type="text" class="poi-name-input" data-poi-id="${poi.id}" value="${escapeHtml(poi.label)}"
          placeholder="Nombre del punto"
          style="background:transparent; border:none; color:#fff; font-size:0.78rem; font-weight:700; flex:1; min-width:0;" />
        <button type="button" class="btn-sm btn-secondary poi-route-btn" data-poi-id="${poi.id}" title="Ver rutas en Auto, Subte, Colectivo y Caminando" style="font-size:0.65rem; padding:0.15rem 0.38rem;">
          🛣️ Rutas
        </button>
        ${appState.pois.length > 1 ? `
          <button type="button" class="btn-sm btn-secondary poi-delete-btn" data-poi-id="${poi.id}" title="Quitar punto (reordena letras A, B, C...)" style="font-size:0.65rem; padding:0.15rem 0.35rem; color:#f87171;">
            ✕
          </button>
        ` : ""}
      </div>
      <div style="display:flex; align-items:center; gap:0.3rem;">
        <input type="text" class="salary-input poi-address-input" data-poi-id="${poi.id}" value="${escapeHtml(poi.address || "")}"
          placeholder="Escribí dirección o esquina (ej: Corrientes 3200)..."
          style="flex:1; font-size:0.71rem; padding:0.22rem 0.45rem; background:rgba(15,23,42,0.75);" />
        <button type="button" class="btn-sm btn-primary poi-locate-addr-btn" data-poi-id="${poi.id}" title="Ubicar esta dirección en el mapa" style="font-size:0.66rem; padding:0.2rem 0.45rem; flex-shrink:0;">
          📍 Ir
        </button>
      </div>
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

  // Editar dirección directamente en un punto existente y mover el pin al presionar Enter o tocar "📍 Ir"
  const triggerGeocodeForPoi = async (pId, btnEl) => {
    const found = appState.pois.find(p => p.id === pId);
    const addrInp = container.querySelector(`.poi-address-input[data-poi-id="${pId}"]`);
    if (!found || !addrInp) return;

    const rawText = addrInp.value.trim();
    if (!rawText) return;

    const oldBtnText = btnEl ? btnEl.textContent : "📍 Ir";
    if (btnEl) btnEl.textContent = "⏳";

    const geo = await geocodeAddressInCaba(rawText);
    if (btnEl) btnEl.textContent = oldBtnText;

    if (geo) {
      found.lat = geo.lat;
      found.lng = geo.lng;
      found.address = geo.formatted;
      renderPoisOnLeafletMap();
      if (leafletMap) leafletMap.panTo([found.lat, found.lng]);
      highlightRoutesFromPoi(found);
    } else {
      alert("No pudimos ubicar esa calle/esquina. Probá indicando calle y altura o esquina (ej: Av. Corrientes 3200, Cabildo y Juramento, Parque Centenario).");
    }
  };

  container.querySelectorAll(".poi-locate-addr-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const pId = btn.getAttribute("data-poi-id");
      triggerGeocodeForPoi(pId, btn);
    });
  });

  container.querySelectorAll(".poi-address-input").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const pId = inp.getAttribute("data-poi-id");
      const found = appState.pois.find(p => p.id === pId);
      if (found) found.address = e.target.value;
    });
    inp.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const pId = inp.getAttribute("data-poi-id");
        const btn = container.querySelector(`.poi-locate-addr-btn[data-poi-id="${pId}"]`);
        triggerGeocodeForPoi(pId, btn);
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

  container.querySelectorAll(".poi-delete-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const pId = btn.getAttribute("data-poi-id");
      appState.pois = appState.pois.filter(p => p.id !== pId);
      reindexPois();
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
  reindexPois();
  const optgroup = document.getElementById("sort-pois-optgroup");
  if (!optgroup) return;

  const singleOptions = appState.pois.map(p =>
    `<option value="poi_${p.id}">Cercanía a ${escapeHtml(p.code)}: ${escapeHtml(p.label)}</option>`
  ).join("");

  optgroup.innerHTML = `
    <option value="cercania_todos" ${appState.sortOption === "cercania_todos" ? "selected" : ""}>
      Cercanía promedio a tus ${appState.pois.length} puntos marcados (${appState.pois.map(p => p.code).join(", ")})
    </option>
    ${singleOptions}
    <option value="perm_orden_lista">Prioridad secuencial según orden de tu lista (${appState.pois.map(p => p.code).join(" > ")})</option>
  `;
}

// Renderiza los marcadores arrastrables de Puntos de Interés en el mapa Leaflet
function renderPoisOnLeafletMap() {
  if (!leafletMap || !poisLayerGroup) return;
  reindexPois();
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

    marker.on("mouseover", (e) => {
      if (!appState.isDrawingMode) {
        highlightRoutesFromPoi(poi, e.originalEvent);
      }
    });

    marker.on("mousemove", (e) => {
      if (!appState.isDrawingMode && e.originalEvent) {
        moveZoneHoverTooltip(e.originalEvent);
      }
    });

    marker.on("mouseout", () => {
      if (hoverNavigateTimer) {
        clearTimeout(hoverNavigateTimer);
        hoverNavigateTimer = null;
      }
      if (!appState.isDrawingMode && appState.activeHighlightedPoiId !== poi.id) {
        clearPoiRoutesHighlight();
        hideZoneHoverTooltip();
      }
    });

    // En celular o click: fija/alterna la visualización nítida de las rutas de viaje desde ese punto
    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      if (appState.activeHighlightedPoiId === poi.id) {
        appState.activeHighlightedPoiId = null;
        clearPoiRoutesHighlight();
        hideZoneHoverTooltip();
      } else {
        appState.activeHighlightedPoiId = poi.id;
        highlightRoutesFromPoi(poi, e.originalEvent);
      }
      renderPoisSidebarList();
    });

    marker.on("dragend", (e) => {
      const newPos = e.target.getLatLng();
      poi.lat = parseFloat(newPos.lat.toFixed(5));
      poi.lng = parseFloat(newPos.lng.toFixed(5));
      poi.address = `Ubicado en mapa (${poi.lat.toFixed(4)}, ${poi.lng.toFixed(4)})`;
      renderPoisSidebarList();
      renderHobbyPoiAutocreateControls();
      renderMapConvenienceRanking();
      if (appState.activeHighlightedPoiId === poi.id) {
        highlightRoutesFromPoi(poi);
      }
    });

    marker.addTo(poisLayerGroup);
  });
}

// Atenúa el resto del mapa (grisáceo/apagado) y dibuja con colores ultra nítidos las rutas en Auto, Subte, Colectivo y Caminando desde el Punto de Interés ÚNICAMENTE hacia las zonas elegidas/dibujadas por el usuario y sus otros puntos (NUNCA muestra zonas pre-cargadas)
function highlightRoutesFromPoi(poi, domEvent = null) {
  if (!leafletMap || !routesLayerGroup) return;
  const mapEl = document.getElementById("leaflet-map");
  if (mapEl) mapEl.classList.add("map-dimmed-mode");

  // Atenuar polígonos de zonas para que las rutas brillen con máximo contraste
  zonesLayerGroup?.eachLayer(layer => {
    if (layer.setStyle) {
      layer.setStyle({ fillOpacity: 0.14, opacity: 0.45, weight: 1.8 });
    }
  });

  routesLayerGroup.clearLayers();

  // Usar ÚNICAMENTE las zonas que el usuario eligió o dibujó + sus otros Puntos de Interés
  const userZones = [...(appState.userSelectedZones || [])];
  if (appState.drawnPolygonPoints && appState.drawnPolygonPoints.length >= 3) {
    userZones.push(buildCustomDrawnZoneObject());
  }

  const targetDestinations = userZones.map(z => {
    const [zLat, zLng] = getZoneCenter(z);
    return {
      isZone: true,
      zone: z,
      title: z.name.split(" (")[0],
      center: [zLat, zLng],
      distKm: getDistanceKm(poi.lat, poi.lng, zLat, zLng)
    };
  });

  // También conectar con los otros Puntos de Interés marcados por el usuario
  appState.pois.forEach(otherPoi => {
    if (otherPoi.id !== poi.id) {
      targetDestinations.push({
        isZone: false,
        poiTarget: otherPoi,
        title: `Punto ${otherPoi.code} (${otherPoi.label})`,
        center: [otherPoi.lat, otherPoi.lng],
        distKm: getDistanceKm(poi.lat, poi.lng, otherPoi.lat, otherPoi.lng)
      });
    }
  });

  targetDestinations.sort((a, b) => a.distKm - b.distKm);
  const topTargets = targetDestinations.slice(0, 5);
  const modesSummaryRows = [];

  topTargets.forEach((item, idx) => {
    const [zLat, zLng] = item.center;
    const dKm = Math.max(0.4, item.distKm);

    const minAuto = Math.max(4, Math.round(dKm * 3.1 + 3));
    const minSubte = Math.max(5, Math.round(dKm * 2.4 + 4));
    const minColectivo = Math.max(7, Math.round(dKm * 4.4 + 5));
    const minCaminando = Math.max(8, Math.round(dKm * 12.2));

    const midAuto = [poi.lat + (zLat - poi.lat) * 0.55 + 0.0028, poi.lng + (zLng - poi.lng) * 0.45 - 0.0024];
    const midSubte = [poi.lat + (zLat - poi.lat) * 0.50 - 0.0020, poi.lng + (zLng - poi.lng) * 0.50 + 0.0022];
    const midBus = [poi.lat + (zLat - poi.lat) * 0.35, zLng];
    const midWalk = [zLat, poi.lng + (zLng - poi.lng) * 0.65];

    // 1. RUTA EN AUTO / MOTO (Magenta Neón)
    L.polyline([[poi.lat, poi.lng], midAuto, [zLat, zLng]], {
      color: "#ff2e93",
      weight: 5,
      opacity: 0.98
    }).addTo(routesLayerGroup);

    // 2. RUTA EN SUBTE / TREN (Turquesa Ciano)
    L.polyline([[poi.lat, poi.lng], midSubte, [zLat, zLng]], {
      color: "#00f5d4",
      weight: 4.5,
      opacity: 0.98,
      dashArray: "10, 6"
    }).addTo(routesLayerGroup);

    // 3. RUTA EN COLECTIVO (Amarillo Intenso)
    L.polyline([[poi.lat, poi.lng], midBus, [zLat, zLng]], {
      color: "#facc15",
      weight: 4,
      opacity: 0.96,
      dashArray: "4, 7"
    }).addTo(routesLayerGroup);

    // 4. RUTA CAMINANDO / BICI (Verde Lima)
    L.polyline([[poi.lat, poi.lng], midWalk, [zLat, zLng]], {
      color: "#a3e635",
      weight: 3.5,
      opacity: 0.95,
      dashArray: "2, 6"
    }).addTo(routesLayerGroup);

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
        <div style="color:#38bdf8; font-weight:800; margin-bottom:2px;">→ ${escapeHtml(item.title)} (${dKm.toFixed(1)} km)</div>
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

    if (idx < 4) {
      modesSummaryRows.push(`
        <div style="display:flex; justify-content:space-between; gap:0.75rem; font-size:0.74rem; padding:0.22rem 0; border-bottom:1px solid rgba(255,255,255,0.08);">
          <strong style="color:#e2e8f0;">Hacia ${escapeHtml(item.title)} (${dKm.toFixed(1)} km):</strong>
          <span>
            <strong style="color:#ff2e93;">🚗 ${minAuto}'</strong> |
            <strong style="color:#00f5d4;">🚇 ${minSubte}'</strong> |
            <strong style="color:#facc15;">🚌 ${minColectivo}'</strong> |
            <strong style="color:#a3e635;">🚶 ${minCaminando}'</strong>
          </span>
        </div>
      `);
    }
  });

  const emptyHint = topTargets.length === 0
    ? `<div style="font-size:0.74rem; color:#bae6fd;">Sumá una zona arriba (ej: Miramar, Tandil, Caballito, Pilar) o dibujá un área para ver cómo conecta este punto con tu zona de interés.</div>`
    : modesSummaryRows.join("");

  const legendEl = document.getElementById("map-routes-legend");
  if (legendEl) {
    legendEl.style.display = "block";
    legendEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; margin-bottom:0.4rem;">
        <div style="font-size:0.82rem; font-weight:800; color:#fff;">
          🛣️ Conexión desde <span style="color:${poi.color};">Punto ${escapeHtml(poi.code)}: ${escapeHtml(poi.label)}</span>
        </div>
        <div style="display:flex; gap:0.55rem; font-size:0.72rem; font-weight:800;">
          <span style="color:#ff2e93;">━━ 🚗 Auto/Moto</span>
          <span style="color:#00f5d4;">┅┅ 🚇 Subte/Tren</span>
          <span style="color:#facc15;">┈┈ 🚌 Colectivo</span>
          <span style="color:#a3e635;">·· 🚶 Bici/Pie</span>
        </div>
      </div>
      <div>${emptyHint}</div>
    `;
  }

  // Mostrar también previsualización flotante al pasar el mouse por el punto
  const tooltip = document.getElementById("map-hover-tooltip");
  if (tooltip && domEvent) {
    const autoNav = document.getElementById("hover-auto-navigate-toggle");
    const nearestZone = userZones[0] || null;
    tooltip.innerHTML = `
      <div style="border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:0.35rem; margin-bottom:0.4rem;">
        <div style="font-weight:800; font-size:0.88rem; color:${poi.color};">📍 Punto ${escapeHtml(poi.code)}: ${escapeHtml(poi.label)}</div>
        <div style="font-size:0.72rem; color:#cbd5e1;">${escapeHtml(poi.address || "")}</div>
      </div>
      <div style="font-size:0.73rem; color:#e2e8f0; margin-bottom:0.35rem;">
        ${emptyHint}
      </div>
      ${autoNav && autoNav.checked && nearestZone ? `<div style="font-size:0.69rem; color:#34d399; font-weight:700;">⏱️ Dejá el mouse quieto para saltar al desglose de ${escapeHtml(nearestZone.name.split(" (")[0])}...</div>` : ""}
    `;
    tooltip.classList.add("visible");
    moveZoneHoverTooltip(domEvent);

    if (autoNav && autoNav.checked && nearestZone) {
      if (hoverNavigateTimer) clearTimeout(hoverNavigateTimer);
      hoverNavigateTimer = setTimeout(() => {
        hideZoneHoverTooltip();
        openZoneDetailedBreakdown(nearestZone);
      }, 650);
    }
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

// Evalúa el Costo Total y el Costo de Vida real ajustado a los hábitos del usuario (movilidad + cilindrada auto/moto, nafta/SUBE al día, dieta, cocina vs delivery, hobbies, supermercados y alertas zonales)
function computeZoneAffordabilityMetrics(zone) {
  const hasSalary = appState.salary && appState.salary > 0;
  const salary = hasSalary ? appState.salary : 0;
  const lp = appState.lifestyleProfile || {};
  const econ = appState.liveEconomicData || { naftaSuperLitroArs: 1195, naftaPremiumLitroArs: 1475, subeBoletoMinArs: 425, ipcMensualPct: 2.7 };

  // 1. Multiplicador de Supermercados según cadenas que el usuario usa
  const activeSupers = (Array.isArray(lp.selectedSupermarkets) && lp.selectedSupermarkets.length > 0)
    ? lp.selectedSupermarkets
    : ["dia", "coto", "carrefour"];
  const superMultSum = activeSupers.reduce((acc, key) => {
    const info = SUPERMARKET_CHAINS_INFO[key];
    return acc + (info ? info.mult : 1.0);
  }, 0);
  const supermarketMult = superMultSum / activeSupers.length;
  const activeSupersLabels = activeSupers.map(k => SUPERMARKET_CHAINS_INFO[k]?.label || k).join(", ");

  // 2. Multiplicador por Dieta y Cocina vs Delivery
  const dietMultipliers = { economica: 0.85, omnivora: 1.0, saludable: 1.12, proteica: 1.22 };
  const cookingMultipliers = { cocino: 1.0, mix: 1.18, delivery: 1.42 };
  const dietMult = dietMultipliers[lp.dietType] || 1.0;
  const cookingMult = cookingMultipliers[lp.cookingHabit] || 1.0;

  // 3. Costo en comercios del barrio (permitiendo prender/apagar rubros en la desconstrucción)
  const locales = zone.locales_cercanos || MAP_AFFORDABILITY_ZONES[0].locales_cercanos;
  const disabledIndices = Array.isArray(zone.disabledLocalStoreIndices) ? zone.disabledLocalStoreIndices : [];
  let rawLocalesSum = 0;
  locales.forEach((loc, idx) => {
    if (!disabledIndices.includes(idx)) {
      if (idx === 0) {
        rawLocalesSum += Math.round(loc.mensual_ars * supermarketMult);
      } else {
        rawLocalesSum += loc.mensual_ars;
      }
    }
  });

  const canastaAdjusted = Math.round(rawLocalesSum * dietMult * cookingMult);

  // 4. Costo de Hobbies / Gimnasio adicionales marcados en la 2da conversación
  const hobbyCostsMap = { gimnasio: 26000, club_deporte: 24000, salidas_cafe: 34000, cursos_arte: 22000 };
  const activeHobbies = Array.isArray(lp.hobbies) ? lp.hobbies : [];
  const hobbiesExtraArs = activeHobbies.reduce((acc, h) => acc + (hobbyCostsMap[h] || 0), 0);

  // 5. Movilidad real según medio de transporte + CILINDRADA (Auto/Moto) + distancia a Puntos de Interés + Alertas Zonales de Cortes/Subtes
  const distInfo = getZoneDistanceMetricsToPois(zone);
  const avgDistKm = distInfo.avgDist > 0 ? distInfo.avgDist : 6.2;
  const zonalAlerts = getZonalAlertsForZone(zone);
  const alertExtraMinutes = zonalAlerts.length > 0 ? Math.min(12, Math.round(zonalAlerts[0].impacto_viaje_min * 0.5)) : 0;

  let transporteAdjusted = zone.transporte_ars || 32000;
  let avgTravelMinutes = Math.max(8, Math.round(avgDistKm * 3.6 + 5)) + alertExtraMinutes;
  let transportModeLabel = "SUBE (Transporte Público)";

  if (lp.transportMode === "auto_nafta") {
    const dispKey = (lp.vehicleDisplacement && lp.vehicleDisplacement.startsWith("auto_")) ? lp.vehicleDisplacement : "auto_16_18";
    const prof = VEHICLE_DISPLACEMENT_PROFILES[dispKey] || VEHICLE_DISPLACEMENT_PROFILES.auto_16_18;
    const fuelUnitPrice = econ[prof.fuelKey] || econ.naftaSuperLitroArs || 1195;
    const monthlyKm = avgDistKm * 2 * 22;
    const litersNeeded = monthlyKm * (prof.litersPer100Km / 100);
    const fuelCostArs = Math.round(litersNeeded * fuelUnitPrice);
    transporteAdjusted = fuelCostArs + prof.fixedMaintArs;
    avgTravelMinutes = Math.max(6, Math.round(avgDistKm * 2.9 + 4)) + alertExtraMinutes;
    transportModeLabel = `${prof.label} (~${Math.round(litersNeeded)}L/mes a $${fuelUnitPrice}/L)`;
  } else if (lp.transportMode === "moto") {
    const dispKey = (lp.vehicleDisplacement && lp.vehicleDisplacement.startsWith("moto_")) ? lp.vehicleDisplacement : "moto_110_150";
    const prof = VEHICLE_DISPLACEMENT_PROFILES[dispKey] || VEHICLE_DISPLACEMENT_PROFILES.moto_110_150;
    const fuelUnitPrice = econ[prof.fuelKey] || econ.naftaSuperLitroArs || 1195;
    const monthlyKm = avgDistKm * 2 * 22;
    const litersNeeded = monthlyKm * (prof.litersPer100Km / 100);
    transporteAdjusted = Math.round(litersNeeded * fuelUnitPrice) + prof.fixedMaintArs;
    avgTravelMinutes = Math.max(5, Math.round(avgDistKm * 2.3 + 3)) + Math.round(alertExtraMinutes * 0.4);
    transportModeLabel = `${prof.label} (~${Math.round(litersNeeded)}L/mes a $${fuelUnitPrice}/L)`;
  } else if (lp.transportMode === "bici_pie") {
    transporteAdjusted = 7500;
    avgTravelMinutes = Math.max(8, Math.round(avgDistKm * 5.2));
    transportModeLabel = "Bicicleta / Caminando";
  } else if (lp.transportMode === "apps_mix") {
    transporteAdjusted = Math.round((econ.subeBoletoMinArs || 425) * 36 + (avgDistKm * 1150 * 8));
    avgTravelMinutes = Math.max(7, Math.round(avgDistKm * 3.1 + 4)) + alertExtraMinutes;
    transportModeLabel = "Mix SUBE + Apps (Uber/Cabify)";
  } else {
    const baseTripsCost = Math.round((econ.subeBoletoMinArs || 425) * 48 * (avgDistKm > 10 ? 1.35 : 1.1));
    transporteAdjusted = Math.max(22000, baseTripsCost);
    avgTravelMinutes = Math.max(8, Math.round(avgDistKm * 3.5 + 5)) + Math.round(alertExtraMinutes * 0.6);
    transportModeLabel = `SUBE al día ($${econ.subeBoletoMinArs}/boleto)`;
  }

  const rentTotal = zone.alquiler_ars + zone.expensas_ars;
  const viviendaGenuinaTotal = rentTotal + zone.servicios_ars;
  const lifestyleTotal = zone.servicios_ars + canastaAdjusted + transporteAdjusted + hobbiesExtraArs;
  const totalMensual = rentTotal + lifestyleTotal;
  const housingGenuineTotal = rentTotal + zone.servicios_ars + transporteAdjusted;

  if (!hasSalary) {
    return {
      hasSalary: false,
      rentTotal,
      viviendaGenuinaTotal,
      pctRent: "—",
      rentHex: "#38bdf8",
      rentLabel: "💬 Ingresá tu sueldo",
      housingGenuineTotal,
      pctHousingGenuine: "—",
      canastaAdjusted,
      transporteAdjusted,
      hobbiesExtraArs,
      supermarketMult,
      activeSupersLabels,
      transportModeLabel,
      avgTravelMinutes,
      avgDistKm,
      lifestyleTotal,
      pctLifestyle: "—",
      lifeHex: "#38bdf8",
      lifeLabel: "💬 Ingresá tu sueldo",
      verdictText: "💬 Ingresá tu sueldo en el panel para ver el % sobre tus ingresos",
      totalMensual,
      pctTotal: "—"
    };
  }

  // Costo de Alquiler + Expensas (Escala: <=35% Verde, 35-45% Amarillo, 45-55% Naranja, >55% Rojo)
  const pctRent = (rentTotal / salary) * 100;
  let rentHex = "#10b981";
  let rentLabel = "🟢 Verde (≤35%)";
  if (pctRent > 35 && pctRent <= 45) { rentHex = "#eab308"; rentLabel = "🟡 Amarillo (35-45%)"; }
  else if (pctRent > 45 && pctRent <= 55) { rentHex = "#f97316"; rentLabel = "🟠 Naranja (45-55%)"; }
  else if (pctRent > 55) { rentHex = "#ef4444"; rentLabel = "🔴 Rojo (>55%)"; }

  const pctHousingGenuine = (housingGenuineTotal / salary) * 100;

  // Costo de Vida separado (0-25% Verde, 25-50% Amarillo, 50-75% Naranja, 75-100% Rojo)
  const pctLifestyle = (lifestyleTotal / salary) * 100;
  let lifeHex = "#10b981";
  let lifeLabel = "🟢 Verde (0-25%)";
  if (pctLifestyle > 25 && pctLifestyle <= 50) { lifeHex = "#eab308"; lifeLabel = "🟡 Amarillo (25-50%)"; }
  else if (pctLifestyle > 50 && pctLifestyle <= 75) { lifeHex = "#f97316"; lifeLabel = "🟠 Naranja (50-75%)"; }
  else if (pctLifestyle > 75) { lifeHex = "#ef4444"; lifeLabel = "🔴 Rojo (75-100%)"; }

  let verdictText = "✅ Muy conveniente según tus hábitos y sueldo";
  if (pctRent > 55 || pctLifestyle > 75) {
    verdictText = "⛔ Supera el rango recomendado para tu sueldo";
  } else if (pctRent > 45 || pctLifestyle > 50) {
    verdictText = "⚠️ Exigente para tu sueldo mensual";
  } else if (pctRent > 35 || pctLifestyle > 25) {
    verdictText = "👌 Viable con presupuesto moderado";
  }

  return {
    hasSalary: true,
    rentTotal,
    viviendaGenuinaTotal,
    pctRent: pctRent.toFixed(1),
    rentHex,
    rentLabel,
    housingGenuineTotal,
    pctHousingGenuine: pctHousingGenuine.toFixed(1),
    canastaAdjusted,
    transporteAdjusted,
    hobbiesExtraArs,
    supermarketMult,
    activeSupersLabels,
    transportModeLabel,
    avgTravelMinutes,
    avgDistKm,
    lifestyleTotal,
    pctLifestyle: pctLifestyle.toFixed(1),
    lifeHex,
    lifeLabel,
    verdictText,
    totalMensual,
    pctTotal: ((totalMensual / salary) * 100).toFixed(1)
  };
}

// Renderiza en el mapa ÚNICAMENTE las zonas que el usuario eligió o dibujó (sin pre-marcar zonas por defecto)
function renderAffordabilityZonesOnMap() {
  if (!leafletMap || !zonesLayerGroup) return;
  zonesLayerGroup.clearLayers();

  const zonesToRender = Array.isArray(appState.userSelectedZones) ? appState.userSelectedZones : [];

  zonesToRender.forEach(zone => {
    const m = computeZoneAffordabilityMetrics(zone);
    const poly = L.polygon(zone.coords, {
      color: m.rentHex,
      weight: 2.8,
      opacity: 0.92,
      fillColor: m.rentHex,
      fillOpacity: 0.34
    });

    const scheduleHoverAutoJump = () => {
      const autoNav = document.getElementById("hover-auto-navigate-toggle");
      if (hoverNavigateTimer) {
        clearTimeout(hoverNavigateTimer);
        hoverNavigateTimer = null;
      }
      if (autoNav && autoNav.checked) {
        hoverNavigateTimer = setTimeout(() => {
          hideZoneHoverTooltip();
          openZoneDetailedBreakdown(zone);
        }, 650);
      }
    };

    poly.on("mouseover", (e) => {
      if (appState.isDrawingMode || appState.activeHighlightedPoiId) return;
      poly.setStyle({ fillOpacity: 0.54, weight: 3.8 });
      if (e.originalEvent) {
        showZoneHoverTooltip(zone, e.originalEvent);
      }
      scheduleHoverAutoJump();
    });

    poly.on("mousemove", (e) => {
      if (appState.isDrawingMode || appState.activeHighlightedPoiId) return;
      if (e.originalEvent) moveZoneHoverTooltip(e.originalEvent);
      // Reinicia el temporizador mientras el mouse se mueve; salta automáticamente al dejar el mouse quieto
      scheduleHoverAutoJump();
    });

    poly.on("mouseout", () => {
      poly.setStyle({ fillOpacity: 0.34, weight: 2.8 });
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

    // Etiqueta compacta en el centroide del polígono con el Costo Total
    const [cLat, cLng] = getZoneCenter(zone);
    const shortTitle = zone.name.split(" (")[0];
    const badgeValue = m.hasSalary ? `${m.pctTotal}%` : `$${Math.round(m.totalMensual / 1000)}k tot.`;
    const labelIcon = L.divIcon({
      className: "zone-centroid-marker",
      html: `
        <div class="zone-label-leaflet" style="border-color:${m.rentHex}; transform:translate(-50%, -50%);">
          <span>${escapeHtml(shortTitle)}</span>
          <span style="color:${m.rentHex}; margin-left:4px;">${badgeValue}</span>
        </div>
      `,
      iconSize: [0, 0]
    });
    L.marker([cLat, cLng], { icon: labelIcon, interactive: false }).addTo(zonesLayerGroup);
  });

  renderDrawnPolygonOnLeaflet();
  renderMapConvenienceRanking();
}

// Arma el Ranking de Conveniencia de las zonas que el usuario marcó según su prioridad (Menos viaje, Menos gasto o Mejor equilibrio para lugares frecuentados)
function renderMapConvenienceRanking() {
  const rankBox = document.getElementById("map-convenience-ranking-box");
  const rankList = document.getElementById("map-convenience-ranking-list");
  const prioBadge = document.getElementById("ranking-priority-badge");
  if (!rankBox || !rankList) return;

  const candidateZones = [...(appState.userSelectedZones || [])];
  if (appState.drawnPolygonPoints && appState.drawnPolygonPoints.length >= 3) {
    candidateZones.push(buildCustomDrawnZoneObject());
  }

  if (candidateZones.length === 0) {
    rankBox.style.display = "none";
    rankList.innerHTML = "";
    return;
  }

  const prio = appState.lifestyleProfile?.rankingPriority || "equilibrio_frecuentes";
  const prioLabels = {
    menos_viaje: "⏱️ Menos tiempo en viaje",
    menos_gasto: "💰 Menos gasto mensual total",
    equilibrio_frecuentes: "🎯 Mejor equilibrio para tus lugares"
  };
  if (prioBadge) prioBadge.textContent = prioLabels[prio] || prioLabels.equilibrio_frecuentes;

  const scored = candidateZones.map(z => {
    const m = computeZoneAffordabilityMetrics(z);
    // Puntaje combinado (menor es mejor)
    let score = 0;
    if (prio === "menos_viaje") {
      score = m.avgTravelMinutes * 1000 + (m.totalMensual / 10000);
    } else if (prio === "menos_gasto") {
      score = m.totalMensual;
    } else {
      score = (m.avgTravelMinutes * 18000) + m.totalMensual;
    }
    return { zone: z, metrics: m, score };
  }).sort((a, b) => a.score - b.score);

  rankBox.style.display = "block";
  rankList.innerHTML = scored.map((item, idx) => {
    const z = item.zone;
    const m = item.metrics;
    const medal = idx === 0 ? "🥇 #1" : (idx === 1 ? "🥈 #2" : (idx === 2 ? "🥉 #3" : `#${idx + 1}`));
    return `
      <div style="background:var(--bg-secondary); border-left:3.5px solid ${m.rentHex}; padding:0.4rem 0.55rem; border-radius:4px; display:flex; justify-content:space-between; align-items:center; gap:0.4rem;">
        <div style="min-width:0;">
          <div style="font-size:0.74rem; font-weight:800; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${medal} · ${escapeHtml(z.name.split(" (")[0])}
          </div>
          <div style="font-size:0.68rem; color:#94a3b8;">
            ⏱️ ~${m.avgTravelMinutes} min viaje · 💰 Total: <strong style="color:${m.rentHex};">$${m.totalMensual.toLocaleString("es-AR")}/mes</strong>
          </div>
        </div>
        <button type="button" class="btn-sm btn-primary ranking-open-zone-btn" data-zone-id="${z.id}" style="font-size:0.65rem; padding:0.2rem 0.45rem; white-space:nowrap;">
          Ver por qué →
        </button>
      </div>
    `;
  }).join("");

  rankList.querySelectorAll(".ranking-open-zone-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const zId = btn.getAttribute("data-zone-id");
      const found = candidateZones.find(z => z.id === zId);
      if (found) {
        openZoneDetailedBreakdown(found);
      }
    });
  });
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

    const scheduleCustomHoverJump = () => {
      const autoNav = document.getElementById("hover-auto-navigate-toggle");
      if (hoverNavigateTimer) {
        clearTimeout(hoverNavigateTimer);
        hoverNavigateTimer = null;
      }
      if (autoNav && autoNav.checked) {
        hoverNavigateTimer = setTimeout(() => {
          hideZoneHoverTooltip();
          openZoneDetailedBreakdown(customZone);
        }, 650);
      }
    };

    userPoly.on("mouseover", (e) => {
      if (e.originalEvent) showZoneHoverTooltip(customZone, e.originalEvent);
      scheduleCustomHoverJump();
    });
    userPoly.on("mousemove", (e) => {
      if (e.originalEvent) moveZoneHoverTooltip(e.originalEvent);
      scheduleCustomHoverJump();
    });
    userPoly.on("mouseout", () => {
      if (hoverNavigateTimer) {
        clearTimeout(hoverNavigateTimer);
        hoverNavigateTimer = null;
      }
      hideZoneHoverTooltip();
    });
    userPoly.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      if (hoverNavigateTimer) clearTimeout(hoverNavigateTimer);
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

  // Vista previa limpia: muestra únicamente el Costo Total (sin el desglose de precios de productos)
  tooltip.innerHTML = `
    <div style="border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:0.4rem; margin-bottom:0.45rem;">
      <div style="font-weight:800; font-size:0.9rem; color:#fff;">📍 ${escapeHtml(zone.name)}</div>
      <div style="font-size:0.75rem; font-weight:700; color:${m.rentHex}; margin-top:2px;">${m.verdictText}</div>
    </div>

    <div style="background:rgba(16,185,129,0.1); border:1.5px solid ${m.rentHex}; padding:0.55rem 0.7rem; border-radius:6px; margin-bottom:0.45rem;">
      <div style="font-size:0.71rem; text-transform:uppercase; letter-spacing:0.03em; color:#bae6fd; font-weight:800;">
        💰 Costo Total Mensual Estimado (Vivienda + Costo de Vida)
      </div>
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:0.15rem;">
        <span style="font-size:1.2rem; font-weight:900; color:#fff;">$${m.totalMensual.toLocaleString("es-AR")} / mes</span>
        <span style="font-size:0.8rem; font-weight:800; color:${m.rentHex};">${m.hasSalary ? `${m.pctTotal}% de tu sueldo` : ""}</span>
      </div>
      <div style="font-size:0.71rem; color:#cbd5e1; margin-top:0.25rem; display:flex; justify-content:space-between;">
        <span>🏠 Alquiler + Exp.: <strong>$${m.rentTotal.toLocaleString("es-AR")}</strong></span>
        <span>🛒 Vida ajustada: <strong>$${m.lifestyleTotal.toLocaleString("es-AR")}</strong></span>
      </div>
      <div style="font-size:0.69rem; color:#94a3b8; margin-top:0.2rem;">
        ⏱️ Viaje prom.: ~${m.avgTravelMinutes} min (${escapeHtml(m.transportModeLabel)})
      </div>
    </div>

    <div style="font-size:0.71rem; color:#38bdf8; font-weight:700; text-align:center;">
      👉 Hacé click en la zona si te interesa expandir la desconstrucción del costo y modificar comercios de uso
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

  const customZone = buildCustomDrawnZoneObject();
  selectedZoneForDeepDive = customZone;
  fetchLiveStoresInZoneFromOSM(customZone);

  renderDrawnPolygonOnLeaflet();
  renderDrawnPolygonSidebarSummary(customZone);
  renderMapConvenienceRanking();
}

function renderDrawnPolygonSidebarSummary(customZone) {
  const summaryBox = document.getElementById("drawn-polygon-map-summary");
  if (!summaryBox) return;

  if (!appState.drawnPolygonPoints || appState.drawnPolygonPoints.length < 3) {
    summaryBox.style.display = "none";
    summaryBox.innerHTML = "";
    return;
  }

  const z = customZone || buildCustomDrawnZoneObject();
  const m = computeZoneAffordabilityMetrics(z);
  summaryBox.style.display = "block";
  summaryBox.innerHTML = `
    <div style="font-weight:800; color:#38bdf8; margin-bottom:0.2rem;">✓ Límite cerrado en el mapa (${appState.drawnPolygonPoints.length} esquinas)</div>
    <div style="font-size:0.72rem; color:#fff; margin-bottom:0.35rem;">
      Costo Total Mensual: <strong style="color:${m.rentHex};">$${m.totalMensual.toLocaleString("es-AR")}/mes</strong> ${m.hasSalary ? `(${m.pctTotal}%)` : ""}
    </div>
    <button type="button" class="btn-sm btn-primary" id="btn-open-drawn-zone-detail" style="width:100%; font-size:0.72rem; padding:0.25rem 0.5rem;">
      📊 Expandir desconstrucción de tu área →
    </button>
  `;

  document.getElementById("btn-open-drawn-zone-detail")?.addEventListener("click", () => {
    openZoneDetailedBreakdown(z);
  });
}

function updateDrawnPolygonStyleAndHover() {
  renderDrawnPolygonOnLeaflet();
  if (appState.drawnPolygonPoints && appState.drawnPolygonPoints.length >= 3) {
    renderDrawnPolygonSidebarSummary();
  }
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
  renderDrawnPolygonSidebarSummary();
  renderMapConvenienceRanking();
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
    cochera: { name: "Cochera", w: 5.0, l: 2.5, priority: false },
    balcon: { name: "Balcón", w: 3.0, l: 1.4, priority: false },
    patio: { name: "Patio / Terraza", w: 4.5, l: 3.5, priority: false }
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
    cocina: "🍳", baño: "🚿", pasillo: "🚪", living: "🛋️", habitacion: "🛏️", cochera: "🚗", balcon: "🪴", patio: "🌳"
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
      <div class="resize-handle-se" title="Arrastrá o tocá para estirar/achicar medidas"></div>
    `;

    const selectBoxOnPointerStart = () => {
      appState.selectedRoomId = room.id;
      document.querySelectorAll(".canvas-room-box").forEach(b => b.classList.remove("selected"));
      box.classList.add("selected");
      syncInspectorWithSelected();
    };

    // Mouse + Touch para seleccionar y arrastrar
    box.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("resize-handle-se")) return;
      selectBoxOnPointerStart();
      initDrag(e, room, box);
    });
    box.addEventListener("touchstart", (e) => {
      if (e.target.classList.contains("resize-handle-se")) return;
      selectBoxOnPointerStart();
      initDrag(e, room, box);
    }, { passive: false });

    // Resize handle (Mouse + Touch)
    const resizeHandle = box.querySelector(".resize-handle-se");
    resizeHandle?.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      selectBoxOnPointerStart();
      initResize(e, room, box);
    });
    resizeHandle?.addEventListener("touchstart", (e) => {
      e.stopPropagation();
      selectBoxOnPointerStart();
      initResize(e, room, box);
    }, { passive: false });

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

function getPointerClientCoords(ev) {
  if (ev.touches && ev.touches.length > 0) {
    return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
  }
  if (ev.changedTouches && ev.changedTouches.length > 0) {
    return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
  }
  return { x: ev.clientX || 0, y: ev.clientY || 0 };
}

// Interactive Dragging on Canvas (Mouse + Touch)
function initDrag(e, room, boxEl) {
  if (e.cancelable) e.preventDefault();
  const startPt = getPointerClientCoords(e);
  const startX = startPt.x;
  const startY = startPt.y;
  const initialLeft = room.x;
  const initialTop = room.y;

  const onMove = (moveEvent) => {
    if (moveEvent.cancelable) moveEvent.preventDefault();
    const pt = getPointerClientCoords(moveEvent);
    const dx = pt.x - startX;
    const dy = pt.y - startY;
    room.x = Math.max(8, initialLeft + dx);
    room.y = Math.max(8, initialTop + dy);
    boxEl.style.left = `${room.x}px`;
    boxEl.style.top = `${room.y}px`;
  };

  const onEnd = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onEnd);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onEnd);
    document.removeEventListener("touchcancel", onEnd);
  };

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onEnd);
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onEnd);
  document.addEventListener("touchcancel", onEnd);
}

// Interactive Resizing on Canvas (Mouse + Touch)
function initResize(e, room, boxEl) {
  if (e.cancelable) e.preventDefault();
  const startPt = getPointerClientCoords(e);
  const startX = startPt.x;
  const startY = startPt.y;
  const initialW = room.width * PIXELS_PER_METER;
  const initialH = room.length * PIXELS_PER_METER;

  const onMove = (moveEvent) => {
    if (moveEvent.cancelable) moveEvent.preventDefault();
    const pt = getPointerClientCoords(moveEvent);
    const dx = pt.x - startX;
    const dy = pt.y - startY;

    const newWPixels = Math.max(48, initialW + dx);
    const newHPixels = Math.max(36, initialH + dy);

    room.width = parseFloat((newWPixels / PIXELS_PER_METER).toFixed(1));
    room.length = parseFloat((newHPixels / PIXELS_PER_METER).toFixed(1));

    updateRoomBoxDOM(room);
    syncInspectorWithSelected();
    updateCanvasSummary();
  };

  const onEnd = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onEnd);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onEnd);
    document.removeEventListener("touchcancel", onEnd);
  };

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onEnd);
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onEnd);
  document.addEventListener("touchcancel", onEnd);
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
  let list = [];
  if (Array.isArray(appState.userSelectedZones) && appState.userSelectedZones.length > 0) {
    list = [...appState.userSelectedZones];
  }
  if (appState.drawnPolygonPoints && appState.drawnPolygonPoints.length >= 3) {
    const customZ = buildCustomDrawnZoneObject();
    if (!list.some(z => z.id === customZ.id)) list.push(customZ);
  }
  if (list.length === 0) {
    list = selectedZoneForDeepDive ? [selectedZoneForDeepDive] : [MAP_AFFORDABILITY_ZONES[0]];
  }

  const opt = appState.sortOption || "cercania_todos";
  const prio = appState.lifestyleProfile?.rankingPriority || "equilibrio_frecuentes";

  return list.sort((zA, zB) => {
    const dA = getZoneDistanceMetricsToPois(zA);
    const dB = getZoneDistanceMetricsToPois(zB);
    const mA = computeZoneAffordabilityMetrics(zA);
    const mB = computeZoneAffordabilityMetrics(zB);

    if (opt === "cercania_todos") {
      if (prio === "menos_viaje") return mA.avgTravelMinutes - mB.avgTravelMinutes;
      if (prio === "menos_gasto") return mA.totalMensual - mB.totalMensual;
      return (mA.avgTravelMinutes * 18000 + mA.totalMensual) - (mB.avgTravelMinutes * 18000 + mB.totalMensual);
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
      return mA.totalMensual - mB.totalMensual;
    }
    if (opt === "precio_desc") {
      return mB.totalMensual - mA.totalMensual;
    }
    return dA.avgDist - dB.avgDist;
  });
}

function executeFilterAndRender() {
  const sortedZones = getSortedSubZones();
  const activeZone = selectedZoneForDeepDive || sortedZones[0] || MAP_AFFORDABILITY_ZONES[0];
  selectedZoneForDeepDive = activeZone;
  fetchLiveStoresInZoneFromOSM(activeZone);

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
          #${idx + 1} · 📍 ${escapeHtml(z.name.split(" (")[0])} (Total: $${Math.round(zm.totalMensual / 1000)}k ${zm.hasSalary ? `· ${zm.pctTotal}%` : ""})
        </button>
      `;
    }).join("");

    pillsBar.querySelectorAll(".zone-switch-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        const zId = btn.getAttribute("data-zone-id");
        const found = sortedZones.find(z => z.id === zId) || MAP_AFFORDABILITY_ZONES.find(z => z.id === zId);
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
    metaEl.textContent = `Zona analizada: ${activeZone.name} | Costo Total: $${computeZoneAffordabilityMetrics(activeZone).totalMensual.toLocaleString("es-AR")}/mes | Sueldo: $${appState.salary.toLocaleString("es-AR")} ARS`;
  }
}

// Configura las píldoras multi-selección y el botón "+ Añadir" para Ambientes, Dormitorios y Baños en Búsqueda Clásica
function setupClassicFiltersInteractions() {
  const addCustomOptionPill = (pillsWrapId, cbClass, inputId, unitSingular, unitPlural) => {
    const wrap = document.getElementById(pillsWrapId);
    const inp = document.getElementById(inputId);
    if (!wrap || !inp) return;
    const val = parseInt(inp.value, 10);
    if (!val || val < 1) return;
    inp.value = "";

    let existing = Array.from(wrap.querySelectorAll(`.${cbClass}`)).find(cb => String(cb.value) === String(val));
    if (existing) {
      existing.checked = true;
      return;
    }

    const labelEl = document.createElement("label");
    labelEl.className = "multi-qty-pill custom-added-pill";
    labelEl.innerHTML = `<input type="checkbox" class="${cbClass}" value="${val}" checked> <span>${val} ${val === 1 ? unitSingular : unitPlural}</span>`;
    wrap.appendChild(labelEl);
  };

  document.getElementById("btn-add-custom-room")?.addEventListener("click", () => {
    addCustomOptionPill("classic-rooms-pills", "classic-rooms-cb", "custom-room-number-input", "amb", "amb");
  });
  document.getElementById("btn-add-custom-bedroom")?.addEventListener("click", () => {
    addCustomOptionPill("classic-bedrooms-pills", "classic-bedrooms-cb", "custom-bedroom-number-input", "dorm.", "dorm.");
  });
  document.getElementById("btn-add-custom-bathroom")?.addEventListener("click", () => {
    addCustomOptionPill("classic-bathrooms-pills", "classic-bathrooms-cb", "custom-bathroom-number-input", "baño", "baños");
  });

  // Al cambiar tipo de cochera, ajusta automáticamente cantidades sugeridas si se elige "Sin cochera"
  const garageSel = document.getElementById("filter-garage");
  garageSel?.addEventListener("change", () => {
    const covInp = document.getElementById("filter-garage-covered-cars");
    const uncovInp = document.getElementById("filter-garage-uncovered-cars");
    if (garageSel.value === "no") {
      if (covInp) covInp.value = "0";
      if (uncovInp) uncovInp.value = "0";
    } else if (garageSel.value === "techada" && covInp && parseInt(covInp.value, 10) === 0) {
      covInp.value = "1";
    } else if (garageSel.value === "descubierta" && uncovInp && parseInt(uncovInp.value, 10) === 0) {
      uncovInp.value = "1";
    } else if (garageSel.value === "mixta") {
      if (covInp && parseInt(covInp.value, 10) === 0) covInp.value = "2";
      if (uncovInp && parseInt(uncovInp.value, 10) === 0) uncovInp.value = "2";
    }
  });
}

// Lee y sincroniza todos los campos de la pestaña Búsqueda Clásica
function readClassicFiltersFromDOM() {
  const cf = appState.classicFilters || {};
  const getVal = (id, fallback) => {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
  };
  cf.operation = getVal("filter-operation", appState.selectedOperation || "alquiler");
  cf.currency = getVal("filter-currency", "ARS");
  cf.minPrice = parseArsNumber(getVal("filter-min-price", "0"));
  cf.maxPrice = parseArsNumber(getVal("filter-max-price", "0"));
  cf.maxExpensas = parseArsNumber(getVal("filter-max-expensas", "0"));
  cf.propertyType = getVal("filter-property-type", "departamento");
  cf.disposition = getVal("filter-disposition", "indistinto");
  cf.orientation = getVal("filter-orientation", "indistinto");
  cf.antiquity = getVal("filter-antiquity", "indistinto");

  const selectedRooms = Array.from(document.querySelectorAll(".classic-rooms-cb:checked"))
    .map(cb => parseInt(cb.value, 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
  cf.selectedRooms = selectedRooms.length > 0 ? selectedRooms : [2];
  cf.minRooms = cf.selectedRooms[0] || 2;

  const selectedBedrooms = Array.from(document.querySelectorAll(".classic-bedrooms-cb:checked"))
    .map(cb => cb.value);
  cf.selectedBedrooms = selectedBedrooms;
  const numericBedrooms = selectedBedrooms.filter(v => v !== "monoambiente").map(v => parseInt(v, 10)).filter(n => !isNaN(n));
  cf.bedrooms = numericBedrooms.length > 0 ? String(numericBedrooms[0]) : (selectedBedrooms.includes("monoambiente") ? "monoambiente" : "0");

  const selectedBathrooms = Array.from(document.querySelectorAll(".classic-bathrooms-cb:checked"))
    .map(cb => parseInt(cb.value, 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
  cf.selectedBathrooms = selectedBathrooms.length > 0 ? selectedBathrooms : [1];
  cf.bathrooms = String(cf.selectedBathrooms[0] || 1);

  cf.minM2Covered = parseInt(getVal("filter-min-m2-covered", "0"), 10) || 0;
  cf.maxM2Total = parseInt(getVal("filter-max-m2-total", "0"), 10) || 0;
  cf.garage = getVal("filter-garage", "indistinto");
  cf.garageCoveredCars = parseInt(getVal("filter-garage-covered-cars", "0"), 10) || 0;
  cf.garageUncoveredCars = parseInt(getVal("filter-garage-uncovered-cars", "0"), 10) || 0;

  cf.features = Array.from(document.querySelectorAll(".classic-feature-cb:checked")).map(cb => cb.value);
  cf.amenities = Array.from(document.querySelectorAll(".classic-amenity-cb:checked")).map(cb => cb.value);
  cf.requirements = Array.from(document.querySelectorAll(".classic-req-cb:checked")).map(cb => cb.value);

  appState.classicFilters = cf;
  appState.selectedOperation = cf.operation === "venta" ? "venta" : "alquiler";
  if (cf.maxPrice > 0) {
    appState.maxPrice = cf.maxPrice;
  }
  return cf;
}

function resetClassicFiltersForm() {
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v;
  };
  setVal("filter-operation", "alquiler");
  setVal("filter-currency", "ARS");
  setVal("filter-min-price", "");
  setVal("filter-max-price", "");
  setVal("filter-max-expensas", "");
  setVal("filter-property-type", "departamento");
  setVal("filter-disposition", "indistinto");
  setVal("filter-orientation", "indistinto");
  setVal("filter-antiquity", "indistinto");
  setVal("filter-min-m2-covered", "");
  setVal("filter-max-m2-total", "");
  setVal("filter-garage", "indistinto");
  setVal("filter-garage-covered-cars", "0");
  setVal("filter-garage-uncovered-cars", "0");

  document.querySelectorAll(".custom-added-pill").forEach(el => el.remove());
  document.querySelectorAll(".classic-rooms-cb, .classic-bedrooms-cb, .classic-bathrooms-cb").forEach(cb => {
    cb.checked = false;
  });
  document.querySelectorAll(".classic-feature-cb, .classic-amenity-cb, .classic-req-cb").forEach(cb => {
    cb.checked = false;
  });
  readClassicFiltersFromDOM();
}

// Construye los links reales con TODOS los filtros aplicados (Zona de CABA o cualquiera de los 135 municipios de PBA + Operación + Ambientes/Dormitorios/Baños + Cochera + m² + Presupuesto)
function buildFilteredPortalUrl(portalDomain, zoneNameOrSlug) {
  const cf = readClassicFiltersFromDOM();
  const d = (portalDomain || "").toLowerCase();
  const op = appState.selectedOperation === "venta" ? "venta" : (cf.operation === "temporal" ? "alquiler-temporal" : "alquiler");
  const maxP = cf.maxPrice > 0 ? cf.maxPrice : (appState.maxPrice || 0);
  const minP = cf.minPrice > 0 ? cf.minPrice : 0;
  const curr = (cf.currency || "ARS").toLowerCase() === "usd" ? "dolares" : "pesos";

  const mainRooms = appState.activeTab === "filtros"
    ? (cf.selectedRooms && cf.selectedRooms.length > 0 ? cf.selectedRooms[0] : cf.minRooms)
    : (appState.floorRooms.filter(r => r.type === "living" || r.type === "habitacion").length || cf.minRooms || 2);
  const ambCount = Math.max(1, Math.min(6, mainRooms || 2));

  const propTypeMap = {
    departamento: "departamentos",
    ph: "ph",
    casa: "casas",
    duplex: "departamentos",
    semipiso: "departamentos",
    loft: "departamentos",
    quinta: "quintas"
  };
  const propPlural = propTypeMap[cf.propertyType] || "departamentos";

  // Limpia paréntesis ej: "Miramar (General Alvarado) — Centro" -> "miramar"
  let cleanZoneName = String(zoneNameOrSlug || "buenos-aires")
    .split("—")[0]
    .split("(")[0]
    .trim();
  let raw = cleanZoneName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let slug = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "capital-federal";
  let mlRegion = "capital-federal";

  const matchedDb = findBuenosAiresLocationInDb(zoneNameOrSlug || "");
  if (matchedDb) {
    slug = matchedDb.slug;
    if (matchedDb.region === "caba") mlRegion = "capital-federal";
    else if (matchedDb.region === "gba-norte") mlRegion = "bs-as-gba-norte";
    else if (matchedDb.region === "gba-oeste") mlRegion = "bs-as-gba-oeste";
    else if (matchedDb.region === "gba-sur") mlRegion = "bs-as-gba-sur";
    else if (matchedDb.slug === "mar-del-plata" || matchedDb.slug === "miramar" || matchedDb.slug === "pinamar" || matchedDb.slug === "villa-gesell" || matchedDb.slug === "necochea" || matchedDb.slug === "la-costa") {
      mlRegion = "bs-as-costa-atlantica";
    } else {
      mlRegion = "buenos-aires-interior";
    }
  } else if (raw.includes("miramar")) {
    slug = "miramar";
    mlRegion = "bs-as-costa-atlantica";
  } else if (raw.includes("mar del plata") || raw.includes("mar-del-plata")) {
    slug = "mar-del-plata";
    mlRegion = "bs-as-costa-atlantica";
  }

  // Segmentos de filtros adicionales compatibles con las URLs de Zonaprop y Argenprop
  const bathCount = cf.selectedBathrooms && cf.selectedBathrooms.length > 0 ? cf.selectedBathrooms[0] : parseInt(cf.bathrooms, 10) || 0;
  const totalGarageCars = (cf.garageCoveredCars || 0) + (cf.garageUncoveredCars || 0);
  const needsGarage = (cf.garage && cf.garage !== "indistinto" && cf.garage !== "no") || totalGarageCars > 0;
  const garageSlugZp = needsGarage ? `-${Math.max(1, totalGarageCars)}-cochera` : "";
  const bathSlugZp = bathCount > 1 ? `-${bathCount}-banos` : "";
  const m2SlugZp = cf.minM2Covered > 0 ? `-mas-de-${cf.minM2Covered}-m2-cubiertos` : "";
  const priceSuffixZp = maxP > 0
    ? (minP > 0 ? `-${minP}-${maxP}-${curr}` : `-menos-${maxP}-${curr}`)
    : "";
  const priceSuffixAp = maxP > 0 ? `-hasta-${maxP}-${curr}` : "";

  const extraQueryParams = new URLSearchParams();
  if (cf.selectedRooms && cf.selectedRooms.length > 1) extraQueryParams.set("ambientes_opciones", cf.selectedRooms.join(","));
  if (cf.selectedBedrooms && cf.selectedBedrooms.length > 0) extraQueryParams.set("dormitorios", cf.selectedBedrooms.join(","));
  if (bathCount > 0) extraQueryParams.set("banos", String(bathCount));
  if (cf.minM2Covered > 0) extraQueryParams.set("m2_cubiertos_min", String(cf.minM2Covered));
  if (cf.maxM2Total > 0) extraQueryParams.set("m2_totales_max", String(cf.maxM2Total));
  if (needsGarage) {
    extraQueryParams.set("cochera", cf.garage);
    if (cf.garageCoveredCars > 0) extraQueryParams.set("autos_techados", String(cf.garageCoveredCars));
    if (cf.garageUncoveredCars > 0) extraQueryParams.set("autos_descubiertos", String(cf.garageUncoveredCars));
  }
  if (cf.features && cf.features.length > 0) extraQueryParams.set("exteriores", cf.features.join(","));
  if (cf.amenities && cf.amenities.length > 0) extraQueryParams.set("amenities", cf.amenities.join(","));
  if (cf.requirements && cf.requirements.length > 0) extraQueryParams.set("requisitos", cf.requirements.join(","));
  const qs = extraQueryParams.toString() ? `?${extraQueryParams.toString()}` : "";

  if (d.includes("zonaprop")) {
    return `https://www.zonaprop.com.ar/${propPlural}-${op}-${slug}-${ambCount}-ambientes${bathSlugZp}${garageSlugZp}${m2SlugZp}${priceSuffixZp}.html${qs}`;
  }
  if (d.includes("argenprop")) {
    const garageAp = needsGarage ? "/con-cochera" : "";
    return `https://www.argenprop.com/${propPlural}/${op}/${slug}/${ambCount}-ambientes${garageAp}${priceSuffixAp}${qs}`;
  }
  if (d.includes("mercadolibre")) {
    const priceMl = maxP > 0 ? `_PriceRange_0${curr === 'dolares' ? 'USD' : 'ARS'}-${maxP}${curr === 'dolares' ? 'USD' : 'ARS'}` : "";
    return `https://inmuebles.mercadolibre.com.ar/${propPlural}/${op}/${mlRegion}/${slug}/_${ambCount}-ambientes${priceMl}${qs}`;
  }
  if (d.includes("remax")) {
    return `https://www.remax.com.ar/listings/${op === 'venta' ? 'buy' : 'rent'}?address=${encodeURIComponent(slug)}&rooms=${ambCount}&maxPrice=${maxP}&bathrooms=${bathCount}&parking=${needsGarage ? Math.max(1, totalGarageCars) : 0}`;
  }
  if (d.includes("properati")) {
    return `https://www.properati.com.ar/s/${slug}/${propPlural === 'casas' ? 'casa' : 'departamento'}/${op}${qs}`;
  }
  const cleanHost = portalDomain.startsWith("http") ? portalDomain : `https://${portalDomain}`;
  return `${cleanHost}/?zona=${encodeURIComponent(slug)}&tipo=${propPlural}&operacion=${op}&ambientes=${ambCount}&banos=${bathCount}&m2_min=${cf.minM2Covered}&max_precio=${maxP}${qs ? "&" + qs.slice(1) : ""}`;
}

function renderFocusedZoneDeepDive(zone) {
  const container = document.getElementById("focused-zone-deep-dive");
  if (!container || !zone) return;

  const cf = readClassicFiltersFromDOM();
  const m = computeZoneAffordabilityMetrics(zone);
  const imp = zone.impuestos_y_servicios || MAP_AFFORDABILITY_ZONES[0].impuestos_y_servicios;
  const locales = zone.locales_cercanos || MAP_AFFORDABILITY_ZONES[0].locales_cercanos;
  const distInfo = getZoneDistanceMetricsToPois(zone);
  const lp = appState.lifestyleProfile || {};
  const econ = appState.liveEconomicData || { sourceLabel: "INDEC IPC Oficial", naftaSuperLitroArs: 1195, subeBoletoMinArs: 425 };

  const roomsText = (cf.selectedRooms && cf.selectedRooms.length > 0)
    ? `${cf.selectedRooms.join(" o ")} amb`
    : `${cf.minRooms || 2} amb`;
  const bedroomsText = (cf.selectedBedrooms && cf.selectedBedrooms.length > 0)
    ? `Dorm.: ${cf.selectedBedrooms.join(", ")}`
    : "";
  const bathroomsText = (cf.selectedBathrooms && cf.selectedBathrooms.length > 0)
    ? `${cf.selectedBathrooms.join(" o ")} baño/s`
    : `${cf.bathrooms || 1} baño/s`;

  const mainRooms = appState.activeTab === "filtros"
    ? (cf.selectedRooms && cf.selectedRooms.length > 0 ? cf.selectedRooms[0] : cf.minRooms)
    : Math.max(1, appState.floorRooms.filter(r => r.type === "living" || r.type === "habitacion").length || 2);
  const priorityRooms = appState.floorRooms.filter(r => r.priority).map(r => r.name).join(", ") || "Living, Cocina, Baño, Habitación";
  const opLabel = appState.selectedOperation === "venta" ? "Compra-Venta" : (cf.operation === "temporal" ? "Alquiler Temporal" : "Alquiler Tradicional");
  const propTypeLabels = {
    departamento: "Depto en edificio",
    ph: "PH (Propiedad Horizontal)",
    casa: "Casa",
    duplex: "Dúplex / Tríplex",
    semipiso: "Piso / Semipiso",
    loft: "Loft / Divisible",
    quinta: "Casa de Country / Quinta"
  };
  const propLabel = propTypeLabels[cf.propertyType] || "Departamento";
  const garageDetailStr = cf.garage === "no"
    ? "Sin cochera"
    : `Cochera: ${cf.garage}${(cf.garageCoveredCars > 0 || cf.garageUncoveredCars > 0) ? ` (${cf.garageCoveredCars} techado/s + ${cf.garageUncoveredCars} sin techar)` : ""}`;

  const classicSummaryTags = [
    `${propLabel}`,
    `${roomsText} (${bathroomsText})`,
    bedroomsText,
    cf.minM2Covered > 0 ? `Mín. ${cf.minM2Covered} m² cub.` : "",
    garageDetailStr,
    ...(cf.features || []).slice(0, 3),
    ...(cf.amenities || []).slice(0, 2),
    ...(cf.requirements || []).slice(0, 2)
  ].filter(Boolean).join(" · ");

  const viviendaGenuinaArs = m.rentTotal + zone.servicios_ars;
  const pctViviendaGenuina = ((viviendaGenuinaArs / (appState.salary || 1500000)) * 100).toFixed(1);

  const disabledIndices = Array.isArray(zone.disabledLocalStoreIndices) ? zone.disabledLocalStoreIndices : [];
  const activeSupers = (Array.isArray(lp.selectedSupermarkets) && lp.selectedSupermarkets.length > 0)
    ? lp.selectedSupermarkets
    : ["dia", "coto", "carrefour"];

  // Alertas de la Base de Datos Zonal (cortes de calle, estaciones de subte, rutas y accesos)
  const zoneAlerts = getZonalAlertsForZone(zone);
  const zoneAlertsHtml = zoneAlerts.length > 0
    ? zoneAlerts.map(al => `
        <div style="background:rgba(245,158,11,0.1); border-left:3.5px solid #f59e0b; padding:0.65rem 0.8rem; border-radius:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem;">
            <strong style="color:#fcd34d; font-size:0.8rem;">${escapeHtml(al.categoria)} · ${escapeHtml(al.titulo)}</strong>
            <span style="font-size:0.7rem; background:rgba(245,158,11,0.22); color:#fde68a; padding:2px 7px; border-radius:999px; font-weight:700;">+${al.impacto_viaje_min} min en hora pico</span>
          </div>
          <div style="font-size:0.76rem; color:#e2e8f0; margin-top:0.2rem;">${escapeHtml(al.detalle)}</div>
          <div style="font-size:0.68rem; color:#94a3b8; margin-top:0.15rem;">Fuente en BD Zonal: ${escapeHtml(al.fuente)}</div>
        </div>
      `).join("")
    : "";

  // Botones de Supermercados para modificar al uso en vivo (ej: si destilda Jumbo y Coto y deja solo Día, actualiza los costos)
  const supermarketsTogglesHtml = Object.values(SUPERMARKET_CHAINS_INFO).map(chain => {
    const isChecked = activeSupers.includes(chain.id);
    return `
      <label style="display:inline-flex; align-items:center; gap:0.35rem; background:${isChecked ? 'rgba(56,189,248,0.16)' : 'var(--bg-primary)'}; border:1px solid ${isChecked ? '#38bdf8' : 'var(--card-border)'}; padding:0.35rem 0.65rem; border-radius:999px; font-size:0.74rem; color:#fff; cursor:pointer; font-weight:700;">
        <input type="checkbox" class="deepdive-supermarket-cb" value="${chain.id}" ${isChecked ? "checked" : ""}>
        <span>${escapeHtml(chain.label)}</span>
        <span style="font-size:0.66rem; color:${chain.mult < 1 ? '#34d399' : (chain.mult > 1 ? '#fca5a5' : '#94a3b8')};">(${escapeHtml(chain.badge)})</span>
      </label>
    `;
  }).join("");

  // Filas de la Desconstrucción (ocultas hasta que el usuario expanda "Ver por qué / Expandir desconstrucción")
  const localesRowsHtml = locales.map((loc, idx) => {
    const isEnabled = !disabledIndices.includes(idx);
    const baseVal = idx === 0 ? Math.round(loc.mensual_ars * m.supermarketMult) : loc.mensual_ars;
    const superNote = idx === 0
      ? `<div style="font-size:0.68rem; color:#34d399; margin-top:2px;">Ajustado a tus cadenas elegidas (${escapeHtml(m.activeSupersLabels)})</div>`
      : "";
    return `
      <tr style="opacity:${isEnabled ? '1' : '0.45'};">
        <td>
          <label style="display:flex; align-items:flex-start; gap:0.45rem; cursor:pointer;">
            <input type="checkbox" class="deepdive-local-rubro-cb" data-rubro-idx="${idx}" ${isEnabled ? "checked" : ""} style="margin-top:3px;">
            <div>
              <strong style="color:#fff;">${escapeHtml(loc.tipo)}</strong>
              ${superNote}
            </div>
          </label>
        </td>
        <td><span style="color:#38bdf8; font-weight:600; font-size:0.75rem;">${escapeHtml(loc.valores)}</span></td>
        <td style="text-align:right; font-weight:800; color:#fff;">
          ${isEnabled ? `$${baseVal.toLocaleString("es-AR")} /mes` : `<span style="color:#94a3b8;">Excluido ($0)</span>`}
        </td>
      </tr>
    `;
  }).join("");

  const liveOsmStoresHtml = (Array.isArray(zone.liveDetectedStoreNames) && zone.liveDetectedStoreNames.length > 0)
    ? `<div style="margin-top:0.55rem; padding:0.45rem 0.65rem; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.35); border-radius:6px; font-size:0.72rem; color:#d1fae5;">
         📡 <strong>Comercios reales detectados al día en esta zona (OpenStreetMap):</strong> ${zone.liveDetectedStoreNames.map(n => escapeHtml(n)).join(" · ")}
       </div>`
    : "";

  // Conexión hacia todos los Puntos de Interés que el usuario sumó
  const poisRoutesRowsHtml = distInfo.perPoi.length > 0
    ? distInfo.perPoi.map(item => `
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
      `).join("")
    : `<div style="font-size:0.76rem; color:var(--text-muted);">No marcaste puntos de interés todavía en el mapa (tiempo estimado base: ~${m.avgTravelMinutes} min).</div>`;

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
            <span style="font-size:0.7rem; background:rgba(16,185,129,0.18); color:#34d399; padding:2px 7px; border-radius:999px; font-weight:700;">Filtros guardados en URL</span>
          </div>
          <div style="font-size:0.74rem; color:var(--text-secondary); line-height:1.45;">
            • <strong>Sub-zona:</strong> ${escapeHtml(zone.name)}<br>
            • <strong>Operación:</strong> ${opLabel} | <strong>Tope:</strong> $${(appState.maxPrice || 1500000).toLocaleString("es-AR")} ${escapeHtml(cf.currency || "ARS")}<br>
            • <strong>Filtros / Layout aplicados:</strong> ${escapeHtml(classicSummaryTags)} (${escapeHtml(priorityRooms)})
          </div>
        </div>
        <a href="${escapeHtml(filteredUrl)}" target="_blank" rel="noopener noreferrer" class="btn-portal-link" style="justify-content:center; width:100%;">
          🔗 Ir a ${escapeHtml(p.name)} con estos filtros aplicados ↗
        </a>
      </div>
    `;
  }).join("");

  const isExpanded = Boolean(zone.isDeconstructionExpanded);

  container.innerHTML = `
    <div style="background:var(--card-bg); border:1.5px solid ${m.rentHex}; border-radius:var(--radius-md); padding:1.4rem; box-shadow:var(--shadow-lg);">
      <!-- Cabecera con el COSTO TOTAL MENSUAL (Vivienda + Costo de Vida ajustado a tus hábitos) -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid var(--card-border);">
        <div>
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span style="font-size:0.73rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--accent-cyan); font-weight:800;">
              📡 ${escapeHtml(econ.sourceLabel)} · Nafta Súper: $${econ.naftaSuperLitroArs}/L · SUBE: $${econ.subeBoletoMinArs}
            </span>
            <button type="button" id="btn-deepdive-open-zonal-db" class="btn-sm btn-secondary" style="font-size:0.68rem; padding:0.18rem 0.55rem; border-color:#f59e0b; color:#fcd34d;">
              🗄️ Ver por qué / ⚠️ Avisar dato obsoleto en Base de Datos
            </button>
          </div>
          <h3 style="font-size:1.5rem; font-weight:800; color:#fff; margin-top:0.2rem;">📍 ${escapeHtml(zone.name)}</h3>
          <p style="font-size:0.83rem; color:var(--text-secondary); margin-top:0.2rem;">${escapeHtml(zone.urban_boundary_note || zone.gastos_alrededor_detalle)}</p>
        </div>
        <div style="background:var(--bg-primary); border:2px solid ${m.rentHex}; padding:0.75rem 1.15rem; border-radius:var(--radius-sm); text-align:right;">
          <div style="font-size:0.72rem; text-transform:uppercase; color:#bae6fd; font-weight:800;">💰 Costo Total Mensual (Vivienda + Vida)</div>
          <div style="font-size:1.45rem; font-weight:900; color:#fff; margin:0.1rem 0;">
            $${m.totalMensual.toLocaleString("es-AR")} ARS / mes
          </div>
          <div style="font-size:0.8rem; font-weight:800; color:${m.rentHex};">
            ${m.hasSalary ? `${m.pctTotal}% de tu sueldo ($${appState.salary.toLocaleString("es-AR")}) · ` : ""}${m.verdictText}
          </div>
        </div>
      </div>

      ${zoneAlertsHtml ? `
      <div style="margin-bottom:1.15rem; display:flex; flex-direction:column; gap:0.45rem;">
        ${zoneAlertsHtml}
      </div>
      ` : ""}

      <!-- BLOQUE SUPERIOR: VIVIENDA GENUINA -->
      <div style="background:var(--bg-primary); border:1px solid var(--card-border); border-left:4px solid ${m.rentHex}; border-radius:var(--radius-sm); padding:1.15rem; margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.75rem; margin-bottom:0.85rem;">
          <div>
            <h4 style="font-size:1.05rem; font-weight:800; color:#fff;">
              🏠 Vivienda Genuina (Alquiler, Expensas, Impuestos y Servicios Fijos)
            </h4>
            <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:0.15rem;">
              Gasto fijo mensual para habitar y mantener el inmueble en esta sub-zona:
            </p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.3rem; font-weight:900; color:#fff;">
              $${viviendaGenuinaArs.toLocaleString("es-AR")} ARS / mes
            </div>
            <span style="font-size:0.76rem; color:var(--accent-cyan); font-weight:700;">
              Total vivienda genuina (${pctViviendaGenuina}% de tu sueldo)
            </span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:0.85rem;">
          <div style="background:var(--bg-tertiary); padding:0.85rem; border-radius:6px; border-left:3.5px solid ${m.rentHex};">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:#fff; font-size:0.86rem;">Alquiler (${mainRooms} amb) + Expensas</strong>
              <span style="font-size:0.76rem; font-weight:800; color:${m.rentHex};">${m.rentLabel}</span>
            </div>
            <div style="font-size:1.15rem; font-weight:800; color:#fff; margin:0.25rem 0;">
              $${m.rentTotal.toLocaleString("es-AR")} ARS <span style="font-size:0.8rem; color:${m.rentHex};">(${m.pctRent}%)</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">
              Alquiler: <strong>$${zone.alquiler_ars.toLocaleString("es-AR")}</strong> + Expensas: <strong>$${zone.expensas_ars.toLocaleString("es-AR")}</strong> + Servicios fijos: <strong>$${zone.servicios_ars.toLocaleString("es-AR")}</strong>
            </div>
          </div>

          <div style="background:var(--bg-tertiary); padding:0.85rem; border-radius:6px; border-left:3.5px solid ${m.lifeHex};">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:#fff; font-size:0.86rem;">Costo de Vida Total Ajustado a Tus Hábitos</strong>
              <span style="font-size:0.76rem; font-weight:800; color:${m.lifeHex};">${m.lifeLabel}</span>
            </div>
            <div style="font-size:1.15rem; font-weight:800; color:#fff; margin:0.25rem 0;">
              $${m.lifestyleTotal.toLocaleString("es-AR")} ARS <span style="font-size:0.8rem; color:${m.lifeHex};">(${m.pctLifestyle}%)</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">
              Comercios/Supermercados: <strong>$${m.canastaAdjusted.toLocaleString("es-AR")}</strong> · Movilidad (${escapeHtml(m.transportModeLabel)}): <strong>$${m.transporteAdjusted.toLocaleString("es-AR")}</strong>${m.hobbiesExtraArs > 0 ? ` · Hobbies/Gym: <strong>$${m.hobbiesExtraArs.toLocaleString("es-AR")}</strong>` : ""}
            </div>
          </div>
        </div>
      </div>

      <!-- BLOQUE MEDIO: COSTO TOTAL DE VIDA LIMPIO + BOTÓN PARA EXPANDIR LA DESCONSTRUCCIÓN Y MODIFICAR SUPERMERCADOS/LOCALES -->
      <div style="background:var(--bg-primary); border:1px solid var(--card-border); border-left:4px solid ${m.lifeHex}; border-radius:var(--radius-sm); padding:1.15rem; margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <div>
            <h4 style="font-size:1.02rem; font-weight:800; color:#fff;">
              🛒 Costo Total en Comercios, Supermercados y Hábitos: <span style="color:${m.lifeHex};">$${m.lifestyleTotal.toLocaleString("es-AR")} ARS / mes</span>
            </h4>
            <p style="font-size:0.77rem; color:var(--text-secondary); margin-top:0.15rem;">
              Calculado con tus supermercados seleccionados (<strong>${escapeHtml(m.activeSupersLabels)}</strong>), tu dieta y tu movilidad real.
            </p>
          </div>
          <button type="button" id="btn-toggle-cost-deconstruction" class="btn-secondary" style="font-size:0.78rem; font-weight:800; padding:0.5rem 0.9rem; border-color:#38bdf8; color:#38bdf8;">
            ${isExpanded ? "▲ Ocultar desconstrucción del costo" : "▼ Ver por qué / Expandir desconstrucción y modificar comercios de uso"}
          </button>
        </div>

        ${liveOsmStoresHtml}

        <!-- SECCIÓN EXPANDIBLE: DESCONSTRUCCIÓN DEL COSTO + MODIFICADOR EN VIVO DE SUPERMERCADOS Y RUBROS -->
        <div id="cost-deconstruction-expandable-panel" style="display:${isExpanded ? "block" : "none"}; margin-top:1rem; padding-top:1rem; border-top:1px dashed var(--card-border);">
          <div style="background:var(--bg-tertiary); border:1px solid rgba(56,189,248,0.35); border-radius:6px; padding:0.85rem; margin-bottom:0.9rem;">
            <div style="font-size:0.8rem; font-weight:800; color:#bae6fd; margin-bottom:0.35rem;">
              🛍️ Modificá al uso en qué supermercados comprás (ej: si no comprás en Jumbo o Coto y comprás solo en Día, destildalos y se actualiza tu costo al instante):
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:0.45rem;">
              ${supermarketsTogglesHtml}
            </div>
          </div>

          <p style="font-size:0.76rem; color:var(--text-secondary); margin-bottom:0.5rem;">
            Desconstrucción rubro por rubro en ${escapeHtml(zone.name.split(" (")[0])} (podés destildar cualquier rubro que no uses):
          </p>
          <div style="overflow-x:auto;">
            <table class="dense-table">
              <thead>
                <tr style="background:var(--bg-tertiary);">
                  <th style="width:38%; color:#fff;">Comercio / Rubro (Tildá o destildá según tu uso)</th>
                  <th style="width:44%; color:#fff;">Desconstrucción de Precios Reales en la Zona</th>
                  <th style="width:18%; text-align:right; color:#fff;">Tu Gasto Mensual</th>
                </tr>
              </thead>
              <tbody>
                ${localesRowsHtml}
              </tbody>
            </table>
          </div>

          <div style="margin-top:0.85rem; padding-top:0.75rem; border-top:1px solid var(--card-border);">
            <div style="font-size:0.78rem; font-weight:800; color:#bae6fd; margin-bottom:0.45rem;">
              ⚡ Desconstrucción de Impuestos Municipales, Servicios Domiciliarios y Movilidad:
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:0.55rem; font-size:0.76rem;">
              <div style="background:var(--bg-tertiary); padding:0.45rem 0.6rem; border-radius:4px;">
                <span style="color:var(--text-muted); display:block; font-size:0.68rem;">🏛️ ABL / Municipal</span>
                <strong style="color:#fff;">$${imp.abl_municipal_ars.toLocaleString("es-AR")} /mes</strong>
              </div>
              <div style="background:var(--bg-tertiary); padding:0.45rem 0.6rem; border-radius:4px;">
                <span style="color:var(--text-muted); display:block; font-size:0.68rem;">💡 Luz</span>
                <strong style="color:#fff;">$${imp.luz_edenor_edesur_ars.toLocaleString("es-AR")} /mes</strong>
              </div>
              <div style="background:var(--bg-tertiary); padding:0.45rem 0.6rem; border-radius:4px;">
                <span style="color:var(--text-muted); display:block; font-size:0.68rem;">🔥 Gas Natural</span>
                <strong style="color:#fff;">$${imp.gas_metrogas_ars.toLocaleString("es-AR")} /mes</strong>
              </div>
              <div style="background:var(--bg-tertiary); padding:0.45rem 0.6rem; border-radius:4px;">
                <span style="color:var(--text-muted); display:block; font-size:0.68rem;">🚿 Agua (AySA)</span>
                <strong style="color:#fff;">$${imp.agua_aysa_ars.toLocaleString("es-AR")} /mes</strong>
              </div>
              <div style="background:var(--bg-tertiary); padding:0.45rem 0.6rem; border-radius:4px;">
                <span style="color:var(--text-muted); display:block; font-size:0.68rem;">🌐 Internet Fibra</span>
                <strong style="color:#fff;">$${imp.internet_fibra_ars.toLocaleString("es-AR")} /mes</strong>
              </div>
              <div style="background:var(--bg-tertiary); padding:0.45rem 0.6rem; border-radius:4px;">
                <span style="color:var(--text-muted); display:block; font-size:0.68rem;">🚗/🚇 ${escapeHtml(m.transportModeLabel)}</span>
                <strong style="color:#38bdf8;">$${m.transporteAdjusted.toLocaleString("es-AR")} /mes</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- BLOQUE EVALUACIÓN: RANKING DE CONVENIENCIA, LÍMITES Y TIEMPOS DE VIAJE -->
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
            <strong style="color:#34d399; display:block; margin-bottom:0.25rem;">🏢 Tipología de Inmuebles y Requisitos en Portales</strong>
            ${escapeHtml(zone.gastos_alrededor_detalle)}
          </div>
        </div>

        <div style="font-size:0.8rem; font-weight:800; color:#e2e8f0; margin-bottom:0.45rem;">
          🛣️ Tiempos de Viaje desde ${escapeHtml(zone.name.split(" (")[0])} hacia tus Puntos de Interés:
        </div>
        <div style="display:flex; flex-direction:column; gap:0.4rem;">
          ${poisRoutesRowsHtml}
        </div>
      </div>

      <!-- BLOQUE FINAL: LINKS QUE REDIRIGEN A LAS PÁGINAS CARGADAS CON LOS FILTROS YA APLICADOS -->
      <div style="background:rgba(6,182,212,0.08); border:1.5px solid rgba(56,189,248,0.45); border-radius:var(--radius-sm); padding:1.15rem;">
        <h4 style="font-size:1rem; font-weight:800; color:#38bdf8; margin-bottom:0.25rem;">
          🔗 Links Directos a las Páginas que Cargaste con los Filtros Ya Aplicados en ${escapeHtml(zone.name.split(" (")[0])}
        </h4>
        <p style="font-size:0.78rem; color:var(--text-secondary); margin-bottom:0.65rem;">
          Hacé click en cualquiera de los sitios que sumaste al principio para ver las ofertas activas con la localidad/zona, operación (${opLabel}), tope de presupuesto ($${(appState.maxPrice || 1500000).toLocaleString("es-AR")}), ambientes (${roomsText}), baños y cochera ya filtrados:
        </p>
        <div class="portal-filtered-grid">
          ${portalLinksHtml}
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-deepdive-open-zonal-db")?.addEventListener("click", () => {
    openZonalDatabaseModal("ajuste_alquiler_zonal");
  });

  // Evento para expandir/ocultar la desconstrucción del costo
  document.getElementById("btn-toggle-cost-deconstruction")?.addEventListener("click", () => {
    zone.isDeconstructionExpanded = !zone.isDeconstructionExpanded;
    renderFocusedZoneDeepDive(zone);
  });

  // Eventos para modificar en vivo las cadenas de supermercados (ej: dejar solo Día y destildar Jumbo/Coto)
  container.querySelectorAll(".deepdive-supermarket-cb").forEach(cb => {
    cb.addEventListener("change", () => {
      const checked = Array.from(container.querySelectorAll(".deepdive-supermarket-cb:checked")).map(el => el.value);
      appState.lifestyleProfile.selectedSupermarkets = checked.length > 0 ? checked : ["dia"];
      // Sincronizar también los checkboxes de la pantalla de hábitos
      document.querySelectorAll(".habit-supermarket-cb").forEach(hCb => {
        hCb.checked = appState.lifestyleProfile.selectedSupermarkets.includes(hCb.value);
      });
      zone.isDeconstructionExpanded = true;
      executeFilterAndRender();
      renderAffordabilityZonesOnMap();
    });
  });

  // Eventos para prender/apagar rubros de comercios de la zona
  container.querySelectorAll(".deepdive-local-rubro-cb").forEach(cb => {
    cb.addEventListener("change", () => {
      const rIdx = parseInt(cb.getAttribute("data-rubro-idx") || "0", 10);
      if (!Array.isArray(zone.disabledLocalStoreIndices)) {
        zone.disabledLocalStoreIndices = [];
      }
      if (!cb.checked) {
        if (!zone.disabledLocalStoreIndices.includes(rIdx)) zone.disabledLocalStoreIndices.push(rIdx);
      } else {
        zone.disabledLocalStoreIndices = zone.disabledLocalStoreIndices.filter(i => i !== rIdx);
      }
      zone.isDeconstructionExpanded = true;
      executeFilterAndRender();
      renderAffordabilityZonesOnMap();
    });
  });
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
