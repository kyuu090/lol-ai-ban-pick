// @ts-check

/**
 * @param {any} root
 */
(function attachUiFormatters(root) {
  /**
   * @param {string | number | Date | null | undefined} value
   * @returns {string}
   */
  function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('ja-JP', {
      dateStyle: 'short',
      timeStyle: 'medium'
    }).format(new Date(value));
  }

  /**
   * @param {string | number | Date | null | undefined} value
   * @returns {string | null}
   */
  function formatMatchDataDate(value) {
    if (!value) return null;
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  /**
   * @param {number | string | null | undefined} value
   * @returns {string}
   */
  function formatPercent(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
  }

  /**
   * @param {number | string | null | undefined} value
   * @param {number} [digits]
   * @returns {string}
   */
  function formatNumber(value, digits = 1) {
    return Number(value || 0).toFixed(digits);
  }

  /**
   * @param {{ avgKills?: number, avgDeaths?: number, avgAssists?: number } | null | undefined} stats
   * @returns {string}
   */
  function formatAverageKda(stats) {
    return `${formatNumber(stats?.avgKills)}/${formatNumber(stats?.avgDeaths)}/${formatNumber(stats?.avgAssists)}`;
  }

  const api = {
    formatAverageKda,
    formatDate,
    formatMatchDataDate,
    formatNumber,
    formatPercent
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.UiFormatters = api;
})(/** @type {any} */ (typeof window !== 'undefined' ? window : globalThis));
