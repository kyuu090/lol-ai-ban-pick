(function attachUiSettingsView(root: UiRoot) {
  function normalizeThemeMode(themeMode: unknown): 'system' | 'light' | 'dark' {
    return themeMode === 'light' || themeMode === 'dark' || themeMode === 'system' ? themeMode : 'system';
  }

  function applyThemeMode(themeMode: unknown, doc: Document = root.document as Document): void {
    const normalizedThemeMode = normalizeThemeMode(themeMode);
    if (normalizedThemeMode === 'system') {
      doc.documentElement.removeAttribute('data-theme');
      return;
    }

    doc.documentElement.dataset.theme = normalizedThemeMode;
  }

  function describeThemeMode(themeMode: unknown): string {
    const normalizedThemeMode = normalizeThemeMode(themeMode);
    if (normalizedThemeMode === 'light') return 'ライトモードを使用します。';
    if (normalizedThemeMode === 'dark') return 'ダークモードを使用します。';
    return 'OSの表示モードに合わせます。';
  }

  function renderSettings(settings: any, deps: SettingsViewDeps = {}): void {
    if (!settings) return;

    const doc = (deps.document || root.document) as Document;
    const elements = (deps.elements || root.UiDomElements?.elements) as UiDomElements;
    const themeMode = normalizeThemeMode(settings.themeMode);
    applyThemeMode(themeMode, doc);

    if (settings.lolInstallDir && doc.activeElement !== elements.lolInstallDirInput) {
      elements.lolInstallDirInput.value = settings.lolInstallDir;
    }

    if (doc.activeElement !== elements.themeModeSelect) {
      elements.themeModeSelect.value = themeMode;
    }
    elements.themeModeStatus.textContent = describeThemeMode(themeMode);
    elements.riotRegionalRouteStatus.textContent = settings.detectedRiotPlatformRegion && settings.detectedRiotRegionalRoute
      ? `LCUから自動検出したサーバ: ${settings.detectedRiotPlatformRegion} / Match-V5 route: ${settings.detectedRiotRegionalRoute}`
      : 'LoLログイン後に LCU から自動検出します。';
  }

  function renderRiotPlatformRegions(settings: any, deps: SettingsViewDeps = {}): void {
    const doc = (deps.document || root.document) as Document;
    const elements = (deps.elements || root.UiDomElements?.elements) as UiDomElements;
    void settings;
    void doc;
    void elements;
  }

  const api = {
    applyThemeMode,
    describeThemeMode,
    normalizeThemeMode,
    renderRiotPlatformRegions,
    renderSettings
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.UiSettingsView = api;
})(typeof window !== 'undefined' ? window : globalThis);
