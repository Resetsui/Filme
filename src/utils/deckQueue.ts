import type { Movie } from '../types/movie';

export interface DeckQueueState {
  order: string[];
  heldFrontMovie: Movie | null;
}

export type DeckReconcileMode = 'background' | 'advance' | 'reset' | 'pin';

export interface DeckReconcileOptions {
  mode: DeckReconcileMode;
  pinnedMovieId?: string | null;
  actedMovieId?: string | null;
  previousFrontMovie?: Movie | null;
}

export const EMPTY_DECK_QUEUE: DeckQueueState = {
  order: [],
  heldFrontMovie: null,
};

/**
 * Reconciles the presentation queue so background syncs (Firestore snapshots, 12h latest releases,
 * automatic AI refills, and taste calibrations) NEVER yank or flash the currently viewed movie
 * (or the peeking back card right behind it). Newly arrived movies seamlessly weave into the queue
 * right behind the active card(s) and appear naturally as soon as the user advances.
 */
export function reconcileDeckQueue(
  current: DeckQueueState,
  rankedCandidates: Movie[],
  options: DeckReconcileOptions,
): DeckQueueState {
  const candidateIds = rankedCandidates.map((m) => m.id);
  const candidateSet = new Set(candidateIds);

  if (options.mode === 'reset') {
    return {
      order: candidateIds,
      heldFrontMovie: null,
    };
  }

  if (options.mode === 'pin') {
    const pinId = options.pinnedMovieId;
    if (pinId && candidateSet.has(pinId)) {
      return {
        order: [pinId, ...candidateIds.filter((id) => id !== pinId)],
        heldFrontMovie: null,
      };
    }
    return {
      order: candidateIds,
      heldFrontMovie: null,
    };
  }

  if (options.mode === 'advance') {
    const actedId = options.actedMovieId ?? current.order[0] ?? null;
    const remainingPrev = current.order.filter((id) => id !== actedId && candidateSet.has(id));
    const promotedFront = remainingPrev[0] ?? null;

    if (!promotedFront) {
      return {
        order: candidateIds,
        heldFrontMovie: null,
      };
    }

    // Keep the promoted back card at index 0 (matches the physical card gliding forward),
    // and let freshly ranked / newly synced / AI-discovered movies flow seamlessly into index 1+.
    return {
      order: [promotedFront, ...candidateIds.filter((id) => id !== promotedFront)],
      heldFrontMovie: null,
    };
  }

  // mode === 'background'
  if (current.order.length === 0 && !current.heldFrontMovie) {
    return {
      order: candidateIds,
      heldFrontMovie: null,
    };
  }

  const currentFrontId = current.order[0] ?? current.heldFrontMovie?.id ?? null;
  const currentBackId = current.order[1] ?? null;

  // Case A: Current front card is still an eligible unwatched candidate
  if (currentFrontId && candidateSet.has(currentFrontId)) {
    const locked: string[] = [currentFrontId];
    // Also lock the peeking back card if still valid so it doesn't flash behind the front card
    if (currentBackId && currentBackId !== currentFrontId && candidateSet.has(currentBackId)) {
      locked.push(currentBackId);
    }
    const lockedSet = new Set(locked);
    const tail = candidateIds.filter((id) => !lockedSet.has(id));
    return {
      order: [...locked, ...tail],
      heldFrontMovie: null,
    };
  }

  // Case B: A remote/background sync removed the front card from candidates while the user is looking at it.
  // Hold the visible front movie in place so the screen never blinks or vanishes mid-read;
  // as soon as the user swipes/skips/marks it ('advance'), the synced queue flows seamlessly.
  const frontSnapshot = current.heldFrontMovie ?? options.previousFrontMovie ?? null;
  if (frontSnapshot && currentFrontId && frontSnapshot.id === currentFrontId) {
    const locked: string[] = [frontSnapshot.id];
    if (currentBackId && currentBackId !== frontSnapshot.id && candidateSet.has(currentBackId)) {
      locked.push(currentBackId);
    }
    const lockedSet = new Set(locked);
    const tail = candidateIds.filter((id) => !lockedSet.has(id));
    return {
      order: [...locked, ...tail],
      heldFrontMovie: frontSnapshot,
    };
  }

  return {
    order: candidateIds,
    heldFrontMovie: null,
  };
}

/**
 * Resolves the ordered list of Movie objects to render in DiscoveryDeck from the stable queue state.
 */
export function resolveDeckMovies(
  queue: DeckQueueState,
  rankedCandidates: Movie[],
): Movie[] {
  const byId = new Map<string, Movie>();
  for (const movie of rankedCandidates) {
    byId.set(movie.id, movie);
  }
  if (queue.heldFrontMovie && !byId.has(queue.heldFrontMovie.id)) {
    byId.set(queue.heldFrontMovie.id, queue.heldFrontMovie);
  }

  if (queue.order.length === 0) {
    return rankedCandidates;
  }

  const resolved: Movie[] = [];
  const seen = new Set<string>();
  for (const id of queue.order) {
    const movie = byId.get(id);
    if (movie && !seen.has(id)) {
      seen.add(id);
      resolved.push(movie);
    }
  }

  // Safety net: append any newly available candidates not yet in queue.order
  for (const movie of rankedCandidates) {
    if (!seen.has(movie.id)) {
      seen.add(movie.id);
      resolved.push(movie);
    }
  }

  return resolved;
}
