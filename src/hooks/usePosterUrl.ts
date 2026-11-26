import { useEffect, useState } from 'react';
import type { Movie } from '../types/movie';

const clientPosterCache = new Map<string, string | null>();
const inflightRequests = new Map<string, Promise<string | null>>();
const decodedImageUrls = new Set<string>();
const warmingImageUrls = new Set<string>();

export function isPosterImageDecoded(url: string | null): boolean {
  return Boolean(url && decodedImageUrls.has(url));
}

export function markPosterImageDecoded(url: string): void {
  decodedImageUrls.add(url);
}

export function unmarkPosterImageDecoded(url: string): void {
  decodedImageUrls.delete(url);
}

function warmImageInBrowserCache(url: string): void {
  if (
    typeof window === 'undefined' ||
    typeof Image === 'undefined' ||
    decodedImageUrls.has(url) ||
    warmingImageUrls.has(url)
  ) {
    return;
  }
  warmingImageUrls.add(url);
  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  img.onload = () => {
    warmingImageUrls.delete(url);
    if (img.naturalWidth > 0) {
      decodedImageUrls.add(url);
    }
  };
  img.onerror = () => {
    warmingImageUrls.delete(url);
  };
  img.src = url;
}

const MAX_CONCURRENT_POSTERS = 6;
let activePosterFetches = 0;
const posterTaskQueue: Array<() => void> = [];

function enqueuePosterFetch<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activePosterFetches += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activePosterFetches -= 1;
          const next = posterTaskQueue.shift();
          if (next) next();
        });
    };

    if (activePosterFetches < MAX_CONCURRENT_POSTERS) {
      run();
    } else {
      posterTaskQueue.push(run);
    }
  });
}

function getCacheKey(
  movie: Pick<Movie, 'originalTitle' | 'searchTitle' | 'title' | 'year' | 'director'>,
): string {
  return `${movie.searchTitle || movie.originalTitle || movie.title}::${movie.year}::${movie.director || ''}`;
}

export function prefetchPoster(
  movie: Pick<Movie, 'originalTitle' | 'searchTitle' | 'title' | 'year' | 'director' | 'posterUrl'>,
): void {
  if (movie.posterUrl) {
    warmImageInBrowserCache(movie.posterUrl);
    return;
  }
  const key = getCacheKey(movie);
  if (clientPosterCache.has(key)) {
    const cachedUrl = clientPosterCache.get(key);
    if (cachedUrl) warmImageInBrowserCache(cachedUrl);
    return;
  }
  if (inflightRequests.has(key)) return;

  const params = new URLSearchParams({
    title: movie.title,
    originalTitle: movie.originalTitle,
    year: String(movie.year),
  });
  if (movie.searchTitle) {
    params.set('searchTitle', movie.searchTitle);
  }
  if (movie.director) {
    params.set('director', movie.director);
  }

  const promise = enqueuePosterFetch(async () => {
    try {
      const res = await fetch(`/api/poster?${params.toString()}`);
      if (!res.ok) {
        return { ok: false, url: null as string | null };
      }
      const data = (await res.json()) as { posterUrl?: string | null };
      const url =
        typeof data.posterUrl === 'string' && data.posterUrl.startsWith('/api/poster-image')
          ? data.posterUrl
          : null;
      return { ok: true, url };
    } catch {
      return { ok: false, url: null as string | null };
    }
  }).then(({ ok, url }) => {
    // Only cache definitive HTTP 200 responses so transient failures can retry cleanly
    if (ok) {
      clientPosterCache.set(key, url);
      if (url) {
        warmImageInBrowserCache(url);
      }
    }
    inflightRequests.delete(key);
    return url;
  });

  inflightRequests.set(key, promise);
}

export function usePosterUrl(
  movie: Pick<Movie, 'originalTitle' | 'searchTitle' | 'title' | 'year' | 'director' | 'posterUrl'>,
): { url: string | null; isLoading: boolean } {
  const key = getCacheKey(movie);
  const hasSyncResult = Boolean(movie.posterUrl) || clientPosterCache.has(key);
  const syncUrl = movie.posterUrl ?? (clientPosterCache.has(key) ? (clientPosterCache.get(key) ?? null) : null);

  const [asyncState, setAsyncState] = useState<{
    key: string;
    url: string | null;
    isLoading: boolean;
  }>(() => ({
    key,
    url: syncUrl,
    isLoading: !hasSyncResult,
  }));

  useEffect(() => {
    if (movie.posterUrl) {
      warmImageInBrowserCache(movie.posterUrl);
      return;
    }

    if (clientPosterCache.has(key)) {
      const cachedUrl = clientPosterCache.get(key) ?? null;
      if (cachedUrl) warmImageInBrowserCache(cachedUrl);
      return;
    }

    let cancelled = false;
    setAsyncState({ key, url: null, isLoading: true });

    prefetchPoster(movie);
    const pending = inflightRequests.get(key);

    if (pending) {
      pending.then((resolved) => {
        if (!cancelled) {
          setAsyncState({ key, url: resolved, isLoading: false });
        }
      });
    } else {
      setAsyncState({ key, url: clientPosterCache.get(key) ?? null, isLoading: false });
    }

    return () => {
      cancelled = true;
    };
  }, [key, movie.posterUrl, movie.title, movie.originalTitle, movie.searchTitle, movie.year, movie.director]);

  if (hasSyncResult) {
    return { url: syncUrl, isLoading: false };
  }

  if (asyncState.key !== key) {
    return { url: null, isLoading: true };
  }

  return { url: asyncState.url, isLoading: asyncState.isLoading };
}
