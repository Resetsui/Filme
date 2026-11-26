import type {
  AudioFilter,
  DecadeFilter,
  FilterState,
  Movie,
  MovieDecision,
  ObscurityFilter,
  SeenSentiment,
  Subgenre,
  TasteProfile,
  UserLibraryState,
  UserMovieEntry,
} from '../types/movie';

export const DEFAULT_FILTERS: FilterState = {
  subgenre: 'all',
  minImdb: 0,
  obscurity: 'all',
  decade: 'all',
  audio: 'all',
  search: '',
};

export const INITIAL_LIBRARY_STATE: UserLibraryState = {
  entries: {},
  history: [],
  discoveredMovies: [],
  customSeenTitles: [],
};

export function matchesDecade(year: number, decade: DecadeFilter): boolean {
  if (decade === 'all') return true;
  if (decade === 'recent') {
    const minRecentYear = new Date().getFullYear() - 1;
    return year >= minRecentYear;
  }
  if (decade === '2020s') return year >= 2020;
  if (decade === '2010s') return year >= 2010 && year <= 2019;
  if (decade === '2000s') return year >= 2000 && year <= 2009;
  if (decade === 'classic') return year < 2000;
  return true;
}

export function matchesObscurity(
  tier: Movie['obscurity'],
  filter: ObscurityFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'blockbusters') return tier === 'Blockbuster';
  if (filter === 'deep-cuts') return tier === 'Lado B' || tier === 'Raridade';
  if (filter === 'classics') return tier === 'Clássico' || tier === 'Cult';
  return true;
}

export function matchesAudioFilter(movie: Movie, audio: AudioFilter): boolean {
  if (audio === 'all') return true;
  if (audio === 'dubbed-only') return movie.hasPtBrDub === true;
  if (audio === 'dubbed-or-must-see') {
    return movie.hasPtBrDub === true || movie.imdbRating >= 7.5;
  }
  return true;
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function matchesSearch(movie: Movie, query: string): boolean {
  const clean = normalizeText(query);
  if (!clean) return true;
  const haystack = normalizeText(
    `${movie.title} ${movie.originalTitle} ${movie.director} ${movie.country} ${movie.subgenre} ${movie.secondaryTag ?? ''}`,
  );
  return haystack.includes(clean);
}

/**
 * Merges discovered movies (newest first) with the base seed catalog, deduplicating by id or normalized originalTitle+year.
 */
export function buildFullCatalog(seedMovies: Movie[], discoveredMovies: Movie[]): Movie[] {
  const seenKeys = new Set<string>();
  const merged: Movie[] = [];

  for (const movie of [...discoveredMovies, ...seedMovies]) {
    const dedupeKey = `${normalizeText(movie.originalTitle)}::${movie.year}`;
    if (seenKeys.has(movie.id) || seenKeys.has(dedupeKey)) {
      continue;
    }
    seenKeys.add(movie.id);
    seenKeys.add(dedupeKey);
    merged.push(movie);
  }
  return merged;
}

/**
 * Filters movies for the active view:
 * - 'discover': excludes movies already marked as seen, watchlist, or skipped.
 * - 'watchlist': only movies marked 'watchlist', sorted by most recently added.
 * - 'seen': only movies marked 'seen', sorted by most recently marked.
 */
export function filterMovies(
  catalog: Movie[],
  filters: FilterState,
  entries: Record<string, UserMovieEntry>,
  mode: 'discover' | 'watchlist' | 'seen',
): Movie[] {
  const result = catalog.filter((movie) => {
    const entry = entries[movie.id];
    if (mode === 'discover') {
      if (entry && (entry.status === 'seen' || entry.status === 'watchlist' || entry.status === 'skipped')) {
        return false;
      }
    } else if (mode === 'watchlist') {
      if (entry?.status !== 'watchlist') return false;
    } else if (mode === 'seen') {
      if (entry?.status !== 'seen') return false;
    }

    if (filters.subgenre !== 'all' && movie.subgenre !== filters.subgenre) {
      return false;
    }
    if (movie.imdbRating < filters.minImdb) {
      return false;
    }
    if (!matchesObscurity(movie.obscurity, filters.obscurity)) {
      return false;
    }
    if (!matchesDecade(movie.year, filters.decade)) {
      return false;
    }
    if (!matchesAudioFilter(movie, filters.audio)) {
      return false;
    }
    if (!matchesSearch(movie, filters.search)) {
      return false;
    }
    return true;
  });

  if (mode === 'watchlist' || mode === 'seen') {
    return result.sort((a, b) => {
      const aTime = entries[a.id]?.updatedAt ?? 0;
      const bTime = entries[b.id]?.updatedAt ?? 0;
      return bTime - aTime;
    });
  }

  return result;
}

export function applyMovieDecision(
  state: UserLibraryState,
  movieId: string,
  decision: MovieDecision,
  now: number = Date.now(),
  sentiment?: SeenSentiment,
): UserLibraryState {
  const previousEntry = state.entries[movieId];
  const resolvedSentiment: SeenSentiment | undefined =
    decision === 'seen' ? sentiment ?? previousEntry?.sentiment ?? 'liked' : undefined;
  const resolvedRating: number | undefined =
    decision === 'seen'
      ? sentiment === 'disliked'
        ? 2
        : sentiment === 'liked'
          ? previousEntry?.personalRating && previousEntry.personalRating >= 4
            ? previousEntry.personalRating
            : 4
          : previousEntry?.personalRating
      : undefined;

  const nextEntry: UserMovieEntry = {
    status: decision,
    sentiment: resolvedSentiment,
    personalRating: resolvedRating,
    updatedAt: now,
  };

  return {
    ...state,
    entries: {
      ...state.entries,
      [movieId]: nextEntry,
    },
    history: [
      ...state.history.slice(-49),
      {
        movieId,
        previousEntry,
        newStatus: decision,
      },
    ],
  };
}

export function undoLastDecision(state: UserLibraryState): {
  nextState: UserLibraryState;
  restoredMovieId: string | null;
} {
  if (state.history.length === 0) {
    return { nextState: state, restoredMovieId: null };
  }

  const last = state.history[state.history.length - 1];
  const nextEntries = { ...state.entries };

  if (last.previousEntry) {
    nextEntries[last.movieId] = last.previousEntry;
  } else {
    delete nextEntries[last.movieId];
  }

  return {
    nextState: {
      ...state,
      entries: nextEntries,
      history: state.history.slice(0, -1),
    },
    restoredMovieId: last.movieId,
  };
}

export function setPersonalRating(
  state: UserLibraryState,
  movieId: string,
  rating: number,
  now: number = Date.now(),
): UserLibraryState {
  const clamped = Math.max(1, Math.min(5, Math.round(rating)));
  const current = state.entries[movieId];
  const sentiment: SeenSentiment = clamped <= 2 ? 'disliked' : 'liked';
  return {
    ...state,
    entries: {
      ...state.entries,
      [movieId]: {
        status: 'seen',
        sentiment,
        personalRating: clamped,
        updatedAt: current?.updatedAt ?? now,
      },
    },
  };
}

export function setSeenSentiment(
  state: UserLibraryState,
  movieId: string,
  sentiment: SeenSentiment,
  now: number = Date.now(),
): UserLibraryState {
  const current = state.entries[movieId];
  const personalRating =
    sentiment === 'disliked'
      ? current?.personalRating && current.personalRating <= 2
        ? current.personalRating
        : 2
      : current?.personalRating && current.personalRating >= 4
        ? current.personalRating
        : 4;

  return {
    ...state,
    entries: {
      ...state.entries,
      [movieId]: {
        status: 'seen',
        sentiment,
        personalRating,
        updatedAt: current?.updatedAt ?? now,
      },
    },
  };
}

export function removeMovieEntry(state: UserLibraryState, movieId: string): UserLibraryState {
  if (!state.entries[movieId]) return state;
  const nextEntries = { ...state.entries };
  delete nextEntries[movieId];
  return {
    ...state,
    entries: nextEntries,
  };
}

export function resetSkippedMovies(state: UserLibraryState): UserLibraryState {
  const nextEntries: Record<string, UserMovieEntry> = {};
  for (const [id, entry] of Object.entries(state.entries)) {
    if (entry.status !== 'skipped') {
      nextEntries[id] = entry;
    }
  }
  return {
    ...state,
    entries: nextEntries,
  };
}

export function batchMarkSeen(
  state: UserLibraryState,
  movieIds: string[],
  now: number = Date.now(),
): UserLibraryState {
  const nextEntries = { ...state.entries };
  for (const id of movieIds) {
    nextEntries[id] = {
      status: 'seen',
      personalRating: nextEntries[id]?.personalRating,
      updatedAt: now,
    };
  }
  return {
    ...state,
    entries: nextEntries,
  };
}

export function pickRandomMovie(
  movies: Movie[],
  excludeId?: string,
  randomFn: () => number = Math.random,
): Movie | null {
  if (movies.length === 0) return null;
  const pool =
    excludeId && movies.length > 1
      ? movies.filter((movie) => movie.id !== excludeId)
      : movies;
  const index = Math.min(pool.length - 1, Math.floor(randomFn() * pool.length));
  return pool[index] ?? null;
}

export function getLibraryCounts(
  catalog: Movie[],
  entries: Record<string, UserMovieEntry>,
): {
  unwatched: number;
  watchlist: number;
  seen: number;
  skipped: number;
  total: number;
} {
  let unwatched = 0;
  let watchlist = 0;
  let seen = 0;
  let skipped = 0;

  for (const movie of catalog) {
    const status = entries[movie.id]?.status;
    if (status === 'watchlist') watchlist += 1;
    else if (status === 'seen') seen += 1;
    else if (status === 'skipped') skipped += 1;
    else unwatched += 1;
  }

  return {
    unwatched,
    watchlist,
    seen,
    skipped,
    total: catalog.length,
  };
}

export function parseImportedTitles(rawText: string): string[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  // Detect Letterboxd / IMDb CSV headers (e.g., Date,Name,Year,... or Const,Your Rating,...,Title,...)
  const firstHeaderCols = lines[0]
    .split(',')
    .map((col) => col.replace(/^"|"$/g, '').trim().toLowerCase());
  const csvTitleIdx = firstHeaderCols.findIndex(
    (col) => col === 'name' || col === 'title' || col === 'titulo' || col === 'título' || col === 'filme',
  );

  const extracted: string[] = [];

  if (csvTitleIdx !== -1 && lines.length > 1) {
    for (let i = 1; i < lines.length; i += 1) {
      const row = lines[i];
      // Simple RFC-4180 aware CSV row split
      const cols: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let c = 0; c < row.length; c += 1) {
        const ch = row[c];
        if (ch === '"') {
          if (inQuotes && row[c + 1] === '"') {
            current += '"';
            c += 1;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          cols.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      cols.push(current.trim());
      const cell = cols[csvTitleIdx]?.replace(/^"|"$/g, '').trim();
      if (cell) extracted.push(cell);
    }
  } else {
    for (const line of lines) {
      const cleaned = line
        .replace(/^[-*•\d.)\s]+/, '')
        .replace(/\s*\(\d{4}\)\s*$/, '')
        .trim();
      if (cleaned.length >= 2) {
        extracted.push(cleaned);
      }
    }
  }

  const seenNorm = new Set<string>();
  const unique: string[] = [];
  for (const title of extracted) {
    const norm = normalizeText(title);
    if (!norm || seenNorm.has(norm)) continue;
    seenNorm.add(norm);
    unique.push(title.slice(0, 110));
  }

  return unique;
}

export function importExternalSeenTitles(
  state: UserLibraryState,
  catalog: Movie[],
  titles: string[],
  now: number = Date.now(),
): { nextState: UserLibraryState; matchedCatalogCount: number; addedExternalCount: number } {
  const nextEntries = { ...state.entries };
  const existingCustomNorm = new Set(state.customSeenTitles.map((t) => normalizeText(t)));
  const nextCustom = [...state.customSeenTitles];

  const catalogByNorm = new Map<string, Movie>();
  for (const movie of catalog) {
    catalogByNorm.set(normalizeText(movie.title), movie);
    catalogByNorm.set(normalizeText(movie.originalTitle), movie);
  }

  let matchedCatalogCount = 0;
  let addedExternalCount = 0;

  for (const rawTitle of titles) {
    const clean = rawTitle.trim();
    const norm = normalizeText(clean);
    if (!norm) continue;

    const matchedMovie = catalogByNorm.get(norm);
    if (matchedMovie) {
      if (nextEntries[matchedMovie.id]?.status !== 'seen') {
        nextEntries[matchedMovie.id] = {
          status: 'seen',
          personalRating: nextEntries[matchedMovie.id]?.personalRating,
          updatedAt: now,
        };
        matchedCatalogCount += 1;
      }
    } else if (!existingCustomNorm.has(norm)) {
      existingCustomNorm.add(norm);
      nextCustom.push(clean);
      addedExternalCount += 1;
    }
  }

  return {
    nextState: {
      ...state,
      entries: nextEntries,
      customSeenTitles: nextCustom,
    },
    matchedCatalogCount,
    addedExternalCount,
  };
}

export function computeTasteProfile(
  catalog: Movie[],
  entries: Record<string, UserMovieEntry>,
): TasteProfile {
  const liked: Array<{ title: string; updatedAt: number; subgenre: Subgenre }> = [];
  const disliked: Array<{ title: string; updatedAt: number; subgenre: Subgenre }> = [];
  const watchlist: Array<{ title: string; updatedAt: number; subgenre: Subgenre }> = [];
  const skipped: Array<{ title: string; updatedAt: number; subgenre: Subgenre }> = [];
  const subgenreWeights: Partial<Record<Subgenre, number>> = {};

  const addWeight = (subgenre: Subgenre, delta: number) => {
    subgenreWeights[subgenre] = (subgenreWeights[subgenre] ?? 0) + delta;
  };

  for (const movie of catalog) {
    const entry = entries[movie.id];
    if (!entry) continue;

    if (entry.status === 'seen') {
      const isDisliked =
        entry.sentiment === 'disliked' ||
        (entry.sentiment === undefined &&
          typeof entry.personalRating === 'number' &&
          entry.personalRating <= 2);
      const isLiked =
        entry.sentiment === 'liked' ||
        (entry.sentiment === undefined &&
          typeof entry.personalRating === 'number' &&
          entry.personalRating >= 4);

      if (isDisliked) {
        disliked.push({ title: movie.title, updatedAt: entry.updatedAt, subgenre: movie.subgenre });
        addWeight(movie.subgenre, -3);
      } else if (isLiked) {
        liked.push({ title: movie.title, updatedAt: entry.updatedAt, subgenre: movie.subgenre });
        addWeight(movie.subgenre, 3);
      }
    } else if (entry.status === 'watchlist') {
      watchlist.push({ title: movie.title, updatedAt: entry.updatedAt, subgenre: movie.subgenre });
      addWeight(movie.subgenre, 2);
    } else if (entry.status === 'skipped') {
      skipped.push({ title: movie.title, updatedAt: entry.updatedAt, subgenre: movie.subgenre });
      addWeight(movie.subgenre, -1);
    }
  }

  liked.sort((a, b) => b.updatedAt - a.updatedAt);
  disliked.sort((a, b) => b.updatedAt - a.updatedAt);
  watchlist.sort((a, b) => b.updatedAt - a.updatedAt);
  skipped.sort((a, b) => b.updatedAt - a.updatedAt);

  const weightEntries = Object.entries(subgenreWeights) as Array<[Subgenre, number]>;
  const preferredSubgenres = weightEntries
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([subgenre]) => subgenre);

  const avoidedSubgenres = weightEntries
    .filter(([, w]) => w <= -2)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([subgenre]) => subgenre);

  return {
    likedTitles: liked.map((item) => item.title).slice(0, 25),
    dislikedTitles: disliked.map((item) => item.title).slice(0, 25),
    watchlistTitles: watchlist.map((item) => item.title).slice(0, 20),
    skippedTitles: skipped.map((item) => item.title).slice(0, 20),
    preferredSubgenres,
    avoidedSubgenres,
    subgenreWeights,
    signalCount: liked.length + disliked.length + watchlist.length,
  };
}

/**
 * Re-orders the unwatched discovery deck natively according to the user's live taste signals,
 * keeping AI-discovered picks prioritized while floating matching subgenres upward and pushing
 * disliked styles toward the end.
 */
export function rankMoviesByTaste(
  movies: Movie[],
  profile: TasteProfile,
  pinnedMovieId?: string | null,
): Movie[] {
  if (movies.length <= 1) return movies;

  const indexed = movies.map((movie, originalIndex) => {
    let score = 0;
    if (pinnedMovieId && movie.id === pinnedMovieId) {
      score += 1000;
    }
    if (profile.signalCount > 0) {
      const subgenreWeight = profile.subgenreWeights[movie.subgenre] ?? 0;
      score += subgenreWeight * 2;
      if (movie.isAiDiscovered) {
        score += 4;
      }
    }
    return { movie, originalIndex, score };
  });

  indexed.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.originalIndex - b.originalIndex;
  });

  return indexed.map((item) => item.movie);
}

export function parseStoredLibrary(raw: string | null): UserLibraryState {
  if (!raw) return INITIAL_LIBRARY_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<UserLibraryState>;
    const entries: Record<string, UserMovieEntry> = {};

    if (parsed.entries && typeof parsed.entries === 'object') {
      for (const [id, value] of Object.entries(parsed.entries)) {
        if (
          value &&
          typeof value === 'object' &&
          (value.status === 'seen' || value.status === 'watchlist' || value.status === 'skipped')
        ) {
          const sentiment: SeenSentiment | undefined =
            value.sentiment === 'liked' || value.sentiment === 'disliked'
              ? value.sentiment
              : undefined;
          entries[id] = {
            status: value.status,
            sentiment,
            personalRating:
              typeof value.personalRating === 'number' &&
              value.personalRating >= 1 &&
              value.personalRating <= 5
                ? Math.round(value.personalRating)
                : undefined,
            updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
          };
        }
      }
    }

    const discoveredMovies: Movie[] = Array.isArray(parsed.discoveredMovies)
      ? parsed.discoveredMovies
          .filter(
            (m): m is Movie =>
              Boolean(m) &&
              typeof m.id === 'string' &&
              typeof m.title === 'string' &&
              typeof m.originalTitle === 'string' &&
              typeof m.year === 'number' &&
              typeof m.imdbRating === 'number',
          )
          .map((m) => ({
            ...m,
            hasPtBrDub: typeof m.hasPtBrDub === 'boolean' ? m.hasPtBrDub : true,
          }))
      : [];

    const customSeenTitles: string[] = Array.isArray(parsed.customSeenTitles)
      ? parsed.customSeenTitles
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .slice(0, 5000)
      : [];

    return {
      entries,
      history: [],
      discoveredMovies,
      customSeenTitles,
    };
  } catch {
    return INITIAL_LIBRARY_STATE;
  }
}
