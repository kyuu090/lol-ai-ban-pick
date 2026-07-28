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
    if (normalizedThemeMode === 'light') return root.UiI18n!.translate('settings.theme.light');
    if (normalizedThemeMode === 'dark') return root.UiI18n!.translate('settings.theme.dark');
    return root.UiI18n!.translate('settings.theme.systemHelp');
  }

  function renderSettings(settings: any, deps: SettingsViewDeps = {}): void {
    if (!settings) return;

    const doc = (deps.document || root.document) as Document;
    const elements = (deps.elements || root.UiDomElements?.elements) as UiDomElements;
    root.UiI18n!.setLanguage(settings.language, doc);
    const themeMode = normalizeThemeMode(settings.themeMode);
    applyThemeMode(themeMode, doc);

    if (settings.lolInstallDir && doc.activeElement !== elements.lolInstallDirInput) {
      elements.lolInstallDirInput.value = settings.lolInstallDir;
    }

    if (doc.activeElement !== elements.themeModeSelect) {
      elements.themeModeSelect.value = themeMode;
    }
    if (doc.activeElement !== elements.languageSelect) {
      elements.languageSelect.value = root.UiI18n!.normalizeLanguage(settings.language);
    }
    elements.themeModeStatus.textContent = describeThemeMode(themeMode);
    elements.riotRegionalRouteStatus.textContent = settings.detectedRiotPlatformRegion && settings.detectedRiotRegionalRoute
      ? root.UiI18n!.translate('settings.detectedRoute', { platformRegion: settings.detectedRiotPlatformRegion, regionalRoute: settings.detectedRiotRegionalRoute })
      : root.UiI18n!.translate('settings.waitingForRoute');
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
