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
  generateVariations: document.querySelector("#generateVariations"),
  saveVersion: document.querySelector("#saveVersion"),
  versionList: document.querySelector("#versionList"),
  versionCount: document.querySelector("#versionCount"),
  toggleInspect: document.querySelector("#toggleInspect"),
  inspectorPanel: document.querySelector("#inspectorPanel"),
  variationDrawer: document.querySelector("#variationDrawer"),
  variationGrid: document.querySelector("#variationGrid"),
  closeVariations: document.querySelector("#closeVariations")
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

  els.generateVariations.addEventListener("click", () => {
    renderVariations(createVariationSet(activeScreen(), els.commandInput.value));
  });

  els.closeVariations.addEventListener("click", () => {
    els.variationDrawer.classList.remove("is-open");
    els.variationDrawer.setAttribute("aria-hidden", "true");
  });

  els.variationGrid.addEventListener("click", (event) => {
    const action = event.target.closest("[data-variation-action]");
    if (!action) return;
    const card = event.target.closest("[data-variation-id]");
    const variation = JSON.parse(decodeURIComponent(card.dataset.variation));

    if (action.dataset.variationAction === "try") {
      state.activeScreenId = variation.screenId;
      render();
      renderPrototype(variation.prototype);
      els.variationDrawer.classList.remove("is-open");
      els.variationDrawer.setAttribute("aria-hidden", "true");
    }

    if (action.dataset.variationAction === "save") {
      saveVariationVersion(variation);
      renderVersions();
    }
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

function createVariationSet(screen, command) {
  const intent = inferIntent(command);
  const base = {
    screenId: screen.id,
    command: command.trim(),
    screenImage: screen.image,
    screenName: screen.name
  };

  return [
    {
      ...base,
      id: "sentence",
      label: "문장",
      principle: "기존 레이아웃을 가장 적게 건드리고 문장형 근거를 추가합니다.",
      density: "낮음",
      prototype: {
        screenId: screen.id,
        template: "popup",
        title: intent.title,
        body: `${intent.body} 핵심 근거를 한 줄 설명으로 먼저 보여줍니다.`,
        primaryAction: intent.primaryAction,
        secondaryAction: intent.secondaryAction,
        completion: "문장형 초안 인터랙션이 실행되었습니다."
      }
    },
    {
      ...base,
      id: "chip",
      label: "CHIP",
      principle: "판단 근거를 작고 빠르게 스캔 가능한 칩으로 분해합니다.",
      density: "중간",
      prototype: {
        screenId: screen.id,
        template: "chip",
        title: intent.title,
        body: intent.body,
        primaryAction: "칩 눌러보기",
        secondaryAction: "닫기",
        completion: "선택한 칩의 상세 근거를 열었습니다."
      }
    },
    {
      ...base,
      id: "flow",
      label: "FLOW",
      principle: "사용자가 왜 이 정보를 봐야 하는지 순서와 맥락을 만듭니다.",
      density: "높음",
      prototype: {
        screenId: screen.id,
        template: "flow",
        title: intent.title,
        body: intent.body,
        primaryAction: "다음 단계",
        secondaryAction: "닫기",
        completion: "다음 흐름으로 이동했습니다."
      }
    },
    {
      ...base,
      id: "four-line",
      label: "4안",
      principle: "과감하게 줄이고, 핵심 정보와 CTA만 남긴 극단적 안입니다.",
      density: "매우 낮음",
      prototype: {
        screenId: screen.id,
        template: "minimal",
        title: intent.title,
        body: intent.body,
        primaryAction: intent.primaryAction,
        secondaryAction: "닫기",
        completion: "최소 정보 초안이 실행되었습니다."
      }
    }
  ];
}

function renderVariations(variations) {
  els.variationGrid.innerHTML = variations
    .map((variation) => {
      const encoded = encodeURIComponent(JSON.stringify(variation));
      return `
        <article class="variation-card" data-variation-id="${variation.id}" data-variation="${encoded}">
          <div class="variation-phone">
            <img src="${variation.screenImage}" alt="" />
            ${variationPreviewMarkup(variation)}
          </div>
          <div class="variation-copy">
            <h3>${escapeHtml(variation.label)}</h3>
            <p>${escapeHtml(variation.principle)}</p>
            <span>정보 밀도: ${escapeHtml(variation.density)}</span>
            <div class="action-row">
              <button data-variation-action="try">테스트</button>
              <button class="primary-button" data-variation-action="save">저장</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
  els.variationDrawer.classList.add("is-open");
  els.variationDrawer.setAttribute("aria-hidden", "false");
}

function saveVariationVersion(variation) {
  state.versions.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    screenId: variation.screenId,
    screenName: `${variation.screenName} · ${variation.label}`,
    command: variation.command,
    template: variation.prototype.template,
    prototype: variation.prototype
  });
  state.versions = state.versions.slice(0, 20);
  saveJson("pretotyping.versions", state.versions);
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
  if (prototype.template === "chip") {
    return `
      <div class="dim"></div>
      <section class="chip-layer">
        <button class="modal-close" data-close title="닫기">×</button>
        <h3>${escapeHtml(prototype.title)}</h3>
        <div class="chip-cloud">
          <button data-primary>매출 증가</button>
          <button data-primary>기관 순매수</button>
          <button data-primary>목표가 상향</button>
          <button data-primary>커뮤니티 TOP 30</button>
          <button data-primary>리포트 발행</button>
        </div>
      </section>
    `;
  }

  if (prototype.template === "flow") {
    return `
      <div class="dim"></div>
      <section class="flow-layer">
        <button class="modal-close" data-close title="닫기">×</button>
        <h3>${escapeHtml(prototype.title)}</h3>
        <ol>
          <li>가격 변화 감지</li>
          <li>뉴스와 수급 근거 확인</li>
          <li>차트와 주문 CTA 연결</li>
        </ol>
        <button class="primary-button" data-primary>${escapeHtml(prototype.primaryAction)}</button>
      </section>
    `;
  }

  if (prototype.template === "minimal") {
    return `
      <section class="minimal-layer">
        <h3>${escapeHtml(prototype.title)}</h3>
        <p>${escapeHtml(prototype.body)}</p>
        <div class="action-row">
          <button class="danger" data-primary>매수</button>
          <button class="blue" data-close>매도</button>
        </div>
      </section>
    `;
  }

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

function variationPreviewMarkup(variation) {
  if (variation.id === "sentence") {
    return `
      <div class="mini-overlay sentence">
        <span>호재</span>
        <p>매출과 수급 근거를 한 줄로 요약</p>
      </div>
    `;
  }

  if (variation.id === "chip") {
    return `
      <div class="mini-overlay chip">
        <span>NH평단가 34,800</span>
        <span>외인 순매수</span>
        <span>목표가 상향</span>
      </div>
    `;
  }

  if (variation.id === "flow") {
    return `
      <div class="mini-overlay flow">
        <span>초반 급락세</span>
        <span>인 순매수</span>
        <span>R&D 투자</span>
        <span>기관 순매도</span>
      </div>
    `;
  }

  return `
    <div class="mini-overlay minimal">
      <div></div>
      <strong>매수</strong>
      <strong>매도</strong>
    </div>
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
