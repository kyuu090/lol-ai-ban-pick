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

    renderRiotPlatformRegions(settings, { document: doc, elements });
    if (doc.activeElement !== elements.themeModeSelect) {
      elements.themeModeSelect.value = themeMode;
    }
    elements.themeModeStatus.textContent = describeThemeMode(themeMode);
    elements.riotRegionalRouteStatus.textContent = `ログイン先サーバ: ${settings.riotPlatformRegion || 'JP1'} / Match-V5 route: ${settings.riotRegionalRoute || 'ASIA'}`;
  }

  function renderRiotPlatformRegions(settings: any, deps: SettingsViewDeps = {}): void {
    const doc = (deps.document || root.document) as Document;
    const elements = (deps.elements || root.UiDomElements?.elements) as UiDomElements;
    const regions = Array.isArray(settings.riotPlatformRegions) ? settings.riotPlatformRegions : [];
    const selectedRegion = settings.riotPlatformRegion || 'JP1';

    if (elements.riotPlatformRegionSelect.childElementCount === 0 && regions.length > 0) {
      elements.riotPlatformRegionSelect.replaceChildren(...regions.map((region: string) => {
        const option = doc.createElement('option');
        option.value = region;
        option.textContent = region;
        return option;
      }));
    }

    if (doc.activeElement !== elements.riotPlatformRegionSelect) {
      elements.riotPlatformRegionSelect.value = selectedRegion;
    }
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
