const state = {
  screens: [],
  activeScreenId: null,
  selectedTemplate: "popup",
  versions: loadJson("pretotyping.versions", []),
  metadataOverrides: loadJson("pretotyping.metadata", {})
};

const els = {
  screenList: document.querySelector("#screenList"),
  screenCount: document.querySelector("#screenCount"),
  activeScreenName: document.querySelector("#activeScreenName"),
  activeImage: document.querySelector("#activeImage"),
  phoneScroll: document.querySelector("#phoneScroll"),
  prototypeOverlay: document.querySelector("#prototypeOverlay"),
  screenKind: document.querySelector("#screenKind"),
  screenNameInput: document.querySelector("#screenNameInput"),
  screenSummaryInput: document.querySelector("#screenSummaryInput"),
  screenAreasInput: document.querySelector("#screenAreasInput"),
  screenStatesInput: document.querySelector("#screenStatesInput"),
  applyMetadata: document.querySelector("#applyMetadata"),
  commandInput: document.querySelector("#commandInput"),
  generatePrototype: document.querySelector("#generatePrototype"),
  saveVersion: document.querySelector("#saveVersion"),
  versionList: document.querySelector("#versionList"),
  versionCount: document.querySelector("#versionCount"),
  toggleInspect: document.querySelector("#toggleInspect"),
  inspectorPanel: document.querySelector("#inspectorPanel")
};

init();

async function init() {
  const response = await fetch("/data/screens.json");
  const data = await response.json();
  state.screens = data.screens.map((screen) => ({
    ...screen,
    ...(state.metadataOverrides[screen.id] || {})
  }));
  state.activeScreenId = state.screens[0]?.id;
  bindEvents();
  render();
}

function bindEvents() {
  els.screenList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-screen-id]");
    if (!button) return;
    state.activeScreenId = button.dataset.screenId;
    clearPrototype();
    render();
  });

  document.querySelectorAll(".segmented button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTemplate = button.dataset.template;
      document.querySelectorAll(".segmented button").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
    });
  });

  els.applyMetadata.addEventListener("click", () => {
    const screen = activeScreen();
    const updated = {
      name: els.screenNameInput.value.trim(),
      summary: els.screenSummaryInput.value.trim(),
      areas: splitList(els.screenAreasInput.value),
      states: splitList(els.screenStatesInput.value)
    };
    Object.assign(screen, updated);
    state.metadataOverrides[screen.id] = updated;
    saveJson("pretotyping.metadata", state.metadataOverrides);
    render();
  });

  els.generatePrototype.addEventListener("click", () => {
    renderPrototype(createPrototype(activeScreen(), els.commandInput.value, state.selectedTemplate));
  });

  els.saveVersion.addEventListener("click", () => {
    const prototype = createPrototype(activeScreen(), els.commandInput.value, state.selectedTemplate);
    state.versions.unshift({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      screenId: state.activeScreenId,
      screenName: activeScreen().name,
      command: els.commandInput.value.trim(),
      template: state.selectedTemplate,
      prototype
    });
    state.versions = state.versions.slice(0, 20);
    saveJson("pretotyping.versions", state.versions);
    renderPrototype(prototype);
    renderVersions();
  });

  els.versionList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-version-id]");
    if (!button) return;
    const version = state.versions.find((item) => item.id === button.dataset.versionId);
    if (!version) return;
    state.activeScreenId = version.screenId;
    els.commandInput.value = version.command;
    render();
    renderPrototype(version.prototype);
  });

  els.toggleInspect.addEventListener("click", () => {
    els.inspectorPanel.classList.toggle("is-collapsed");
  });
}

function render() {
  renderScreens();
  renderActiveScreen();
  renderVersions();
}

function renderScreens() {
  els.screenCount.textContent = `${state.screens.length} screens`;
  els.screenList.innerHTML = state.screens
    .map((screen) => {
      const active = screen.id === state.activeScreenId ? "is-active" : "";
      return `
        <button class="screen-item ${active}" data-screen-id="${screen.id}">
          <img src="${screen.image}" alt="" loading="lazy" />
          <span>
            <strong>${escapeHtml(screen.name)}</strong>
            <small>${escapeHtml(screen.kind)} · ${screen.viewport.width}x${screen.viewport.height}</small>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderActiveScreen() {
  const screen = activeScreen();
  if (!screen) return;
  els.activeScreenName.textContent = screen.name;
  els.activeImage.src = screen.image;
  els.screenKind.textContent = screen.kind;
  els.screenNameInput.value = screen.name;
  els.screenSummaryInput.value = screen.summary;
  els.screenAreasInput.value = screen.areas.join(", ");
  els.screenStatesInput.value = screen.states.join(", ");
  els.phoneScroll.scrollTo({ top: 0, behavior: "instant" });
}

function renderVersions() {
  els.versionCount.textContent = String(state.versions.length);
  if (!state.versions.length) {
    els.versionList.innerHTML = `<p class="empty">아직 저장된 프로토타입 버전이 없습니다.</p>`;
    return;
  }

  els.versionList.innerHTML = state.versions
    .map((version) => {
      const date = new Intl.DateTimeFormat("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(version.createdAt));
      return `
        <button class="version-item" data-version-id="${version.id}">
          <strong>${escapeHtml(version.screenName)}</strong>
          <span>${escapeHtml(version.template)} · ${date}</span>
          <small>${escapeHtml(version.command)}</small>
        </button>
      `;
    })
    .join("");
}

function createPrototype(screen, command, template) {
  const intent = inferIntent(command);
  return {
    screenId: screen.id,
    template,
    title: intent.title,
    body: intent.body,
    primaryAction: intent.primaryAction,
    secondaryAction: intent.secondaryAction,
    completion: intent.completion
  };
}

function inferIntent(command) {
  const normalized = command.trim() || "새 프로토타입을 만들어줘.";
  const hasBenefit = /혜택|benefit|리워드|보상/.test(normalized);
  const hasComplete = /완료|성공|토스트|done|success/.test(normalized);
  const hasWarning = /주의|경고|위험|사기/.test(normalized);

  return {
    title: hasWarning ? "확인하고 진행하세요" : hasBenefit ? "지금 받을 수 있는 혜택" : "프로토타입 변경안",
    body: summarizeCommand(normalized),
    primaryAction: hasComplete ? "확인하고 완료" : "확인",
    secondaryAction: "닫기",
    completion: hasComplete ? "요청한 완료 상태가 표시되었습니다." : "인터랙션이 실행되었습니다."
  };
}

function renderPrototype(prototype) {
  clearPrototype();
  els.prototypeOverlay.innerHTML = templateMarkup(prototype);
  els.prototypeOverlay.classList.add("is-visible");

  const close = () => clearPrototype();
  els.prototypeOverlay.querySelector("[data-close]")?.addEventListener("click", close);
  els.prototypeOverlay.querySelector("[data-primary]")?.addEventListener("click", () => {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = prototype.completion;
    els.prototypeOverlay.append(toast);
    setTimeout(() => toast.remove(), 2400);
  });
}

function templateMarkup(prototype) {
  if (prototype.template === "bottomSheet") {
    return `
      <div class="dim"></div>
      <section class="bottom-sheet">
        <div class="grabber"></div>
        <h3>${escapeHtml(prototype.title)}</h3>
        <p>${escapeHtml(prototype.body)}</p>
        <div class="action-row">
          <button data-close>${escapeHtml(prototype.secondaryAction)}</button>
          <button class="primary-button" data-primary>${escapeHtml(prototype.primaryAction)}</button>
        </div>
      </section>
    `;
  }

  if (prototype.template === "route") {
    return `
      <section class="route-preview">
        <p class="eyebrow">Generated screen</p>
        <h3>${escapeHtml(prototype.title)}</h3>
        <p>${escapeHtml(prototype.body)}</p>
        <button class="primary-button" data-primary>${escapeHtml(prototype.primaryAction)}</button>
        <button data-close>원본 화면으로 돌아가기</button>
      </section>
    `;
  }

  return `
    <div class="dim"></div>
    <section class="modal">
      <button class="modal-close" data-close title="닫기">×</button>
      <h3>${escapeHtml(prototype.title)}</h3>
      <p>${escapeHtml(prototype.body)}</p>
      <div class="action-row">
        <button data-close>${escapeHtml(prototype.secondaryAction)}</button>
        <button class="primary-button" data-primary>${escapeHtml(prototype.primaryAction)}</button>
      </div>
    </section>
  `;
}

function clearPrototype() {
  els.prototypeOverlay.classList.remove("is-visible");
  els.prototypeOverlay.innerHTML = "";
}

function activeScreen() {
  return state.screens.find((screen) => screen.id === state.activeScreenId);
}

function summarizeCommand(command) {
  if (command.length <= 92) return command;
  return `${command.slice(0, 90)}...`;
}

function splitList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
