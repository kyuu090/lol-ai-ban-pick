(function attachUiSettingsView(root) {
  function normalizeThemeMode(themeMode) {
    return ['system', 'light', 'dark'].includes(themeMode) ? themeMode : 'system';
  }

  function applyThemeMode(themeMode, doc = root.document) {
    const normalizedThemeMode = normalizeThemeMode(themeMode);
    if (normalizedThemeMode === 'system') {
      doc.documentElement.removeAttribute('data-theme');
      return;
    }

    doc.documentElement.dataset.theme = normalizedThemeMode;
  }

  function describeThemeMode(themeMode) {
    const normalizedThemeMode = normalizeThemeMode(themeMode);
    if (normalizedThemeMode === 'light') return 'ライトモードを使用します。';
    if (normalizedThemeMode === 'dark') return 'ダークモードを使用します。';
    return 'OSの表示モードに合わせます。';
  }

  function renderSettings(settings, deps = {}) {
    if (!settings) return;

    const doc = deps.document || root.document;
    const elements = deps.elements || root.UiDomElements?.elements;
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

  function renderRiotPlatformRegions(settings, deps = {}) {
    const doc = deps.document || root.document;
    const elements = deps.elements || root.UiDomElements?.elements;
    const regions = Array.isArray(settings.riotPlatformRegions) ? settings.riotPlatformRegions : [];
    const selectedRegion = settings.riotPlatformRegion || 'JP1';

    if (elements.riotPlatformRegionSelect.childElementCount === 0 && regions.length > 0) {
      elements.riotPlatformRegionSelect.replaceChildren(...regions.map((region) => {
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
