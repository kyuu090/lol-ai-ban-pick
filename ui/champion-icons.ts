(function attachUiChampionIcons(root: UiRoot) {
  const DEFAULT_ICON_REQUEST_CONCURRENCY = 4;
  const DEFAULT_CHAMPION_ICON_RETRY_DELAY_MS = 12000;

  function createChampionIconLoader(options: ChampionIconLoaderOptions = {}): ChampionIconLoader {
    const runtimeRoot = options.root || root;
    const cache = options.cache || new Map();
    const queue: Array<{ id: number; resolve: (src: string | null) => void }> = [];
    const requestConcurrency = options.requestConcurrency || DEFAULT_ICON_REQUEST_CONCURRENCY;
    const retryDelayMs = options.retryDelayMs || DEFAULT_CHAMPION_ICON_RETRY_DELAY_MS;
    const getChampionIcon = options.getChampionIcon || ((id: number) => runtimeRoot.lcuApi?.getChampionIcon?.(id));
    const setTimer = options.setTimeout || runtimeRoot.setTimeout?.bind(runtimeRoot) || setTimeout;
    let activeRequests = 0;
    let observer: IntersectionObserver | null = null;

    function loadChampionIcon(img: HTMLImageElement, championId: number | string): void {
      const id = Number(championId);
      if (!id || !runtimeRoot.lcuApi?.getChampionIcon && !options.getChampionIcon) return;

      img.dataset.championId = String(id);

      const cached = cache.get(id);
      if (typeof cached === 'string') {
        setChampionIconSrc(img, id, cached);
        return;
      }

      if (cached === null) return;

      if (cached) {
        attachChampionIcon(img, id, cached);
        return;
      }

      if (observer) {
        observer.observe(img);
        return;
      }

      attachChampionIcon(img, id, enqueueChampionIconRequest(id));
    }

    function loadChampionIconEager(img: HTMLImageElement, championId: number | string): void {
      const id = Number(championId);
      if (!id || !runtimeRoot.lcuApi?.getChampionIcon && !options.getChampionIcon) return;

      img.dataset.championId = String(id);

      const cached = cache.get(id);
      if (typeof cached === 'string') {
        setChampionIconSrc(img, id, cached);
        return;
      }

      if (cached === null) return;

      attachChampionIcon(img, id, cached || enqueueChampionIconRequest(id));
    }

    function handleChampionIconIntersections(entries: IntersectionObserverEntry[]): void {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        observer?.unobserve(entry.target);
        const target = entry.target as HTMLImageElement;
        const id = Number(target.dataset.championId);
        if (!id) return;

        attachChampionIcon(target, id, enqueueChampionIconRequest(id));
      });
    }

    function attachChampionIcon(img: HTMLImageElement, id: number, iconPromise: Promise<string | null>): void {
      iconPromise.then((src) => {
        if (src && img.dataset.championId === String(id)) {
          setChampionIconSrc(img, id, src);
        }
      });
    }

    function setChampionIconSrc(img: HTMLImageElement, id: number, src: string): void {
      img.onerror = () => {
        if (img.dataset.championId !== String(id)) return;

        markChampionIconMissing(id);
        img.removeAttribute('src');
      };
      img.src = src;
    }

    function markChampionIconMissing(id: number): void {
      cache.set(id, null);
      setTimer(() => {
        if (cache.get(id) === null) {
          cache.delete(id);
        }
      }, retryDelayMs);
    }

    function enqueueChampionIconRequest(id: number): Promise<string | null> {
      const cached = cache.get(id);
      if (cached) return cached;
      if (cached === null) return Promise.resolve(null);

      let resolveRequest: (src: string | null) => void = () => {};
      const iconPromise = new Promise<string | null>((resolve) => {
        resolveRequest = resolve;
      });

      cache.set(id, iconPromise);
      queue.push({ id, resolve: resolveRequest });
      processChampionIconQueue();

      return iconPromise;
    }

    function processChampionIconQueue(): void {
      while (activeRequests < requestConcurrency && queue.length > 0) {
        const request = queue.shift();
        if (!request) return;
        const { id, resolve } = request;
        activeRequests += 1;

        Promise.resolve(getChampionIcon(id))
          .then((src) => {
            if (src) {
              cache.set(id, src);
            } else {
              markChampionIconMissing(id);
            }
            resolve(src || null);
          })
          .catch(() => {
            markChampionIconMissing(id);
            resolve(null);
          })
          .finally(() => {
            activeRequests -= 1;
            processChampionIconQueue();
          });
      }
    }

    if (typeof runtimeRoot.IntersectionObserver === 'function') {
      observer = new runtimeRoot.IntersectionObserver(handleChampionIconIntersections, { rootMargin: '180px' });
    }

    return {
      loadChampionIcon,
      loadChampionIconEager
    };
  }

  const api = { createChampionIconLoader } as ChampionIconLoader & { createChampionIconLoader(options?: ChampionIconLoaderOptions): ChampionIconLoader };
  Object.assign(api, createChampionIconLoader());

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.UiChampionIcons = api;
})(typeof window !== 'undefined' ? window : globalThis);
