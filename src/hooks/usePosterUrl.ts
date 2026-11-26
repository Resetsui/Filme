import { useEffect, useState } from 'react';
import type { Movie } from '../types/movie';

const clientPosterCache = new Map<string, string | null>();
const inflightRequests = new Map<string, Promise<string | null>>();

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
  if (movie.posterUrl) return;
  const key = getCacheKey(movie);
  if (clientPosterCache.has(key) || inflightRequests.has(key)) return;

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
  const initialCached = movie.posterUrl ?? clientPosterCache.get(key) ?? undefined;

  const [url, setUrl] = useState<string | null>(initialCached ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(initialCached === undefined);

  useEffect(() => {
    if (movie.posterUrl) {
      setUrl(movie.posterUrl);
      setIsLoading(false);
      return;
    }

    if (clientPosterCache.has(key)) {
      setUrl(clientPosterCache.get(key) ?? null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setUrl(null);
    setIsLoading(true);

    prefetchPoster(movie);
    const pending = inflightRequests.get(key);

    if (pending) {
      pending.then((resolved) => {
        if (!cancelled) {
          setUrl(resolved);
          setIsLoading(false);
        }
      });
    } else {
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [key, movie.posterUrl, movie.title, movie.originalTitle, movie.searchTitle, movie.year, movie.director]);

  return { url, isLoading };
}
