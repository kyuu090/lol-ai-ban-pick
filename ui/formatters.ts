type DateInput = string | number | Date | null | undefined;
type NumberInput = number | string | null | undefined;
type AverageKdaStats = {
  avgKills?: number;
  avgDeaths?: number;
  avgAssists?: number;
};

(function attachUiFormatters(root: any) {
  function formatDate(value: DateInput): string {
    if (!value) return '-';
    return new Intl.DateTimeFormat('ja-JP', {
      dateStyle: 'short',
      timeStyle: 'medium'
    }).format(new Date(value));
  }

  function formatMatchDataDate(value: DateInput): string | null {
    if (!value) return null;
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  function formatPercent(value: NumberInput): string {
    return `${Math.round(Number(value || 0) * 100)}%`;
  }

  function formatNumber(value: NumberInput, digits = 1): string {
    return Number(value || 0).toFixed(digits);
  }

  function formatAverageKda(stats: AverageKdaStats | null | undefined): string {
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
})(typeof window !== 'undefined' ? window : globalThis);
