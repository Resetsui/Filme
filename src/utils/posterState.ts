export type PosterVisualState = 'loading' | 'loaded' | 'unavailable';

export interface PosterVisualInput {
  url: string | null;
  isFetchingUrl: boolean;
  loadedUrl: string | null;
  failedUrl: string | null;
  isDecodedInCache: boolean;
}

/**
 * Pure state machine for MoviePoster display state.
 * Guarantees cached/decoded images render immediately as 'loaded' without
 * flashing or getting stuck on the loading state after card swaps.
 */
export function resolvePosterVisualState({
  url,
  isFetchingUrl,
  loadedUrl,
  failedUrl,
  isDecodedInCache,
}: PosterVisualInput): PosterVisualState {
  const hasValidCandidate = Boolean(url && failedUrl !== url);
  const isOfficialLoaded =
    hasValidCandidate && Boolean(url && (loadedUrl === url || isDecodedInCache));

  if (isOfficialLoaded) {
    return 'loaded';
  }

  if (isFetchingUrl || hasValidCandidate) {
    return 'loading';
  }

  return 'unavailable';
}
