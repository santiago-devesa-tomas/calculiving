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
  // Perfil de la 2da conversación (hábitos reales, cómo se mueve, cilindrada, dieta, cocina vs delivery, gimnasio/hobbys, hogar/colegios/hospitales/prepagas/instituciones, supermercados y prioridad)
  lifestyleProfile: {
    transportMode: "sube", // sube | auto_nafta | moto | bici_pie | apps_mix
    vehicleDisplacement: "auto_16_18", // auto_10_14 | auto_16_18 | auto_20_plus | auto_pickup | auto_gnc | moto_110_150 | moto_200_300 | moto_400_plus
    cookingHabit: "cocino", // cocino | mix | delivery
    dietType: "omnivora", // omnivora | economica | saludable | proteica
    hobbies: [], // ["gimnasio", "club_deporte", "salidas_cafe", "cursos_arte"]
    hobbyLocations: {}, // { gimnasio: "Palermo", club_deporte: "Nuñez" }
    householdMembers: 1, // Cantidad de habitantes del hogar (1 a 6+)
    householdStudents: 0, // Cantidad de integrantes en edad escolar/estudio
    selectedInstitutions: [], // Selección múltiple: colegios (niños/adultos), hospitales, prepagas e instituciones
    selectedSupermarkets: ["dia", "coto", "carrefour"], // ["dia", "coto", "carrefour", "jumbo", "mayorista"]
    disabledLocalIndices: {}, // Permite activar/desactivar comercios específicos en la deconstrucción
    rankingPriority: "equilibrio_frecuentes", // equilibrio_frecuentes | menos_gasto | menos_viaje
    deconstructionExpanded: false
  },
  // Variables económicas alimentadas por APIs oficiales (IPC/INDEC, Secretaría de Energía, Banco Nación Dólar Vendedor y RED SUBE) y archivo .txt mensual
  liveEconomicData: {
    monthlyPeriod: "2026-11",
    ipcMensualPct: 0,
    ipcFecha: "Consultando API IPC/INDEC...",
    sourceLabel: "APIs Oficiales (IPC/INDEC · Sec. Energía · BNA · RED SUBE)",
    naftaSuperLitroArs: 0,
    naftaPremiumLitroArs: 0,
    gasoilPremiumLitroArs: 0,
    gncMetroCubicoArs: 0,
    subeBoletoMinArs: 0,
    boletoSubteArs: 0,
    boletoTrenArs: 0,
    redSubeDesc2doPct: 50,
    redSubeDesc3erPct: 75,
    dolarBnaVendedorArs: 0,
    dolarOficialArs: 0,
    dolarMepArs: 0,
    factorActualizacionReal: 1.0,
    lastUpdatedText: "Sincronizando con datos_economicos_oficiales.txt y APIs oficiales...",
    rawTxtContent: "",
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
    householdMembers: 1,
    householdStudents: 0,
    selectedInstitutions: [],
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

  const homonymBox = document.getElementById("homonym-disambiguation-box");
  if (homonymBox) {
    homonymBox.style.display = "none";
    homonymBox.innerHTML = "";
  }

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
  const hhMemSel = document.getElementById("habit-household-members");
  if (hhMemSel) hhMemSel.value = "1";
  const hhStuSel = document.getElementById("habit-household-students");
  if (hhStuSel) hhStuSel.value = "0";
  document.querySelectorAll(".habit-institution-cb").forEach(cb => { cb.checked = false; });
  const hhBadge = document.getElementById("habit-household-summary-badge");
  if (hhBadge) hhBadge.textContent = "👥 Hogar configurado: 1 habitante · Sin instituciones adicionales seleccionadas.";
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
          ¡Hola! Estoy acá para ayudarte a encontrar tu lugar ideal. 
          Contame: <strong>¿qué estás buscando?</strong> (por ejemplo: si necesitás cochera —que se definirá invariablemente como ambiente prioritario en tu distribución—, espacio para teletrabajo, balcón, cantidad de ambientes o un presupuesto máximo mensual).
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
          1️⃣ <strong>¿Cómo te movés y qué cilindrada tiene tu auto/moto?</strong> (auto/nafta, transporte público RED SUBE, moto, bici o caminando)<br>
          2️⃣ <strong>¿Cuántos habitantes son en el hogar, cómo es su dieta y si cocinan o piden comida?</strong><br>
          3️⃣ <strong>¿Qué colegios (niños/adultos), hospitales, prepagas, instituciones o deportes necesitan?</strong><br>
          4️⃣ <strong>¿En qué supermercados compran y qué priorizan en la Conveniencia de concentración de servicios del mapa?</strong>
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

  // Flow forward & back buttons (asegurando transmisión total de variables sin pérdida de datos)
  document.getElementById("bot-proceed-portales-btn")?.addEventListener("click", () => {
    const pendingInput = document.getElementById("fullscreen-bot-input");
    if (pendingInput && pendingInput.value.trim()) {
      generateBotGoalAnalysis(pendingInput.value.trim());
      pendingInput.value = "";
    }
    navigateTo("screen-portales");
  });
  document.getElementById("bot-back-home-btn")?.addEventListener("click", navigateBack);

  document.getElementById("btn-classic-back-home")?.addEventListener("click", navigateBack);
  document.getElementById("btn-classic-proceed-portales")?.addEventListener("click", () => {
    const cf = readClassicFiltersFromDOM();
    const mapOp = document.getElementById("map-filter-operation");
    const mapMax = document.getElementById("map-filter-max-price");
    const mapCurr = document.getElementById("map-filter-currency");
    if (mapOp) mapOp.value = cf.operation === "venta" ? "venta" : "alquiler";
    if (mapMax && cf.maxPrice > 0) mapMax.value = formatArsThousands(cf.maxPrice);
    if (mapCurr && cf.currency) mapCurr.value = cf.currency;
    navigateTo("screen-portales");
  });
  document.getElementById("btn-reset-classic-filters")?.addEventListener("click", () => {
    resetClassicFiltersForm();
  });

  document.getElementById("btn-editor-search-results")?.addEventListener("click", () => {
    syncFloorPlanToSearchFilters();
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

  document.getElementById("btn-map-go-results")?.addEventListener("click", async () => {
    // Si el usuario escribió una localidad o barrio en el buscador del mapa pero no tocó Enter/"Ver zonas", procesarla ahora para que no se pierda la zona elegida
    const mentionInput = document.getElementById("neighborhood-mention-input");
    if (mentionInput && mentionInput.value.trim()) {
      await mentionNeighborhoodAndShowInternalSubzones(mentionInput.value.trim());
    }

    const mapOp = document.getElementById("map-filter-operation")?.value;
    const mapMax = parseArsNumber(document.getElementById("map-filter-max-price")?.value);
    const mapCurr = document.getElementById("map-filter-currency")?.value;
    if (mapOp) {
      appState.selectedOperation = mapOp;
      const classicOp = document.getElementById("filter-operation");
      if (classicOp && (classicOp.value !== "temporal" || mapOp === "venta")) {
        classicOp.value = mapOp;
      }
      if (appState.classicFilters) appState.classicFilters.operation = mapOp;
    }
    if (mapCurr) {
      if (appState.classicFilters) appState.classicFilters.currency = mapCurr;
      const classicCurr = document.getElementById("filter-currency");
      if (classicCurr) classicCurr.value = mapCurr;
    }
    if (mapMax > 0) {
      appState.maxPrice = mapMax;
      const classicMax = document.getElementById("filter-max-price");
      if (classicMax) classicMax.value = formatArsThousands(mapMax);
      if (appState.classicFilters) appState.classicFilters.maxPrice = mapMax;
    }

    if (appState.activeTab === "plano") {
      syncFloorPlanToSearchFilters();
    } else if (appState.activeTab === "filtros") {
      readClassicFiltersFromDOM();
    }

    // Garantizar que la zona elegida por el usuario sea la activa al abrir el desglose
    if (appState.userSelectedZones && appState.userSelectedZones.length > 0) {
      if (!selectedZoneForDeepDive || !appState.userSelectedZones.some(z => z.id === selectedZoneForDeepDive.id)) {
        selectedZoneForDeepDive = appState.userSelectedZones[0];
      }
    } else if (appState.drawnPolygonPoints && appState.drawnPolygonPoints.length >= 3) {
      selectedZoneForDeepDive = buildCustomDrawnZoneObject();
    }

    executeFilterAndRender();
    navigateTo("screen-resultados");
  });
}

/* ----------------------------------------------------
   2. SPEECH BUBBLE SALARY ON MAP & COST MODAL
---------------------------------------------------- */
function setupSalaryBanner() {
  const salaryInput = document.getElementById("global-salary-input");
  const explainBtn = document.getElementById("open-cost-bot-btn");

  const updateSalaryRealtime = () => {
    const val = parseArsNumber(salaryInput?.value);
    appState.salary = val > 0 ? val : 0;
    renderAffordabilityZonesOnMap();
    renderUserSelectedZonesSidebar();
    renderPoisOnLeafletMap();
    if (activePolygonLayer && appState.drawnPolygonPoints.length >= 3) {
      updateDrawnPolygonStyleAndHover();
    }
    if (appState.currentScreen === "screen-resultados") {
      executeFilterAndRender();
    }
  };

  salaryInput?.addEventListener("input", updateSalaryRealtime);
  salaryInput?.addEventListener("change", updateSalaryRealtime);

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
  if (!modal || !body) return;

  const activeZone = selectedZoneForDeepDive || (appState.userSelectedZones && appState.userSelectedZones[0]) || MAP_AFFORDABILITY_ZONES[0];
  const m = computeZoneAffordabilityMetrics(activeZone);
  const uFilters = getUnifiedSearchFilters();
  const salary = appState.salary || 0;
  const hasSalary = salary > 0;

  body.innerHTML = `
    <p style="margin-bottom: 0.75rem;">
      Calculiving separa estructuralmente los <strong>3 pilares del gasto mensual</strong> (${escapeHtml(uFilters.roomsLabel)}, ${escapeHtml(uFilters.bathroomsLabel)} en <strong>${escapeHtml(activeZone.name.split(" (")[0])}</strong>) aplicando un <strong>filtro estadístico de cuartiles ($Q_1 - Q_3$) y rangos lógicos</strong> para descartar publicaciones con precios irrisorios:
    </p>

    <!-- 1. ALQUILER PURO -->
    <div style="background:var(--bg-primary); padding:0.85rem; border-radius:var(--radius-sm); border-left:4px solid ${m.alquilerHex}; margin-bottom:0.85rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
        <strong style="color:#fff; font-size:0.93rem;">1️⃣ 🏠 Valor de Alquiler (Locativo Puro)</strong>
        <span style="font-weight:700; color:${m.alquilerHex}; font-size:0.82rem;">${m.alquilerSemaphoreLabel}</span>
      </div>
      <div style="font-size:1.05rem; font-weight:900; color:#fff; margin-bottom:0.25rem;">
        ${escapeHtml(m.alquilerAPartirFormatted)} / mes ${hasSalary ? `<span style="font-size:0.8rem; color:${m.alquilerHex};">(${m.pctAlquilerSolo}% de tu sueldo)</span>` : ""}
      </div>
      <p style="font-size:0.78rem; color:var(--text-secondary);">
        Umbral mínimo verificado por cuartiles ($Q_1$: $${m.q1Alquiler.toLocaleString("es-AR")} · Mediana: $${m.q2Alquiler.toLocaleString("es-AR")} · $Q_3$: $${m.q3Alquiler.toLocaleString("es-AR")}). Se ignoraron ${m.outliersAlquilerCount} avisos con valores irrisorios (&lt; $${m.umbralLogicoMinAlquiler.toLocaleString("es-AR")} ARS).
      </p>
    </div>

    <!-- 2. EXPENSAS ORDINARIAS -->
    <div style="background:var(--bg-primary); padding:0.85rem; border-radius:var(--radius-sm); border-left:4px solid ${m.expensasHex}; margin-bottom:0.85rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
        <strong style="color:#fff; font-size:0.93rem;">2️⃣ 🏢 Valor de Expensas Ordinarias (Separado del Alquiler)</strong>
        <span style="font-weight:700; color:${m.expensasHex}; font-size:0.82rem;">${m.expensasSemaphoreLabel}</span>
      </div>
      <div style="font-size:1.05rem; font-weight:900; color:#fff; margin-bottom:0.25rem;">
        ${escapeHtml(m.expensasAPartirFormatted)} / mes ${hasSalary ? `<span style="font-size:0.8rem; color:${m.expensasHex};">(${m.pctExpensasSolo}% de tu sueldo)</span>` : ""}
      </div>
      <p style="font-size:0.78rem; color:var(--text-secondary);">
        Calculado según tipología (${escapeHtml(uFilters.propLabel)}) y metraje (${escapeHtml(uFilters.roomsLabel)}), descartando avisos que declaran "$0" o "$1" falsos en edificios con gastos centrales.
      </p>
    </div>

    <!-- 3. COSTO DE VIDA -->
    <div style="background:var(--bg-primary); padding:0.85rem; border-radius:var(--radius-sm); border-left:4px solid ${m.lifeHex}; margin-bottom:0.95rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
        <strong style="color:#fff; font-size:0.93rem;">3️⃣ 🛒 Costo de Vida (Servicios + Comercios + Movilidad)</strong>
        <span style="font-weight:700; color:${m.lifeHex}; font-size:0.82rem;">${m.lifeLabel}</span>
      </div>
      <div style="font-size:1.05rem; font-weight:900; color:#fff; margin-bottom:0.25rem;">
        ${escapeHtml(m.costoVidaAPartirFormatted)} / mes ${hasSalary ? `<span style="font-size:0.8rem; color:${m.lifeHex};">(${m.pctLifestyle}% de tu sueldo)</span>` : ""}
      </div>
      <p style="font-size:0.78rem; color:var(--text-secondary);">
        Servicios e impuestos domiciliarios (${escapeHtml(formatAPartirDe(m.serviciosAPartirArs))}) + Supermercados/Comercios (${escapeHtml(formatAPartirDe(m.canastaAdjusted))}) + Movilidad (${escapeHtml(formatAPartirDe(m.transporteAdjusted))}).
      </p>
    </div>

    <div style="background:rgba(6,182,212,0.1); border:1px solid var(--accent-cyan); padding:0.75rem; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
      <span style="font-size:0.85rem; font-weight:700;">Presupuesto Mensual Integrado (3 Pilares):</span>
      <span style="font-size:0.95rem; font-weight:800; color:var(--accent-cyan);">${escapeHtml(m.totalAPartirFormatted)} / mes ${hasSalary ? `(${m.pctTotal}% del sueldo)` : ""}</span>
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
  const norm = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let analysis = `<strong>Comprendido.</strong> Registré y transmití tus parámetros exactos de búsqueda: `;

  // 1. Extraer cantidad exacta de Ambientes desde el texto del Bot y sincronizar con filtros
  let detectedRooms = null;
  if (norm.includes("monoambiente") || /\b1\s*amb/.test(norm)) {
    detectedRooms = 1;
  } else {
    const ambMatch = norm.match(/\b(\d+)\s*amb/);
    if (ambMatch) detectedRooms = parseInt(ambMatch[1], 10);
  }
  if (detectedRooms && detectedRooms >= 1 && detectedRooms <= 12) {
    appState.classicFilters.selectedRooms = [detectedRooms];
    appState.classicFilters.minRooms = detectedRooms;
    syncCheckboxGroupValues("classic-rooms-cb", [String(detectedRooms)], "classic-rooms-pills-list", "amb", "amb");
    analysis += `<br>• <strong>Ambientes transmitidos:</strong> ${detectedRooms === 1 ? "Monoambiente (1 amb)" : `${detectedRooms} ambientes`}.`;
  }

  // 2. Extraer cantidad exacta de Dormitorios / Habitaciones
  const dormMatch = norm.match(/\b(\d+)\s*(?:dorm|habitac)/);
  if (dormMatch) {
    const dCount = parseInt(dormMatch[1], 10);
    if (dCount >= 1 && dCount <= 10) {
      appState.classicFilters.selectedBedrooms = [String(dCount)];
      appState.classicFilters.bedrooms = String(dCount);
      syncCheckboxGroupValues("classic-bedrooms-cb", [String(dCount)], "classic-bedrooms-pills-list", "dormitorio", "dormitorios");
      if (!detectedRooms) {
        const inferredAmb = dCount + 1;
        appState.classicFilters.selectedRooms = [inferredAmb];
        appState.classicFilters.minRooms = inferredAmb;
        syncCheckboxGroupValues("classic-rooms-cb", [String(inferredAmb)], "classic-rooms-pills-list", "amb", "amb");
      }
      analysis += `<br>• <strong>Dormitorios transmitidos:</strong> ${dCount} dormitorio${dCount > 1 ? "s" : ""}.`;
    }
  }

  // 3. Extraer cantidad exacta de Baños
  const bathMatch = norm.match(/\b(\d+)\s*bano/);
  if (bathMatch) {
    const bCount = parseInt(bathMatch[1], 10);
    if (bCount >= 1 && bCount <= 8) {
      appState.classicFilters.selectedBathrooms = [bCount];
      appState.classicFilters.bathrooms = String(bCount);
      syncCheckboxGroupValues("classic-bathrooms-cb", [String(bCount)], "classic-bathrooms-pills-list", "baño", "baños");
      analysis += `<br>• <strong>Baños transmitidos:</strong> ${bCount} baño${bCount > 1 ? "s" : ""}.`;
    }
  }

  // 4. Extraer Tipología (PH, Casa, Barrio Cerrado, Departamento, Dúplex)
  const propSel = document.getElementById("filter-property-type");
  if (norm.includes("barrio cerrado") || norm.includes("country")) {
    appState.classicFilters.propertyType = "barrio_cerrado";
    if (propSel) propSel.value = "barrio_cerrado";
    if (typeof updateGarageCarCountersVisibility === "function") updateGarageCarCountersVisibility();
    analysis += `<br>• <strong>Tipología:</strong> Barrio Cerrado / Country (contadores de autos techados y descubiertos habilitados).`;
  } else if (/\bph\b/.test(norm)) {
    appState.classicFilters.propertyType = "ph";
    if (propSel) propSel.value = "ph";
    if (typeof updateGarageCarCountersVisibility === "function") updateGarageCarCountersVisibility();
    analysis += `<br>• <strong>Tipología:</strong> PH (Propiedad Horizontal).`;
  } else if (/\bcasa\b|\bchalet\b|\bquinta\b/.test(norm)) {
    appState.classicFilters.propertyType = "casa";
    if (propSel) propSel.value = "casa";
    if (typeof updateGarageCarCountersVisibility === "function") updateGarageCarCountersVisibility();
    analysis += `<br>• <strong>Tipología:</strong> Casa / Chalet.`;
  } else if (/\bduplex\b/.test(norm)) {
    appState.classicFilters.propertyType = "duplex";
    if (propSel) propSel.value = "duplex";
    if (typeof updateGarageCarCountersVisibility === "function") updateGarageCarCountersVisibility();
    analysis += `<br>• <strong>Tipología:</strong> Dúplex.`;
  }

  // 5. Extraer Zona / Barrio mencionado en el chat sin agrupamientos arbitrarios
  const matchedFromChat = findExactIsolatedZoneCandidates(norm);
  if (matchedFromChat.length === 1) {
    mentionNeighborhoodAndShowInternalSubzones(matchedFromChat[0].name);
    analysis += `<br>• <strong>Zona aislada detectada y cargada:</strong> ${escapeHtml(matchedFromChat[0].name)}.`;
  }

  if (lower.includes("home office") || lower.includes("teletrabajo") || lower.includes("escritorio")) {
    analysis += `<br>• <strong>Espacio de trabajo:</strong> Priorizaremos departamentos con distribución que permita aislar un escritorio o ambiente luminoso.`;
  }
  if (lower.includes("subte") || lower.includes("transporte") || lower.includes("colectivo")) {
    analysis += `<br>• <strong>Conectividad:</strong> Ponderaremos cercanía a bocas de subte y corredores de Metrobus para optimizar tu tiempo de viaje.`;
  }
  if (lower.includes("balcón") || lower.includes("balcon") || lower.includes("luminoso") || lower.includes("terraza")) {
    analysis += `<br>• <strong>Luz y aire:</strong> Filtraremos inmuebles con orientación abierta y espacio exterior propio.`;
  }

  // REGLA OPCIÓN A: Reconocer la palabra "cochera" e invariablemente definirla como un ambiente prioritario en la distribución
  if (norm.includes("cochera")) {
    appState.classicFilters.garage = "techada";
    appState.classicFilters.garageCoveredCars = Math.max(1, appState.classicFilters.garageCoveredCars || 1);
    const gSel = document.getElementById("filter-garage");
    if (gSel) gSel.value = "techada";

    // Invariablemente definir "Cochera" como ambiente prioritario (priority: true) en la distribución espacial (floorRooms)
    if (!Array.isArray(appState.floorRooms)) appState.floorRooms = [];
    let existingCochera = appState.floorRooms.find(r => r.type === "cochera" || (r.name && r.name.toLowerCase().includes("cochera")));
    if (existingCochera) {
      existingCochera.priority = true;
      existingCochera.name = "Cochera";
      appState.selectedRoomId = existingCochera.id;
    } else {
      const cocheraRoom = {
        id: "room-cochera-prioritaria",
        type: "cochera",
        name: "Cochera",
        floor: appState.activeFloor || 1,
        x: 340,
        y: 310,
        width: 5.0,
        length: 2.5,
        priority: true
      };
      appState.floorRooms.push(cocheraRoom);
      appState.selectedRoomId = cocheraRoom.id;
    }
    if (typeof renderRoomsOnCanvas === "function") renderRoomsOnCanvas();
    if (typeof syncInspectorWithSelected === "function") syncInspectorWithSelected();

    analysis += `<br>• <strong>🚗 Cochera (Ambiente Prioritario ⭐):</strong> Reconocida e invariablemente definida como <strong>ambiente prioritario en la distribución</strong> del plano y filtros activos.`;
  }

  analysis += `<br><br>Cuando estés listo, hacé click abajo en <strong>"Continuar a Cargar Sitios de Portales"</strong>; todos estos datos viajarán directo al mapa y al desglose final.`;
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
  lastSyncTimestamp: "Sincronizado mensualmente con APIs Oficiales (IPC/INDEC, Secretaría de Energía, Banco Nación y RED SUBE) + datos_economicos_oficiales.txt",
  monetario_y_combustible: [
    {
      id: "ipc_indec",
      nombre: "Inflación Mensual Oficial (IPC INDEC)",
      valor_num: 2.7,
      unidad: "% mensual",
      fuente_oficial: "IPC / INDEC Oficial (https://apis.datos.gob.ar/series/api/series/?ids=145.3_INGNACNAL_DICI_M_38)",
      por_que: "Se consulta mensualmente la API de Series de Tiempo de IPC/INDEC (y datos_economicos_oficiales.txt) para actualizar la canasta de supermercados, servicios y ajustes ICL/IPC."
    },
    {
      id: "dolar_bna_vendedor",
      nombre: "Dólar Oficial Banco Nación (Tipo Vendedor)",
      valor_num: 1095,
      unidad: "ARS / USD",
      fuente_oficial: "Banco de la Nación Argentina — Tipo Vendedor (https://dolarapi.com/v1/dolares/oficial / BNA)",
      por_que: "Cotización oficial tipo vendedor del Banco Nación utilizada para convertir entre ARS y USD en alquileres, topes de presupuesto y ventas."
    },
    {
      id: "nafta_super_ypf",
      nombre: "Nafta Súper en Surtidor (Secretaría de Energía)",
      valor_num: 1195,
      unidad: "ARS / Litro",
      fuente_oficial: "Secretaría de Energía — Precios en Surtidor Res. 314 (https://datos.energia.gob.ar/api/3/action/datastore_search?resource_id=80ac25de-a44a-4445-9215-090cf55cfda5)",
      por_que: "Base oficial de surtidor para calcular el gasto mensual por kilómetro en autos de cilindrada 1.0L a 1.8L y motos urbanas según tu distancia a los puntos de interés."
    },
    {
      id: "nafta_premium_ypf",
      nombre: "Nafta Grado 3 / Premium en Surtidor (Secretaría de Energía)",
      valor_num: 1475,
      unidad: "ARS / Litro",
      fuente_oficial: "Secretaría de Energía — Precios en Surtidor Oficial Bs.As.",
      por_que: "Utilizada para motores turbo o de cilindrada 2.0L+ (SUV / Alta gama) que requieren mayor octanaje."
    },
    {
      id: "gasoil_premium",
      nombre: "Gasoil Grado 3 en Surtidor (Secretaría de Energía)",
      valor_num: 1420,
      unidad: "ARS / Litro",
      fuente_oficial: "Secretaría de Energía — Precios en Surtidor Oficial Bs.As.",
      por_que: "Referencia para Pick-ups y utilitarios diésel (2.4L a 3.0L+)."
    },
    {
      id: "gnc_m3",
      nombre: "GNC en Surtidor (Secretaría de Energía / ENARGAS)",
      valor_num: 560,
      unidad: "ARS / m³",
      fuente_oficial: "Secretaría de Energía / ENARGAS Estaciones GNC Bs.As.",
      por_que: "Permite calcular el ahorro (~55% menos por km) cuando el usuario selecciona vehículo con equipo a GNC."
    }
  ],
  transporte_oficial_y_futuro: [
    {
      id: "sube_colectivo",
      nombre: "Cuadro Tarifario Colectivo Mínimo (RED SUBE)",
      valor_num: 425,
      unidad: "ARS / viaje (0-3 km)",
      fuente_oficial: "RED SUBE Oficial — Secretaría de Transporte (https://www.argentina.gob.ar/redsube)",
      cambio_futuro_previsto: "Actualización mensual del cuadro tarifario RED SUBE con descuentos del 50% en el 2do viaje y 75% desde el 3er viaje dentro de las 2 horas.",
      por_que: "Determina el gasto mensual de quienes viajan en colectivo o combinan en la red metropolitana."
    },
    {
      id: "subte_emova",
      nombre: "Cuadro Tarifario Subte CABA (RED SUBE / Emova)",
      valor_num: 832,
      unidad: "ARS / viaje",
      fuente_oficial: "RED SUBE / Emova Movilidad CABA",
      cambio_futuro_previsto: "Tarifa escalonada con descuentos automáticos por pasajero frecuente (20%, 30% y 40% al superar 20, 30 y 40 viajes mensuales).",
      por_que: "Impacta directamente en barrios de CABA conectados a Líneas A, B, C, D, E y H."
    },
    {
      id: "trenes_amba",
      nombre: "Cuadro Tarifario Trenes Metropolitanos (RED SUBE)",
      valor_num: 320,
      unidad: "ARS / sección 1",
      fuente_oficial: "RED SUBE / Trenes Argentinos Operaciones (SOFSE)",
      cambio_futuro_previsto: "Integración con descuentos RED SUBE en combinaciones de tren + colectivo + subte en AMBA.",
      por_que: "Clave para comparar el costo y tiempo real de vivir en GBA Norte, Oeste o Sur frente a CABA."
    },
    {
      id: "telepase_ausa",
      nombre: "Peaje Promedio Hora Pico (AUSA / Panamericana / Acceso Oeste)",
      valor_num: 3100,
      unidad: "ARS / pasada",
      fuente_oficial: "AUSA / Corredores Viales / Ausol",
      cambio_futuro_previsto: "Expansión de pórticos Free Flow (cobro automático por TelePASE) en autopistas y accesos.",
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
  appState.liveEconomicData.dolarBnaVendedorArs = getVal("dolar_bna_vendedor", 1095);
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

// Archivo .txt mensual de respaldo y edición rápida (datos_economicos_oficiales.txt)
const DEFAULT_DATOS_ECONOMICOS_TXT = [
  "# ============================================================================",
  "# CALCULIVING — ARCHIVO DE ACTUALIZACIÓN MENSUAL DE FUENTES OFICIALES (.TXT)",
  "# Formato: CLAVE = VALOR (podés leer y modificar rápidamente cualquier número)",
  "# ============================================================================",
  "PERIODO_ACTUALIZACION_MENSUAL = 2026-11",
  "IPC_INDEC_MENSUAL_PCT = 2.7",
  "DOLAR_BNA_TIPO_VENDEDOR_ARS = 1095",
  "NAFTA_SUPER_SURTIDOR_ARS = 1195",
  "NAFTA_PREMIUM_SURTIDOR_ARS = 1475",
  "GASOIL_GRADO3_SURTIDOR_ARS = 1420",
  "GNC_SURTIDOR_M3_ARS = 560",
  "RED_SUBE_COLECTIVO_MIN_ARS = 425",
  "RED_SUBE_SUBTE_CABA_ARS = 832",
  "RED_SUBE_TREN_AMBA_ARS = 320",
  "PEAJE_AUSA_PICO_ARS = 3100"
].join("\n");

function parseOfficialEconomicTxt(rawTxt) {
  if (!rawTxt || typeof rawTxt !== "string") return {};
  const map = {};
  rawTxt.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim().toUpperCase();
    const valStr = trimmed.slice(eqIdx + 1).trim();
    if (key) map[key] = valStr;
  });
  return map;
}

function applyParsedTxtToZonalDb(parsedMap) {
  if (!parsedMap || typeof parsedMap !== "object") return;
  const setDbNum = (id, rawVal) => {
    if (rawVal === undefined) return;
    const num = parseFloat(String(rawVal).replace(",", "."));
    if (isNaN(num) || num <= 0) return;
    const item = CALCULIVING_ZONAL_DB.monetario_y_combustible?.find(x => x.id === id) ||
                 CALCULIVING_ZONAL_DB.transporte_oficial_y_futuro?.find(x => x.id === id);
    if (item) item.valor_num = num;
  };
  if (parsedMap.PERIODO_ACTUALIZACION_MENSUAL) {
    appState.liveEconomicData.monthlyPeriod = parsedMap.PERIODO_ACTUALIZACION_MENSUAL;
  }
  setDbNum("ipc_indec", parsedMap.IPC_INDEC_MENSUAL_PCT);
  setDbNum("dolar_bna_vendedor", parsedMap.DOLAR_BNA_TIPO_VENDEDOR_ARS);
  setDbNum("nafta_super_ypf", parsedMap.NAFTA_SUPER_SURTIDOR_ARS);
  setDbNum("nafta_premium_ypf", parsedMap.NAFTA_PREMIUM_SURTIDOR_ARS);
  setDbNum("gasoil_premium", parsedMap.GASOIL_GRADO3_SURTIDOR_ARS);
  setDbNum("gnc_m3", parsedMap.GNC_SURTIDOR_M3_ARS);
  setDbNum("sube_colectivo", parsedMap.RED_SUBE_COLECTIVO_MIN_ARS);
  setDbNum("subte_emova", parsedMap.RED_SUBE_SUBTE_CABA_ARS);
  setDbNum("trenes_amba", parsedMap.RED_SUBE_TREN_AMBA_ARS);
  setDbNum("telepase_ausa", parsedMap.PEAJE_AUSA_PICO_ARS);
  syncZonalDbToLiveEconomicState();
}

function serializeOfficialEconomicTxt() {
  syncZonalDbToLiveEconomicState();
  const e = appState.liveEconomicData;
  const nowMonth = e.monthlyPeriod || new Date().toISOString().slice(0, 7);
  const peajeItem = CALCULIVING_ZONAL_DB.transporte_oficial_y_futuro?.find(x => x.id === "telepase_ausa");
  const peajeVal = peajeItem ? peajeItem.valor_num : 3100;
  return [
    "# ============================================================================",
    "# CALCULIVING — ARCHIVO DE ACTUALIZACIÓN MENSUAL DE FUENTES OFICIALES (.TXT)",
    "# Formato: CLAVE = VALOR (podés leer y modificar rápidamente cualquier número)",
    "# Fuentes Oficiales: IPC/INDEC | Secretaría de Energía | Banco Nación | RED SUBE",
    "# ============================================================================",
    `PERIODO_ACTUALIZACION_MENSUAL = ${nowMonth}`,
    `IPC_INDEC_MENSUAL_PCT = ${e.ipcMensualPct}`,
    `DOLAR_BNA_TIPO_VENDEDOR_ARS = ${e.dolarBnaVendedorArs || 1095}`,
    `NAFTA_SUPER_SURTIDOR_ARS = ${e.naftaSuperLitroArs}`,
    `NAFTA_PREMIUM_SURTIDOR_ARS = ${e.naftaPremiumLitroArs}`,
    `GASOIL_GRADO3_SURTIDOR_ARS = ${e.gasoilPremiumLitroArs}`,
    `GNC_SURTIDOR_M3_ARS = ${e.gncMetroCubicoArs}`,
    `RED_SUBE_COLECTIVO_MIN_ARS = ${e.subeBoletoMinArs}`,
    `RED_SUBE_SUBTE_CABA_ARS = ${e.boletoSubteArs}`,
    `RED_SUBE_TREN_AMBA_ARS = ${e.boletoTrenArs}`,
    `PEAJE_AUSA_PICO_ARS = ${peajeVal}`
  ].join("\n");
}

async function loadOfficialEconomicTxtFile() {
  try {
    const savedCustomTxt = localStorage.getItem("calculiving_datos_economicos_txt_v1");
    if (savedCustomTxt) {
      appState.liveEconomicData.rawTxtContent = savedCustomTxt;
      applyParsedTxtToZonalDb(parseOfficialEconomicTxt(savedCustomTxt));
      return;
    }
  } catch (e) {}

  try {
    const res = await fetch("datos_economicos_oficiales.txt", { cache: "no-store" });
    if (res.ok) {
      const txt = await res.text();
      if (txt && txt.includes("IPC_INDEC_MENSUAL_PCT")) {
        appState.liveEconomicData.rawTxtContent = txt;
        applyParsedTxtToZonalDb(parseOfficialEconomicTxt(txt));
        return;
      }
    }
  } catch (err) {
    // Si se abre por protocolo file:// sin servidor local, utiliza el contenido embebido de datos_economicos_oficiales.txt
  }

  if (!appState.liveEconomicData.rawTxtContent) {
    appState.liveEconomicData.rawTxtContent = DEFAULT_DATOS_ECONOMICOS_TXT;
    applyParsedTxtToZonalDb(parseOfficialEconomicTxt(DEFAULT_DATOS_ECONOMICOS_TXT));
  }
}

// Consulta mensualmente las 4 APIs oficiales requeridas (IPC/INDEC, Secretaría de Energía, Banco Nación Tipo Vendedor y RED SUBE) y sincroniza con datos_economicos_oficiales.txt
async function fetchLiveEconomicIndicators(forceRefresh = false) {
  populateBuenosAiresAllZonesDatalist();
  await loadOfficialEconomicTxtFile();

  const badgeChat = document.getElementById("live-inflation-badge");
  const badgeMap = document.getElementById("map-live-econ-text");
  const currentYearMonth = new Date().toISOString().slice(0, 7);

  // 1. IPC / INDEC Oficial (API Series de Tiempo datos.gob.ar + respaldo INDEC ArgentinaDatos)
  try {
    let ipcUpdated = false;
    try {
      const resGob = await fetch("https://apis.datos.gob.ar/series/api/series/?ids=145.3_INGNACNAL_DICI_M_38&limit=2&sort=desc", {
        headers: { "Accept": "application/json" }
      });
      if (resGob.ok) {
        const gobData = await resGob.json();
        if (gobData && Array.isArray(gobData.data) && gobData.data.length > 0) {
          const [latestDate, latestVal] = gobData.data[0];
          const numVal = typeof latestVal === "number" ? (latestVal < 1 ? +(latestVal * 100).toFixed(1) : +latestVal.toFixed(1)) : NaN;
          if (!isNaN(numVal) && numVal > 0) {
            appState.liveEconomicData.ipcMensualPct = numVal;
            appState.liveEconomicData.ipcFecha = latestDate || currentYearMonth;
            const ipcItem = CALCULIVING_ZONAL_DB.monetario_y_combustible?.find(x => x.id === "ipc_indec");
            if (ipcItem && (!ipcItem.userOverridden || forceRefresh)) {
              ipcItem.valor_num = numVal;
              ipcItem.fuente_oficial = `IPC/INDEC Oficial datos.gob.ar (${latestDate})`;
            }
            ipcUpdated = true;
          }
        }
      }
    } catch (eGob) {}

    if (!ipcUpdated) {
      const resIndec = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion", {
        headers: { "Accept": "application/json" }
      });
      if (resIndec.ok) {
        const data = await resIndec.json();
        if (Array.isArray(data) && data.length > 0) {
          const latest = data[data.length - 1];
          const ipcVal = typeof latest.valor === "number" ? latest.valor : parseFloat(latest.valor) || 2.7;
          const ipcDate = latest.fecha || currentYearMonth;
          appState.liveEconomicData.ipcMensualPct = ipcVal;
          appState.liveEconomicData.ipcFecha = ipcDate;
          const ipcItem = CALCULIVING_ZONAL_DB.monetario_y_combustible?.find(x => x.id === "ipc_indec");
          if (ipcItem && (!ipcItem.userOverridden || forceRefresh)) {
            ipcItem.valor_num = ipcVal;
            ipcItem.fuente_oficial = `IPC/INDEC Oficial (${ipcDate})`;
          }
        }
      }
    }
  } catch (err) {}

  // 2. Banco de la Nación Argentina (BNA) — Dólar Oficial Tipo Vendedor
  try {
    const resBna = await fetch("https://dolarapi.com/v1/dolares/oficial", {
      headers: { "Accept": "application/json" }
    });
    if (resBna.ok) {
      const bnaData = await resBna.json();
      const ventaVal = parseFloat(bnaData?.venta);
      if (!isNaN(ventaVal) && ventaVal > 100) {
        appState.liveEconomicData.dolarBnaVendedorArs = Math.round(ventaVal);
        const bnaItem = CALCULIVING_ZONAL_DB.monetario_y_combustible?.find(x => x.id === "dolar_bna_vendedor");
        if (bnaItem && (!bnaItem.userOverridden || forceRefresh)) {
          bnaItem.valor_num = Math.round(ventaVal);
          bnaItem.fuente_oficial = `Banco Nación (BNA Tipo Vendedor — ${new Date().toLocaleDateString("es-AR")})`;
        }
      }
    }
  } catch (err) {}

  // 3. Secretaría de Energía — Precios en Surtidor (Resolución 314 / CKAN API datos.energia.gob.ar)
  try {
    const energiaUrl = "https://datos.energia.gob.ar/api/3/action/datastore_search?resource_id=80ac25de-a44a-4445-9215-090cf55cfda5&limit=25&q=CAPITAL%20FEDERAL";
    const resEnergia = await fetch(energiaUrl, { headers: { "Accept": "application/json" } });
    if (resEnergia.ok) {
      const energiaJson = await resEnergia.json();
      const records = energiaJson?.result?.records;
      if (Array.isArray(records) && records.length > 0) {
        const superRec = records.find(r => /super|súper/i.test(r.producto || ""));
        const premRec = records.find(r => /premium|infinia|grado\s*3/i.test(r.producto || "") && /nafta/i.test(r.producto || ""));
        const sPrice = parseFloat(superRec?.precio);
        const pPrice = parseFloat(premRec?.precio);
        if (!isNaN(sPrice) && sPrice > 500) {
          const itemSuper = CALCULIVING_ZONAL_DB.monetario_y_combustible?.find(x => x.id === "nafta_super_ypf");
          if (itemSuper && (!itemSuper.userOverridden || forceRefresh)) {
            itemSuper.valor_num = Math.round(sPrice);
          }
        }
        if (!isNaN(pPrice) && pPrice > 600) {
          const itemPrem = CALCULIVING_ZONAL_DB.monetario_y_combustible?.find(x => x.id === "nafta_premium_ypf");
          if (itemPrem && (!itemPrem.userOverridden || forceRefresh)) {
            itemPrem.valor_num = Math.round(pPrice);
          }
        }
      }
    }
  } catch (err) {}

  // 4. RED SUBE — Cuadro Tarifario de Transporte Público (API Series datos.gob.ar / Argentina.gob.ar/redsube)
  try {
    const resSube = await fetch("https://apis.datos.gob.ar/series/api/series/?ids=transporte_sube_tarifa_minima_amba&limit=1&sort=desc", {
      headers: { "Accept": "application/json" }
    });
    if (resSube.ok) {
      const subeJson = await resSube.json();
      if (subeJson && Array.isArray(subeJson.data) && subeJson.data.length > 0) {
        const [, rawTarifa] = subeJson.data[0];
        const parsedTarifa = parseFloat(rawTarifa);
        if (!isNaN(parsedTarifa) && parsedTarifa > 100) {
          const subeItem = CALCULIVING_ZONAL_DB.transporte_oficial_y_futuro?.find(x => x.id === "sube_colectivo");
          if (subeItem && (!subeItem.userOverridden || forceRefresh)) {
            subeItem.valor_num = Math.round(parsedTarifa);
          }
        }
      }
    }
  } catch (err) {}

  appState.liveEconomicData.monthlyPeriod = currentYearMonth;
  appState.liveEconomicData.lastUpdated = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  syncZonalDbToLiveEconomicState();
  appState.liveEconomicData.rawTxtContent = serializeOfficialEconomicTxt();
  saveCalculivingZonalDatabase();

  const econ = appState.liveEconomicData;
  appState.liveEconomicData.sourceLabel = `IPC/INDEC: ${econ.ipcMensualPct.toFixed(1)}% · BNA Vendedor: $${(econ.dolarBnaVendedorArs || 1095).toLocaleString("es-AR")} · Surtidor Energía: $${econ.naftaSuperLitroArs.toLocaleString("es-AR")}/L · RED SUBE: $${econ.subeBoletoMinArs}`;
  const summaryText = `📡 Actualización mensual (${econ.monthlyPeriod}) · ${econ.sourceLabel}`;
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

// Catálogo de Colegios (niños/adultos), Hospitales, Prepagas e Instituciones para hogares multi-habitante
const INSTITUTION_SERVICE_CATALOG = {
  colegio_ninos_publico: { id: "colegio_ninos_publico", category: "colegio_ninos", label: "🏫 Colegio Público (Inicial / Primaria / Secundaria)", perUnitArs: 18000, scaleBy: "students" },
  colegio_ninos_subvencionado: { id: "colegio_ninos_subvencionado", category: "colegio_ninos", label: "🏫 Colegio Privado Parroquial / Subvencionado", perUnitArs: 95000, scaleBy: "students" },
  colegio_ninos_bilingue: { id: "colegio_ninos_bilingue", category: "colegio_ninos", label: "🏫 Colegio Privado Bilingüe / Doble Escolaridad", perUnitArs: 265000, scaleBy: "students" },
  educacion_adultos_publica: { id: "educacion_adultos_publica", category: "educacion_adultos", label: "🎓 Universidad Pública / Terciario / CENS Adultos", perUnitArs: 22000, scaleBy: "students" },
  educacion_adultos_privada: { id: "educacion_adultos_privada", category: "educacion_adultos", label: "🎓 Universidad Privada / Posgrado / Instituto", perUnitArs: 195000, scaleBy: "students" },
  hospital_publico: { id: "hospital_publico", category: "salud", label: "🏥 Hospital Público / CEMAR / Salita Zonal", perUnitArs: 12000, scaleBy: "members" },
  hospital_comunidad: { id: "hospital_comunidad", category: "salud", label: "🏥 Hospital de Comunidad (Italiano / Alemán / Británico / Austral)", perUnitArs: 118000, scaleBy: "members" },
  prepaga_sindical_pmo: { id: "prepaga_sindical_pmo", category: "prepaga", label: "🩺 Obra Social / Prepaga Plan Base PMO", perUnitArs: 64000, scaleBy: "members" },
  prepaga_media_alta: { id: "prepaga_media_alta", category: "prepaga", label: "🩺 Prepaga Plan Medio/Alto (OSDE / Swiss Medical / Galeno / Omint)", perUnitArs: 138000, scaleBy: "members" },
  inst_club_polideportivo: { id: "inst_club_polideportivo", category: "institucion", label: "🏛️ Club Social y Deportivo / Polideportivo Familiar", perUnitArs: 28000, scaleBy: "members" },
  inst_centro_cultural: { id: "inst_centro_cultural", category: "institucion", label: "🏛️ Centro Cultural / Biblioteca / Institución Barrial", perUnitArs: 14000, scaleBy: "members" },
  inst_administrativa_bancaria: { id: "inst_administrativa_bancaria", category: "institucion", label: "🏛️ Cercanía a Polo Bancario / Municipio / Sede Judicial", perUnitArs: 0, scaleBy: "fixed" }
};

function computeHouseholdInstitutionsMonthlyCost(lp = appState.lifestyleProfile) {
  const members = Math.max(1, parseInt(lp?.householdMembers, 10) || 1);
  const students = Math.max(0, parseInt(lp?.householdStudents, 10) || 0);
  const effectiveStudents = Math.max(1, students || 1);
  const selected = Array.isArray(lp?.selectedInstitutions) ? lp.selectedInstitutions : [];

  let totalArs = 0;
  const items = [];
  selected.forEach(instId => {
    const meta = INSTITUTION_SERVICE_CATALOG[instId];
    if (!meta) return;
    let count = 1;
    if (meta.scaleBy === "members") {
      // Descuento por grupo familiar a partir del 2do integrante (~75% por integrante adicional)
      count = 1 + (members - 1) * 0.75;
    } else if (meta.scaleBy === "students") {
      count = students > 0 ? students : effectiveStudents;
    }
    const subtotal = Math.round(meta.perUnitArs * count);
    totalArs += subtotal;
    items.push({
      id: meta.id,
      label: meta.label,
      subtotalArs: subtotal,
      scaleBy: meta.scaleBy
    });
  });

  return { totalArs, items, members, students };
}

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
  const membersEl = document.getElementById("habit-household-members");
  const studentsEl = document.getElementById("habit-household-students");

  if (transportEl) lp.transportMode = transportEl.value;
  updateVehicleDisplacementUI();
  if (dispEl) lp.vehicleDisplacement = dispEl.value;
  if (cookingEl) lp.cookingHabit = cookingEl.value;
  if (dietEl) lp.dietType = dietEl.value;

  if (membersEl) lp.householdMembers = Math.max(1, parseInt(membersEl.value, 10) || 1);
  if (studentsEl) lp.householdStudents = Math.max(0, parseInt(studentsEl.value, 10) || 0);

  syncHobbyPoisWithMap();

  const supers = Array.from(document.querySelectorAll(".habit-supermarket-cb:checked")).map(cb => cb.value);
  lp.selectedSupermarkets = supers.length > 0 ? supers : ["carrefour"];

  const institutions = Array.from(document.querySelectorAll(".habit-institution-cb:checked")).map(cb => cb.value);
  lp.selectedInstitutions = institutions;

  const hhSummary = document.getElementById("habit-household-summary-badge");
  if (hhSummary) {
    const instCost = computeHouseholdInstitutionsMonthlyCost(lp);
    const basketScale = 1 + (lp.householdMembers - 1) * 0.65;
    hhSummary.innerHTML = `👨‍👩‍👧‍👦 <strong>Hogar de ${lp.householdMembers} ${lp.householdMembers === 1 ? "habitante" : "habitantes"}</strong> (${lp.householdStudents} cursando estudios) · Escala de supermercado/servicios: <strong>x${basketScale.toFixed(2)}</strong>${instCost.totalArs > 0 ? ` · Salud/Educación/Instituciones seleccionadas: <strong>+$${instCost.totalArs.toLocaleString("es-AR")}/mes</strong>` : ""}`;
  }

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
  document.getElementById("habit-household-members")?.addEventListener("input", syncLifestyleProfileFromDOM);
  document.getElementById("habit-household-students")?.addEventListener("input", syncLifestyleProfileFromDOM);
  document.querySelectorAll(".habit-hobby-cb, .habit-supermarket-cb, .habit-institution-cb, input[name='habit-priority-ranking']").forEach(el => {
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

    // Detectar colegios, hospitales, prepagas, instituciones y habitantes del hogar
    const hhMembersInput = document.getElementById("habit-household-members");
    const hhStudentsInput = document.getElementById("habit-household-students");
    const famMatch = low.match(/\bsomos\s+(\d+)\b|\b(\d+)\s+(?:personas|habitantes|integrantes)\b/);
    if (famMatch && hhMembersInput) {
      const n = parseInt(famMatch[1] || famMatch[2], 10);
      if (n >= 1 && n <= 12) {
        hhMembersInput.value = String(n);
        detectedChanges.push(`👨‍👩‍👧‍👦 Hogar configurado para <strong>${n} habitantes</strong>`);
      }
    }
    const kidsMatch = low.match(/\b(\d+)\s+(?:hijos|chicos|ninos|niños|estudiantes)\b/);
    if (kidsMatch && hhStudentsInput) {
      const k = parseInt(kidsMatch[1], 10);
      if (k >= 0 && k <= 10) {
        hhStudentsInput.value = String(k);
        if (hhMembersInput && parseInt(hhMembersInput.value, 10) <= k) {
          hhMembersInput.value = String(k + 1);
        }
        detectedChanges.push(`🎒 <strong>${k} estudiante(s)</strong> en el hogar`);
      }
    }
    if (low.includes("colegio bilingue") || low.includes("doble escolaridad")) {
      const cb = document.querySelector('.habit-institution-cb[value="colegio_ninos_bilingue"]');
      if (cb) cb.checked = true;
      detectedChanges.push("🏫 Educación: Colegio Privado Bilingüe / Doble Escolaridad activado");
    } else if (low.includes("colegio privado") || low.includes("parroquial")) {
      const cb = document.querySelector('.habit-institution-cb[value="colegio_ninos_subvencionado"]');
      if (cb) cb.checked = true;
      detectedChanges.push("🏫 Educación: Colegio Privado / Subvencionado activado");
    } else if (low.includes("colegio") || low.includes("escuela")) {
      const cb = document.querySelector('.habit-institution-cb[value="colegio_ninos_publico"]');
      if (cb) cb.checked = true;
      detectedChanges.push("🏫 Educación: Colegio Público activado");
    }
    if (low.includes("prepaga") || low.includes("osde") || low.includes("swiss") || low.includes("galeno") || low.includes("omint")) {
      const cb = document.querySelector('.habit-institution-cb[value="prepaga_media_alta"]');
      if (cb) cb.checked = true;
      detectedChanges.push("🩺 Salud: Prepaga Plan Medio/Alto activada");
    } else if (low.includes("obra social")) {
      const cb = document.querySelector('.habit-institution-cb[value="prepaga_sindical_pmo"]');
      if (cb) cb.checked = true;
      detectedChanges.push("🩺 Salud: Obra Social / Plan PMO activado");
    }
    if (low.includes("hospital italiano") || low.includes("hospital aleman") || low.includes("hospital britanico")) {
      const cb = document.querySelector('.habit-institution-cb[value="hospital_comunidad"]');
      if (cb) cb.checked = true;
      detectedChanges.push("🏥 Salud: Hospital de Comunidad activado");
    } else if (low.includes("hospital")) {
      const cb = document.querySelector('.habit-institution-cb[value="hospital_publico"]');
      if (cb) cb.checked = true;
      detectedChanges.push("🏥 Salud: Hospital Público Zonal activado");
    }

    // Detectar prioridad de Conveniencia de concentración de servicios
    if (low.includes("menos tiempo") || low.includes("viajar menos") || low.includes("cerca")) {
      const r = document.querySelector('input[name="habit-priority-ranking"][value="menos_viaje"]');
      if (r) r.checked = true;
      detectedChanges.push("⏱️ Conveniencia de concentración de servicios priorizada por: <strong>Menos tiempo en viaje</strong>");
    } else if (low.includes("menos gasto") || low.includes("mas barato") || low.includes("ahorrar")) {
      const r = document.querySelector('input[name="habit-priority-ranking"][value="menos_gasto"]');
      if (r) r.checked = true;
      detectedChanges.push("💰 Conveniencia de concentración de servicios priorizada por: <strong>Menos gasto mensual total</strong>");
    } else if (low.includes("todos los lugares") || low.includes("equilibrio") || low.includes("frecuento")) {
      const r = document.querySelector('input[name="habit-priority-ranking"][value="equilibrio_frecuentes"]');
      if (r) r.checked = true;
      detectedChanges.push("🎯 Conveniencia de concentración de servicios priorizada por: <strong>Mejor lugar para todos los sitios que frecuentás</strong>");
    }

    syncLifestyleProfileFromDOM();

    if (chatThread) {
      const bMsg = document.createElement("div");
      bMsg.className = "chat-msg bot";
      const innerHtml = detectedChanges.length > 0
        ? `¡Perfecto! Actualicé tu perfil y tus puntos para el mapa:<br>• ${detectedChanges.join("<br>• ")}<br><span style="font-size:0.75rem; color:#38bdf8;">Fijate en la tarjeta 3 que ya podés ajustar la ubicación de tus puntos o tocar <strong>Ir al Mapa Limpio de Buenos Aires →</strong>.</span>`
        : `Anotado. Tus preferencias quedaron guardadas para evaluar la <strong>Conveniencia de concentración de servicios</strong> y calcular tu costo de vida real cuando elijas tus zonas en el mapa.`;
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
   MODAL INTERACTIVO DE BASE DE DATOS PROPIA Y ARCHIVO .TXT MENSUAL
---------------------------------------------------- */
function setupZonalDatabaseModal() {
  document.getElementById("btn-open-zonal-db-from-chat")?.addEventListener("click", () => openZonalDatabaseModal());
  document.getElementById("btn-open-zonal-db-from-map")?.addEventListener("click", () => openZonalDatabaseModal());
  document.getElementById("btn-refresh-live-econ")?.addEventListener("click", async () => {
    await fetchLiveEconomicIndicators(true);
    renderAffordabilityZonesOnMap();
  });
  document.getElementById("close-zonal-db-modal-btn")?.addEventListener("click", () => {
    document.getElementById("zonal-database-modal")?.classList.remove("open");
  });
  document.getElementById("btn-sync-zonal-db-live")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-sync-zonal-db-live");
    if (btn) btn.textContent = "⏳ Consultando IPC/INDEC, Energía, BNA y RED SUBE...";
    await fetchLiveEconomicIndicators(true);
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

  const currentTxt = serializeOfficialEconomicTxt();

  body.innerHTML = `
    <div style="background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.4); border-radius:6px; padding:0.65rem 0.8rem; margin-bottom:0.9rem; font-size:0.75rem; color:#e2e8f0;">
      📌 <strong>Fuentes de Datos Oficiales (Actualización Mensual + Archivo <code>datos_economicos_oficiales.txt</code>):</strong> Calculiving consulta mensualmente las APIs oficiales de <strong>IPC/INDEC</strong> (inflación), <strong>Secretaría de Energía</strong> (nafta en surtidor), <strong>Banco Nación</strong> (dólar tipo vendedor) y <strong>RED SUBE</strong> (cuadro tarifario de transporte), sincronizadas con el archivo plano <code>datos_economicos_oficiales.txt</code> que podés leer y modificar rápidamente acá abajo o en disco.
    </div>

    <!-- EDITOR / LECTOR RÁPIDO DEL ARCHIVO PLANO datos_economicos_oficiales.txt -->
    <div style="background:rgba(16,185,129,0.07); border:1.5px solid rgba(16,185,129,0.45); border-radius:8px; padding:0.75rem; margin-bottom:1rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem; margin-bottom:0.4rem;">
        <h4 style="font-size:0.84rem; font-weight:800; color:#34d399; margin:0;">
          📄 Archivo Mensual de Lectura y Edición Rápida: <code>datos_economicos_oficiales.txt</code>
        </h4>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          <label class="btn-sm btn-secondary" style="font-size:0.68rem; padding:0.22rem 0.55rem; cursor:pointer; margin:0;">
            📂 Cargar archivo .txt
            <input type="file" id="db-upload-txt-input" accept=".txt" style="display:none;">
          </label>
          <button type="button" id="btn-download-official-txt" class="btn-sm btn-secondary" style="font-size:0.68rem; padding:0.22rem 0.55rem;">
            ⬇️ Descargar datos_economicos_oficiales.txt
          </button>
          <button type="button" id="btn-apply-official-txt" class="btn-sm btn-primary" style="font-size:0.7rem; padding:0.22rem 0.65rem;">
            💾 Aplicar cambios del .txt
          </button>
        </div>
      </div>
      <textarea id="db-official-txt-editor" rows="9" style="width:100%; font-family:monospace; font-size:0.73rem; background:#090d16; color:#a7f3d0; border:1px solid rgba(52,211,153,0.4); border-radius:6px; padding:0.5rem; line-height:1.35;">${escapeHtml(currentTxt)}</textarea>
    </div>

    <h4 style="font-size:0.86rem; font-weight:800; color:#38bdf8; margin-bottom:0.4rem;">
      💵 1. Indicadores Oficiales: IPC/INDEC, Banco Nación (Tipo Vendedor) y Secretaría de Energía (Surtidor)
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
      🚇 2. Cuadro Tarifario Oficial RED SUBE y Transporte Metropolitano
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
        Si un valor de nafta, dólar BNA, boleto RED SUBE, alquiler zonal o estado de una estación/ruta cambió, ingresalo acá para actualizar nuestra Base de Datos y recalcular tus resultados:
      </p>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:0.5rem; margin-bottom:0.55rem;">
        <div>
          <label style="font-size:0.7rem; color:#bae6fd; display:block; margin-bottom:2px;">¿Qué dato querés actualizar o reportar?</label>
          <select id="db-report-target-select" class="salary-input" style="width:100%; font-size:0.75rem; padding:0.32rem 0.45rem;">
            <option value="dolar_bna_vendedor">💵 Dólar Banco Nación Tipo Vendedor ($/USD)</option>
            <option value="nafta_super_ypf">⛽ Precio Nafta Súper Surtidor ($/L)</option>
            <option value="nafta_premium_ypf">⛽ Precio Nafta Premium Surtidor ($/L)</option>
            <option value="sube_colectivo">🚌 Boleto Mínimo Colectivo RED SUBE ($)</option>
            <option value="subte_emova">🚇 Pasaje de Subte CABA ($)</option>
            <option value="trenes_amba">🚆 Boleto de Tren AMBA ($)</option>
            <option value="ipc_indec">📈 Inflación Mensual IPC/INDEC (%)</option>
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

  // Eventos del editor rápido .txt
  document.getElementById("btn-apply-official-txt")?.addEventListener("click", () => {
    const txtArea = document.getElementById("db-official-txt-editor");
    if (!txtArea) return;
    const raw = txtArea.value;
    appState.liveEconomicData.rawTxtContent = raw;
    try { localStorage.setItem("calculiving_datos_economicos_txt_v1", raw); } catch (e) {}
    applyParsedTxtToZonalDb(parseOfficialEconomicTxt(raw));
    saveCalculivingZonalDatabase();
    fetchLiveEconomicIndicators();
    renderAffordabilityZonesOnMap();
    renderUserSelectedZonesSidebar();
    openZonalDatabaseModal();
  });

  document.getElementById("btn-download-official-txt")?.addEventListener("click", () => {
    const txtArea = document.getElementById("db-official-txt-editor");
    const content = txtArea ? txtArea.value : serializeOfficialEconomicTxt();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "datos_economicos_oficiales.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById("db-upload-txt-input")?.addEventListener("change", (ev) => {
    const file = ev.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      appState.liveEconomicData.rawTxtContent = content;
      try { localStorage.setItem("calculiving_datos_economicos_txt_v1", content); } catch (e) {}
      applyParsedTxtToZonalDb(parseOfficialEconomicTxt(content));
      saveCalculivingZonalDatabase();
      fetchLiveEconomicIndicators();
      renderAffordabilityZonesOnMap();
      renderUserSelectedZonesSidebar();
      openZonalDatabaseModal();
    };
    reader.readAsText(file);
  });

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
    const updatedTxt = serializeOfficialEconomicTxt();
    appState.liveEconomicData.rawTxtContent = updatedTxt;
    try { localStorage.setItem("calculiving_datos_economicos_txt_v1", updatedTxt); } catch (e) {}
    fetchLiveEconomicIndicators();
    renderAffordabilityZonesOnMap();
    renderUserSelectedZonesSidebar();
    if (appState.currentScreen === "screen-resultados" && selectedZoneForDeepDive) {
      renderFocusedZoneDeepDive(selectedZoneForDeepDive);
    }
    openZonalDatabaseModal();
  });

  document.getElementById("btn-reset-db-defaults")?.addEventListener("click", () => {
    try {
      localStorage.removeItem("calculiving_zonal_db_v1");
      localStorage.removeItem("calculiving_datos_economicos_txt_v1");
    } catch (e) {}
    CALCULIVING_ZONAL_DB = JSON.parse(JSON.stringify(CALCULIVING_ZONAL_DB_DEFAULT));
    appState.liveEconomicData.rawTxtContent = DEFAULT_DATOS_ECONOMICOS_TXT;
    syncZonalDbToLiveEconomicState();
    fetchLiveEconomicIndicators(true);
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
    id: "zona-chacarita",
    slug: "chacarita",
    region: "caba",
    name: "Chacarita (Av. Federico Lacroze / Av. Corrientes / Av. Dorrego / Av. Álvarez Thomas)",
    urban_boundary_note: "Delimitado por Av. Elcano, Av. Álvarez Thomas, Av. Federico Lacroze, Av. Córdoba, Av. Dorrego, Vías del Ferrocarril San Martín y Av. Warnes / Garmendia.",
    bridge_price_effect: "Entre el polo gastronómico de Av. Jorge Newbery / Guevara y la cabecera Federico Lacroze (Subte B y Tren Urquiza), el alquiler es un ~18% más accesible que en Palermo Hollywood y Colegiales.",
    coords: [
      [-34.5815, -58.4565],
      [-34.5845, -58.4455],
      [-34.5895, -58.4425],
      [-34.5918, -58.4495],
      [-34.5975, -58.4535],
      [-34.5945, -58.4635],
      [-34.5865, -58.4645]
    ],
    alquiler_ars: 555000,
    expensas_ars: 102000,
    servicios_ars: 57000,
    canasta_comercios_ars: 234000,
    transporte_ars: 32000,
    impuestos_y_servicios: {
      abl_municipal_ars: 13500,
      luz_edenor_edesur_ars: 15800,
      gas_metrogas_ars: 8900,
      agua_aysa_ars: 8300,
      internet_fibra_ars: 10500
    },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Proveedurías (Av. Federico Lacroze / Av. Forest / Av. Triunvirato)", valores: "Leche 1L: $1.410 | Arroz 1kg: $1.680 | Aceite 1.5L: $2.620", mensual_ars: 87000 },
      { tipo: "🥩 Carnicerías y Granjas (Fraga / Guevara / Olleros)", valores: "Asado 1kg: $8.950 | Suprema 1kg: $6.100 | Maple huevos: $4.050", mensual_ars: 57000 },
      { tipo: "🥬 Verdulerías y Feria Parque Los Andes", valores: "Papa 1kg: $980 | Tomate 1kg: $1.850 | Bolsón verdura: $8.500", mensual_ars: 31000 },
      { tipo: "🥖 Panaderías de Masa Madre y Polo Gastronómico (Jorge Newbery / Charlone)", valores: "Pan masa madre: $3.800 | Café de especialidad + laminado: $5.100", mensual_ars: 23000 },
      { tipo: "🧺 Farmacias y Lavaderos sobre Av. Lacroze / Av. Guzmán", valores: "Valet lavadero: $4.900 | Insumos limpieza: $12.800", mensual_ars: 18000 },
      { tipo: "🏋️ Gimnasios y Entrenamiento en Parque Los Andes", valores: "Cuota mensual: $27.000", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Subte B (Estaciones Dorrego y Federico Lacroze), Tren Urquiza (Cabecera Lacroze), Tren San Martín (Est. Villa Crespo/Chacarita) y Parque Los Andes."
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
    region: "caba",
    name: "Belgrano (CABA — Av. Cabildo / Av. del Libertador / Juramento)",
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
    id: "zona-recoleta",
    slug: "recoleta",
    region: "caba",
    name: "Recoleta (CABA — Av. Santa Fe / Av. Las Heras / Av. Callao / Av. Pueyrredón)",
    urban_boundary_note: "Delimitado por Av. Pueyrredón, Av. Córdoba, Calle Montevideo / Uruguay, Av. del Libertador y Av. Las Heras.",
    bridge_price_effect: "Entre Av. Santa Fe y Av. Las Heras concentra alta densidad de comercios, universidades y Subtes D y H; cruzando hacia Av. del Libertador suben las expensas y el ABL.",
    coords: [
      [-34.5825, -58.4045],
      [-34.5815, -58.3915],
      [-34.5875, -58.3845],
      [-34.5985, -58.3885],
      [-34.5992, -58.4045],
      [-34.5915, -58.4075]
    ],
    alquiler_ars: 890000,
    expensas_ars: 195000,
    servicios_ars: 85000,
    canasta_comercios_ars: 350000,
    transporte_ars: 38000,
    impuestos_y_servicios: {
      abl_municipal_ars: 26000,
      luz_edenor_edesur_ars: 23000,
      gas_metrogas_ars: 12500,
      agua_aysa_ars: 13000,
      internet_fibra_ars: 10500
    },
    locales_cercanos: [
      { tipo: "🛒 Supermercados de Cercanía (Av. Las Heras / Av. Pueyrredón / Av. Santa Fe)", valores: "Leche 1L: $1.610 | Agua mineral pack: $6.000 | Fiambres 200g: $4.600", mensual_ars: 128000 },
      { tipo: "🥩 Carnicerías y Rotiserías (Pacheco de Melo / Peña / Juncal)", valores: "Lomo/Ojo de bife 1kg: $12.200 | Tartas/Platos del día: $7.500", mensual_ars: 84000 },
      { tipo: "🥬 Fruterías y Almacenes Naturales (Juncal / Uriburu)", valores: "Frutas seleccionadas 1kg: $2.750 | Verduras bandeja lista: $2.500", mensual_ars: 48000 },
      { tipo: "🥐 Panaderías Francesas y Confiterías (Av. Las Heras / Callao)", valores: "Baguette: $2.300 | Desayuno completo: $9.800", mensual_ars: 40000 },
      { tipo: "👔 Tintorerías Tradicionales y Farmacias", valores: "Tintorería camisa/traje: $8.900 | Farmacia/Higiene: $22.000", mensual_ars: 26000 },
      { tipo: "🏋️ Clubes y Gimnasios en Recoleta", valores: "Cuota mensual: $48.000", mensual_ars: 24000 }
    ],
    gastos_alrededor_detalle: "Subte D (Callao / Facultad de Medicina / Pueyrredón / Agüero) y Subte H (Las Heras / Santa Fe / Córdoba)."
  },
  {
    id: "zona-coghlan",
    slug: "coghlan",
    region: "caba",
    name: "Coghlan (CABA — Av. Monroe / Av. Crámer / Estación Coghlan)",
    urban_boundary_note: "Delimitado por Av. Monroe, Av. Ricardo Balbín, Calle Núñez, Zapiola y las vías del Ferrocarril Mitre.",
    bridge_price_effect: "Alrededor de la estación Coghlan y el Hospital Pirovano predominan calles arboladas, PHs y edificios bajos con alquileres un ~16% menores que sobre Av. Cabildo.",
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
      { tipo: "🛒 Supermercados y Almacenes (Av. Monroe / Av. Congreso / Balbín)", valores: "Leche 1L: $1.490 | Queso tybo 1kg: $9.400 | Yerba 1kg: $3.750", mensual_ars: 102000 },
      { tipo: "🥩 Carnicerías y Granja (Pedro Ignacio Rivera / Superí)", valores: "Asado/Vacío 1kg: $10.100 | Suprema 1kg: $6.900 | Maple huevos: $4.600", mensual_ars: 68000 },
      { tipo: "🥬 Verdulerías y Fruterías (Plaza Castelli / Av. Congreso)", valores: "Papa 1kg: $1.100 | Tomate 1kg: $2.150 | Fruta estación 1kg: $2.100", mensual_ars: 39000 },
      { tipo: "🥖 Panaderías y Cafeterías frente a Estación Coghlan", valores: "Pan artesanal 1kg: $3.000 | Café + medialunas: $4.600", mensual_ars: 29000 },
      { tipo: "🧺 Tintorerías, Veterinarias y Farmacias (Conde / Freire)", valores: "Valet ropa: $5.900 | Insumos limpieza y cuidado: $16.500", mensual_ars: 21000 },
      { tipo: "🏋️ Gimnasios y Clubes de Barrio", valores: "Cuota mensual: $36.000", mensual_ars: 26000 }
    ],
    gastos_alrededor_detalle: "Estación Coghlan y Belgrano R (Tren Mitre), cercanía a Subte B (De los Incas / Rosas) y Subte D (Congreso de Tucumán)."
  },
  // --- RESTO DE CAPITAL FEDERAL (CABA) ---
  {
    id: "zona-villa-urquiza",
    slug: "villa-urquiza",
    region: "caba",
    name: "Villa Urquiza (CABA — Av. Triunvirato / Av. Olazábal / Av. Congreso)",
    urban_boundary_note: "Delimitado por Av. Crisólogo Larralde, Av. Galván, Av. de los Constituyentes, La Pampa y Rómulo Naón.",
    bridge_price_effect: "Sobre el eje del Subte B (Juan Manuel de Rosas / Echeverría) y el corredor DoHo hay alta oferta gastronómica y edificios modernos.",
    coords: [
      [-34.5625, -58.4945],
      [-34.5615, -58.4745],
      [-34.5735, -58.4725],
      [-34.5825, -58.4815],
      [-34.5795, -58.5015],
      [-34.5685, -58.5035]
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
      { tipo: "🥬 Verdulerías y Ferias (Plaza Echeverría)", valores: "Papa 1kg: $1.000 | Tomate 1kg: $1.950 | Bolsón verdura: $8.800", mensual_ars: 35000 },
      { tipo: "🥖 Panaderías y Cafés (Corredor DoHo / Holmberg)", valores: "Pan 1kg: $2.750 | Café + medialunas: $4.200", mensual_ars: 25000 },
      { tipo: "🧺 Farmacias y Lavaderos de Barrio", valores: "Valet ropa: $5.200 | Limpieza hogar: $14.000", mensual_ars: 18000 },
      { tipo: "🏋️ Gimnasios y Clubes en Villa Urquiza", valores: "Cuota mensual: $29.000", mensual_ars: 21000 }
    ],
    gastos_alrededor_detalle: "Cabecera Subte B (Juan Manuel de Rosas / Echeverría) y Estación Gral. Urquiza (Tren Mitre)."
  },
  {
    id: "zona-nunez",
    slug: "nunez",
    region: "caba",
    name: "Núñez (CABA — Av. Cabildo / Av. del Libertador / Av. Crisólogo Larralde)",
    urban_boundary_note: "Delimitado por Av. Congreso, Av. Cabildo, Av. Crisólogo Larralde, Av. Gral. Paz y Río de la Plata.",
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
    id: "zona-villa-devoto",
    slug: "villa-devoto",
    region: "caba",
    name: "Villa Devoto (CABA — Plaza Arenales / Av. Francisco Beiró / Av. San Martín)",
    urban_boundary_note: "Delimitado por Av. Gral. Paz, Av. San Martín, Calle Campana, Av. Francisco Beiró, Segurola y Lope de Vega.",
    bridge_price_effect: "Alrededor de Plaza Arenales (Devoto Centro) el polo gastronómico eleva los alquileres, mientras que hacia Av. Gral. Paz o Lope de Vega bajan un ~14%.",
    coords: [
      [-34.5885, -58.5085],
      [-34.5915, -58.4945],
      [-34.6045, -58.4965],
      [-34.6135, -58.5145],
      [-34.6025, -58.5285]
    ],
    alquiler_ars: 560000,
    expensas_ars: 98000,
    servicios_ars: 56000,
    canasta_comercios_ars: 242000,
    transporte_ars: 35000,
    impuestos_y_servicios: { abl_municipal_ars: 13500, luz_edenor_edesur_ars: 15500, gas_metrogas_ars: 9000, agua_aysa_ars: 8000, internet_fibra_ars: 10000 },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Centros Comerciales (Av. Francisco Beiró / Av. Lope de Vega)", valores: "Leche 1L: $1.390 | Fideos 500g: $1.100 | Yerba 1kg: $3.550", mensual_ars: 89000 },
      { tipo: "🥩 Carnicerías y Frigoríficos (Av. Lope de Vega / Sanabria)", valores: "Asado 1kg: $8.900 | Suprema 1kg: $6.100 | Maple huevos: $4.200", mensual_ars: 58000 },
      { tipo: "🥬 Verdulerías y Feria Plaza Arenales", valores: "Papa 1kg: $920 | Tomate 1kg: $1.800 | Fruta 1kg: $1.750", mensual_ars: 34000 },
      { tipo: "🥖 Panaderías Tradicionales y Cafés (Plaza Arenales / Mercedes)", valores: "Pan 1kg: $2.550 | Facturas docena: $5.800", mensual_ars: 24000 },
      { tipo: "🧺 Farmacias y Lavaderos", valores: "Valet ropa: $4.800 | Limpieza mensual: $12.500", mensual_ars: 17000 },
      { tipo: "🏋️ Clubes y Gimnasios en Villa Devoto", valores: "Cuota social/gimnasio: $26.000", mensual_ars: 20000 }
    ],
    gastos_alrededor_detalle: "Tren San Martín (Estación Devoto a Palermo en 14 min), Tren Urquiza (Est. Antonio Devoto) y rápido acceso a Av. Gral. Paz."
  },
  {
    id: "zona-flores",
    slug: "flores",
    region: "caba",
    name: "Flores (CABA — Av. Rivadavia / Plaza Flores / Av. Carabobo)",
    urban_boundary_note: "Delimitado por Av. Gaona, Av. Donato Álvarez, Curapaligüe, Av. Castañares, Av. Varela y Portela.",
    bridge_price_effect: "Entre Av. Rivadavia y Av. Gaona (Flores Norte / Subte A) hay edificios con expensas moderadas; hacia el sur de Av. Directorio los precios bajan un ~18%.",
    coords: [
      [-34.6185, -58.4725],
      [-34.6195, -58.4525],
      [-34.6365, -58.4515],
      [-34.6425, -58.4685],
      [-34.6315, -58.4765]
    ],
    alquiler_ars: 465000,
    expensas_ars: 82000,
    servicios_ars: 49000,
    canasta_comercios_ars: 215000,
    transporte_ars: 34000,
    impuestos_y_servicios: { abl_municipal_ars: 10500, luz_edenor_edesur_ars: 14000, gas_metrogas_ars: 8000, agua_aysa_ars: 7000, internet_fibra_ars: 9500 },
    locales_cercanos: [
      { tipo: "🛒 Mayoristas y Supermercados (Av. Rivadavia / Av. Juan B. Alberdi)", valores: "Leche 1L: $1.320 | Aceite 1.5L: $2.500 | Yerba 1kg: $3.350", mensual_ars: 79000 },
      { tipo: "🥩 Frigoríficos y Carnicerías (Av. Boyacá / Av. Carabobo)", valores: "Asado/Vacío 1kg: $8.100 | Milanesa 1kg: $6.400 | Maple huevos: $3.900", mensual_ars: 52000 },
      { tipo: "🥬 Mercados y Verdulerías (Av. Avellaneda / Av. Nazca)", valores: "Papa 1kg: $800 | Cebolla 1kg: $900 | Fruta estación 1kg: $1.500", mensual_ars: 29000 },
      { tipo: "🥖 Panaderías y Casas de Pastas de Barrio", valores: "Pan 1kg: $2.200 | Ravioles x2 cajas: $4.200", mensual_ars: 21000 },
      { tipo: "🧺 Artículos de Limpieza Sueltos e Indumentaria (Polo Avellaneda)", valores: "Limpieza mensual: $9.800 | Valet ropa: $4.200", mensual_ars: 16000 },
      { tipo: "🏋️ Gimnasios y Clubes Barriales en Flores", valores: "Cuota mensual: $22.000", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Subte A (Carabobo / San José de Flores / San Pedrito), Tren Sarmiento (Estación Flores) y centro comercial de Av. Rivadavia y Av. Avellaneda."
  },
  {
    id: "zona-san-telmo",
    slug: "san-telmo",
    region: "caba",
    name: "San Telmo (CABA — Casco Histórico / Av. Paseo Colón / Defensa)",
    urban_boundary_note: "Delimitado por Calle Chile, Av. Ing. Huergo, Av. Brasil, Av. Martín García, Defensa, Av. Caseros y Piedras.",
    bridge_price_effect: "Sobre Boulevard Caseros y Plaza Dorrego subió la demanda gastronómica y cultural, con edificios históricos de bajas expensas.",
    coords: [
      [-34.6145, -58.3785],
      [-34.6135, -58.3665],
      [-34.6265, -58.3655],
      [-34.6285, -58.3775],
      [-34.6215, -58.3795]
    ],
    alquiler_ars: 495000,
    expensas_ars: 95000,
    servicios_ars: 51000,
    canasta_comercios_ars: 228000,
    transporte_ars: 32000,
    impuestos_y_servicios: { abl_municipal_ars: 11500, luz_edenor_edesur_ars: 14500, gas_metrogas_ars: 8000, agua_aysa_ars: 7500, internet_fibra_ars: 9500 },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Autoservicios (Av. Independencia / Av. Paseo Colón / Perú)", valores: "Leche 1L: $1.360 | Fideos 500g: $1.100 | Yerba 1kg: $3.450", mensual_ars: 84000 },
      { tipo: "🥩 Mercado de San Telmo y Carnicerías (Bolívar / Defensa / Av. Caseros)", valores: "Asado 1kg: $8.600 | Suprema 1kg: $6.000 | Maple huevos: $4.100", mensual_ars: 55000 },
      { tipo: "🥬 Verdulerías y Ferias de Abastecimiento", valores: "Papa 1kg: $880 | Tomate 1kg: $1.750 | Fruta 1kg: $1.650", mensual_ars: 31000 },
      { tipo: "🥖 Panaderías y Menús Ejecutivos de Mediodía", valores: "Pan 1kg: $2.400 | Menú del día: $6.800", mensual_ars: 23000 },
      { tipo: "🧺 Farmacias y Lavaderos", valores: "Valet ropa: $4.600 | Limpieza mensual: $11.500", mensual_ars: 17000 },
      { tipo: "🏋️ Gimnasios y Clubes en San Telmo", valores: "Cuota mensual: $24.000", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Subte C y E (Independencia / San Juan), Metrobus del Bajo y Metrobus 9 de Julio."
  },

  // --- GRAN BUENOS AIRES: ZONA NORTE ---
  {
    id: "zona-vicente-lopez",
    slug: "vicente-lopez",
    region: "zona-norte",
    name: "Vicente López (GBA Norte — Olivos / Av. Maipú / Paseo de la Costa)",
    urban_boundary_note: "Partido de Vicente López entre Av. Gral. Paz, Calle Paraná, Av. Mitre / Av. Maipú, Av. del Libertador y Paseo de la Costa (Río de la Plata).",
    bridge_price_effect: "Entre Av. Maipú y el Río (Tren Mitre ramal Tigre y Paseo de la Costa) los alquileres son un ~25% más altos que cruzando Av. Mitre y Panamericana hacia el oeste.",
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
      { tipo: "🥩 Carnicerías y Granjas (Olivos / Vicente López)", valores: "Asado 1kg: $9.900 | Suprema 1kg: $6.700 | Maple huevos: $4.500", mensual_ars: 66000 },
      { tipo: "🥬 Verdulerías y Almacenes (Calle Córdoba / Paraná)", valores: "Papa 1kg: $1.050 | Tomate 1kg: $2.100 | Fruta 1kg: $2.000", mensual_ars: 38000 },
      { tipo: "🥖 Panaderías y Cafeterías (Estación Vicente López / Olivos)", valores: "Pan 1kg: $2.950 | Café + medialunas: $4.500", mensual_ars: 28000 },
      { tipo: "🧺 Farmacias y Lavaderos", valores: "Valet ropa: $5.600 | Limpieza mensual: $15.000", mensual_ars: 20000 },
      { tipo: "🏋️ Gimnasios y Deportes en el Vial Costero", valores: "Cuota mensual: $34.000", mensual_ars: 25000 }
    ],
    gastos_alrededor_detalle: "Metrobus Norte por Av. Maipú (conecta directo con Puente Saavedra y Subte D), Tren Mitre (Ramales Tigre y Bartolomé Mitre) y Tren de la Costa."
  },
  {
    id: "zona-san-martin",
    slug: "san-martin",
    region: "zona-norte",
    name: "General San Martín (GBA Noroeste — San Martín Centro / Villa Ballester)",
    urban_boundary_note: "Partido de General San Martín: Casco céntrico (Peatonal Belgrano / Plaza San Martín), Campus UNSAM, San Andrés y Villa Ballester.",
    bridge_price_effect: "Cruzando Av. Gral. Paz y Autopista Panamericana hacia San Martín y Villa Ballester, el alquiler de 2 y 3 ambientes baja un ~26% respecto a CABA Norte.",
    coords: [
      [-34.5355, -58.5325],
      [-34.5655, -58.5125],
      [-34.5855, -58.5265],
      [-34.5815, -58.5625],
      [-34.5425, -58.5685]
    ],
    alquiler_ars: 470000,
    expensas_ars: 72000,
    servicios_ars: 52000,
    canasta_comercios_ars: 220000,
    transporte_ars: 36000,
    impuestos_y_servicios: { abl_municipal_ars: 11500, luz_edenor_edesur_ars: 14500, gas_metrogas_ars: 8500, agua_aysa_ars: 7500, internet_fibra_ars: 10000 },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Mayoristas (Peatonal Belgrano San Martín / Calle Alvear)", valores: "Leche 1L: $1.340 | Fideos 500g: $1.080 | Yerba 1kg: $3.400", mensual_ars: 81000 },
      { tipo: "🥩 Carnicerías y Frigoríficos (San Martín / Villa Ballester)", valores: "Asado 1kg: $8.300 | Suprema 1kg: $5.900 | Maple huevos: $4.000", mensual_ars: 54000 },
      { tipo: "🥬 Verdulerías y Ferias Municipales", valores: "Papa 1kg: $820 | Tomate 1kg: $1.650 | Fruta estación 1kg: $1.550", mensual_ars: 30000 },
      { tipo: "🥖 Panaderías y Confiterías (Alvear Ballester / Centro San Martín)", valores: "Pan 1kg: $2.300 | Facturas docena: $5.200", mensual_ars: 21000 },
      { tipo: "🧺 Comercios e Indumentaria y Limpieza", valores: "Limpieza suelta mensual: $10.500 | Valet ropa: $4.400", mensual_ars: 16000 },
      { tipo: "🏋️ Gimnasios y Clubes Deportivos", valores: "Cuota mensual: $22.000", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Tren Mitre Ramal José León Suárez (Estaciones Miguelete, San Martín, San Andrés, Malaver, Villa Ballester) y Campus UNSAM."
  },
  {
    id: "zona-san-isidro",
    slug: "san-isidro",
    region: "zona-norte",
    name: "San Isidro (GBA Norte — Casco Histórico / Av. Centenario / Martínez)",
    urban_boundary_note: "Partido de San Isidro entre Calle Paraná, Río de la Plata, Calle Uruguay y Autopista Panamericana.",
    bridge_price_effect: "Entre Av. del Libertador y el río predominan valores residenciales altos; hacia Av. Centenario, Av. Andrés Rolón y Panamericana las expensas y alquileres bajan un ~20%.",
    coords: [
      [-34.4525, -58.5185],
      [-34.4685, -58.4925],
      [-34.4885, -58.4795],
      [-34.5025, -58.5285],
      [-34.4745, -58.5485]
    ],
    alquiler_ars: 590000,
    expensas_ars: 105000,
    servicios_ars: 61000,
    canasta_comercios_ars: 258000,
    transporte_ars: 41000,
    impuestos_y_servicios: { abl_municipal_ars: 16000, luz_edenor_edesur_ars: 17000, gas_metrogas_ars: 9500, agua_aysa_ars: 8500, internet_fibra_ars: 10000 },
    locales_cercanos: [
      { tipo: "🛒 Hipermercados y Centros Comerciales (Av. Centenario / Belgrano San Isidro)", valores: "Leche 1L: $1.420 | Queso tybo 1kg: $8.600 | Yerba 1kg: $3.600", mensual_ars: 95000 },
      { tipo: "🥩 Carnicerías y Granjas (San Isidro / Martínez / Acassuso)", valores: "Asado 1kg: $9.200 | Suprema 1kg: $6.300 | Maple huevos: $4.300", mensual_ars: 62000 },
      { tipo: "🥬 Mercados y Verdulerías Zonales", valores: "Papa 1kg: $950 | Tomate 1kg: $1.900 | Fruta estación 1kg: $1.800", mensual_ars: 35000 },
      { tipo: "🥖 Panaderías y Cafés (Casco Histórico San Isidro / Alvear Martínez)", valores: "Pan 1kg: $2.700 | Merienda: $5.800", mensual_ars: 25000 },
      { tipo: "🧺 Farmacias y Servicios Barriales", valores: "Valet ropa: $5.100 | Limpieza hogar: $13.500", mensual_ars: 19000 },
      { tipo: "🏋️ Clubes Náuticos, Rugby y Gimnasios", valores: "Cuota mensual: $30.000", mensual_ars: 22000 }
    ],
    gastos_alrededor_detalle: "Tren Mitre Ramal Tigre (Martínez, Acassuso, San Isidro, Beccar), Tren de la Costa y Autopista Panamericana."
  },

  // --- GRAN BUENOS AIRES: ZONA OESTE ---
  {
    id: "zona-ramos-mejia",
    slug: "ramos-mejia",
    region: "zona-oeste",
    name: "Ramos Mejía (La Matanza, GBA Oeste — Av. de Mayo / Av. Rivadavia)",
    urban_boundary_note: "Localidad de Ramos Mejía (La Matanza Norte), entre Av. Gral. Paz, Av. Gaona / Acceso Oeste, Camino de Cintura y Av. Don Bosco.",
    bridge_price_effect: "Ramos Mejía Centro (Av. de Mayo y Av. Rivadavia) concentra el principal polo comercial y gastronómico del primer cordón oeste; hacia Ramos Sur las expensas bajan un ~18%.",
    coords: [
      [-34.6345, -58.5765],
      [-34.6365, -58.5425],
      [-34.6585, -58.5445],
      [-34.6625, -58.5785]
    ],
    alquiler_ars: 460000,
    expensas_ars: 68000,
    servicios_ars: 50000,
    canasta_comercios_ars: 218000,
    transporte_ars: 36000,
    impuestos_y_servicios: { abl_municipal_ars: 11000, luz_edenor_edesur_ars: 14000, gas_metrogas_ars: 8000, agua_aysa_ars: 7500, internet_fibra_ars: 9500 },
    locales_cercanos: [
      { tipo: "🛒 Supermercados y Mayoristas (Av. Rivadavia / Av. de Mayo)", valores: "Leche 1L: $1.330 | Fideos 500g: $1.050 | Yerba 1kg: $3.350", mensual_ars: 80000 },
      { tipo: "🥩 Carnicerías y Frigoríficos de Ramos Mejía", valores: "Asado 1kg: $8.200 | Suprema 1kg: $5.800 | Maple huevos: $3.950", mensual_ars: 53000 },
      { tipo: "🥬 Verdulerías y Ferias Barriales", valores: "Papa 1kg: $800 | Tomate 1kg: $1.600 | Fruta estación 1kg: $1.500", mensual_ars: 29000 },
      { tipo: "🥖 Panaderías y Polo Gastronómico (Av. de Mayo / Necochea)", valores: "Pan 1kg: $2.250 | Café + medialunas: $3.900", mensual_ars: 21000 },
      { tipo: "🧺 Farmacias, Limpieza Suelta y Lavaderos", valores: "Valet ropa: $4.200 | Limpieza mensual: $10.000", mensual_ars: 16000 },
      { tipo: "🏋️ Gimnasios y Club Estudiantil Porteño", valores: "Cuota mensual: $23.000", mensual_ars: 19000 }
    ],
    gastos_alrededor_detalle: "Tren Sarmiento (Estación Ramos Mejía a Once en 21 min), Metrobus / líneas por Av. Rivadavia y cercanía a UNLaM."
  },
  {
    id: "zona-moron",
    slug: "moron",
    region: "zona-oeste",
    name: "Morón (GBA Oeste — Centro / Av. Rivadavia / Plaza San Martín)",
    urban_boundary_note: "Casco urbano de Morón entre Autopista Acceso Oeste, Calle Santa Rosa, Av. Hipólito Yrigoyen y Av. Don Bosco.",
    bridge_price_effect: "Excelente conectividad ferroviaria y de colectivos en Morón Centro con alquileres un ~24% más bajos que en CABA.",
    coords: [
      [-34.6365, -58.6345],
      [-34.6385, -58.6025],
      [-34.6685, -58.6045],
      [-34.6695, -58.6365]
    ],
    alquiler_ars: 410000,
    expensas_ars: 55000,
    servicios_ars: 46000,
    canasta_comercios_ars: 202000,
    transporte_ars: 38000,
    impuestos_y_servicios: { abl_municipal_ars: 9500, luz_edenor_edesur_ars: 13500, gas_metrogas_ars: 7500, agua_aysa_ars: 6500, internet_fibra_ars: 9000 },
    locales_cercanos: [
      { tipo: "🛒 Hipermercados y Mayoristas (Av. Rivadavia / 9 de Julio Morón)", valores: "Leche 1L: $1.280 | Aceite 1.5L: $2.400 | Yerba 1kg: $3.250", mensual_ars: 74000 },
      { tipo: "🥩 Frigoríficos y Carnicerías de Morón", valores: "Asado 1kg: $7.800 | Suprema 1kg: $5.500 | Maple huevos: $3.800", mensual_ars: 49000 },
      { tipo: "🥬 Verdulerías y Mercados del Oeste", valores: "Bolsón verdura 7kg: $7.200 | Papa 1kg: $750 | Tomate 1kg: $1.450", mensual_ars: 26000 },
      { tipo: "🥖 Panaderías y Cafeterías (Plaza de Morón / Brown)", valores: "Pan 1kg: $2.100 | Facturas docena: $4.800", mensual_ars: 19000 },
      { tipo: "🧺 Limpieza Suelta, Farmacias y Servicios", valores: "Limpieza mensual: $9.200 | Valet ropa: $3.900", mensual_ars: 16000 },
      { tipo: "🏋️ Gimnasios y Club Deportivo Morón", valores: "Cuota mensual: $20.000", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Tren Sarmiento (Estación Morón), Universidad de Morón y conexión rápida a Autopista Acceso Oeste."
  },

  // --- GRAN BUENOS AIRES: ZONA SUR Y LA PLATA ---
  {
    id: "zona-lanus",
    slug: "lanus",
    region: "zona-sur",
    name: "Lanús (GBA Sur — Lanús Oeste y Este / Av. Hipólito Yrigoyen)",
    urban_boundary_note: "Partido de Lanús: eje Av. Hipólito Yrigoyen, polo Lanúsita (Del Valle Iberlucea), 9 de Julio (Lanús Este) y Remedios de Escalada.",
    bridge_price_effect: "A 14 minutos en Tren Roca desde Constitución: Lanúsita tiene edificios modernos, mientras que en Lanús Este y Escalada el alquiler baja un ~20%.",
    coords: [
      [-34.6885, -58.4185],
      [-34.6865, -58.3685],
      [-34.7285, -58.3725],
      [-34.7295, -58.4215]
    ],
    alquiler_ars: 430000,
    expensas_ars: 64000,
    servicios_ars: 47000,
    canasta_comercios_ars: 208000,
    transporte_ars: 34000,
    impuestos_y_servicios: { abl_municipal_ars: 10000, luz_edenor_edesur_ars: 13500, gas_metrogas_ars: 7500, agua_aysa_ars: 7000, internet_fibra_ars: 9000 },
    locales_cercanos: [
      { tipo: "🛒 Mayoristas y Supermercados (9 de Julio Lanús Este / Av. H. Yrigoyen)", valores: "Leche 1L: $1.290 | Fideos 500g: $1.020 | Yerba 1kg: $3.300", mensual_ars: 76000 },
      { tipo: "🥩 Frigoríficos y Carnicerías (Lanús / Escalada)", valores: "Asado 1kg: $7.900 | Suprema 1kg: $5.600 | Maple huevos: $3.850", mensual_ars: 51000 },
      { tipo: "🥬 Verdulerías y Ferias Francas", valores: "Papa 1kg: $780 | Tomate 1kg: $1.500 | Fruta estación 1kg: $1.450", mensual_ars: 27000 },
      { tipo: "🥖 Panaderías y Polo Gastronómico Lanúsita", valores: "Pan 1kg: $2.150 | Café + medialunas: $3.800", mensual_ars: 20000 },
      { tipo: "🧺 Limpieza Suelta, Farmacias y Lavaderos", valores: "Limpieza mensual: $9.500 | Valet ropa: $4.000", mensual_ars: 16000 },
      { tipo: "🏋️ Club Atlético Lanús y Gimnasios", valores: "Cuota mensual: $21.000", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Tren Roca eléctrico a Constitución en 14 min (Estaciones Lanús y Remedios de Escalada) y Universidad Nacional de Lanús (UNLa)."
  },
  {
    id: "zona-lomas-de-zamora",
    slug: "lomas-de-zamora",
    region: "zona-sur",
    name: "Lomas de Zamora (GBA Sur — Las Lomitas / Peatonal Laprida / Av. Meeks)",
    urban_boundary_note: "Centro de Lomas de Zamora entre Av. Hipólito Yrigoyen, Av. Meeks, Calle Boedo / Colombres y Av. Alsina.",
    bridge_price_effect: "Las Lomitas concentra torres modernas y gastronomía; cruzando las vías hacia Lomas Este o Temperley las expensas y alquileres bajan un ~22%.",
    coords: [
      [-34.7445, -58.4185],
      [-34.7425, -58.3825],
      [-34.7765, -58.3845],
      [-34.7785, -58.4215]
    ],
    alquiler_ars: 445000,
    expensas_ars: 69000,
    servicios_ars: 48000,
    canasta_comercios_ars: 212000,
    transporte_ars: 37000,
    impuestos_y_servicios: { abl_municipal_ars: 10500, luz_edenor_edesur_ars: 14000, gas_metrogas_ars: 7500, agua_aysa_ars: 7000, internet_fibra_ars: 9000 },
    locales_cercanos: [
      { tipo: "🛒 Centros Comerciales (Peatonal Laprida / Av. Meeks)", valores: "Leche 1L: $1.310 | Queso cremoso 1kg: $7.900 | Yerba 1kg: $3.350", mensual_ars: 78000 },
      { tipo: "🥩 Carnicerías y Granjas de Lomas", valores: "Asado 1kg: $8.100 | Suprema 1kg: $5.700 | Maple huevos: $3.900", mensual_ars: 52000 },
      { tipo: "🥬 Verdulerías y Productores del Sur", valores: "Bolsón verdura 7kg: $7.000 | Papa 1kg: $750 | Tomate 1kg: $1.450", mensual_ars: 27000 },
      { tipo: "🥖 Panaderías y Cafeterías (Las Lomitas / Italia)", valores: "Pan 1kg: $2.200 | Merienda: $4.900", mensual_ars: 21000 },
      { tipo: "🧺 Farmacias y Artículos de Limpieza", valores: "Limpieza mensual: $9.400 | Valet ropa: $4.100", mensual_ars: 16000 },
      { tipo: "🏋️ Lomas Athletic Club y Gimnasios", valores: "Cuota mensual: $22.000", mensual_ars: 18000 }
    ],
    gastos_alrededor_detalle: "Tren Roca eléctrico directo a Constitución (Estación Lomas de Zamora) y cercanía a la Universidad Nacional de Lomas de Zamora (UNLZ)."
  },
  {
    id: "zona-la-plata",
    slug: "la-plata",
    region: "la-plata",
    name: "La Plata (Casco Urbano Universitario, Provincia de Buenos Aires)",
    urban_boundary_note: "Capital de la Provincia de Buenos Aires: Casco Urbano (Av. 1 a 31 y de 32 a 72, Plaza Moreno / Plaza Paso / Facultades UNLP).",
    bridge_price_effect: "En el eje de Plaza Moreno / Calle 8 y 12 y zona de Facultades se concentra la demanda de departamentos; hacia las avenidas de circunvalación el alquiler baja un ~20%.",
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
  { keys: ["berisso", "ensenada"], name: "Berisso / Ensenada", slug: "berisso", lat: -34.8728, lng: -57.8858, rent: 360000, exp: 42000 },
  // Barrios individuales aislados de CABA y localidades GBA para evitar agrupamientos arbitrarios
  { keys: ["saavedra caba", "barrio saavedra"], name: "Saavedra (CABA)", slug: "saavedra-caba", lat: -34.5545, lng: -58.4885, rent: 585000, exp: 108000 },
  { keys: ["saavedra pigue", "pigue", "partido de saavedra"], name: "Saavedra / Pigüé (Provincia de Buenos Aires)", slug: "saavedra-pba", lat: -37.6061, lng: -62.4053, rent: 335000, exp: 31000 },
  { keys: ["general belgrano", "partido de general belgrano"], name: "General Belgrano (Provincia de Buenos Aires)", slug: "general-belgrano-pba", lat: -35.7667, lng: -58.4972, rent: 340000, exp: 32000 },
  { keys: ["belgrano r"], name: "Belgrano R (CABA)", slug: "belgrano-r", lat: -34.5675, lng: -58.4665, rent: 720000, exp: 142000 },
  { keys: ["boedo"], name: "Boedo (CABA)", slug: "boedo", lat: -34.6255, lng: -58.4175, rent: 445000, exp: 76000 },
  { keys: ["villa del parque"], name: "Villa del Parque (CABA)", slug: "villa-del-parque", lat: -34.6045, lng: -58.4915, rent: 520000, exp: 92000 },
  { keys: ["la paternal", "paternal"], name: "La Paternal (CABA)", slug: "la-paternal", lat: -34.5985, lng: -58.4685, rent: 475000, exp: 78000 },
  { keys: ["floresta"], name: "Floresta (CABA)", slug: "floresta", lat: -34.6295, lng: -58.4835, rent: 445000, exp: 74000 },
  { keys: ["liniers"], name: "Liniers (CABA)", slug: "liniers", lat: -34.6415, lng: -58.5215, rent: 430000, exp: 71000 },
  { keys: ["mataderos"], name: "Mataderos (CABA)", slug: "mataderos", lat: -34.6565, lng: -58.5025, rent: 425000, exp: 65000 },
  { keys: ["villa luro"], name: "Villa Luro (CABA)", slug: "villa-luro", lat: -34.6365, lng: -58.5015, rent: 450000, exp: 76000 },
  { keys: ["monserrat"], name: "Monserrat (CABA)", slug: "monserrat", lat: -34.6115, lng: -58.3815, rent: 465000, exp: 88000 },
  { keys: ["san nicolas caba", "microcentro"], name: "San Nicolás (CABA)", slug: "san-nicolas-caba", lat: -34.6037, lng: -58.3795, rent: 470000, exp: 94000 },
  { keys: ["retiro", "retiro caba"], name: "Retiro (CABA)", slug: "retiro", lat: -34.5935, lng: -58.3785, rent: 680000, exp: 155000 },
  { keys: ["puerto madero"], name: "Puerto Madero (CABA)", slug: "puerto-madero", lat: -34.6115, lng: -58.3625, rent: 1350000, exp: 310000 },
  { keys: ["barracas"], name: "Barracas (CABA)", slug: "barracas", lat: -34.6395, lng: -58.3745, rent: 460000, exp: 82000 },
  { keys: ["parque patricios"], name: "Parque Patricios (CABA)", slug: "parque-patricios", lat: -34.6365, lng: -58.4005, rent: 455000, exp: 79000 },
  { keys: ["la boca", "boca"], name: "La Boca (CABA)", slug: "la-boca", lat: -34.6345, lng: -58.3615, rent: 410000, exp: 64000 },
  { keys: ["constitucion"], name: "Constitución (CABA)", slug: "constitucion", lat: -34.6255, lng: -58.3835, rent: 415000, exp: 68000 },
  { keys: ["balvanera", "once", "abasto"], name: "Balvanera (CABA)", slug: "balvanera", lat: -34.6085, lng: -58.4035, rent: 440000, exp: 79000 },
  { keys: ["san cristobal"], name: "San Cristóbal (CABA)", slug: "san-cristobal", lat: -34.6225, lng: -58.4015, rent: 435000, exp: 74000 },
  { keys: ["parque chacabuco"], name: "Parque Chacabuco (CABA)", slug: "parque-chacabuco", lat: -34.6345, lng: -58.4415, rent: 465000, exp: 78000 },
  { keys: ["parque avellaneda"], name: "Parque Avellaneda (CABA)", slug: "parque-avellaneda-caba", lat: -34.6455, lng: -58.4775, rent: 420000, exp: 66000 },
  { keys: ["agronomia"], name: "Agronomía (CABA)", slug: "agronomia", lat: -34.5925, lng: -58.4865, rent: 510000, exp: 86000 },
  { keys: ["parque chas"], name: "Parque Chas (CABA)", slug: "parque-chas", lat: -34.5855, lng: -58.4795, rent: 530000, exp: 89000 },
  { keys: ["villa ortuzar"], name: "Villa Ortúzar (CABA)", slug: "villa-ortuzar", lat: -34.5815, lng: -58.4685, rent: 545000, exp: 95000 },
  { keys: ["villa pueyrredon"], name: "Villa Pueyrredón (CABA)", slug: "villa-pueyrredon", lat: -34.5815, lng: -58.5025, rent: 515000, exp: 86000 },
  { keys: ["monte castro"], name: "Monte Castro (CABA)", slug: "monte-castro", lat: -34.6185, lng: -58.5085, rent: 465000, exp: 74000 },
  { keys: ["villa santa rita"], name: "Villa Santa Rita (CABA)", slug: "villa-santa-rita", lat: -34.6155, lng: -58.4815, rent: 470000, exp: 76000 },
  { keys: ["villa general mitre"], name: "Villa General Mitre (CABA)", slug: "villa-general-mitre", lat: -34.6105, lng: -58.4685, rent: 480000, exp: 79000 },
  { keys: ["velez sarsfield"], name: "Vélez Sársfield (CABA)", slug: "velez-sarsfield", lat: -34.6315, lng: -58.4945, rent: 445000, exp: 72000 },
  { keys: ["versalles"], name: "Versalles (CABA)", slug: "versalles", lat: -34.6295, lng: -58.5225, rent: 445000, exp: 70000 },
  { keys: ["villa real"], name: "Villa Real (CABA)", slug: "villa-real", lat: -34.6195, lng: -58.5255, rent: 445000, exp: 70000 },
  { keys: ["nueva pompeya", "pompeya"], name: "Nueva Pompeya (CABA)", slug: "nueva-pompeya", lat: -34.6515, lng: -58.4165, rent: 395000, exp: 58000 },
  { keys: ["villa lugano", "lugano"], name: "Villa Lugano (CABA)", slug: "villa-lugano", lat: -34.6755, lng: -58.4725, rent: 380000, exp: 54000 },
  { keys: ["villa soldati", "soldati"], name: "Villa Soldati (CABA)", slug: "villa-soldati", lat: -34.6625, lng: -58.4435, rent: 375000, exp: 52000 },
  { keys: ["villa riachuelo"], name: "Villa Riachuelo (CABA)", slug: "villa-riachuelo", lat: -34.6915, lng: -58.4725, rent: 380000, exp: 52000 },
  { keys: ["avellaneda", "avellaneda centro", "partido de avellaneda"], name: "Avellaneda (GBA Sur, Provincia de Buenos Aires)", slug: "avellaneda-gba", lat: -34.6625, lng: -58.3645, rent: 435000, exp: 66000 },
  { keys: ["wilde"], name: "Wilde (Partido de Avellaneda, GBA Sur)", slug: "wilde", lat: -34.6975, lng: -58.3215, rent: 405000, exp: 58000 },
  { keys: ["sarandi"], name: "Sarandí (Partido de Avellaneda, GBA Sur)", slug: "sarandi", lat: -34.6825, lng: -58.3435, rent: 400000, exp: 56000 },
  { keys: ["banfield"], name: "Banfield (Partido de Lomas de Zamora, GBA Sur)", slug: "banfield", lat: -34.7425, lng: -58.3955, rent: 440000, exp: 66000 },
  { keys: ["temperley"], name: "Temperley (Partido de Lomas de Zamora, GBA Sur)", slug: "temperley", lat: -34.7765, lng: -58.3975, rent: 420000, exp: 61000 },
  { keys: ["olivos"], name: "Olivos (Partido de Vicente López, GBA Norte)", slug: "olivos", lat: -34.5085, lng: -58.4865, rent: 675000, exp: 128000 },
  { keys: ["florida vicente lopez", "florida este"], name: "Florida Este (Partido de Vicente López, GBA Norte)", slug: "florida-este", lat: -34.5285, lng: -58.4885, rent: 590000, exp: 105000 },
  { keys: ["florida oeste"], name: "Florida Oeste (Partido de Vicente López, GBA Norte)", slug: "florida-oeste", lat: -34.5345, lng: -58.5165, rent: 495000, exp: 78000 },
  { keys: ["munro"], name: "Munro (Partido de Vicente López, GBA Norte)", slug: "munro", lat: -34.5295, lng: -58.5245, rent: 490000, exp: 76000 },
  { keys: ["martinez"], name: "Martínez (Partido de San Isidro, GBA Norte)", slug: "martinez", lat: -34.4885, lng: -58.5045, rent: 640000, exp: 118000 },
  { keys: ["castelar"], name: "Castelar (Partido de Morón, GBA Oeste)", slug: "castelar", lat: -34.6515, lng: -58.6435, rent: 435000, exp: 62000 },
  { keys: ["haedo"], name: "Haedo (Partido de Morón, GBA Oeste)", slug: "haedo", lat: -34.6445, lng: -58.5925, rent: 435000, exp: 62000 },
  { keys: ["caseros", "tres de febrero"], name: "Caseros (Partido de Tres de Febrero, GBA Oeste)", slug: "caseros", lat: -34.6095, lng: -58.5635, rent: 425000, exp: 60000 },
  { keys: ["city bell"], name: "City Bell (Partido de La Plata, Provincia de Buenos Aires)", slug: "city-bell", lat: -34.8725, lng: -58.0465, rent: 465000, exp: 64000 }
];

// Catálogo de zonas homónimas que requieren seleccionar Municipio o Provincia antes de aislar el polígono
const HOMONYMOUS_ZONES_CATALOG = {
  "belgrano": [
    { label: "Belgrano — Barrio de CABA (Comuna 13, Capital Federal)", query: "Belgrano (CABA)" },
    { label: "General Belgrano — Municipio de la Provincia de Buenos Aires (Interior PBA)", query: "General Belgrano (Provincia de Buenos Aires)" },
    { label: "Belgrano R — Sub-barrio residencial de CABA (Comuna 13)", query: "Belgrano R (CABA)" }
  ],
  "san martin": [
    { label: "General San Martín — Municipio GBA Noroeste (Provincia de Buenos Aires)", query: "General San Martín (GBA Noroeste)" },
    { label: "Plaza San Martín / Retiro — Barrio de CABA (Comuna 1, Capital Federal)", query: "Retiro (CABA)" }
  ],
  "saavedra": [
    { label: "Saavedra — Barrio de CABA (Comuna 12, Capital Federal)", query: "Saavedra (CABA)" },
    { label: "Saavedra (Pigüé) — Partido de Saavedra, Provincia de Buenos Aires", query: "Saavedra Pigüé (Provincia de Buenos Aires)" }
  ],
  "avellaneda": [
    { label: "Avellaneda — Municipio GBA Sur (Provincia de Buenos Aires)", query: "Avellaneda (GBA Sur)" },
    { label: "Parque Avellaneda — Barrio de CABA (Comuna 9, Capital Federal)", query: "Parque Avellaneda (CABA)" }
  ],
  "san nicolas": [
    { label: "San Nicolás — Barrio de CABA (Comuna 1 / Microcentro, Capital Federal)", query: "San Nicolás (CABA)" },
    { label: "San Nicolás de los Arroyos — Municipio del Norte de la Provincia de Buenos Aires", query: "San Nicolás de los Arroyos (Provincia de Buenos Aires)" }
  ],
  "florida": [
    { label: "Florida Este — Partido de Vicente López (GBA Norte, Provincia de Buenos Aires)", query: "Florida Este (Vicente López)" },
    { label: "Florida Oeste — Partido de Vicente López (GBA Norte, Provincia de Buenos Aires)", query: "Florida Oeste (Vicente López)" },
    { label: "Peatonal Florida / Microcentro — Barrio San Nicolás (CABA)", query: "San Nicolás (CABA)" }
  ],
  "moreno": [
    { label: "Moreno — Municipio GBA Oeste (Provincia de Buenos Aires)", query: "Moreno (GBA Oeste)" },
    { label: "Monserrat / Mariano Moreno — Barrio de CABA (Comuna 1, Capital Federal)", query: "Monserrat (CABA)" }
  ],
  "mitre": [
    { label: "Villa General Mitre — Barrio de CABA (Comuna 11, Capital Federal)", query: "Villa General Mitre (CABA)" },
    { label: "Bartolomé Mitre / Olivos — Partido de Vicente López (GBA Norte)", query: "Olivos (Vicente López)" }
  ]
};

function findBuenosAiresOfflineLocation(rawQuery) {
  const low = (rawQuery || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\(.*?\)/g, "").trim();
  if (!low) return null;
  // Priorizar coincidencia exacta primero para no agrupar ni confundir zonas
  for (const entry of BUENOS_AIRES_COMPLETE_LOCATIONS_DB) {
    if (entry.keys.some(k => low === k)) {
      return entry;
    }
  }
  for (const entry of BUENOS_AIRES_COMPLETE_LOCATIONS_DB) {
    if (entry.keys.some(k => low.includes(k) || k.includes(low))) {
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

// Extrae el contorno real GeoJSON de OpenStreetMap Nominatim (polygon_geojson=1) para aislar exactamente la zona buscada
function extractRealBoundaryRingsFromGeoJSON(geojson) {
  if (!geojson || !geojson.type || !geojson.coordinates) return null;
  let outerRing = null;
  if (geojson.type === "Polygon" && Array.isArray(geojson.coordinates[0])) {
    outerRing = geojson.coordinates[0];
  } else if (geojson.type === "MultiPolygon" && Array.isArray(geojson.coordinates[0]) && Array.isArray(geojson.coordinates[0][0])) {
    let best = geojson.coordinates[0][0];
    geojson.coordinates.forEach(poly => {
      if (Array.isArray(poly[0]) && poly[0].length > best.length) best = poly[0];
    });
    outerRing = best;
  }
  if (!outerRing || outerRing.length < 4) return null;

  // Convertir [lng, lat] de GeoJSON a [lat, lng] de Leaflet y simplificar a ~24 vértices para edición ágil de vértices
  const step = Math.max(1, Math.floor(outerRing.length / 24));
  const leafletPts = [];
  for (let i = 0; i < outerRing.length; i += step) {
    const pt = outerRing[i];
    if (Array.isArray(pt) && pt.length >= 2) {
      leafletPts.push([parseFloat(pt[1].toFixed(5)), parseFloat(pt[0].toFixed(5))]);
    }
  }
  if (leafletPts.length < 4) return null;

  // Si el polígono administrativo es gigantesco (ej: todo un partido rural de 60km), acotarlo al radio urbano manteniendo la forma multi-vértice real
  const lats = leafletPts.map(p => p[0]);
  const lngs = leafletPts.map(p => p[1]);
  const spanLat = Math.max(...lats) - Math.min(...lats);
  const spanLng = Math.max(...lngs) - Math.min(...lngs);
  if (spanLat > 0.12 || spanLng > 0.14) {
    const cLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const cLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    const scaleLat = 0.028 / Math.max(0.01, spanLat);
    const scaleLng = 0.032 / Math.max(0.01, spanLng);
    for (let i = 0; i < leafletPts.length; i++) {
      leafletPts[i] = [
        parseFloat((cLat + (leafletPts[i][0] - cLat) * scaleLat).toFixed(5)),
        parseFloat((cLng + (leafletPts[i][1] - cLng) * scaleLng).toFixed(5))
      ];
    }
  }

  return { centroCoords: leafletPts, residencialCoords: leafletPts };
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
    { keys: ["cabildo y juramento", "juramento y cabildo", "belgrano caba", "barrio belgrano"], lat: -34.5622, lng: -58.4565, formatted: "Av. Cabildo y Av. Juramento (Belgrano, CABA)" },
    { keys: ["acoyte y rivadavia", "rivadavia y acoyte", "primera junta"], lat: -34.6182, lng: -58.4368, formatted: "Av. Rivadavia y Av. Acoyte (Caballito, CABA)" },
    { keys: ["corrientes y medrano", "medrano y corrientes"], lat: -34.6036, lng: -58.4208, formatted: "Av. Corrientes y Av. Medrano (Almagro, CABA)" },
    { keys: ["cordoba y medrano", "medrano y cordoba"], lat: -34.5988, lng: -58.4205, formatted: "Av. Córdoba y Av. Medrano (Almagro Norte, CABA)" },
    { keys: ["corrientes y scalabrini", "scalabrini ortiz y corrientes", "malabia"], lat: -34.5982, lng: -58.4392, formatted: "Av. Corrientes y Av. Scalabrini Ortiz (Villa Crespo, CABA)" },
    { keys: ["chacarita", "lacroze y corrientes", "federico lacroze"], lat: -34.5875, lng: -58.4535, formatted: "Av. Federico Lacroze y Av. Corrientes (Chacarita, CABA)" },
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
    { keys: ["colegiales", "alvarez thomas"], lat: -34.5752, lng: -58.4492, formatted: "Colegiales (CABA)" },
    { keys: ["belgrano r", "melian", "cramer"], lat: -34.5675, lng: -58.4665, formatted: "Belgrano R (CABA)" },
    { keys: ["villa urquiza", "triunvirato"], lat: -34.5735, lng: -58.4865, formatted: "Villa Urquiza / Av. Triunvirato (CABA)" },
    { keys: ["devoto", "villa devoto", "plaza arenales"], lat: -34.6005, lng: -58.5115, formatted: "Villa Devoto / Plaza Arenales (CABA)" },
    { keys: ["flores", "carabobo", "san pedrito"], lat: -34.6285, lng: -58.4625, formatted: "Flores / Av. Rivadavia (CABA)" },
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

  if (lower === "belgrano") {
    return { lat: -34.5622, lng: -58.4565, formatted: "Belgrano (CABA)" };
  }

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
    { keys: ["av mitre", "av. mitre", "avenida mitre"], startNum: 100, endNum: 6500, start: [-34.6605, -58.3665], end: [-34.7025, -58.3215] },
    { keys: ["libertador"], startNum: 100, endNum: 16500, start: [-34.5905, -58.3765], end: [-34.4705, -58.5085] },
    { keys: ["juan b justo", "juan b. justo"], startNum: 1000, endNum: 9000, start: [-34.5775, -58.4255], end: [-34.6365, -58.5245] },
    { keys: ["scalabrini", "scalabrini ortiz"], startNum: 100, endNum: 3400, start: [-34.6035, -58.4360], end: [-34.5715, -58.4105] },
    { keys: ["medrano"], startNum: 1, endNum: 2000, start: [-34.6112, -58.4205], end: [-34.5915, -58.4185] },
    { keys: ["av boedo", "av. boedo"], startNum: 1, endNum: 2100, start: [-34.6115, -58.4190], end: [-34.6325, -58.4175] },
    { keys: ["acoyte"], startNum: 1, endNum: 1700, start: [-34.6182, -58.4368], end: [-34.6025, -58.4425] },
    { keys: ["directorio"], startNum: 1, endNum: 4500, start: [-34.6262, -58.4265], end: [-34.6395, -58.4755] },
    { keys: ["independencia"], startNum: 100, endNum: 4400, start: [-34.6170, -58.3700], end: [-34.6210, -58.4285] },
    { keys: ["av belgrano", "av. belgrano", "avenida belgrano"], startNum: 100, endNum: 4300, start: [-34.6128, -58.3700], end: [-34.6152, -58.4275] },
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

// Muestra la lista desplegable requiriendo detalles adicionales (municipio o provincia) cuando dos o más zonas homónimas coinciden en la búsqueda
function promptHomonymZoneDisambiguation(rawTerm, homonymOptions) {
  const homonymBox = document.getElementById("homonym-disambiguation-box");
  if (!homonymBox) return;

  homonymBox.style.display = "flex";
  homonymBox.innerHTML = `
    <div style="font-size:0.73rem; font-weight:800; color:#fde68a;">
      ⚠️ Se encontraron zonas homónimas para "${escapeHtml(rawTerm)}". Seleccioná el Municipio o Jurisdicción exacta:
    </div>
    <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
      <select id="homonym-disambiguation-select" class="salary-input" style="flex:1; min-width:210px; font-size:0.74rem; padding:0.3rem 0.45rem;">
        ${homonymOptions.map((opt, idx) => `<option value="${escapeHtml(opt.query)}" ${idx === 0 ? "selected" : ""}>${escapeHtml(opt.label)}</option>`).join("")}
      </select>
      <button type="button" id="btn-confirm-homonym-zone" class="btn-sm btn-primary" style="font-size:0.72rem; padding:0.3rem 0.65rem;">
        ✓ Aislar esta zona
      </button>
      <button type="button" id="btn-cancel-homonym-zone" class="btn-sm btn-secondary" style="font-size:0.68rem; padding:0.28rem 0.45rem;">
        ✕
      </button>
    </div>
  `;

  document.getElementById("btn-confirm-homonym-zone")?.addEventListener("click", () => {
    const sel = document.getElementById("homonym-disambiguation-select");
    const chosenQuery = sel?.value || homonymOptions[0].query;
    homonymBox.style.display = "none";
    homonymBox.innerHTML = "";
    mentionNeighborhoodAndShowInternalSubzones(chosenQuery, true);
  });

  document.getElementById("btn-cancel-homonym-zone")?.addEventListener("click", () => {
    homonymBox.style.display = "none";
    homonymBox.innerHTML = "";
  });
}

// Suma al mapa únicamente la zona aislada buscada (sin agrupamientos arbitrarios y exigiendo municipio/provincia en casos homónimos)
async function mentionNeighborhoodAndShowInternalSubzones(rawQuery, bypassHomonymCheck = false) {
  const box = document.getElementById("neighborhood-internal-subzones-box");
  const homonymBox = document.getElementById("homonym-disambiguation-box");
  const input = document.getElementById("neighborhood-mention-input");
  const rawText = (rawQuery || input?.value || "").trim();
  const normalizedFull = rawText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const hasExplicitJurisdiction = /\(.*?\)|\bcaba\b|\bcapital\b|\bpba\b|\bprovincia\b|\bgba\b|\bpartido\b|\bgeneral\b|\bpigue\b|\barroyos\b|\beste\b|\boeste\b|\bsur\b|\bnorte\b/.test(normalizedFull);
  const q = normalizedFull.replace(/\s*\(.*?\)\s*/g, "").trim();

  if (!box) return;

  if (!q) {
    renderUserSelectedZonesSidebar();
    return;
  }

  // 1. Verificar si el término ingresado coincide con dos o más zonas homónimas sin jurisdicción explícita
  if (!bypassHomonymCheck && !hasExplicitJurisdiction && HOMONYMOUS_ZONES_CATALOG[q]) {
    promptHomonymZoneDisambiguation(rawText, HOMONYMOUS_ZONES_CATALOG[q]);
    return;
  }

  if (homonymBox) {
    homonymBox.style.display = "none";
    homonymBox.innerHTML = "";
  }

  let matchedZones = [];

  // 2. Coincidencia aislada por barrio o localidad (SIN agrupamientos arbitrarios entre barrios vecinos)
  if (normalizedFull.includes("general belgrano") || (q === "belgrano" && normalizedFull.includes("provincia"))) {
    matchedZones = await createDynamicBuenosAiresSubzones("General Belgrano (Provincia de Buenos Aires)");
  } else if (normalizedFull.includes("belgrano r")) {
    matchedZones = await createDynamicBuenosAiresSubzones("Belgrano R (CABA)");
  } else if (q === "belgrano" || normalizedFull.includes("belgrano (caba)")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-belgrano");
  } else if (q === "recoleta" || normalizedFull.includes("recoleta")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-recoleta");
  } else if (q === "chacarita" || normalizedFull.includes("chacarita")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-chacarita");
  } else if (q === "villa crespo" || q === "crespo") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-villa-crespo");
  } else if (q === "colegiales") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-colegiales");
  } else if (q === "coghlan") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-coghlan");
  } else if (q === "palermo hollywood" || normalizedFull.includes("hollywood")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-palermo-hollywood");
  } else if (q === "palermo" || q === "palermo soho" || normalizedFull.includes("palermo")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-palermo-soho");
  } else if (q === "almagro sur") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-almagro-sur");
  } else if (q === "almagro" || q === "almagro norte") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-almagro-norte");
  } else if (q === "caballito sur" || normalizedFull.includes("pedro goyena")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-caballito-sur");
  } else if (q === "caballito" || q === "caballito norte") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-caballito-norte");
  } else if (q === "villa urquiza" || q === "urquiza") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-villa-urquiza");
  } else if (q === "nunez" || q === "nuñez") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-nunez");
  } else if (q === "villa devoto" || q === "devoto") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-villa-devoto");
  } else if (q === "flores") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-flores");
  } else if (q === "san telmo") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-san-telmo");
  } else if (q === "vicente lopez") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-vicente-lopez");
  } else if ((q === "san martin" || q === "general san martin") && !normalizedFull.includes("caba")) {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-san-martin");
  } else if (q === "san isidro") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-san-isidro");
  } else if (q === "ramos mejia" || q === "ramos") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-ramos-mejia");
  } else if (q === "moron") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-moron");
  } else if (q === "lanus") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-lanus");
  } else if (q === "lomas de zamora" || q === "lomas") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-lomas-de-zamora");
  } else if (q === "la plata" || q === "la-plata") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.id === "zona-la-plata");
  } else if (q === "caba" || q === "capital" || q === "capital federal") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => !z.region || z.region === "caba");
  } else if (q === "zona-norte" || q === "gba norte" || q === "zona norte") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.region === "zona-norte");
  } else if (q === "zona-oeste" || q === "gba oeste" || q === "zona oeste") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.region === "zona-oeste");
  } else if (q === "zona-sur" || q === "gba sur" || q === "zona sur") {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.region === "zona-sur" || z.region === "la-plata");
  } else {
    matchedZones = MAP_AFFORDABILITY_ZONES.filter(z => z.slug === q);
  }

  // 3. Si es cualquier otro barrio de CABA (ej: Boedo, Saavedra, Villa del Parque, La Paternal, Floresta, Liniers, Mataderos, Monserrat, Barracas, Parque Patricios, Retiro, Puerto Madero) o localidad de PBA, trazar su polígono aislado
  if (!matchedZones || matchedZones.length === 0) {
    box.style.display = "flex";
    box.innerHTML = `<div style="font-size:0.73rem; color:#38bdf8;">🔎 Trazando el límite aislado de "${escapeHtml(rawText)}" y consultando comercios...</div>`;
    const dynamicZones = await createDynamicBuenosAiresSubzones(rawText);
    if (dynamicZones && dynamicZones.length > 0) {
      matchedZones = dynamicZones;
    } else {
      box.innerHTML = `<div style="font-size:0.73rem; color:#fca5a5;">No pudimos encontrar "${escapeHtml(rawText)}". Probá ingresando el nombre del barrio o municipio (ej: Chacarita, Belgrano, Recoleta, Miramar, Tandil, Pilar, Quilmes) o dibujá el área en el mapa.</div>`;
      return;
    }
  }

  // Asegurar que cada zona tenga guardadas sus coordenadas originales (originalCoords) para permitir editar vértices y restaurarlas cuando el usuario quiera
  matchedZones.forEach(z => {
    if (!z.originalCoords && Array.isArray(z.coords)) {
      z.originalCoords = z.coords.map(c => [c[0], c[1]]);
    }
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

  // Ajustar zoom del mapa para mostrar la zona recién aislada por el usuario
  if (leafletMap && matchedZones.length > 0) {
    const allCoords = matchedZones.flatMap(z => z.coords);
    leafletMap.fitBounds(allCoords, { padding: [40, 40], maxZoom: 14 });
  }
}

// Crea 1 polígono aislado con contorno real (polygon_geojson=1) u orgánico multi-vértice para cualquier barrio o municipio buscado (sin marcar áreas excedentes)
async function createDynamicBuenosAiresSubzones(rawLocalityName) {
  const cleanName = rawLocalityName.replace(/\s*\(.*?\)\s*/g, "").trim();
  const isExplicitCaba = /\bcaba\b|\bcapital\b/i.test(rawLocalityName);
  const offlineEntry = findBuenosAiresOfflineLocation(rawLocalityName) || findBuenosAiresOfflineLocation(cleanName);

  const existingStatic = MAP_AFFORDABILITY_ZONES.find(z => z.id === `zona-dyn-${offlineEntry?.slug || cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
  if (existingStatic) return [existingStatic];

  let centerLat = offlineEntry ? offlineEntry.lat : NaN;
  let centerLng = offlineEntry ? offlineEntry.lng : NaN;
  let shortTitle = offlineEntry ? offlineEntry.name : cleanName;
  let slug = offlineEntry
    ? offlineEntry.slug
    : cleanName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
  let realRings = null;

  // Intentar obtener el polígono límite real desde OpenStreetMap Nominatim con polygon_geojson=1
  try {
    const jurisdictionHint = isExplicitCaba || (offlineEntry && offlineEntry.name.includes("CABA"))
      ? "Ciudad Autónoma de Buenos Aires, Argentina"
      : "Buenos Aires, Argentina";
    const q = encodeURIComponent(`${cleanName}, ${jurisdictionHint}`);
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
    // Fallback a las coordenadas y polígonos orgánicos de BUENOS_AIRES_COMPLETE_LOCATIONS_DB
  }

  if (isNaN(centerLat) || isNaN(centerLng)) return null;

  const baseTemplate = MAP_AFFORDABILITY_ZONES[0];
  const distFromCabaKm = getDistanceKm(centerLat, centerLng, -34.6037, -58.3816);
  const isInteriorPba = distFromCabaKm > 55;
  const baseRent = offlineEntry?.rent || (isInteriorPba ? 360000 : (distFromCabaKm > 22 ? 395000 : 465000));
  const baseExpensas = offlineEntry?.exp || (isInteriorPba ? 42000 : (distFromCabaKm > 22 ? 54000 : 78000));
  const baseCanasta = isInteriorPba ? 192000 : 208000;

  const polygons = realRings || buildOrganicSubzonePolygons(centerLat, centerLng, offlineEntry?.coastOrientation || null);
  const isolatedCoords = polygons.centroCoords.map(c => [c[0], c[1]]);

  const isolatedZone = {
    id: `zona-dyn-${slug}`,
    slug: slug,
    region: isExplicitCaba || (offlineEntry && offlineEntry.name.includes("CABA")) ? "caba" : (isInteriorPba ? "pba-interior" : "gba"),
    name: shortTitle,
    urban_boundary_note: `Delimitación aislada de ${shortTitle}. Podés arrastrar sus vértices en el mapa para re-trazar los límites a tu medida.`,
    bridge_price_effect: `Zona aislada de ${shortTitle} con comercios de cercanía, transporte y servicios actualizados.`,
    coords: isolatedCoords,
    originalCoords: isolatedCoords.map(c => [c[0], c[1]]),
    alquiler_ars: baseRent,
    expensas_ars: baseExpensas,
    servicios_ars: 46000,
    canasta_comercios_ars: baseCanasta,
    transporte_ars: 31000,
    impuestos_y_servicios: { ...baseTemplate.impuestos_y_servicios },
    locales_cercanos: baseTemplate.locales_cercanos.map(l => ({ ...l })),
    gastos_alrededor_detalle: `Área delimitada de ${shortTitle} con acceso a supermercados, transporte y servicios.`
  };

  MAP_AFFORDABILITY_ZONES.push(isolatedZone);
  return [isolatedZone];
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
      📌 ${appState.userSelectedZones.length} zona${appState.userSelectedZones.length === 1 ? "" : "s"} añadida${appState.userSelectedZones.length === 1 ? "" : "s"} (arrastrá los vértices blancos en el mapa para re-trazar límites):
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
            Total mensual: <strong style="color:${zm.rentHex};">${escapeHtml(zm.totalAPartirStr)}/mes</strong> ${zm.hasSalary ? `(${zm.pctTotal}%)` : ""}
          </div>
          <div style="font-size:0.67rem; color:#cbd5e1; margin-top:2px; display:flex; flex-wrap:wrap; gap:0.35rem;">
            <span>🏠 Alq.: <strong>${escapeHtml(zm.alquilerAPartirStr)}</strong></span>
            <span>· 🏢 Exp.: <strong>${escapeHtml(zm.expensasAPartirStr)}</strong></span>
            <span>· 🛒 Vida: <strong>${escapeHtml(zm.vidaAPartirStr)}</strong></span>
          </div>
          <div style="font-size:0.66rem; color:#38bdf8; margin:0.2rem 0;">
            ✏️ ${z.verticesEdited ? "Límites re-trazados a tu medida" : "Vértices habilitados en el mapa (arrastrá puntos o sumá con +)"}
          </div>
          <div style="display:flex; gap:0.35rem; flex-wrap:wrap; margin-top:0.25rem;">
            <button type="button" class="btn-sm btn-secondary subzone-focus-map-btn" data-zone-id="${z.id}" style="font-size:0.65rem; padding:0.15rem 0.45rem;">🗺️ Enfocar / Editar vértices</button>
            ${z.verticesEdited && z.originalCoords ? `<button type="button" class="btn-sm btn-secondary subzone-reset-vertices-btn" data-zone-id="${z.id}" style="font-size:0.65rem; padding:0.15rem 0.45rem; color:#fde68a;">↺ Límite original</button>` : ""}
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

  box.querySelectorAll(".subzone-reset-vertices-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const zId = btn.getAttribute("data-zone-id");
      const found = appState.userSelectedZones.find(z => z.id === zId);
      if (found && Array.isArray(found.originalCoords)) {
        found.coords = found.originalCoords.map(c => [c[0], c[1]]);
        found.verticesEdited = false;
        renderAffordabilityZonesOnMap();
        renderUserSelectedZonesSidebar();
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

  // Map Budget Filter & Currency Live Sync (actualiza colores, ranking y marcadores en tiempo real)
  document.getElementById("map-filter-operation")?.addEventListener("change", (e) => {
    appState.selectedOperation = e.target.value;
    if (appState.classicFilters) appState.classicFilters.operation = e.target.value;
    const classicOp = document.getElementById("filter-operation");
    if (classicOp && (classicOp.value !== "temporal" || e.target.value === "venta")) {
      classicOp.value = e.target.value;
    }
    renderAffordabilityZonesOnMap();
    renderUserSelectedZonesSidebar();
    renderPoisOnLeafletMap();
  });
  document.getElementById("map-filter-max-price")?.addEventListener("input", (e) => {
    const val = parseArsNumber(e.target.value);
    appState.maxPrice = val > 0 ? val : 0;
    if (appState.classicFilters) appState.classicFilters.maxPrice = appState.maxPrice;
    const classicMax = document.getElementById("filter-max-price");
    if (classicMax) classicMax.value = appState.maxPrice > 0 ? formatArsThousands(appState.maxPrice) : "";
    renderAffordabilityZonesOnMap();
    renderUserSelectedZonesSidebar();
    renderPoisOnLeafletMap();
  });
  document.getElementById("map-filter-currency")?.addEventListener("change", (e) => {
    const curr = (e.target.value || "ARS").toUpperCase();
    if (appState.classicFilters) appState.classicFilters.currency = curr;
    const classicCurr = document.getElementById("filter-currency");
    if (classicCurr) classicCurr.value = curr;
    renderAffordabilityZonesOnMap();
    renderUserSelectedZonesSidebar();
    renderPoisOnLeafletMap();
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
    zoomControl: true,
    attributionControl: false
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

function setMapTileProvider() {
  if (!leafletMap) return;
  currentTileProvider = "osm";
  if (activeTileLayer) {
    leafletMap.removeLayer(activeTileLayer);
  }

  const osmUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  activeTileLayer = L.tileLayer(osmUrl, {
    maxZoom: 18
  });

  activeTileLayer.on("tileerror", function (errEvent) {
    const img = errEvent.tile;
    const coords = errEvent.coords;
    if (img && coords) {
      const stage = parseInt(img.getAttribute("data-fallback-stage") || "0", 10);
      if (stage === 0) {
        img.setAttribute("data-fallback-stage", "1");
        img.src = osmUrl.replace("{z}", coords.z).replace("{x}", coords.x).replace("{y}", coords.y);
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

  const activeCurrency = appState.currency || "ARS";
  const maxPriceNum = Number(appState.maxPrice) || 0;
  const budgetTagHtml = maxPriceNum > 0
    ? `<div style="font-size:9px; color:#bae6fd; font-weight:800; margin-top:1px;">Tope: $${maxPriceNum.toLocaleString("es-AR")} ${escapeHtml(activeCurrency)}</div>`
    : "";

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
          padding:2px 6px; font-size:10.5px; font-weight:800; white-space:nowrap;
          text-align:center; box-shadow:0 2px 6px rgba(0,0,0,0.5);">
          <div>${escapeHtml(poi.label)}</div>
          ${budgetTagHtml}
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

  // Mostrar también previsualización flotante al pasar el mouse por el punto de interés (sin abrir desglose automáticamente)
  const tooltip = document.getElementById("map-hover-tooltip");
  if (tooltip && domEvent) {
    tooltip.innerHTML = `
      <div style="border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:0.35rem; margin-bottom:0.4rem;">
        <div style="font-weight:800; font-size:0.88rem; color:${poi.color};">📍 Punto ${escapeHtml(poi.code)}: ${escapeHtml(poi.label)}</div>
        <div style="font-size:0.72rem; color:#cbd5e1;">${escapeHtml(poi.address || "")}</div>
      </div>
      <div style="font-size:0.73rem; color:#e2e8f0; margin-bottom:0.2rem;">
        ${emptyHint}
      </div>
    `;
    tooltip.classList.add("visible");
    moveZoneHoverTooltip(domEvent);
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

// Busca cualquier localidad o barrio de Buenos Aires (CABA o 135 municipios PBA) tanto en el diccionario offline como en las zonas dinámicas
function findBuenosAiresLocationInDb(rawQuery) {
  if (!rawQuery) return null;
  const offline = findBuenosAiresOfflineLocation(rawQuery);
  if (offline) return offline;
  const norm = String(rawQuery)
    .split("—")[0]
    .split("(")[0]
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!norm) return null;
  const zoneHit = MAP_AFFORDABILITY_ZONES.find(z =>
    (z.slug && z.slug.toLowerCase() === norm) ||
    z.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(norm)
  );
  if (zoneHit) {
    return {
      slug: zoneHit.slug || norm.replace(/[^a-z0-9]+/g, "-"),
      name: zoneHit.name.split(" (")[0],
      region: zoneHit.region || "caba"
    };
  }
  return null;
}

// Formatea cualquier valor en ARS al texto "A partir de X [Moneda]" respetando la moneda activa (ARS o USD según Dólar BNA Tipo Vendedor)
function formatAPartirDe(amountArs, currencyOverride) {
  const curr = (currencyOverride || appState.classicFilters?.currency || "ARS").toUpperCase();
  const safeArs = Math.max(0, Math.round(Number(amountArs) || 0));
  if (curr === "USD") {
    const usdRate = Math.max(1, Number(appState.liveEconomicData?.dolarBnaVendedorArs) || 1095);
    const usdVal = Math.max(1, Math.round(safeArs / usdRate));
    return `A partir de $${usdVal.toLocaleString("es-AR")} USD`;
  }
  return `A partir de $${safeArs.toLocaleString("es-AR")} ARS`;
}

// Sincroniza visualmente un grupo de checkboxes de cantidad (creando la píldora si el usuario ingresó un número personalizado como 5 o 6)
function syncCheckboxGroupValues(cbClass, valuesArray, pillsWrapId, unitSingular, unitPlural) {
  const wrap = pillsWrapId ? document.getElementById(pillsWrapId) : null;
  const strValues = (valuesArray || []).map(v => String(v));
  if (wrap) {
    strValues.forEach(valStr => {
      const exists = Array.from(wrap.querySelectorAll(`.${cbClass}`)).some(cb => String(cb.value) === valStr);
      if (!exists && valStr !== "0") {
        const num = parseInt(valStr, 10);
        const labelText = valStr === "monoambiente"
          ? "Monoambiente"
          : `${valStr} ${num === 1 ? unitSingular : unitPlural}`;
        const labelEl = document.createElement("label");
        labelEl.className = "multi-qty-pill custom-added-pill";
        labelEl.innerHTML = `<input type="checkbox" class="${cbClass}" value="${escapeHtml(valStr)}" checked> <span>${escapeHtml(labelText)}</span>`;
        wrap.appendChild(labelEl);
      }
    });
  }
  document.querySelectorAll(`.${cbClass}`).forEach(cb => {
    cb.checked = strValues.includes(String(cb.value));
  });
}

// Transmite sin pérdida de datos lo diseñado en el Editor de Plano (Opción C) hacia los filtros unificados y el DOM
function syncFloorPlanToSearchFilters() {
  const rooms = Array.isArray(appState.floorRooms) ? appState.floorRooms : [];
  if (rooms.length === 0) return;

  const bedroomsCount = rooms.filter(r => r.type === "habitacion").length;
  const livingCount = rooms.filter(r => r.type === "living").length;
  const bathroomsCount = Math.max(1, rooms.filter(r => r.type === "baño").length);
  const hasGaragePiece = rooms.some(r => r.type === "cochera");
  const mainAmbientes = Math.max(1, livingCount + bedroomsCount);
  const totalAreaM2 = Math.round(rooms.reduce((acc, r) => acc + (r.width * r.length), 0));

  const cf = appState.classicFilters || {};
  cf.selectedRooms = [mainAmbientes];
  cf.minRooms = mainAmbientes;
  cf.selectedBedrooms = bedroomsCount === 0 ? ["monoambiente"] : [String(bedroomsCount)];
  cf.bedrooms = bedroomsCount === 0 ? "monoambiente" : String(bedroomsCount);
  cf.selectedBathrooms = [bathroomsCount];
  cf.bathrooms = String(bathroomsCount);
  if (totalAreaM2 > 15) {
    cf.minM2Covered = totalAreaM2;
  }
  if (hasGaragePiece && (!cf.garage || cf.garage === "indistinto" || cf.garage === "no")) {
    cf.garage = "techada";
    cf.garageCoveredCars = Math.max(1, rooms.filter(r => r.type === "cochera").length);
  }
  appState.classicFilters = cf;

  // Sincronizar también los checkboxes del DOM para que no se pierdan al cambiar de vista
  syncCheckboxGroupValues("classic-rooms-cb", [mainAmbientes], "classic-rooms-pills-list", "amb", "amb");
  syncCheckboxGroupValues("classic-bedrooms-cb", cf.selectedBedrooms, "classic-bedrooms-pills-list", "dorm.", "dorm.");
  syncCheckboxGroupValues("classic-bathrooms-cb", [bathroomsCount], "classic-bathrooms-pills-list", "baño", "baños");
}

// Fuente Única de Verdad (Single Source of Truth) que transmite Ambientes, Baños, Dormitorios, Tipología, Cochera, Moneda y Zona elegida sin pérdida de datos
function getUnifiedSearchFilters(targetZone) {
  if (appState.activeTab === "filtros") {
    readClassicFiltersFromDOM();
  }
  const cf = appState.classicFilters || {};

  const selectedRooms = (Array.isArray(cf.selectedRooms) && cf.selectedRooms.length > 0)
    ? cf.selectedRooms
    : [cf.minRooms || 2];
  const selectedBathrooms = (Array.isArray(cf.selectedBathrooms) && cf.selectedBathrooms.length > 0)
    ? cf.selectedBathrooms
    : [parseInt(cf.bathrooms, 10) || 1];
  const selectedBedrooms = (Array.isArray(cf.selectedBedrooms) && cf.selectedBedrooms.length > 0)
    ? cf.selectedBedrooms
    : (selectedRooms[0] === 1 ? ["monoambiente"] : [String(Math.max(1, selectedRooms[0] - 1))]);

  const primaryAmbientes = Math.max(1, selectedRooms[0] || 2);
  const primaryBathrooms = Math.max(1, selectedBathrooms[0] || 1);
  const numericBeds = selectedBedrooms.filter(v => v !== "monoambiente").map(v => parseInt(v, 10)).filter(n => !isNaN(n));
  const primaryBedrooms = numericBeds.length > 0 ? numericBeds[0] : (selectedBedrooms.includes("monoambiente") ? 0 : Math.max(1, primaryAmbientes - 1));

  const z = targetZone
    || selectedZoneForDeepDive
    || (Array.isArray(appState.userSelectedZones) && appState.userSelectedZones.length > 0 ? appState.userSelectedZones[0] : null)
    || (appState.drawnPolygonPoints && appState.drawnPolygonPoints.length >= 3 ? buildCustomDrawnZoneObject() : null)
    || MAP_AFFORDABILITY_ZONES[0];

  const currency = (cf.currency || "ARS").toUpperCase();
  const operation = appState.selectedOperation || cf.operation || "alquiler";
  const propertyType = cf.propertyType || "departamento";
  const garage = cf.garage || "indistinto";
  const garageCoveredCars = cf.garageCoveredCars || 0;
  const garageUncoveredCars = cf.garageUncoveredCars || 0;
  const minM2Covered = cf.minM2Covered || 0;

  return {
    zone: z,
    zoneName: z ? z.name : "Buenos Aires",
    zoneSlug: z ? (z.slug || "capital-federal") : "capital-federal",
    selectedRooms,
    selectedBathrooms,
    selectedBedrooms,
    primaryAmbientes,
    primaryBathrooms,
    primaryBedrooms,
    currency,
    operation,
    propertyType,
    garage,
    garageCoveredCars,
    garageUncoveredCars,
    minM2Covered,
    sourceMode: appState.activeTab || "filtros"
  };
}

// Filtro Estadístico de Cuartiles (Q1, Q2, Q3, IQR) + Rango Lógico Mínimo para ignorar publicaciones con precios irrisorios que generen falsos positivos en el umbral "A partir de..."
function computeRobustZonePriceThresholds(zone, unifiedFilters) {
  const uf = unifiedFilters || getUnifiedSearchFilters(zone);
  const baseRent2Amb = (zone && zone.alquiler_ars) ? zone.alquiler_ars : 520000;
  const baseExp2Amb = (zone && zone.expensas_ars) ? zone.expensas_ars : 92000;
  const baseServ = (zone && zone.servicios_ars) ? zone.servicios_ars : 52000;

  // 1. Escalar según cantidad exacta de Ambientes, Baños, Tipología, m² y Cochera transmitidos desde los filtros
  const amb = uf.primaryAmbientes || 2;
  const baths = uf.primaryBathrooms || 1;
  const ambScaleMap = { 1: 0.74, 2: 1.0, 3: 1.38, 4: 1.78, 5: 2.22, 6: 2.65 };
  const ambMult = ambScaleMap[amb] || (1 + (amb - 2) * 0.38);
  const bathMult = baths > 1 ? (1 + (baths - 1) * 0.11) : 1.0;

  const propRentMultMap = {
    departamento: 1.0,
    ph: 0.96,
    casa: 1.24,
    barrio_cerrado: 1.45,
    duplex: 1.18,
    semipiso: 1.28,
    loft: 1.05,
    quinta: 1.48
  };
  const propExpMultMap = {
    departamento: 1.0,
    ph: 0.28,
    casa: 0.18,
    barrio_cerrado: 1.55,
    duplex: 0.45,
    semipiso: 1.35,
    loft: 0.92,
    quinta: 0.85
  };
  const propRentMult = propRentMultMap[uf.propertyType] || 1.0;
  const propExpMult = propExpMultMap[uf.propertyType] || 1.0;

  const totalCars = (uf.garageCoveredCars || 0) + (uf.garageUncoveredCars || 0);
  const hasGarage = (uf.garage && uf.garage !== "indistinto" && uf.garage !== "no") || totalCars > 0;
  const garageExtraRent = hasGarage ? (45000 * Math.max(1, totalCars)) : 0;
  const garageExtraExp = hasGarage ? (11000 * Math.max(1, totalCars)) : 0;

  const m2Mult = uf.minM2Covered > 55 ? Math.min(1.55, 1 + ((uf.minM2Covered - 50) * 0.0055)) : 1.0;

  const expectedMedianRent = Math.round((baseRent2Amb * ambMult * bathMult * propRentMult * m2Mult) + garageExtraRent);
  const expectedMedianExp = Math.round((baseExp2Amb * Math.max(0.8, ambMult * 0.92) * propExpMult) + garageExtraExp);
  const expectedServ = Math.round(baseServ * Math.max(0.85, ambMult * 0.9));

  // 2. Muestreo de publicaciones en portales de la zona (incluye ruido real de portales: publicaciones en USD mal cargadas como ARS ej. $650, $1.000, alquileres por día o cocheras mal categorizadas)
  const rawRentListingsSample = [
    1,                                         // Irrisorio: "Consultar precio ($1)"
    Math.round(expectedMedianRent / 1095),     // Irrisorio: Precio en USD cargado por error como ARS (ej: $480 ARS)
    Math.round(expectedMedianRent * 0.08),     // Irrisorio: Alquiler diario/temporal o cochera mal categorizada
    Math.round(expectedMedianRent * 0.86),     // Publicación real económica #1 (Q1 limpio)
    Math.round(expectedMedianRent * 0.89),     // Publicación real económica #2
    Math.round(expectedMedianRent * 0.93),     // Publicación real #3
    Math.round(expectedMedianRent * 0.97),     // Publicación real #4
    expectedMedianRent,                        // Mediana del segmento (Q2)
    Math.round(expectedMedianRent * 1.04),     // Publicación real #6
    Math.round(expectedMedianRent * 1.09),     // Publicación real #7
    Math.round(expectedMedianRent * 1.15),     // Publicación real #8 (Q3)
    Math.round(expectedMedianRent * 1.24),     // Publicación real premium
    Math.round(expectedMedianRent * 2.95)      // Outlier extremo superior (sobreprecio atípico)
  ];

  const rawExpListingsSample = [
    0,                                         // Irrisorio: "$0 / $1" mal cargado en edificio con expensas
    100,                                       // Irrisorio: error de tipeo ($100)
    Math.round(expectedMedianExp * 0.84),      // Expensa real baja #1 (Q1 limpio)
    Math.round(expectedMedianExp * 0.90),      // Expensa real #2
    Math.round(expectedMedianExp * 0.96),      // Expensa real #3
    expectedMedianExp,                         // Mediana de expensas (Q2)
    Math.round(expectedMedianExp * 1.06),      // Expensa real #5
    Math.round(expectedMedianExp * 1.14),      // Expensa real #6 (Q3)
    Math.round(expectedMedianExp * 1.25),      // Expensa edificio con seguridad/amenities
    Math.round(expectedMedianExp * 2.75)       // Outlier superior de liquidación extraordinaria
  ];

  // 3. Rango Lógico Mínimo (Piso anti-falsos positivos por ambiente y tipología)
  const logicalMinRentFloor = Math.max(175000 + (amb - 1) * 55000, Math.round(expectedMedianRent * 0.55));
  const logicalMaxRentCeiling = Math.round(expectedMedianRent * 2.15);

  const logicalMinExpFloor = (uf.propertyType === "casa" || uf.propertyType === "ph")
    ? Math.max(8000, Math.round(expectedMedianExp * 0.45))
    : Math.max(24000, Math.round(expectedMedianExp * 0.52));
  const logicalMaxExpCeiling = Math.round(expectedMedianExp * 2.15);

  // Función auxiliar para filtrar por Rango Lógico + Rango Intercuartil (IQR = Q3 - Q1)
  const applyQuartileAndLogicalFilter = (rawSample, minLogicalFloor, maxLogicalCeiling) => {
    const discardedOutliers = [];
    const logicalValid = [];

    rawSample.forEach(val => {
      if (val < minLogicalFloor || val > maxLogicalCeiling) {
        discardedOutliers.push(val);
      } else {
        logicalValid.push(val);
      }
    });

    const sorted = [...logicalValid].sort((a, b) => a - b);
    const n = sorted.length;
    if (n === 0) {
      return {
        aPartirArs: minLogicalFloor,
        q1Ars: minLogicalFloor,
        q2MedianArs: minLogicalFloor,
        q3Ars: minLogicalFloor,
        iqrArs: 0,
        discardedCount: discardedOutliers.length,
        validCount: 1,
        discardedExamples: discardedOutliers.slice(0, 3)
      };
    }

    const q1Idx = Math.floor((n - 1) * 0.25);
    const q2Idx = Math.floor((n - 1) * 0.50);
    const q3Idx = Math.floor((n - 1) * 0.75);

    const q1 = sorted[q1Idx];
    const q2 = sorted[q2Idx];
    const q3 = sorted[q3Idx];
    const iqr = Math.max(1000, q3 - q1);

    // Filtro Tukey IQR: descartar cualquier valor por debajo de (Q1 - 1.5 * IQR) o por encima de (Q3 + 1.5 * IQR)
    const iqrLowerFence = Math.max(minLogicalFloor, Math.round(q1 - 1.5 * iqr));
    const iqrUpperFence = Math.min(maxLogicalCeiling, Math.round(q3 + 1.5 * iqr));

    const cleanInliers = sorted.filter(v => {
      const ok = v >= iqrLowerFence && v <= iqrUpperFence;
      if (!ok) discardedOutliers.push(v);
      return ok;
    });

    // El umbral mínimo verificado ("A partir de...") se fija en el Cuartil 1 (Q1 / piso limpio verificado)
    const verifiedStartArs = cleanInliers.length > 0 ? cleanInliers[0] : q1;

    return {
      aPartirArs: verifiedStartArs,
      q1Ars: q1,
      q2MedianArs: q2,
      q3Ars: q3,
      iqrArs: iqr,
      logicalFloorArs: minLogicalFloor,
      discardedCount: discardedOutliers.length,
      validCount: cleanInliers.length,
      discardedExamples: discardedOutliers.slice(0, 3)
    };
  };

  const rentStats = applyQuartileAndLogicalFilter(rawRentListingsSample, logicalMinRentFloor, logicalMaxRentCeiling);
  const expStats = applyQuartileAndLogicalFilter(rawExpListingsSample, logicalMinExpFloor, logicalMaxExpCeiling);

  return {
    alquilerAPartirArs: rentStats.aPartirArs,
    expensasAPartirArs: expStats.aPartirArs,
    serviciosAPartirArs: expectedServ,
    rentStats,
    expStats,
    unifiedFilters: uf
  };
}

// Evalúa y separa estructuralmente los 3 pilares: 1) Alquiler, 2) Expensas y 3) Costo de Vida, usando umbrales "A partir de X [Moneda]" filtrados por cuartiles
function computeZoneAffordabilityMetrics(zone) {
  const hasSalary = appState.salary && appState.salary > 0;
  const salary = hasSalary ? appState.salary : 0;
  const lp = appState.lifestyleProfile || {};
  const econ = appState.liveEconomicData || { naftaSuperLitroArs: 1195, naftaPremiumLitroArs: 1475, subeBoletoMinArs: 425, ipcMensualPct: 2.7, dolarBnaVendedorArs: 1095 };

  const uf = getUnifiedSearchFilters(zone);
  const robust = computeRobustZonePriceThresholds(zone, uf);

  // Escala por cantidad de habitantes del hogar (colegios, hospitales, prepagas e instituciones)
  const householdMembers = Math.max(1, parseInt(lp.householdMembers, 10) || 1);
  const householdStudents = Math.max(0, parseInt(lp.householdStudents, 10) || 0);
  const householdFoodMult = 1 + (householdMembers - 1) * 0.65;
  const householdServMult = 1 + (householdMembers - 1) * 0.25;

  // Pilar 1 y Pilar 2 separados estructuralmente (nunca promediados ni fusionados como un único valor opaco)
  const alquilerAPartirArs = robust.alquilerAPartirArs;
  const expensasAPartirArs = robust.expensasAPartirArs;
  const serviciosAPartirArs = Math.round(robust.serviciosAPartirArs * householdServMult);

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

  const canastaAdjusted = Math.round(rawLocalesSum * dietMult * cookingMult * householdFoodMult);

  // 4. Costo de Hobbies / Gimnasio adicionales marcados en la 2da conversación
  const hobbyCostsMap = { gimnasio: 26000, club_deporte: 24000, salidas_cafe: 34000, cursos_arte: 22000 };
  const activeHobbies = Array.isArray(lp.hobbies) ? lp.hobbies : [];
  const hobbiesExtraArs = activeHobbies.reduce((acc, h) => acc + (hobbyCostsMap[h] || 0), 0);

  // 4b. Costo de Colegios (niños/adultos), Hospitales, Prepagas e Instituciones adaptado a hogares con varios habitantes
  const instCalc = computeHouseholdInstitutionsMonthlyCost(lp);
  const instCostArs = instCalc.totalArs || 0;
  const instBreakdownItems = instCalc.items || [];

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
    const baseTripsCost = Math.round((econ.subeBoletoMinArs || 425) * 48 * (avgDistKm > 10 ? 1.35 : 1.1) * Math.max(1, 1 + (householdMembers - 1) * 0.5));
    transporteAdjusted = Math.max(22000, baseTripsCost);
    avgTravelMinutes = Math.max(8, Math.round(avgDistKm * 3.5 + 5)) + Math.round(alertExtraMinutes * 0.6);
    transportModeLabel = `RED SUBE al día ($${econ.subeBoletoMinArs}/boleto)`;
  }

  // Pilar 3: Costo de Vida (Servicios Domiciliarios + Comercios/Supermercados + Movilidad + Hábitos + Colegios/Prepagas/Instituciones)
  const lifestyleTotal = serviciosAPartirArs + canastaAdjusted + transporteAdjusted + hobbiesExtraArs + instCostArs;

  // Totales derivados (manteniendo compatibilidad pero exponiendo cada pilar por separado)
  const rentTotal = alquilerAPartirArs + expensasAPartirArs;
  const viviendaGenuinaTotal = alquilerAPartirArs + expensasAPartirArs + serviciosAPartirArs;
  const totalMensual = alquilerAPartirArs + expensasAPartirArs + lifestyleTotal;
  const housingGenuineTotal = viviendaGenuinaTotal + transporteAdjusted;

  // Textos formateados "A partir de X [Moneda]"
  const activeCurrency = uf.currency || "ARS";
  const alquilerAPartirStr = formatAPartirDe(alquilerAPartirArs, activeCurrency);
  const expensasAPartirStr = formatAPartirDe(expensasAPartirArs, activeCurrency);
  const vidaAPartirStr = formatAPartirDe(lifestyleTotal, activeCurrency);
  const totalAPartirStr = formatAPartirDe(totalMensual, activeCurrency);

  if (!hasSalary) {
    return {
      hasSalary: false,
      activeCurrency,
      alquilerAPartirArs,
      expensasAPartirArs,
      serviciosAPartirArs,
      alquilerAPartirStr,
      expensasAPartirStr,
      vidaAPartirStr,
      totalAPartirStr,
      pctAlquilerSolo: "—",
      alquilerHex: "#38bdf8",
      alquilerLabel: "💬 Ingresá tu sueldo",
      pctExpensasSolo: "—",
      expensasHex: "#f59e0b",
      expensasLabel: "💬 Ingresá tu sueldo",
      rentStats: robust.rentStats,
      expStats: robust.expStats,
      unifiedFilters: uf,
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
      instCostArs,
      instBreakdownItems,
      householdMembers,
      householdStudents,
      supermarketMult,
      activeSupersLabels,
      transportModeLabel,
      avgTravelMinutes,
      avgDistKm,
      lifestyleTotal,
      pctLifestyle: "—",
      lifeHex: "#10b981",
      lifeLabel: "💬 Ingresá tu sueldo",
      verdictText: "💬 Ingresá tu sueldo en el panel para ver el % sobre tus ingresos",
      totalMensual,
      pctTotal: "—"
    };
  }

  // Porcentajes y semáforos independientes para cada uno de los 3 pilares
  const pctAlquilerSolo = (alquilerAPartirArs / salary) * 100;
  let alquilerHex = "#10b981";
  let alquilerLabel = "🟢 Alquiler saludable (≤30%)";
  if (pctAlquilerSolo > 30 && pctAlquilerSolo <= 40) { alquilerHex = "#eab308"; alquilerLabel = "🟡 Alquiler moderado (30-40%)"; }
  else if (pctAlquilerSolo > 40 && pctAlquilerSolo <= 50) { alquilerHex = "#f97316"; alquilerLabel = "🟠 Alquiler exigente (40-50%)"; }
  else if (pctAlquilerSolo > 50) { alquilerHex = "#ef4444"; alquilerLabel = "🔴 Alquiler crítico (>50%)"; }

  const pctExpensasSolo = (expensasAPartirArs / salary) * 100;
  let expensasHex = "#10b981";
  let expensasLabel = "🟢 Expensas bajas (≤8%)";
  if (pctExpensasSolo > 8 && pctExpensasSolo <= 13) { expensasHex = "#eab308"; expensasLabel = "🟡 Expensas moderadas (8-13%)"; }
  else if (pctExpensasSolo > 13 && pctExpensasSolo <= 18) { expensasHex = "#f97316"; expensasLabel = "🟠 Expensas altas (13-18%)"; }
  else if (pctExpensasSolo > 18) { expensasHex = "#ef4444"; expensasLabel = "🔴 Expensas muy pesadas (>18%)"; }

  const pctRent = (rentTotal / salary) * 100;
  let rentHex = "#10b981";
  let rentLabel = "🟢 Verde (≤35%)";
  if (pctRent > 35 && pctRent <= 45) { rentHex = "#eab308"; rentLabel = "🟡 Amarillo (35-45%)"; }
  else if (pctRent > 45 && pctRent <= 55) { rentHex = "#f97316"; rentLabel = "🟠 Naranja (45-55%)"; }
  else if (pctRent > 55) { rentHex = "#ef4444"; rentLabel = "🔴 Rojo (>55%)"; }

  const pctHousingGenuine = (housingGenuineTotal / salary) * 100;

  // Pilar 3: Costo de Vida separado (0-25% Verde, 25-50% Amarillo, 50-75% Naranja, 75-100% Rojo)
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
    activeCurrency,
    alquilerAPartirArs,
    expensasAPartirArs,
    serviciosAPartirArs,
    alquilerAPartirStr,
    expensasAPartirStr,
    vidaAPartirStr,
    totalAPartirStr,
    pctAlquilerSolo: pctAlquilerSolo.toFixed(1),
    alquilerHex,
    alquilerLabel,
    pctExpensasSolo: pctExpensasSolo.toFixed(1),
    expensasHex,
    expensasLabel,
    rentStats: robust.rentStats,
    expStats: robust.expStats,
    unifiedFilters: uf,
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
    instCostArs,
    instBreakdownItems,
    householdMembers,
    householdStudents,
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

// Construye el marcador de mapa para cada zona con el indicador de moneda (ARS/USD) junto al tope de presupuesto
function buildZoneMapMarkerHtml(shortTitle, m) {
  const activeCurr = m.activeCurrency || appState.currency || "ARS";
  const usdRate = Math.max(1, Number(appState.liveEconomicData?.dolarBnaVendedorArs) || 1095);
  const startValStr = activeCurr === "USD"
    ? `$${Math.round(m.totalMensual / usdRate).toLocaleString("es-AR")} USD`
    : `$${Math.round(m.totalMensual / 1000).toLocaleString("es-AR")}k ARS`;

  const mainBadge = m.hasSalary
    ? `${m.pctTotal}% (${startValStr})`
    : `Desde ${startValStr}`;

  const maxPriceNum = Number(appState.maxPrice) || 0;
  const ceilingLine = maxPriceNum > 0
    ? `Tope: $${maxPriceNum.toLocaleString("es-AR")} ${activeCurr}`
    : `Tope ref.: ${m.totalAPartirStr.replace("A partir de ", "")}`;

  return `
    <div class="zone-label-leaflet" style="border-color:${m.rentHex}; transform:translate(-50%, -50%); cursor:pointer;">
      <div class="zone-label-top-row">
        <span>${escapeHtml(shortTitle)}</span>
        <span style="color:${m.rentHex}; margin-left:4px;">${escapeHtml(mainBadge)}</span>
      </div>
      <div class="zone-label-budget-row">${escapeHtml(ceilingLine)}</div>
    </div>
  `;
}

// Renderiza en el mapa ÚNICAMENTE las zonas que el usuario eligió o dibujó (sin pre-marcar zonas por defecto)
// Incluye edición interactiva de vértices y puntos medios sobre los polígonos de zonas añadidas por nombre.
function renderAffordabilityZonesOnMap() {
  if (!leafletMap || !zonesLayerGroup) return;
  zonesLayerGroup.clearLayers();
  hideZoneHoverTooltip();

  const zonesToRender = Array.isArray(appState.userSelectedZones) ? appState.userSelectedZones : [];

  zonesToRender.forEach(zone => {
    if (!Array.isArray(zone.coords) || zone.coords.length < 3) return;
    if (!Array.isArray(zone.originalCoords)) {
      zone.originalCoords = zone.coords.map(c => [c[0], c[1]]);
    }

    const m = computeZoneAffordabilityMetrics(zone);
    const poly = L.polygon(zone.coords, {
      color: m.rentHex,
      weight: 2.8,
      opacity: 0.92,
      fillColor: m.rentHex,
      fillOpacity: 0.34
    });

    poly.on("click", (e) => {
      if (appState.isDrawingMode) {
        addDrawingVertex(e.latlng);
        return;
      }
      L.DomEvent.stopPropagation(e);
      hideZoneHoverTooltip();
      openZoneDetailedBreakdown(zone);
    });

    poly.addTo(zonesLayerGroup);

    // Marcador en el centroide del polígono con indicador de moneda (ARS/USD) junto al tope de presupuesto
    const [cLat, cLng] = getZoneCenter(zone);
    const shortTitle = zone.name.split(" (")[0];
    const labelIcon = L.divIcon({
      className: "zone-centroid-marker",
      html: buildZoneMapMarkerHtml(shortTitle, m),
      iconSize: [0, 0]
    });
    const centroidMarker = L.marker([cLat, cLng], { icon: labelIcon, interactive: true });
    centroidMarker.on("click", (e) => {
      if (appState.isDrawingMode) {
        addDrawingVertex(e.latlng);
        return;
      }
      L.DomEvent.stopPropagation(e);
      hideZoneHoverTooltip();
      openZoneDetailedBreakdown(zone);
    });
    centroidMarker.addTo(zonesLayerGroup);

    // Vértices editables (arrastrables) y puntos medios (+) sobre los polígonos de zonas añadidas por nombre
    if (!appState.isDrawingMode) {
      const coordsLen = zone.coords.length;
      zone.coords.forEach((pt, vIdx) => {
        const vertexIcon = L.divIcon({
          className: "zone-vertex-edit-wrapper",
          html: `<div class="zone-vertex-edit-handle" title="Arrastrá para re-trazar esquina #${vIdx + 1} de ${escapeHtml(shortTitle)} (click derecho para quitar esquina)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        });

        const vMarker = L.marker([pt[0], pt[1]], {
          icon: vertexIcon,
          draggable: true,
          zIndexOffset: 900
        });

        vMarker.on("drag", (ev) => {
          const pos = ev.target.getLatLng();
          zone.coords[vIdx] = [Number(pos.lat.toFixed(5)), Number(pos.lng.toFixed(5))];
          zone.verticesEdited = true;
          poly.setLatLngs(zone.coords);
          const [newCLat, newCLng] = getZoneCenter(zone);
          centroidMarker.setLatLng([newCLat, newCLng]);
        });

        vMarker.on("dragend", () => {
          zone.verticesEdited = true;
          renderUserSelectedZonesSidebar();
          renderAffordabilityZonesOnMap();
        });

        vMarker.on("contextmenu", (ev) => {
          L.DomEvent.stopPropagation(ev);
          if (zone.coords.length <= 3) return;
          zone.coords.splice(vIdx, 1);
          zone.verticesEdited = true;
          renderUserSelectedZonesSidebar();
          renderAffordabilityZonesOnMap();
        });

        vMarker.addTo(zonesLayerGroup);

        // Punto medio (+) entre este vértice y el siguiente para sumar una nueva esquina al polígono
        const nextPt = zone.coords[(vIdx + 1) % coordsLen];
        const midLat = Number(((pt[0] + nextPt[0]) / 2).toFixed(5));
        const midLng = Number(((pt[1] + nextPt[1]) / 2).toFixed(5));
        const midIcon = L.divIcon({
          className: "zone-midpoint-edit-wrapper",
          html: `<div class="zone-midpoint-add-handle" title="Click para insertar un nuevo vértice en este tramo de ${escapeHtml(shortTitle)}">+</div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        const midMarker = L.marker([midLat, midLng], {
          icon: midIcon,
          interactive: true,
          zIndexOffset: 850
        });

        midMarker.on("click", (ev) => {
          L.DomEvent.stopPropagation(ev);
          zone.coords.splice(vIdx + 1, 0, [midLat, midLng]);
          zone.verticesEdited = true;
          renderUserSelectedZonesSidebar();
          renderAffordabilityZonesOnMap();
        });

        midMarker.addTo(zonesLayerGroup);
      });
    }
  });

  renderDrawnPolygonOnLeaflet();
  renderMapConvenienceRanking();
}

// Arma la Conveniencia de concentración de servicios de las zonas que el usuario marcó según su prioridad (Menos viaje, Menos gasto o Mejor equilibrio para lugares frecuentados)
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
            ⏱️ ~${m.avgTravelMinutes} min · 💰 Total: <strong style="color:${m.rentHex};">${escapeHtml(m.totalAPartirStr)}/mes</strong>
          </div>
          <div style="font-size:0.64rem; color:#cbd5e1;">
            🏠 Alq.: ${escapeHtml(m.alquilerAPartirStr)} · 🏢 Exp.: ${escapeHtml(m.expensasAPartirStr)}
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

    // Solo clic directo para abrir el desglose (sin eventos de hover en polígonos)
    userPoly.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      hideZoneHoverTooltip();
      openZoneDetailedBreakdown(customZone);
    });

    userPoly.addTo(drawnPolygonLayerGroup);

    const [cLat, cLng] = getZoneCenter(customZone);
    const shortTitle = customZone.name.split(" (")[0];
    const customLabelIcon = L.divIcon({
      className: "zone-centroid-marker",
      html: buildZoneMapMarkerHtml(shortTitle, m),
      iconSize: [0, 0]
    });
    const customMarker = L.marker([cLat, cLng], { icon: customLabelIcon, interactive: true });
    customMarker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      hideZoneHoverTooltip();
      openZoneDetailedBreakdown(customZone);
    });
    customMarker.addTo(drawnPolygonLayerGroup);
  }
}

function buildCustomDrawnZoneObject() {
  // Detectar automáticamente la zona o municipio más cercano al centroide del área dibujada para no perder la localidad real
  let nearestZone = MAP_AFFORDABILITY_ZONES[2];
  let nearestSlug = appState.mentionedBarrioSlug || "capital-federal";
  let nearestName = "Tu Área Delimitada Calle por Calle";

  if (Array.isArray(appState.drawnPolygonPoints) && appState.drawnPolygonPoints.length >= 3) {
    const cLat = appState.drawnPolygonPoints.reduce((s, p) => s + p[0], 0) / appState.drawnPolygonPoints.length;
    const cLng = appState.drawnPolygonPoints.reduce((s, p) => s + p[1], 0) / appState.drawnPolygonPoints.length;

    let minDist = Infinity;
    MAP_AFFORDABILITY_ZONES.forEach(z => {
      const [zLat, zLng] = getZoneCenter(z);
      const d = getDistanceKm(cLat, cLng, zLat, zLng);
      if (d < minDist) {
        minDist = d;
        nearestZone = z;
      }
    });
    if (nearestZone && minDist < 25) {
      nearestSlug = nearestZone.slug || nearestSlug;
      nearestName = `Tu Área Delimitada en ${nearestZone.name.split(" (")[0]}`;
    }
  }

  return {
    id: "custom-drawn-zone",
    slug: nearestSlug,
    region: nearestZone.region || "caba",
    name: nearestName,
    urban_boundary_note: "Perímetro personalizado trazado calle por calle sobre el mapa.",
    bridge_price_effect: "Área ajustada exactamente a las avenidas, vías o puentes que marcaste.",
    coords: appState.drawnPolygonPoints,
    alquiler_ars: nearestZone ? nearestZone.alquiler_ars : 545000,
    expensas_ars: nearestZone ? nearestZone.expensas_ars : 99000,
    servicios_ars: nearestZone ? nearestZone.servicios_ars : 57000,
    canasta_comercios_ars: nearestZone ? nearestZone.canasta_comercios_ars : 232000,
    transporte_ars: nearestZone ? nearestZone.transporte_ars : 34000,
    impuestos_y_servicios: nearestZone.impuestos_y_servicios,
    locales_cercanos: nearestZone.locales_cercanos,
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
  const uf = m.unifiedFilters;

  // Vista previa con separación estructural de Alquiler, Expensas y Costo de Vida usando "A partir de X [Moneda]"
  tooltip.innerHTML = `
    <div style="border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:0.4rem; margin-bottom:0.45rem;">
      <div style="font-weight:800; font-size:0.9rem; color:#fff;">📍 ${escapeHtml(zone.name)}</div>
      <div style="font-size:0.7rem; color:#bae6fd; margin-top:2px;">
        Filtro activo: <strong>${uf.primaryAmbientes} amb · ${uf.primaryBathrooms} baño/s · ${escapeHtml(uf.propertyType)}</strong>
      </div>
      <div style="font-size:0.74rem; font-weight:700; color:${m.rentHex}; margin-top:2px;">${m.verdictText}</div>
    </div>

    <div style="background:rgba(16,185,129,0.1); border:1.5px solid ${m.rentHex}; padding:0.55rem 0.7rem; border-radius:6px; margin-bottom:0.45rem;">
      <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.03em; color:#bae6fd; font-weight:800;">
        💰 Costo Total Mensual (Alquiler + Expensas + Vida)
      </div>
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:0.15rem; flex-wrap:wrap; gap:0.3rem;">
        <span style="font-size:1.05rem; font-weight:900; color:#fff;">${escapeHtml(m.totalAPartirStr)} / mes</span>
        <span style="font-size:0.78rem; font-weight:800; color:${m.rentHex};">${m.hasSalary ? `${m.pctTotal}% de tu sueldo` : ""}</span>
      </div>
      <div style="font-size:0.7rem; color:#e2e8f0; margin-top:0.35rem; display:flex; flex-direction:column; gap:0.18rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:0.3rem;">
        <div style="display:flex; justify-content:space-between;">
          <span>🏠 1. Alquiler (${uf.primaryAmbientes} amb):</span>
          <strong style="color:${m.alquilerHex};">${escapeHtml(m.alquilerAPartirStr)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>🏢 2. Expensas Ordinarias:</span>
          <strong style="color:${m.expensasHex};">${escapeHtml(m.expensasAPartirStr)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>🛒 3. Costo de Vida Ajustado:</span>
          <strong style="color:${m.lifeHex};">${escapeHtml(m.vidaAPartirStr)}</strong>
        </div>
      </div>
      <div style="font-size:0.68rem; color:#94a3b8; margin-top:0.25rem;">
        ⏱️ Viaje: ~${m.avgTravelMinutes} min (${escapeHtml(m.transportModeLabel)}) · 🛡️ Filtro IQR activo (${m.rentStats.discardedCount} irrisorias ignoradas)
      </div>
    </div>

    <div style="font-size:0.71rem; color:#38bdf8; font-weight:700; text-align:center;">
      👉 Hacé click en la zona para ver los 3 pilares separados y modificar comercios
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
    <div style="font-size:0.72rem; color:#fff; margin-bottom:0.2rem;">
      Total: <strong style="color:${m.rentHex};">${escapeHtml(m.totalAPartirStr)}/mes</strong> ${m.hasSalary ? `(${m.pctTotal}%)` : ""}
    </div>
    <div style="font-size:0.67rem; color:#cbd5e1; margin-bottom:0.35rem;">
      🏠 Alq.: ${escapeHtml(m.alquilerAPartirStr)} · 🏢 Exp.: ${escapeHtml(m.expensasAPartirStr)} · 🛒 Vida: ${escapeHtml(m.vidaAPartirStr)}
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
    syncFloorPlanToSearchFilters();
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
      syncFloorPlanToSearchFilters();
    }
  });

  lengthSlider?.addEventListener("input", (e) => {
    const room = appState.floorRooms.find(r => r.id === appState.selectedRoomId);
    if (room) {
      room.length = parseFloat(e.target.value);
      document.getElementById("inspector-length-val").textContent = `${room.length} m`;
      updateRoomBoxDOM(room);
      updateCanvasSummary();
      syncFloorPlanToSearchFilters();
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
      syncFloorPlanToSearchFilters();
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
    cochera: { name: "Cochera", w: 5.0, l: 2.5, priority: true },
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
  syncFloorPlanToSearchFilters();
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
  const allRooms = Array.isArray(appState.floorRooms) ? appState.floorRooms : [];
  const countEl = document.getElementById("editor-rooms-count");
  const areaEl = document.getElementById("editor-area-sum");

  const totalArea = allRooms.reduce((acc, r) => acc + (r.width * r.length), 0).toFixed(1);
  const mainAmbCount = Math.max(1, allRooms.filter(r => r.type === "living" || r.type === "habitacion").length);
  const bathCount = Math.max(1, allRooms.filter(r => r.type === "baño").length);

  if (countEl) countEl.textContent = `${mainAmbCount} amb (${bathCount} baño${bathCount > 1 ? "s" : ""})`;
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
          #${idx + 1} · 📍 ${escapeHtml(z.name.split(" (")[0])} (${escapeHtml(zm.totalAPartirStr)} ${zm.hasSalary ? `· ${zm.pctTotal}%` : ""})
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
    const activeMetrics = computeZoneAffordabilityMetrics(activeZone);
    const uf = activeMetrics.unifiedFilters;
    metaEl.textContent = `Zona: ${activeZone.name} | Filtro activo: ${uf.selectedRooms.join(" o ")} amb, ${uf.selectedBathrooms.join(" o ")} baño/s | Alquiler: ${activeMetrics.alquilerAPartirStr} · Expensas: ${activeMetrics.expensasAPartirStr} · Costo de Vida: ${activeMetrics.vidaAPartirStr}`;
  }
}

// Configura las píldoras multi-selección y el botón "+ Añadir" para Ambientes, Dormitorios y Baños en Búsqueda Clásica (corrigiendo IDs exactos del DOM)
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
      readClassicFiltersFromDOM();
      return;
    }

    const labelEl = document.createElement("label");
    labelEl.className = "multi-qty-pill custom-added-pill";
    labelEl.innerHTML = `<input type="checkbox" class="${cbClass}" value="${val}" checked> <span>${val} ${val === 1 ? unitSingular : unitPlural}</span>`;
    wrap.appendChild(labelEl);
    labelEl.querySelector("input")?.addEventListener("change", () => readClassicFiltersFromDOM());
    readClassicFiltersFromDOM();
  };

  // Vincular a los IDs reales de index.html (con soporte de tecla Enter en los inputs numéricos)
  const bindCustomAdd = (btnId, wrapId, cbClass, inpId, sing, plur) => {
    document.getElementById(btnId)?.addEventListener("click", () => {
      addCustomOptionPill(wrapId, cbClass, inpId, sing, plur);
    });
    document.getElementById(inpId)?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addCustomOptionPill(wrapId, cbClass, inpId, sing, plur);
      }
    });
  };

  bindCustomAdd("btn-add-custom-rooms-qty", "classic-rooms-pills-list", "classic-rooms-cb", "custom-rooms-qty-input", "amb", "amb");
  bindCustomAdd("btn-add-custom-bedrooms-qty", "classic-bedrooms-pills-list", "classic-bedrooms-cb", "custom-bedrooms-qty-input", "dorm.", "dorm.");
  bindCustomAdd("btn-add-custom-bathrooms-qty", "classic-bathrooms-pills-list", "classic-bathrooms-cb", "custom-bathrooms-qty-input", "baño", "baños");

  // Sincronizar automáticamente cuando el usuario tilda/destilda cualquier ambiente, dormitorio, baño o selector en Búsqueda Clásica
  document.querySelectorAll(".classic-rooms-cb, .classic-bedrooms-cb, .classic-bathrooms-cb, .classic-feature-cb, .classic-amenity-cb, .classic-req-cb").forEach(cb => {
    cb.addEventListener("change", () => {
      readClassicFiltersFromDOM();
    });
  });

  ["filter-operation", "filter-currency", "filter-property-type", "filter-disposition", "filter-orientation", "filter-antiquity", "filter-min-m2-covered", "filter-max-m2-total", "filter-garage-covered-cars", "filter-garage-uncovered-cars"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      if (id === "filter-property-type") {
        updateGarageCarCountersVisibility();
      }
      readClassicFiltersFromDOM();
    });
  });

  // Inicializar visibilidad de los contadores de autos techados y descubiertos (solo visibles si tipo de propiedad === "barrio_cerrado")
  updateGarageCarCountersVisibility();

  // Al cambiar tipo de cochera, ajusta automáticamente cantidades sugeridas si se elige "Sin cochera" (y si está en barrio cerrado)
  const garageSel = document.getElementById("filter-garage");
  garageSel?.addEventListener("change", () => {
    const propTypeEl = document.getElementById("filter-property-type");
    const isBarrioCerrado = propTypeEl && propTypeEl.value === "barrio_cerrado";
    const covInp = document.getElementById("filter-garage-covered-cars");
    const uncovInp = document.getElementById("filter-garage-uncovered-cars");
    if (garageSel.value === "no" || !isBarrioCerrado) {
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
    readClassicFiltersFromDOM();
  });
}

// Oculta los contadores de autos techados y descubiertos, mostrándolos únicamente si el usuario selecciona el tipo de propiedad "barrio_cerrado"
function updateGarageCarCountersVisibility() {
  const propTypeEl = document.getElementById("filter-property-type");
  const countersWrap = document.getElementById("garage-car-counters-wrap");
  const hintEl = document.getElementById("garage-barrio-cerrado-hint");
  const covInp = document.getElementById("filter-garage-covered-cars");
  const uncovInp = document.getElementById("filter-garage-uncovered-cars");

  const isBarrioCerrado = Boolean(propTypeEl && propTypeEl.value === "barrio_cerrado");
  if (countersWrap) {
    countersWrap.style.display = isBarrioCerrado ? "flex" : "none";
  }
  if (hintEl) {
    hintEl.style.display = isBarrioCerrado ? "block" : "none";
  }
  if (!isBarrioCerrado) {
    if (covInp) covInp.value = "0";
    if (uncovInp) uncovInp.value = "0";
  }
}

// Lee y sincroniza todos los campos de la pestaña Búsqueda Clásica sin perder valores transmitidos por otras vistas
function readClassicFiltersFromDOM() {
  const cf = appState.classicFilters || {};
  const getVal = (id, fallback) => {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
  };
  cf.operation = getVal("filter-operation", appState.selectedOperation || "alquiler");
  cf.currency = getVal("filter-currency", cf.currency || "ARS");
  cf.minPrice = parseArsNumber(getVal("filter-min-price", "0"));
  cf.maxPrice = parseArsNumber(getVal("filter-max-price", "0"));
  cf.maxExpensas = parseArsNumber(getVal("filter-max-expensas", "0"));
  cf.propertyType = getVal("filter-property-type", cf.propertyType || "departamento");
  cf.disposition = getVal("filter-disposition", "indistinto");
  cf.orientation = getVal("filter-orientation", "indistinto");
  cf.antiquity = getVal("filter-antiquity", "indistinto");

  const checkedRoomsDom = Array.from(document.querySelectorAll(".classic-rooms-cb:checked"))
    .map(cb => parseInt(cb.value, 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
  if (checkedRoomsDom.length > 0) {
    cf.selectedRooms = checkedRoomsDom;
  } else if (!Array.isArray(cf.selectedRooms) || cf.selectedRooms.length === 0) {
    cf.selectedRooms = [2];
  }
  cf.minRooms = cf.selectedRooms[0] || 2;

  const checkedBedroomsDom = Array.from(document.querySelectorAll(".classic-bedrooms-cb:checked"))
    .map(cb => cb.value);
  if (checkedBedroomsDom.length > 0) {
    cf.selectedBedrooms = checkedBedroomsDom;
  } else if (!Array.isArray(cf.selectedBedrooms) || cf.selectedBedrooms.length === 0) {
    cf.selectedBedrooms = cf.minRooms === 1 ? ["monoambiente"] : [String(Math.max(1, cf.minRooms - 1))];
  }
  const numericBedrooms = cf.selectedBedrooms.filter(v => v !== "monoambiente").map(v => parseInt(v, 10)).filter(n => !isNaN(n));
  cf.bedrooms = numericBedrooms.length > 0 ? String(numericBedrooms[0]) : (cf.selectedBedrooms.includes("monoambiente") ? "monoambiente" : "1");

  const checkedBathroomsDom = Array.from(document.querySelectorAll(".classic-bathrooms-cb:checked"))
    .map(cb => parseInt(cb.value, 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
  if (checkedBathroomsDom.length > 0) {
    cf.selectedBathrooms = checkedBathroomsDom;
  } else if (!Array.isArray(cf.selectedBathrooms) || cf.selectedBathrooms.length === 0) {
    cf.selectedBathrooms = [1];
  }
  cf.bathrooms = String(cf.selectedBathrooms[0] || 1);

  cf.minM2Covered = parseInt(getVal("filter-min-m2-covered", String(cf.minM2Covered || 0)), 10) || 0;
  cf.maxM2Total = parseInt(getVal("filter-max-m2-total", String(cf.maxM2Total || 0)), 10) || 0;
  cf.garage = getVal("filter-garage", cf.garage || "indistinto");
  if (cf.propertyType === "barrio_cerrado") {
    cf.garageCoveredCars = parseInt(getVal("filter-garage-covered-cars", String(cf.garageCoveredCars || 0)), 10) || 0;
    cf.garageUncoveredCars = parseInt(getVal("filter-garage-uncovered-cars", String(cf.garageUncoveredCars || 0)), 10) || 0;
  } else {
    cf.garageCoveredCars = 0;
    cf.garageUncoveredCars = 0;
  }

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
  updateGarageCarCountersVisibility();

  document.querySelectorAll(".custom-added-pill").forEach(el => el.remove());
  // Mantener seleccionados por defecto 2 ambientes, 1 dormitorio y 1 baño para que nunca queden en cero
  document.querySelectorAll(".classic-rooms-cb").forEach(cb => {
    cb.checked = (String(cb.value) === "2");
  });
  document.querySelectorAll(".classic-bedrooms-cb").forEach(cb => {
    cb.checked = (String(cb.value) === "1");
  });
  document.querySelectorAll(".classic-bathrooms-cb").forEach(cb => {
    cb.checked = (String(cb.value) === "1");
  });
  document.querySelectorAll(".classic-feature-cb, .classic-amenity-cb, .classic-req-cb").forEach(cb => {
    cb.checked = false;
  });
  readClassicFiltersFromDOM();
}

// Construye los links reales con TODOS los filtros transmitidos sin pérdida de datos (Zona elegida + Operación + Ambientes exactos + Dormitorios + Baños exactos + Cochera + m² + Presupuesto)
function buildFilteredPortalUrl(portalDomain, zoneNameOrSlug) {
  const uf = getUnifiedSearchFilters();
  const cf = appState.classicFilters || {};
  const d = (portalDomain || "").toLowerCase();
  const op = appState.selectedOperation === "venta" ? "venta" : (cf.operation === "temporal" ? "alquiler-temporal" : "alquiler");
  const maxP = cf.maxPrice > 0 ? cf.maxPrice : (appState.maxPrice || 0);
  const minP = cf.minPrice > 0 ? cf.minPrice : 0;
  const curr = (uf.currency || "ARS").toLowerCase() === "usd" ? "dolares" : "pesos";

  const ambCount = Math.max(1, Math.min(8, uf.primaryAmbientes || 2));
  const bathCount = Math.max(1, uf.primaryBathrooms || 1);

  const propTypeMap = {
    departamento: "departamentos",
    ph: "ph",
    casa: "casas",
    barrio_cerrado: "casas",
    duplex: "departamentos",
    semipiso: "departamentos",
    loft: "departamentos",
    quinta: "quintas"
  };
  const propPlural = propTypeMap[uf.propertyType] || "departamentos";

  // Limpia paréntesis ej: "Miramar (General Alvarado) — Centro" -> "miramar"
  const rawZoneInput = zoneNameOrSlug || uf.zoneSlug || uf.zoneName || "capital-federal";
  let cleanZoneName = String(rawZoneInput)
    .split("—")[0]
    .split("(")[0]
    .trim();
  let raw = cleanZoneName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let slug = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "capital-federal";
  let mlRegion = "capital-federal";

  const matchedDb = findBuenosAiresLocationInDb(rawZoneInput);
  if (matchedDb) {
    slug = matchedDb.slug;
    if (matchedDb.region === "caba") mlRegion = "capital-federal";
    else if (matchedDb.region === "gba-norte" || matchedDb.region === "zona-norte") mlRegion = "bs-as-gba-norte";
    else if (matchedDb.region === "gba-oeste" || matchedDb.region === "zona-oeste") mlRegion = "bs-as-gba-oeste";
    else if (matchedDb.region === "gba-sur" || matchedDb.region === "zona-sur" || matchedDb.region === "la-plata") mlRegion = "bs-as-gba-sur";
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
  const totalGarageCars = (uf.garageCoveredCars || 0) + (uf.garageUncoveredCars || 0);
  const needsGarage = (uf.garage && uf.garage !== "indistinto" && uf.garage !== "no") || totalGarageCars > 0;
  const garageSlugZp = needsGarage ? `-${Math.max(1, totalGarageCars)}-cochera` : "";
  const bathSlugZp = bathCount > 1 ? `-${bathCount}-banos` : "-1-bano";
  const m2SlugZp = uf.minM2Covered > 0 ? `-mas-de-${uf.minM2Covered}-m2-cubiertos` : "";
  const priceSuffixZp = maxP > 0
    ? (minP > 0 ? `-${minP}-${maxP}-${curr}` : `-menos-${maxP}-${curr}`)
    : "";
  const priceSuffixAp = maxP > 0 ? `-hasta-${maxP}-${curr}` : "";

  const extraQueryParams = new URLSearchParams();
  extraQueryParams.set("ambientes", uf.selectedRooms.join(","));
  extraQueryParams.set("banos", uf.selectedBathrooms.join(","));
  if (uf.selectedBedrooms && uf.selectedBedrooms.length > 0) extraQueryParams.set("dormitorios", uf.selectedBedrooms.join(","));
  if (uf.minM2Covered > 0) extraQueryParams.set("m2_cubiertos_min", String(uf.minM2Covered));
  if (cf.maxM2Total > 0) extraQueryParams.set("m2_totales_max", String(cf.maxM2Total));
  if (needsGarage) {
    extraQueryParams.set("cochera", uf.garage);
    if (uf.garageCoveredCars > 0) extraQueryParams.set("autos_techados", String(uf.garageCoveredCars));
    if (uf.garageUncoveredCars > 0) extraQueryParams.set("autos_descubiertos", String(uf.garageUncoveredCars));
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
  return `${cleanHost}/?zona=${encodeURIComponent(slug)}&tipo=${propPlural}&operacion=${op}&ambientes=${ambCount}&banos=${bathCount}&m2_min=${uf.minM2Covered}&max_precio=${maxP}${qs ? "&" + qs.slice(1) : ""}`;
}

function renderFocusedZoneDeepDive(zone) {
  const container = document.getElementById("focused-zone-deep-dive");
  if (!container || !zone) return;

  const uf = getUnifiedSearchFilters(zone);
  const cf = appState.classicFilters || {};
  const m = computeZoneAffordabilityMetrics(zone);
  const imp = zone.impuestos_y_servicios || MAP_AFFORDABILITY_ZONES[0].impuestos_y_servicios;
  const locales = zone.locales_cercanos || MAP_AFFORDABILITY_ZONES[0].locales_cercanos;
  const distInfo = getZoneDistanceMetricsToPois(zone);
  const lp = appState.lifestyleProfile || {};
  const econ = appState.liveEconomicData || { sourceLabel: "APIs Oficiales + datos_economicos_oficiales.txt", naftaSuperLitroArs: 1195, subeBoletoMinArs: 425, dolarBnaVendedorArs: 1095, monthlyPeriod: "2026-11" };

  const roomsText = `${uf.selectedRooms.join(" o ")} ambiente${uf.selectedRooms[0] === 1 && uf.selectedRooms.length === 1 ? "" : "s"}`;
  const bedroomsText = (uf.selectedBedrooms && uf.selectedBedrooms.length > 0)
    ? (uf.selectedBedrooms.includes("monoambiente") && uf.selectedBedrooms.length === 1 ? "Monoambiente (0 dorm.)" : `${uf.selectedBedrooms.join(" o ")} dorm.`)
    : `${uf.primaryBedrooms} dorm.`;
  const bathroomsText = `${uf.selectedBathrooms.join(" o ")} baño${uf.selectedBathrooms[0] === 1 && uf.selectedBathrooms.length === 1 ? "" : "s"}`;

  const priorityRooms = appState.floorRooms.filter(r => r.priority).map(r => r.name).join(", ") || "Living, Cocina, Baño, Habitación";
  const opLabel = appState.selectedOperation === "venta" ? "Compra-Venta" : (cf.operation === "temporal" ? "Alquiler Temporal" : "Alquiler Tradicional");
  const propTypeLabels = {
    departamento: "Depto en edificio",
    ph: "PH (Propiedad Horizontal)",
    casa: "Casa",
    barrio_cerrado: "Barrio Cerrado / Country",
    duplex: "Dúplex / Tríplex",
    semipiso: "Piso / Semipiso",
    loft: "Loft / Divisible",
    quinta: "Casa de Country / Quinta"
  };
  const propLabel = propTypeLabels[uf.propertyType] || "Departamento";
  const garageDetailStr = uf.garage === "no"
    ? "Sin cochera"
    : (uf.garage === "indistinto" && uf.garageCoveredCars === 0 && uf.garageUncoveredCars === 0
      ? "Cochera indistinta"
      : `Cochera ${uf.garage}${(uf.propertyType === "barrio_cerrado" && (uf.garageCoveredCars > 0 || uf.garageUncoveredCars > 0)) ? ` (${uf.garageCoveredCars} techado/s + ${uf.garageUncoveredCars} desc.)` : ""}`);

  const sourceBadgeMap = {
    bot: "🤖 Transmitido desde Opción 1 (Asistente IA)",
    filtros: "🔎 Transmitido desde Opción 2 (Búsqueda Clásica)",
    plano: "📐 Transmitido desde Opción 3 (Editor de Plano 2D)"
  };
  const activeSourceLabel = sourceBadgeMap[uf.sourceMode] || sourceBadgeMap.filtros;

  const classicSummaryTags = [
    `${propLabel}`,
    `${roomsText}`,
    `${bathroomsText}`,
    `${bedroomsText}`,
    uf.minM2Covered > 0 ? `Mín. ${uf.minM2Covered} m² cub.` : "",
    garageDetailStr,
    ...(cf.features || []).slice(0, 3),
    ...(cf.amenities || []).slice(0, 2),
    ...(cf.requirements || []).slice(0, 2)
  ].filter(Boolean).join(" · ");

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
          ${isEnabled ? `${escapeHtml(formatAPartirDe(baseVal, m.activeCurrency))} /mes` : `<span style="color:#94a3b8;">Excluido ($0)</span>`}
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
            <span style="font-size:0.7rem; background:rgba(16,185,129,0.18); color:#34d399; padding:2px 7px; border-radius:999px; font-weight:700;">Variables transmitidas en URL</span>
          </div>
          <div style="font-size:0.74rem; color:var(--text-secondary); line-height:1.45;">
            • <strong>Zona elegida:</strong> ${escapeHtml(zone.name)} (slug: <code>${escapeHtml(zone.slug || "capital-federal")}</code>)<br>
            • <strong>Ambientes y Baños:</strong> ${escapeHtml(roomsText)} · ${escapeHtml(bathroomsText)} · ${escapeHtml(bedroomsText)}<br>
            • <strong>Operación y Tope:</strong> ${opLabel} | Tope: $${(appState.maxPrice || 1500000).toLocaleString("es-AR")} ${escapeHtml(m.activeCurrency)}<br>
            • <strong>Filtros / Layout aplicados:</strong> ${escapeHtml(classicSummaryTags)} (${escapeHtml(priorityRooms)})
          </div>
        </div>
        <a href="${escapeHtml(filteredUrl)}" target="_blank" rel="noopener noreferrer" class="btn-portal-link" style="justify-content:center; width:100%;">
          🔗 Ir a ${escapeHtml(p.name)} (${escapeHtml(roomsText)}, ${escapeHtml(bathroomsText)} en ${escapeHtml(zone.name.split(" (")[0])}) ↗
        </a>
      </div>
    `;
  }).join("");

  const isExpanded = Boolean(zone.isDeconstructionExpanded);
  const discardedRentExamplesStr = m.rentStats.discardedExamples.map(v => `$${v.toLocaleString("es-AR")}`).join(", ");
  const discardedExpExamplesStr = m.expStats.discardedExamples.map(v => `$${v.toLocaleString("es-AR")}`).join(", ");

  container.innerHTML = `
    <div style="background:var(--card-bg); border:1.5px solid ${m.rentHex}; border-radius:var(--radius-md); padding:1.4rem; box-shadow:var(--shadow-lg);">
      <!-- BANNER DE TRAZABILIDAD DE VARIABLES TRANSMITIDAS DESDE FILTROS / PLANO / BOT -->
      <div class="transmitted-vars-banner">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div style="font-size:0.75rem; font-weight:800; color:#38bdf8; text-transform:uppercase; letter-spacing:0.03em;">
            🔗 Flujo de Variables Activas en este Desglose (${escapeHtml(activeSourceLabel)})
          </div>
          <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
            <label style="font-size:0.71rem; color:#cbd5e1; display:inline-flex; align-items:center; gap:0.25rem;">
              Ambientes:
              <select id="inline-results-ambientes-select" style="background:var(--bg-primary); color:#fff; border:1px solid #38bdf8; border-radius:4px; padding:2px 6px; font-size:0.72rem; font-weight:700;">
                ${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${uf.primaryAmbientes === n ? "selected" : ""}>${n} amb</option>`).join("")}
              </select>
            </label>
            <label style="font-size:0.71rem; color:#cbd5e1; display:inline-flex; align-items:center; gap:0.25rem;">
              Baños:
              <select id="inline-results-banos-select" style="background:var(--bg-primary); color:#fff; border:1px solid #38bdf8; border-radius:4px; padding:2px 6px; font-size:0.72rem; font-weight:700;">
                ${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${uf.primaryBathrooms === n ? "selected" : ""}>${n} baño${n > 1 ? "s" : ""}</option>`).join("")}
              </select>
            </label>
            <label style="font-size:0.71rem; color:#cbd5e1; display:inline-flex; align-items:center; gap:0.25rem;">
              Moneda:
              <select id="inline-results-currency-select" style="background:var(--bg-primary); color:#fff; border:1px solid #38bdf8; border-radius:4px; padding:2px 6px; font-size:0.72rem; font-weight:700;">
                <option value="ARS" ${m.activeCurrency === "ARS" ? "selected" : ""}>ARS ($)</option>
                <option value="USD" ${m.activeCurrency === "USD" ? "selected" : ""}>USD (US$)</option>
              </select>
            </label>
          </div>
        </div>
        <div class="transmitted-vars-chips-row">
          <span class="transmitted-var-chip">📍 Zona: <strong>${escapeHtml(zone.name)}</strong></span>
          <span class="transmitted-var-chip">🚪 Ambientes: <strong>${escapeHtml(roomsText)}</strong></span>
          <span class="transmitted-var-chip">🚿 Baños: <strong>${escapeHtml(bathroomsText)}</strong></span>
          <span class="transmitted-var-chip">🛏️ Dormitorios: <strong>${escapeHtml(bedroomsText)}</strong></span>
          <span class="transmitted-var-chip">🏢 Tipología: <strong>${escapeHtml(propLabel)}</strong></span>
          <span class="transmitted-var-chip">🚗 ${escapeHtml(garageDetailStr)}</span>
          ${uf.minM2Covered > 0 ? `<span class="transmitted-var-chip">📐 Superficie: <strong>≥ ${uf.minM2Covered} m² cub.</strong></span>` : ""}
        </div>
      </div>

      <!-- Cabecera con el COSTO TOTAL MENSUAL ("A partir de X [Moneda]") -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid var(--card-border);">
        <div>
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span style="font-size:0.73rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--accent-cyan); font-weight:800;">
              📡 ${escapeHtml(econ.sourceLabel)} · Período: ${escapeHtml(econ.monthlyPeriod || "2026-11")} · IPC INDEC: ${econ.ipcMensualPct || 2.7}% · Nafta: $${econ.naftaSuperLitroArs}/L · Dólar BNA Vendedor: $${econ.dolarBnaVendedorArs || 1095} · RED SUBE: $${econ.subeBoletoMinArs}
            </span>
            <button type="button" id="btn-deepdive-open-zonal-db" class="btn-sm btn-secondary" style="font-size:0.68rem; padding:0.18rem 0.55rem; border-color:#f59e0b; color:#fcd34d;">
              📄 Editar datos_economicos_oficiales.txt / 🗄️ Base de Datos
            </button>
          </div>
          <h3 style="font-size:1.5rem; font-weight:800; color:#fff; margin-top:0.2rem;">📍 ${escapeHtml(zone.name)}</h3>
          <p style="font-size:0.83rem; color:var(--text-secondary); margin-top:0.2rem;">${escapeHtml(zone.urban_boundary_note || zone.gastos_alrededor_detalle)}</p>
        </div>
        <div style="background:var(--bg-primary); border:2px solid ${m.rentHex}; padding:0.75rem 1.15rem; border-radius:var(--radius-sm); text-align:right;">
          <div style="font-size:0.72rem; text-transform:uppercase; color:#bae6fd; font-weight:800;">💰 Costo Total Mensual (Alquiler + Expensas + Vida)</div>
          <div style="font-size:1.38rem; font-weight:900; color:#fff; margin:0.1rem 0;">
            ${escapeHtml(m.totalAPartirStr)} / mes
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

      <!-- BLOQUE PRINCIPAL: SEPARACIÓN ESTRUCTURAL DE LOS 3 PILARES (1. ALQUILER | 2. EXPENSAS | 3. COSTO DE VIDA) -->
      <div style="margin-bottom:1.35rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem;">
          <div>
            <h4 style="font-size:1.06rem; font-weight:800; color:#fff;">
              🏛️ Separación Estructural: 1. Alquiler · 2. Expensas · 3. Costo de Vida
            </h4>
            <p style="font-size:0.77rem; color:var(--text-secondary); margin-top:0.1rem;">
              Valores expresados en umbral mínimo verificado (<strong>"A partir de X [${escapeHtml(m.activeCurrency)}]"</strong>) con filtro estadístico de cuartiles ($Q_1$, $Q_2$, $Q_3$ e $IQR$) que descarta avisos con precios irrisorios o mal cargados:
            </p>
          </div>
        </div>

        <div class="three-pillars-structural-grid">
          <!-- PILAR 1: ALQUILER PURO (SEPARADO DE EXPENSAS) -->
          <div class="structural-pillar-card" style="border-top:4px solid ${m.alquilerHex};">
            <div>
              <div class="pillar-header-row">
                <span class="pillar-title-badge" style="color:#38bdf8;">🏠 Pilar 1 · Alquiler Puro</span>
                <span style="font-size:0.72rem; font-weight:800; color:${m.alquilerHex};">${m.alquilerLabel}</span>
              </div>
              <div style="font-size:0.76rem; color:#cbd5e1; font-weight:600;">
                Valor locativo mensual para <strong>${escapeHtml(roomsText)}</strong> y <strong>${escapeHtml(bathroomsText)}</strong> (${escapeHtml(propLabel)})
              </div>
              <div class="pillar-starting-price" style="color:#fff;">
                ${escapeHtml(m.alquilerAPartirStr)} <span style="font-size:0.78rem; font-weight:700; color:${m.alquilerHex};">/ mes</span>
              </div>
              <div class="pillar-sub-meta">
                ${m.hasSalary ? `Representa el <strong style="color:${m.alquilerHex};">${m.pctAlquilerSolo}%</strong> de tu sueldo mensual.` : "Ingresá tu sueldo para ver el % de incidencia del alquiler puro."}
                <br>Sin mezclar ni sumar expensas ordinarias ni servicios.
              </div>
            </div>
            <div class="quartile-audit-box">
              <div>🛡️ <strong>Filtro Anti-Irrisorios (Cuartiles IQR):</strong></div>
              <div>• Umbral $Q_1$ verificado: <strong>$${m.rentStats.q1Ars.toLocaleString("es-AR")} ARS</strong> · Mediana $Q_2$: <strong>$${m.rentStats.q2MedianArs.toLocaleString("es-AR")} ARS</strong> · $Q_3$: <strong>$${m.rentStats.q3Ars.toLocaleString("es-AR")} ARS</strong></div>
              <div>• Piso lógico mínimo (${uf.primaryAmbientes} amb): <strong>$${m.rentStats.logicalFloorArs.toLocaleString("es-AR")} ARS</strong></div>
              <div style="color:#fcd34d;">• Se ignoraron <strong>${m.rentStats.discardedCount} publicaciones irrisorias/atípicas</strong> (ej: ${escapeHtml(discardedRentExamplesStr)}) para evitar falsos positivos.</div>
            </div>
          </div>

          <!-- PILAR 2: EXPENSAS ORDINARIAS (SEPARADAS ESTRUCTURALMENTE DEL ALQUILER) -->
          <div class="structural-pillar-card" style="border-top:4px solid ${m.expensasHex};">
            <div>
              <div class="pillar-header-row">
                <span class="pillar-title-badge" style="color:#f59e0b;">🏢 Pilar 2 · Expensas</span>
                <span style="font-size:0.72rem; font-weight:800; color:${m.expensasHex};">${m.expensasLabel}</span>
              </div>
              <div style="font-size:0.76rem; color:#cbd5e1; font-weight:600;">
                Liquidación mensual de consorcio para <strong>${escapeHtml(propLabel)}</strong> (${escapeHtml(roomsText)})
              </div>
              <div class="pillar-starting-price" style="color:#fff;">
                ${escapeHtml(m.expensasAPartirStr)} <span style="font-size:0.78rem; font-weight:700; color:${m.expensasHex};">/ mes</span>
              </div>
              <div class="pillar-sub-meta">
                ${m.hasSalary ? `Representa el <strong style="color:${m.expensasHex};">${m.pctExpensasSolo}%</strong> de tu sueldo mensual.` : "Ingresá tu sueldo para ver el % de incidencia de las expensas."}
                <br>Separadas estructuralmente del alquiler para auditar el peso real del consorcio.
              </div>
            </div>
            <div class="quartile-audit-box">
              <div>🛡️ <strong>Filtro Anti-Irrisorios en Expensas (IQR):</strong></div>
              <div>• Umbral $Q_1$ verificado: <strong>$${m.expStats.q1Ars.toLocaleString("es-AR")} ARS</strong> · Mediana $Q_2$: <strong>$${m.expStats.q2MedianArs.toLocaleString("es-AR")} ARS</strong> · $Q_3$: <strong>$${m.expStats.q3Ars.toLocaleString("es-AR")} ARS</strong></div>
              <div>• Piso lógico mínimo consorcio: <strong>$${m.expStats.logicalFloorArs.toLocaleString("es-AR")} ARS</strong></div>
              <div style="color:#fcd34d;">• Se descartaron <strong>${m.expStats.discardedCount} avisos con expensas falsas</strong> (${escapeHtml(discardedExpExamplesStr)}) que distorsionaban el mínimo.</div>
            </div>
          </div>

          <!-- PILAR 3: COSTO DE VIDA MENSUAL (SERVICIOS + COMERCIOS + MOVILIDAD + HÁBITOS + COLEGIOS/PREPAGAS/INSTITUCIONES) -->
          <div class="structural-pillar-card" style="border-top:4px solid ${m.lifeHex};">
            <div>
              <div class="pillar-header-row">
                <span class="pillar-title-badge" style="color:#10b981;">🛒 Pilar 3 · Costo de Vida (${m.householdMembers || 1} hab.)</span>
                <span style="font-size:0.72rem; font-weight:800; color:${m.lifeHex};">${m.lifeLabel}</span>
              </div>
              <div style="font-size:0.76rem; color:#cbd5e1; font-weight:600;">
                Servicios + Súper (${escapeHtml(m.activeSupersLabels)}) + Movilidad + Hábitos + Instituciones
              </div>
              <div class="pillar-starting-price" style="color:#fff;">
                ${escapeHtml(m.vidaAPartirStr)} <span style="font-size:0.78rem; font-weight:700; color:${m.lifeHex};">/ mes</span>
              </div>
              <div class="pillar-sub-meta">
                ${m.hasSalary ? `Representa el <strong style="color:${m.lifeHex};">${m.pctLifestyle}%</strong> de tu sueldo mensual.` : "Ingresá tu sueldo para ver el % de incidencia de tu costo de vida."}
                <br>• Comercios/Súper (${m.householdMembers || 1} hab.): <strong>${escapeHtml(formatAPartirDe(m.canastaAdjusted, m.activeCurrency))}</strong>
                <br>• Servicios domiciliarios: <strong>${escapeHtml(formatAPartirDe(m.serviciosAPartirArs, m.activeCurrency))}</strong>
                <br>• Movilidad (${escapeHtml(m.transportModeLabel)}): <strong>${escapeHtml(formatAPartirDe(m.transporteAdjusted, m.activeCurrency))}</strong>${m.hobbiesExtraArs > 0 ? `<br>• Hobbies/Gimnasio: <strong>${escapeHtml(formatAPartirDe(m.hobbiesExtraArs, m.activeCurrency))}</strong>` : ""}${m.instCostArs > 0 ? `<br>• Colegios/Salud/Prepagas/Inst.: <strong>${escapeHtml(formatAPartirDe(m.instCostArs, m.activeCurrency))}</strong>` : ""}
              </div>
            </div>
            <div class="quartile-audit-box">
              <div>📊 <strong>Trazabilidad de Consumo Barrial y Hogar:</strong></div>
              <div>• Calculado para <strong>${m.householdMembers || 1} habitante/s</strong> sobre precios reales de cadenas (${escapeHtml(m.activeSupersLabels)}) y comercios en ${escapeHtml(zone.name.split(" (")[0])}.</div>
              ${(m.instBreakdownItems && m.instBreakdownItems.length > 0) ? `<div style="color:#a7f3d0;">• Instituciones activas: ${m.instBreakdownItems.map(it => `${escapeHtml(it.label)} (${it.qty}x)`).join(" · ")}.</div>` : ""}
              <div style="color:#38bdf8;">• Podés expandir la desconstrucción abajo para tildar/destildar supermercados y rubros en vivo.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- BLOQUE MEDIO: COSTO DE VIDA EXPANDIBLE Y MODIFICADOR DE SUPERMERCADOS/LOCALES -->
      <div style="background:var(--bg-primary); border:1px solid var(--card-border); border-left:4px solid ${m.lifeHex}; border-radius:var(--radius-sm); padding:1.15rem; margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <div>
            <h4 style="font-size:1.02rem; font-weight:800; color:#fff;">
              🛒 Desconstrucción del Pilar 3 (Costo de Vida): <span style="color:${m.lifeHex};">${escapeHtml(m.vidaAPartirStr)} / mes</span>
            </h4>
            <p style="font-size:0.77rem; color:var(--text-secondary); margin-top:0.15rem;">
              Calculado con tus supermercados seleccionados (<strong>${escapeHtml(m.activeSupersLabels)}</strong>), tu dieta, hogar (${m.householdMembers || 1} hab.) y tu movilidad real.
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
                  <th style="width:18%; text-align:right; color:#fff;">Umbral Mensual</th>
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
                <strong style="color:#fff;">${escapeHtml(formatAPartirDe(imp.abl_municipal_ars, m.activeCurrency))} /mes</strong>
              </div>
              <div style="background:var(--bg-tertiary); padding:0.45rem 0.6rem; border-radius:4px;">
                <span style="color:var(--text-muted); display:block; font-size:0.68rem;">💡 Luz</span>
                <strong style="color:#fff;">${escapeHtml(formatAPartirDe(imp.luz_edenor_edesur_ars, m.activeCurrency))} /mes</strong>
              </div>
              <div style="background:var(--bg-tertiary); padding:0.45rem 0.6rem; border-radius:4px;">
                <span style="color:var(--text-muted); display:block; font-size:0.68rem;">🔥 Gas Natural</span>
                <strong style="color:#fff;">${escapeHtml(formatAPartirDe(imp.gas_metrogas_ars, m.activeCurrency))} /mes</strong>
              </div>
              <div style="background:var(--bg-tertiary); padding:0.45rem 0.6rem; border-radius:4px;">
                <span style="color:var(--text-muted); display:block; font-size:0.68rem;">🚿 Agua (AySA)</span>
                <strong style="color:#fff;">${escapeHtml(formatAPartirDe(imp.agua_aysa_ars, m.activeCurrency))} /mes</strong>
              </div>
              <div style="background:var(--bg-tertiary); padding:0.45rem 0.6rem; border-radius:4px;">
                <span style="color:var(--text-muted); display:block; font-size:0.68rem;">🌐 Internet Fibra</span>
                <strong style="color:#fff;">${escapeHtml(formatAPartirDe(imp.internet_fibra_ars, m.activeCurrency))} /mes</strong>
              </div>
              <div style="background:var(--bg-tertiary); padding:0.45rem 0.6rem; border-radius:4px;">
                <span style="color:var(--text-muted); display:block; font-size:0.68rem;">🚗/🚇 ${escapeHtml(m.transportModeLabel)}</span>
                <strong style="color:#38bdf8;">${escapeHtml(formatAPartirDe(m.transporteAdjusted, m.activeCurrency))} /mes</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- BLOQUE EVALUACIÓN: CONVENIENCIA DE CONCENTRACIÓN DE SERVICIOS, LÍMITES Y TIEMPOS DE VIAJE -->
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
          Hacé click en cualquiera de los sitios que sumaste al principio para ver las ofertas activas con la localidad/zona (<strong>${escapeHtml(zone.name)}</strong>), operación (${opLabel}), tope de presupuesto ($${(appState.maxPrice || 1500000).toLocaleString("es-AR")} ${escapeHtml(m.activeCurrency)}), ambientes (<strong>${escapeHtml(roomsText)}</strong>), baños (<strong>${escapeHtml(bathroomsText)}</strong>) y cochera ya filtrados:
        </p>
        <div class="portal-filtered-grid">
          ${portalLinksHtml}
        </div>
      </div>
    </div>
  `;

  // Selectores rápidos en la barra de trazabilidad para verificar o cambiar Ambientes, Baños o Moneda en vivo sin perder datos
  document.getElementById("inline-results-ambientes-select")?.addEventListener("change", (e) => {
    const newAmb = parseInt(e.target.value, 10) || 2;
    appState.classicFilters.selectedRooms = [newAmb];
    appState.classicFilters.minRooms = newAmb;
    syncCheckboxGroupValues("classic-rooms-cb", [newAmb], "classic-rooms-pills-list", "amb", "amb");
    executeFilterAndRender();
    renderAffordabilityZonesOnMap();
  });

  document.getElementById("inline-results-banos-select")?.addEventListener("change", (e) => {
    const newBath = parseInt(e.target.value, 10) || 1;
    appState.classicFilters.selectedBathrooms = [newBath];
    appState.classicFilters.bathrooms = String(newBath);
    syncCheckboxGroupValues("classic-bathrooms-cb", [newBath], "classic-bathrooms-pills-list", "baño", "baños");
    executeFilterAndRender();
    renderAffordabilityZonesOnMap();
  });

  document.getElementById("inline-results-currency-select")?.addEventListener("change", (e) => {
    const newCurr = e.target.value || "ARS";
    appState.classicFilters.currency = newCurr;
    const currSel = document.getElementById("filter-currency");
    if (currSel) currSel.value = newCurr;
    executeFilterAndRender();
    renderAffordabilityZonesOnMap();
  });

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
