/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AvoidPreferencesModal } from './components/AvoidPreferencesModal';
import { BatchSeenModal } from './components/BatchSeenModal';
import { DiscoverModal } from './components/DiscoverModal';
import { DiscoveryDeck } from './components/DiscoveryDeck';
import { FilterBar } from './components/FilterBar';
import { Header, type AuthUserInfo } from './components/Header';
import { MovieDetailModal } from './components/MovieDetailModal';
import { MovieListView } from './components/MovieListView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { RouletteModal } from './components/RouletteModal';
import {
  UniverseTransitionOverlay,
  type UniverseTransitionState,
} from './components/UniverseTransitionOverlay';
import { UNIVERSE_CONFIGS } from './config/universes';
import { auth, googleProvider } from './firebase';
import {
  deleteMovieEntryFromCloud,
  ensureUserProfile,
  mergeLocalLibraryIntoCloud,
  subscribeToUserLibrary,
  syncAvoidPreferencesToCloud,
  syncDiscoveredMoviesToCloud,
  syncExternalSeenTitlesToCloud,
  syncMovieEntryToCloud,
} from './services/firestoreSync';
import type {
  AppTab,
  AppUniverse,
  AudioFilter,
  AvoidPreferences,
  DecadeFilter,
  FilterState,
  Movie,
  MovieDecision,
  ObscurityFilter,
  SeenSentiment,
  Subgenre,
  UserLibraryState,
} from './types/movie';
import {
  EMPTY_DECK_QUEUE,
  reconcileDeckQueue,
  resolveDeckMovies,
  type DeckQueueState,
  type DeckReconcileMode,
} from './utils/deckQueue';
import {
  countActiveAvoids,
  getActiveAvoidLabels,
  isMovieBlockedByPreferences,
  sanitizeAvoidPreferences,
} from './utils/exclusions';
import {
  DEFAULT_FILTERS,
  applyMovieDecision,
  batchMarkSeen,
  buildFullCatalog,
  computeTasteProfile,
  filterMovies,
  getLibraryCounts,
  importExternalSeenTitles,
  parseStoredLibrary,
  pickRandomMovie,
  rankMoviesByTaste,
  removeMovieEntry,
  resetSkippedMovies,
  setPersonalRating,
  setSeenSentiment,
  undoLastDecision,
} from './utils/movieFilters';

const ACTIVE_UNIVERSE_KEY = 'cinema:active-universe';
const LATEST_RADAR_INTERVAL_MS = 1000 * 60 * 60 * 12; // 12 hours

interface ToastBanner {
  id: number;
  message: string;
  tone: 'neutral' | 'error';
}

function resolveInitialUniverse(): AppUniverse {
  try {
    const params = new URLSearchParams(window.location.search);
    const param = params.get('app')?.toLowerCase().trim();
    if (param === 'matine' || param === 'romcom') return 'matine';
    if (param === 'nocturna' || param === 'horror') return 'nocturna';

    const stored = window.localStorage.getItem(ACTIVE_UNIVERSE_KEY);
    if (stored === 'matine' || stored === 'nocturna') return stored;
  } catch {
    // Ignore URL/storage read errors
  }
  return 'nocturna';
}

function loadUniverseLibrary(universe: AppUniverse): UserLibraryState {
  try {
    return parseStoredLibrary(window.localStorage.getItem(UNIVERSE_CONFIGS[universe].storageKey));
  } catch {
    return parseStoredLibrary(null);
  }
}

export default function App() {
  const [universe, setUniverse] = useState<AppUniverse>(resolveInitialUniverse);

  // Two 100% isolated libraries in state and localStorage (zero cross-contamination)
  const [libraries, setLibraries] = useState<Record<AppUniverse, UserLibraryState>>(() => ({
    nocturna: loadUniverseLibrary('nocturna'),
    matine: loadUniverseLibrary('matine'),
  }));

  const universeConfig = UNIVERSE_CONFIGS[universe];
  const library = libraries[universe];

  const [authUser, setAuthUser] = useState<AuthUserInfo | null>(null);
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced'>('local');

  const [activeTab, setActiveTab] = useState<AppTab>('discover');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [pinnedMovieId, setPinnedMovieId] = useState<string | null>(null);

  // Modals & AI states
  const [isDiscoverOpen, setIsDiscoverOpen] = useState(false);
  const [isAvoidOpen, setIsAvoidOpen] = useState(false);
  const [isBatchSeenOpen, setIsBatchSeenOpen] = useState(false);
  const [selectedDetailMovie, setSelectedDetailMovie] = useState<Movie | null>(null);
  const [rouletteMovie, setRouletteMovie] = useState<Movie | null>(null);

  // Explicit deck queue transition signal (background syncs/AI arrivals leave seq unchanged)
  const [queueSignal, setQueueSignal] = useState<{
    seq: number;
    mode: DeckReconcileMode;
    actedMovieId?: string | null;
    pinnedMovieId?: string | null;
  }>({ seq: 0, mode: 'reset' });

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFindingSimilar, setIsFindingSimilar] = useState(false);
  const [isAutoRefilling, setIsAutoRefilling] = useState(false);
  const [isRefreshingReleases, setIsRefreshingReleases] = useState(false);
  const [autoRefillEnabled, setAutoRefillEnabled] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastBanner | null>(null);
  const [universeTransition, setUniverseTransition] = useState<UniverseTransitionState | null>(
    null,
  );

  const batchCounterRef = useRef<Record<AppUniverse, number>>({ nocturna: 0, matine: 0 });
  const autoRefillInFlightRef = useRef(false);
  const autoRefillCooldownUntilRef = useRef(0);
  const latestRadarInFlightRef = useRef(false);
  const recentAutoTriggeredRef = useRef(false);
  const transitionTimersRef = useRef<number[]>([]);
  const librariesRef = useRef(libraries);
  librariesRef.current = libraries;
  const universeRef = useRef(universe);
  universeRef.current = universe;

  useEffect(() => {
    return () => {
      for (const timer of transitionTimersRef.current) {
        window.clearTimeout(timer);
      }
      transitionTimersRef.current = [];
    };
  }, []);

  const updateUniverseLibrary = useCallback(
    (targetUniverse: AppUniverse, updater: (prev: UserLibraryState) => UserLibraryState) => {
      setLibraries((prev) => ({
        ...prev,
        [targetUniverse]: updater(prev[targetUniverse]),
      }));
    },
    [],
  );

  const showToast = useCallback((message: string, tone: 'neutral' | 'error' = 'neutral') => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Apply dual theme (<html class="dark"> for Nocturna, sunlit light editorial for Matinê) + document title + PWA theme-color + active universe persistence
  useEffect(() => {
    document.documentElement.classList.toggle('dark', universe === 'nocturna');
    document.title = universeConfig.documentTitle;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', universe === 'nocturna' ? '#09090B' : '#F0E3DC');
    }
    try {
      window.localStorage.setItem(ACTIVE_UNIVERSE_KEY, universe);
    } catch {
      // Ignore storage quota errors
    }
  }, [universe, universeConfig.documentTitle]);

  // Persist Nocturna library exclusively to its own storage key
  useEffect(() => {
    const state = libraries.nocturna;
    try {
      window.localStorage.setItem(
        UNIVERSE_CONFIGS.nocturna.storageKey,
        JSON.stringify({
          entries: state.entries,
          discoveredMovies: state.discoveredMovies,
          customSeenTitles: state.customSeenTitles,
          avoidPreferences: state.avoidPreferences,
        }),
      );
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [
    libraries.nocturna.entries,
    libraries.nocturna.discoveredMovies,
    libraries.nocturna.customSeenTitles,
    libraries.nocturna.avoidPreferences,
  ]);

  // Persist Matinê library exclusively to its own isolated storage key
  useEffect(() => {
    const state = libraries.matine;
    try {
      window.localStorage.setItem(
        UNIVERSE_CONFIGS.matine.storageKey,
        JSON.stringify({
          entries: state.entries,
          discoveredMovies: state.discoveredMovies,
          customSeenTitles: state.customSeenTitles,
          avoidPreferences: state.avoidPreferences,
        }),
      );
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [
    libraries.matine.entries,
    libraries.matine.discoveredMovies,
    libraries.matine.customSeenTitles,
    libraries.matine.avoidPreferences,
  ]);

  // Firebase Auth listener (runs once)
  useEffect(() => {
    let active = true;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        if (active) {
          setAuthUser(null);
          setSyncStatus('local');
        }
        return;
      }

      try {
        await ensureUserProfile(firebaseUser);
      } catch {
        // Non-blocking profile check
      }

      if (active) {
        setAuthUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
        });
      }
    });

    return () => {
      active = false;
      unsubAuth();
    };
  }, []);

  // Isolated Firestore cross-device sync scoped strictly to the active universe's subcollections
  useEffect(() => {
    const uid = authUser?.uid;
    if (!uid) {
      setSyncStatus('local');
      return;
    }

    let active = true;
    let unsubFirestore: (() => void) | null = null;
    const targetUniverse = universe;
    setSyncStatus('syncing');

    const startSync = async () => {
      try {
        await mergeLocalLibraryIntoCloud(uid, targetUniverse, librariesRef.current[targetUniverse]);
        if (!active) return;

        unsubFirestore = subscribeToUserLibrary(
          uid,
          targetUniverse,
          (partial) => {
            if (!active) return;
            updateUniverseLibrary(targetUniverse, (prev) => ({
              ...prev,
              entries: partial.entries ?? prev.entries,
              discoveredMovies: partial.discoveredMovies ?? prev.discoveredMovies,
              customSeenTitles: partial.customSeenTitles ?? prev.customSeenTitles,
              avoidPreferences: partial.avoidPreferences ?? prev.avoidPreferences,
            }));
            setSyncStatus('synced');
          },
          () => {
            if (!active) return;
            showToast('Não foi possível sincronizar com a nuvem agora.', 'error');
            setSyncStatus('local');
          },
        );
      } catch {
        if (active) {
          showToast('Erro ao iniciar sincronização na nuvem.', 'error');
          setSyncStatus('local');
        }
      }
    };

    void startSync();

    return () => {
      active = false;
      if (unsubFirestore) unsubFirestore();
    };
  }, [authUser?.uid, universe, showToast, updateUniverseLibrary]);

  const commitUniverseSwitch = useCallback(
    (next: AppUniverse) => {
      setUniverse(next);
      setFilters(DEFAULT_FILTERS);
      setActiveTab('discover');
      setPinnedMovieId(null);
      setMobileFiltersOpen(false);
      setIsDiscoverOpen(false);
      setIsAvoidOpen(false);
      setIsBatchSeenOpen(false);
      setSelectedDetailMovie(null);
      setRouletteMovie(null);
      setAiError(null);
      recentAutoTriggeredRef.current = false;

      try {
        const url = new URL(window.location.href);
        url.searchParams.set('app', next);
        window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      } catch {
        // Ignore history errors
      }
    },
    [],
  );

  const handleSwitchUniverse = useCallback(
    (next: AppUniverse, origin?: { x: number; y: number }) => {
      if (next === universeRef.current) return;

      for (const timer of transitionTimersRef.current) {
        window.clearTimeout(timer);
      }
      transitionTimersRef.current = [];

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      const id = Date.now();
      const originX = origin?.x ?? 36;
      const originY = origin?.y ?? 32;

      setUniverseTransition({
        id,
        target: next,
        originX,
        originY,
        phase: 'entering',
        reducedMotion: prefersReducedMotion,
      });

      const swapDelay = prefersReducedMotion ? 260 : 520;
      const exitDelay = prefersReducedMotion ? 480 : 880;
      const cleanupDelay = prefersReducedMotion ? 940 : 1340;

      // Swap the underlying app state right when the magical portal fully covers the screen
      const swapTimer = window.setTimeout(() => {
        commitUniverseSwitch(next);
      }, swapDelay);

      // Begin luminous dissolve revealing the newly transformed universe
      const exitTimer = window.setTimeout(() => {
        setUniverseTransition((prev) =>
          prev && prev.id === id ? { ...prev, phase: 'exiting' } : prev,
        );
      }, exitDelay);

      // Unmount overlay cleanly after fade completes
      const cleanupTimer = window.setTimeout(() => {
        setUniverseTransition((prev) => (prev && prev.id === id ? null : prev));
      }, cleanupDelay);

      transitionTimersRef.current = [swapTimer, exitTimer, cleanupTimer];
    },
    [commitUniverseSwitch],
  );

  const handleCopyUniverseLink = useCallback(
    (target: AppUniverse) => {
      const link = `${window.location.origin}${window.location.pathname}?app=${target}`;
      const label = UNIVERSE_CONFIGS[target].name;
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard
          .writeText(link)
          .then(() => {
            showToast(`Link direto do ${label} copiado! Salve nos favoritos do celular.`);
          })
          .catch(() => {
            showToast(`Link direto do ${label}: ?app=${target}`);
          });
      } else {
        showToast(`Link direto do ${label}: ?app=${target}`);
      }
    },
    [showToast],
  );

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Conta conectada! Sua biblioteca agora sincroniza entre PC e celular.');
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      showToast('Não foi possível entrar com Google agora. Tente novamente.', 'error');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showToast('Você saiu da sincronização na nuvem.');
    } catch {
      showToast('Erro ao sair da conta.', 'error');
    }
  };

  const fullCatalog = useMemo(
    () => buildFullCatalog(universeConfig.seedMovies, library.discoveredMovies),
    [universeConfig.seedMovies, library.discoveredMovies],
  );

  const counts = useMemo(() => {
    const base = getLibraryCounts(fullCatalog, library.entries);
    return {
      ...base,
      seenTotalWithExternal: base.seen + library.customSeenTitles.length,
    };
  }, [fullCatalog, library.entries, library.customSeenTitles.length]);

  const tasteProfile = useMemo(
    () => computeTasteProfile(fullCatalog, library.entries),
    [fullCatalog, library.entries],
  );

  const lastCalibratedSignalRef = useRef<Record<AppUniverse, number>>({
    nocturna: 0,
    matine: 0,
  });

  // Sync baseline calibration signal when switching universe so it never fires spuriously
  useEffect(() => {
    if (lastCalibratedSignalRef.current[universe] === 0 && tasteProfile.signalCount > 0) {
      lastCalibratedSignalRef.current[universe] = tasteProfile.signalCount;
    }
  }, [universe, tasteProfile.signalCount]);

  const excludeTitles = useMemo(() => {
    const catalogTitles = fullCatalog.map((movie) => `${movie.originalTitle} (${movie.year})`);
    return [...library.customSeenTitles, ...catalogTitles];
  }, [fullCatalog, library.customSeenTitles]);

  const rankedDiscoverCandidates = useMemo(() => {
    const filtered = filterMovies(
      fullCatalog,
      filters,
      library.entries,
      'discover',
      library.avoidPreferences,
      universe,
    );
    return rankMoviesByTaste(filtered, tasteProfile, pinnedMovieId);
  }, [
    fullCatalog,
    filters,
    library.entries,
    library.avoidPreferences,
    universe,
    tasteProfile,
    pinnedMovieId,
  ]);

  const filterContextKey = useMemo(
    () =>
      JSON.stringify({
        universe,
        filters,
        avoidPreferences: library.avoidPreferences,
      }),
    [universe, filters, library.avoidPreferences],
  );

  // StrictMode-safe synchronous stable presentation queue:
  // Background Firestore syncs, 12h latest releases radar, and AI refills NEVER flash or
  // replace the currently viewed card (or the peeking back card behind it).
  const committedQueueRef = useRef<DeckQueueState>(EMPTY_DECK_QUEUE);
  const committedFrontRef = useRef<Movie | null>(null);
  const committedContextRef = useRef<string>(filterContextKey);
  const committedSignalSeqRef = useRef<number>(0);

  const { nextDeckQueue, discoverList } = useMemo(() => {
    const contextChanged = committedContextRef.current !== filterContextKey;
    const signalChanged = committedSignalSeqRef.current !== queueSignal.seq;

    let nextQueue: DeckQueueState;
    if (contextChanged) {
      nextQueue = reconcileDeckQueue(committedQueueRef.current, rankedDiscoverCandidates, {
        mode: 'reset',
      });
    } else if (signalChanged) {
      nextQueue = reconcileDeckQueue(committedQueueRef.current, rankedDiscoverCandidates, {
        mode: queueSignal.mode,
        actedMovieId: queueSignal.actedMovieId,
        pinnedMovieId: queueSignal.pinnedMovieId,
      });
    } else {
      nextQueue = reconcileDeckQueue(committedQueueRef.current, rankedDiscoverCandidates, {
        mode: 'background',
        previousFrontMovie: committedFrontRef.current,
      });
    }

    const resolved = resolveDeckMovies(nextQueue, rankedDiscoverCandidates);
    return { nextDeckQueue: nextQueue, discoverList: resolved };
  }, [rankedDiscoverCandidates, filterContextKey, queueSignal]);

  useLayoutEffect(() => {
    committedQueueRef.current = nextDeckQueue;
    committedFrontRef.current = discoverList[0] ?? null;
    committedContextRef.current = filterContextKey;
    committedSignalSeqRef.current = queueSignal.seq;
  }, [nextDeckQueue, discoverList, filterContextKey, queueSignal.seq]);

  const activeAvoidCount = useMemo(
    () => countActiveAvoids(library.avoidPreferences),
    [library.avoidPreferences],
  );

  const activeAvoidLabels = useMemo(
    () => getActiveAvoidLabels(library.avoidPreferences, universe),
    [library.avoidPreferences, universe],
  );

  const watchlistMovies = useMemo(
    () => filterMovies(fullCatalog, filters, library.entries, 'watchlist'),
    [fullCatalog, filters, library.entries],
  );

  const seenMovies = useMemo(
    () => filterMovies(fullCatalog, filters, library.entries, 'seen'),
    [fullCatalog, filters, library.entries],
  );

  const fetchAiRecommendations = useCallback(
    async (options: {
      subgenre: Subgenre | 'all';
      minImdb: number;
      obscurity: ObscurityFilter;
      decade: DecadeFilter;
      audio: AudioFilter;
      mood?: string;
      anchorMovie?: Movie;
      count?: number;
      prependToTop?: boolean;
      silent?: boolean;
      toastMessage?: (addedCount: number) => string;
    }): Promise<Movie[]> => {
      const targetUniverse = universeRef.current;
      const batchNumber = batchCounterRef.current[targetUniverse];
      batchCounterRef.current[targetUniverse] += 1;

      const currentAvoidPreferences = librariesRef.current[targetUniverse].avoidPreferences;

      const response = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universe: targetUniverse,
          subgenre: options.subgenre,
          minImdb: options.minImdb,
          obscurity: options.obscurity,
          decade: options.decade,
          audioPreference: options.audio,
          mood: options.mood ?? '',
          count: options.count ?? 10,
          batchNumber,
          likedTitles: tasteProfile.likedTitles,
          dislikedTitles: tasteProfile.dislikedTitles,
          watchlistTitles: tasteProfile.watchlistTitles,
          skippedTitles: tasteProfile.skippedTitles,
          preferredSubgenres: tasteProfile.preferredSubgenres,
          avoidedSubgenres: tasteProfile.avoidedSubgenres,
          avoidPreferences: currentAvoidPreferences,
          excludeTitles,
          anchorMovie: options.anchorMovie
            ? {
                title: options.anchorMovie.title,
                originalTitle: options.anchorMovie.originalTitle,
                year: options.anchorMovie.year,
                subgenre: options.anchorMovie.subgenre,
              }
            : undefined,
        }),
      });

      const data = (await response.json()) as { movies?: Movie[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao consultar a Curadoria IA.');
      }

      const incoming = (Array.isArray(data.movies) ? data.movies : []).filter(
        (movie) => !isMovieBlockedByPreferences(movie, currentAvoidPreferences, targetUniverse),
      );
      if (incoming.length > 0) {
        updateUniverseLibrary(targetUniverse, (prev) => ({
          ...prev,
          discoveredMovies: options.prependToTop
            ? [...incoming, ...prev.discoveredMovies]
            : [...prev.discoveredMovies, ...incoming],
        }));

        if (authUser?.uid) {
          void syncDiscoveredMoviesToCloud(authUser.uid, targetUniverse, incoming).catch(() => {});
        }
      }

      if (!options.silent && universeRef.current === targetUniverse) {
        if (incoming.length > 0) {
          showToast(
            options.toastMessage
              ? options.toastMessage(incoming.length)
              : options.anchorMovie
                ? `+${incoming.length} filmes na linha de ${options.anchorMovie.title} adicionados à fila.`
                : `+${incoming.length} novos filmes adicionados à sua fila.`,
          );
        } else {
          showToast('Nenhum título inédito retornado nesta rodada. Tente ajustar os filtros.');
        }
      }

      return incoming;
    },
    [tasteProfile, excludeTitles, showToast, authUser?.uid, updateUniverseLibrary],
  );

  const fetchLatestReleases = useCallback(
    async (options?: { force?: boolean; silent?: boolean; pinTop?: boolean }): Promise<Movie[]> => {
      if (latestRadarInFlightRef.current) return [];
      const targetUniverse = universeRef.current;
      const targetConfig = UNIVERSE_CONFIGS[targetUniverse];
      latestRadarInFlightRef.current = true;
      setIsRefreshingReleases(true);

      try {
        const params = new URLSearchParams({ universe: targetUniverse });
        if (options?.force) params.set('force', '1');
        const response = await fetch(`/api/latest-releases?${params.toString()}`);
        const data = (await response.json()) as { movies?: Movie[]; error?: string };
        if (!response.ok) {
          throw new Error(data.error || 'Falha ao buscar lançamentos recentes.');
        }

        const fetched = Array.isArray(data.movies) ? data.movies : [];
        const currentTargetLib = librariesRef.current[targetUniverse];
        const existingCatalog = buildFullCatalog(
          targetConfig.seedMovies,
          currentTargetLib.discoveredMovies,
        );
        const existingKeys = new Set<string>();
        for (const m of existingCatalog) {
          existingKeys.add(`${m.originalTitle.toLowerCase().trim()}::${m.year}`);
          existingKeys.add(`${m.title.toLowerCase().trim()}::${m.year}`);
        }
        for (const ext of currentTargetLib.customSeenTitles) {
          existingKeys.add(ext.toLowerCase().trim());
        }

        const novel = fetched.filter((movie) => {
          if (
            isMovieBlockedByPreferences(
              movie,
              currentTargetLib.avoidPreferences,
              targetUniverse,
            )
          ) {
            return false;
          }
          const origKey = `${movie.originalTitle.toLowerCase().trim()}::${movie.year}`;
          const ptKey = `${movie.title.toLowerCase().trim()}::${movie.year}`;
          return (
            !existingKeys.has(origKey) &&
            !existingKeys.has(ptKey) &&
            !existingKeys.has(movie.originalTitle.toLowerCase().trim()) &&
            !existingKeys.has(movie.title.toLowerCase().trim())
          );
        });

        if (novel.length > 0) {
          updateUniverseLibrary(targetUniverse, (prev) => ({
            ...prev,
            discoveredMovies: [...novel, ...prev.discoveredMovies],
          }));

          if (authUser?.uid) {
            void syncDiscoveredMoviesToCloud(authUser.uid, targetUniverse, novel).catch(() => {});
          }
        }

        try {
          window.localStorage.setItem(targetConfig.latestRadarKey, String(Date.now()));
        } catch {
          // Ignore storage quota errors
        }

        if (options?.pinTop && universeRef.current === targetUniverse) {
          const newestCandidate =
            novel[0] ??
            existingCatalog.find(
              (m) =>
                m.year >= new Date().getFullYear() - 1 &&
                !librariesRef.current[targetUniverse].entries[m.id] &&
                !isMovieBlockedByPreferences(
                  m,
                  librariesRef.current[targetUniverse].avoidPreferences,
                  targetUniverse,
                ),
            );
          if (newestCandidate) {
            setFilters((prev) => ({ ...prev, decade: 'recent', search: '' }));
            setPinnedMovieId(newestCandidate.id);
            setQueueSignal((prev) => ({
              seq: prev.seq + 1,
              mode: 'pin',
              pinnedMovieId: newestCandidate.id,
            }));
            setActiveTab('discover');
          }
        }

        if (!options?.silent && universeRef.current === targetUniverse) {
          if (novel.length > 0) {
            showToast(`+${novel.length} lançamentos recentes adicionados à sua fila.`);
          } else {
            showToast('Radar atualizado: seus lançamentos recentes já estão na fila.');
          }
        }

        return novel;
      } catch (error) {
        if (!options?.silent && universeRef.current === targetUniverse) {
          showToast(
            error instanceof Error
              ? error.message
              : 'Não foi possível consultar lançamentos recentes agora.',
            'error',
          );
        }
        return [];
      } finally {
        latestRadarInFlightRef.current = false;
        setIsRefreshingReleases(false);
      }
    },
    [authUser?.uid, showToast, updateUniverseLibrary],
  );

  // Automatic non-blocking fresh releases radar every 12 hours (per universe)
  useEffect(() => {
    let lastChecked = 0;
    try {
      lastChecked = Number(window.localStorage.getItem(universeConfig.latestRadarKey) || 0);
    } catch {
      lastChecked = 0;
    }

    if (Date.now() - lastChecked < LATEST_RADAR_INTERVAL_MS) {
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchLatestReleases({ force: false, silent: true });
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [universeConfig.latestRadarKey, fetchLatestReleases]);

  // Reactive fresh releases radar when user selects "Recentes (Lançamentos)" filter
  useEffect(() => {
    if (filters.decade !== 'recent') {
      recentAutoTriggeredRef.current = false;
      return;
    }
    if (
      activeTab !== 'discover' ||
      discoverList.length >= 4 ||
      recentAutoTriggeredRef.current ||
      latestRadarInFlightRef.current
    ) {
      return;
    }

    recentAutoTriggeredRef.current = true;
    void fetchLatestReleases({ force: false, silent: false });
  }, [activeTab, filters.decade, discoverList.length, fetchLatestReleases]);

  // Seamless infinite background refill when deck drops to <= 3 cards during active digging
  useEffect(() => {
    if (
      !autoRefillEnabled ||
      activeTab !== 'discover' ||
      filters.search.trim().length > 0 ||
      discoverList.length > 3 ||
      library.history.length === 0 ||
      autoRefillInFlightRef.current ||
      Date.now() < autoRefillCooldownUntilRef.current ||
      isAiLoading ||
      isFindingSimilar
    ) {
      return;
    }

    autoRefillInFlightRef.current = true;
    setIsAutoRefilling(true);

    fetchAiRecommendations({
      subgenre: filters.subgenre,
      minImdb: filters.minImdb > 0 ? filters.minImdb : 6.5,
      obscurity: filters.obscurity,
      decade: filters.decade,
      audio: filters.audio,
      count: 10,
      prependToTop: false,
      silent: true,
    })
      .then((incoming) => {
        if (incoming.length === 0) {
          autoRefillCooldownUntilRef.current = Date.now() + 60_000;
        }
      })
      .catch((error) => {
        autoRefillCooldownUntilRef.current = Date.now() + 60_000;
        const msg =
          error instanceof Error && error.message
            ? error.message
            : 'Pico de demanda na Curadoria IA agora. Tente novamente em instantes.';
        showToast(msg, 'error');
      })
      .finally(() => {
        autoRefillInFlightRef.current = false;
        setIsAutoRefilling(false);
      });
  }, [
    autoRefillEnabled,
    activeTab,
    filters,
    discoverList.length,
    library.history.length,
    isAiLoading,
    isFindingSimilar,
    fetchAiRecommendations,
    showToast,
  ]);

  // Native background AI taste calibration: every 10 fresh liked/disliked/watchlist signals in the active universe
  useEffect(() => {
    const signalDelta = tasteProfile.signalCount - lastCalibratedSignalRef.current[universe];
    if (
      !autoRefillEnabled ||
      activeTab !== 'discover' ||
      filters.search.trim().length > 0 ||
      tasteProfile.signalCount < 8 ||
      signalDelta < 10 ||
      autoRefillInFlightRef.current ||
      Date.now() < autoRefillCooldownUntilRef.current ||
      isAiLoading ||
      isFindingSimilar
    ) {
      return;
    }

    lastCalibratedSignalRef.current[universe] = tasteProfile.signalCount;
    autoRefillInFlightRef.current = true;
    setIsAutoRefilling(true);

    fetchAiRecommendations({
      subgenre: filters.subgenre,
      minImdb: filters.minImdb > 0 ? filters.minImdb : 6.8,
      obscurity: filters.obscurity,
      decade: filters.decade,
      audio: filters.audio,
      count: 8,
      prependToTop: false,
      silent: true,
    })
      .catch(() => {
        autoRefillCooldownUntilRef.current = Date.now() + 60_000;
      })
      .finally(() => {
        autoRefillInFlightRef.current = false;
        setIsAutoRefilling(false);
      });
  }, [
    universe,
    autoRefillEnabled,
    activeTab,
    filters,
    tasteProfile.signalCount,
    isAiLoading,
    isFindingSimilar,
    fetchAiRecommendations,
  ]);

  const handleUpdateAvoidPreferences = useCallback(
    (nextPrefs: AvoidPreferences) => {
      const targetUniverse = universeRef.current;
      const sanitized = sanitizeAvoidPreferences(nextPrefs);
      updateUniverseLibrary(targetUniverse, (prev) => ({
        ...prev,
        avoidPreferences: sanitized,
      }));
      if (authUser?.uid) {
        void syncAvoidPreferencesToCloud(authUser.uid, targetUniverse, sanitized).catch(() => {});
      }
    },
    [authUser?.uid, updateUniverseLibrary],
  );

  const handleDecision = useCallback(
    (movieId: string, decision: MovieDecision, sentiment?: SeenSentiment) => {
      const targetUniverse = universeRef.current;
      setPinnedMovieId(null);
      setQueueSignal((prev) => ({
        seq: prev.seq + 1,
        mode: 'advance',
        actedMovieId: movieId,
      }));
      const next = applyMovieDecision(
        librariesRef.current[targetUniverse],
        movieId,
        decision,
        Date.now(),
        sentiment,
      );
      updateUniverseLibrary(targetUniverse, () => next);

      const entry = next.entries[movieId];
      if (authUser?.uid && entry) {
        void syncMovieEntryToCloud(authUser.uid, targetUniverse, movieId, entry).catch(() => {});
      }
    },
    [authUser?.uid, updateUniverseLibrary],
  );

  const handleToggleSentiment = useCallback(
    (movieId: string, sentiment: SeenSentiment) => {
      const targetUniverse = universeRef.current;
      const next = setSeenSentiment(librariesRef.current[targetUniverse], movieId, sentiment);
      updateUniverseLibrary(targetUniverse, () => next);
      const entry = next.entries[movieId];
      if (authUser?.uid && entry) {
        void syncMovieEntryToCloud(authUser.uid, targetUniverse, movieId, entry).catch(() => {});
      }
    },
    [authUser?.uid, updateUniverseLibrary],
  );

  const handleRateMovie = useCallback(
    (movieId: string, rating: number) => {
      const targetUniverse = universeRef.current;
      const next = setPersonalRating(librariesRef.current[targetUniverse], movieId, rating);
      updateUniverseLibrary(targetUniverse, () => next);
      const entry = next.entries[movieId];
      if (authUser?.uid && entry) {
        void syncMovieEntryToCloud(authUser.uid, targetUniverse, movieId, entry).catch(() => {});
      }
    },
    [authUser?.uid, updateUniverseLibrary],
  );

  const handleRemoveEntry = useCallback(
    (movieId: string) => {
      const targetUniverse = universeRef.current;
      updateUniverseLibrary(targetUniverse, (prev) => removeMovieEntry(prev, movieId));
      if (authUser?.uid) {
        void deleteMovieEntryFromCloud(authUser.uid, targetUniverse, movieId).catch(() => {});
      }
    },
    [authUser?.uid, updateUniverseLibrary],
  );

  const handleUndo = useCallback(() => {
    const targetUniverse = universeRef.current;
    const { nextState, restoredMovieId } = undoLastDecision(librariesRef.current[targetUniverse]);
    updateUniverseLibrary(targetUniverse, () => nextState);
    if (restoredMovieId) {
      setPinnedMovieId(restoredMovieId);
      setQueueSignal((prev) => ({
        seq: prev.seq + 1,
        mode: 'pin',
        pinnedMovieId: restoredMovieId,
      }));
      if (authUser?.uid) {
        const restoredEntry = nextState.entries[restoredMovieId];
        if (restoredEntry) {
          void syncMovieEntryToCloud(
            authUser.uid,
            targetUniverse,
            restoredMovieId,
            restoredEntry,
          ).catch(() => {});
        } else {
          void deleteMovieEntryFromCloud(authUser.uid, targetUniverse, restoredMovieId).catch(
            () => {},
          );
        }
      }
    }
  }, [authUser?.uid, updateUniverseLibrary]);

  const handleResetSkipped = useCallback(() => {
    const targetUniverse = universeRef.current;
    const skippedIds = Object.entries(librariesRef.current[targetUniverse].entries)
      .filter(([, entry]) => entry.status === 'skipped')
      .map(([id]) => id);

    updateUniverseLibrary(targetUniverse, (prev) => resetSkippedMovies(prev));
    if (authUser?.uid) {
      for (const id of skippedIds) {
        void deleteMovieEntryFromCloud(authUser.uid, targetUniverse, id).catch(() => {});
      }
    }
    showToast('Filmes pulados devolvidos à fila.');
  }, [authUser?.uid, showToast, updateUniverseLibrary]);

  const handleDiscoverSubmit = async (params: {
    subgenre: Subgenre | 'all';
    minImdb: number;
    obscurity: ObscurityFilter;
    decade: DecadeFilter;
    audio: AudioFilter;
    mood: string;
  }) => {
    const targetUniverse = universeRef.current;
    setIsAiLoading(true);
    setAiError(null);
    try {
      const added = await fetchAiRecommendations({
        ...params,
        count: 10,
        prependToTop: true,
      });
      if (added.length > 0 && universeRef.current === targetUniverse) {
        setFilters({
          ...DEFAULT_FILTERS,
          subgenre: params.subgenre,
          audio: params.audio,
          minImdb: 0,
          obscurity: 'all',
          decade: 'all',
        });
        setPinnedMovieId(added[0].id);
        setQueueSignal((prev) => ({
          seq: prev.seq + 1,
          mode: 'pin',
          pinnedMovieId: added[0].id,
        }));
        setActiveTab('discover');
        setIsDiscoverOpen(false);
      }
    } catch (error) {
      if (universeRef.current === targetUniverse) {
        setAiError(
          error instanceof Error
            ? error.message
            : 'Não foi possível concluir a curadoria agora.',
        );
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleFindSimilar = async (movie: Movie) => {
    if (isFindingSimilar) return;
    const targetUniverse = universeRef.current;
    setIsFindingSimilar(true);
    try {
      const added = await fetchAiRecommendations({
        subgenre: 'all',
        minImdb: Math.max(6.2, Number((movie.imdbRating - 0.6).toFixed(1))),
        obscurity: filters.obscurity,
        decade: 'all',
        audio: filters.audio,
        anchorMovie: movie,
        count: 6,
        prependToTop: true,
      });
      if (added.length > 0 && universeRef.current === targetUniverse) {
        setFilters({
          ...DEFAULT_FILTERS,
          audio: filters.audio,
        });
        setPinnedMovieId(added[0].id);
        setQueueSignal((prev) => ({
          seq: prev.seq + 1,
          mode: 'pin',
          pinnedMovieId: added[0].id,
        }));
        setActiveTab('discover');
      }
    } catch (error) {
      if (universeRef.current === targetUniverse) {
        showToast(
          error instanceof Error
            ? error.message
            : 'Não foi possível buscar filmes parecidos agora.',
          'error',
        );
      }
    } finally {
      setIsFindingSimilar(false);
    }
  };

  const handleManualLoadMore = async () => {
    if (isAutoRefilling) return;
    autoRefillCooldownUntilRef.current = 0;
    const targetUniverse = universeRef.current;
    setIsAutoRefilling(true);
    try {
      const wasEmpty = discoverList.length === 0;
      const added = await fetchAiRecommendations({
        subgenre: filters.subgenre,
        minImdb: filters.minImdb > 0 ? filters.minImdb : 6.5,
        obscurity: filters.obscurity,
        decade: filters.decade,
        audio: filters.audio,
        count: 10,
        prependToTop: false,
      });
      if (added.length > 0 && wasEmpty && universeRef.current === targetUniverse) {
        setPinnedMovieId(added[0].id);
        setQueueSignal((prev) => ({
          seq: prev.seq + 1,
          mode: 'pin',
          pinnedMovieId: added[0].id,
        }));
      }
    } catch (error) {
      if (universeRef.current === targetUniverse) {
        showToast(
          error instanceof Error ? error.message : 'Erro ao garimpar mais filmes.',
          'error',
        );
      }
    } finally {
      setIsAutoRefilling(false);
    }
  };

  const handleOpenRoulette = () => {
    const pool = watchlistMovies.length > 0 ? watchlistMovies : discoverList;
    const picked = pickRandomMovie(pool, rouletteMovie?.id);
    if (picked) {
      setRouletteMovie(picked);
    }
  };

  const handleExportBackup = () => {
    const payload = JSON.stringify(
      {
        universe,
        entries: library.entries,
        discoveredMovies: library.discoveredMovies,
        customSeenTitles: library.customSeenTitles,
        avoidPreferences: library.avoidPreferences,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = universeConfig.backupFilename;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Backup do ${universeConfig.name} baixado em JSON.`);
  };

  const handleImportBackup = (jsonText: string) => {
    const targetUniverse = universeRef.current;
    try {
      const raw = JSON.parse(jsonText) as { universe?: unknown };
      if (
        (raw?.universe === 'nocturna' || raw?.universe === 'matine') &&
        raw.universe !== targetUniverse
      ) {
        const expectedName = UNIVERSE_CONFIGS[raw.universe].name;
        showToast(
          `Este backup pertence ao ${expectedName}. Troque para o ${expectedName} antes de importar.`,
          'error',
        );
        return;
      }
    } catch {
      // parseStoredLibrary will handle invalid JSON cleanly
    }

    const parsed = parseStoredLibrary(jsonText);
    const entryCount = Object.keys(parsed.entries).length;
    if (entryCount === 0 && parsed.customSeenTitles.length === 0) {
      showToast('O arquivo JSON não continha registros válidos.', 'error');
      return;
    }
    updateUniverseLibrary(targetUniverse, () => parsed);
    if (authUser?.uid) {
      void mergeLocalLibraryIntoCloud(authUser.uid, targetUniverse, parsed).catch(() => {});
    }
    showToast(
      `Biblioteca do ${UNIVERSE_CONFIGS[targetUniverse].name} restaurada (${entryCount} marcados, ${parsed.customSeenTitles.length} externos).`,
    );
  };

  const mobileActiveFilterCount =
    (filters.subgenre !== 'all' ? 1 : 0) +
    (filters.minImdb > 0 ? 1 : 0) +
    (filters.obscurity !== 'all' ? 1 : 0) +
    (filters.decade !== 'all' ? 1 : 0) +
    (filters.audio !== 'all' ? 1 : 0) +
    (filters.search.trim().length > 0 ? 1 : 0) +
    (activeAvoidCount > 0 ? 1 : 0);

  const currentTabCount =
    activeTab === 'discover'
      ? discoverList.length
      : activeTab === 'watchlist'
        ? watchlistMovies.length
        : seenMovies.length;

  const contextLabel =
    activeTab === 'discover'
      ? 'na fila'
      : activeTab === 'watchlist'
        ? 'em Quero ver'
        : 'assistidos';

  return (
    <div className="min-h-screen bg-[#F4EAE4] text-[#2D1E25] dark:bg-[#09090B] dark:text-zinc-100 pb-20 md:pb-12 transition-colors duration-200">
      <Header
        universe={universe}
        onSwitchUniverse={handleSwitchUniverse}
        onCopyUniverseLink={handleCopyUniverseLink}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setMobileFiltersOpen(false);
          if (tab === 'discover' && committedQueueRef.current.heldFrontMovie) {
            setQueueSignal((prev) => ({ seq: prev.seq + 1, mode: 'reset' }));
          }
        }}
        onOpenDiscover={() => {
          setAiError(null);
          setIsDiscoverOpen(true);
        }}
        counts={{
          unwatched: counts.unwatched,
          watchlist: counts.watchlist,
          seen: counts.seenTotalWithExternal,
        }}
        user={authUser}
        syncStatus={syncStatus}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        mobileFilterCount={mobileActiveFilterCount}
        mobileFiltersOpen={mobileFiltersOpen}
        onToggleMobileFilters={() => setMobileFiltersOpen((prev) => !prev)}
      />

      <FilterBar
        universe={universe}
        filters={filters}
        subgenreOptions={universeConfig.subgenreOptions}
        onChange={setFilters}
        totalMatching={currentTabCount}
        contextLabel={contextLabel}
        activeAvoidCount={activeAvoidCount}
        onOpenAvoidPreferences={() => setIsAvoidOpen(true)}
        mobileOpen={mobileFiltersOpen}
        onCloseMobile={() => setMobileFiltersOpen(false)}
      />

      <main>
        {activeTab === 'discover' && (
          <DiscoveryDeck
            universe={universe}
            movies={discoverList}
            skippedCount={counts.skipped}
            canUndo={library.history.length > 0}
            tasteProfile={tasteProfile}
            isFindingSimilar={isFindingSimilar}
            isAutoRefilling={isAutoRefilling}
            isRefreshingReleases={isRefreshingReleases}
            autoRefillEnabled={autoRefillEnabled}
            onToggleAutoRefill={() => setAutoRefillEnabled((prev) => !prev)}
            onLoadMoreBatch={handleManualLoadMore}
            onRefreshLatestReleases={() =>
              void fetchLatestReleases({ force: true, silent: false, pinTop: true })
            }
            onDecision={handleDecision}
            onUndo={handleUndo}
            onResetFilters={() => setFilters(DEFAULT_FILTERS)}
            onResetSkipped={handleResetSkipped}
            onOpenDiscover={() => {
              setAiError(null);
              setIsDiscoverOpen(true);
            }}
            onFindSimilar={handleFindSimilar}
            onOpenBatchSeen={() => setIsBatchSeenOpen(true)}
            onCopyMatineLink={() => handleCopyUniverseLink('matine')}
            onJumpToMovie={(id) => {
              setPinnedMovieId(id);
              setQueueSignal((prev) => ({
                seq: prev.seq + 1,
                mode: 'pin',
                pinnedMovieId: id,
              }));
            }}
            onInspectMovie={setSelectedDetailMovie}
            activeAvoidCount={activeAvoidCount}
            onOpenAvoidPreferences={() => setIsAvoidOpen(true)}
          />
        )}

        {activeTab === 'watchlist' && (
          <MovieListView
            mode="watchlist"
            watchlistSubtitle={universeConfig.watchlistSubtitle}
            seenSubtitle={universeConfig.seenSubtitle}
            movies={watchlistMovies}
            entries={library.entries}
            customSeenTitles={library.customSeenTitles}
            onRemoveCustomSeenTitle={() => {}}
            onSelectMovie={setSelectedDetailMovie}
            onMarkSeen={(id, sentiment) => {
              handleDecision(id, 'seen', sentiment ?? 'liked');
              showToast(
                sentiment === 'disliked'
                  ? 'Marcado como assistido (Não curti).'
                  : 'Marcado como assistido (Curti).',
              );
            }}
            onToggleSentiment={handleToggleSentiment}
            onMoveToWatchlist={(id) => handleDecision(id, 'watchlist')}
            onRemoveEntry={handleRemoveEntry}
            onRateMovie={handleRateMovie}
            onFindSimilar={handleFindSimilar}
            onOpenRoulette={handleOpenRoulette}
            onOpenBatchSeen={() => setIsBatchSeenOpen(true)}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onGoToDiscover={() => setActiveTab('discover')}
          />
        )}

        {activeTab === 'seen' && (
          <MovieListView
            mode="seen"
            watchlistSubtitle={universeConfig.watchlistSubtitle}
            seenSubtitle={universeConfig.seenSubtitle}
            movies={seenMovies}
            entries={library.entries}
            customSeenTitles={library.customSeenTitles}
            onRemoveCustomSeenTitle={(title) => {
              const targetUniverse = universeRef.current;
              const nextTitles = librariesRef.current[targetUniverse].customSeenTitles.filter(
                (item) => item !== title,
              );
              updateUniverseLibrary(targetUniverse, (prev) => ({
                ...prev,
                customSeenTitles: nextTitles,
              }));
              if (authUser?.uid) {
                void syncExternalSeenTitlesToCloud(authUser.uid, targetUniverse, nextTitles).catch(
                  () => {},
                );
              }
            }}
            onSelectMovie={setSelectedDetailMovie}
            onMarkSeen={(id, sentiment) => handleDecision(id, 'seen', sentiment)}
            onToggleSentiment={handleToggleSentiment}
            onMoveToWatchlist={(id) => {
              handleDecision(id, 'watchlist');
              showToast('Adicionado de volta em Quero ver.');
            }}
            onRemoveEntry={handleRemoveEntry}
            onRateMovie={handleRateMovie}
            onFindSimilar={handleFindSimilar}
            onOpenRoulette={handleOpenRoulette}
            onOpenBatchSeen={() => setIsBatchSeenOpen(true)}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onGoToDiscover={() => setActiveTab('discover')}
          />
        )}
      </main>

      {/* Modals */}
      <DiscoverModal
        open={isDiscoverOpen}
        universeConfig={universeConfig}
        initialFilters={filters}
        tasteSummary={{
          seenCount: counts.seenTotalWithExternal,
          likedCount: tasteProfile.likedTitles.length + tasteProfile.watchlistTitles.length,
          dislikedCount: tasteProfile.dislikedTitles.length,
          likedExamples: [...tasteProfile.likedTitles, ...tasteProfile.watchlistTitles],
          dislikedExamples: tasteProfile.dislikedTitles,
        }}
        avoidLabels={activeAvoidLabels}
        onOpenAvoidPreferences={() => setIsAvoidOpen(true)}
        isLoading={isAiLoading}
        errorMessage={aiError}
        onClose={() => {
          if (!isAvoidOpen) setIsDiscoverOpen(false);
        }}
        onSubmit={handleDiscoverSubmit}
      />

      <AvoidPreferencesModal
        open={isAvoidOpen}
        universe={universe}
        universeName={universeConfig.name}
        preferences={library.avoidPreferences}
        onChange={handleUpdateAvoidPreferences}
        onClose={() => setIsAvoidOpen(false)}
      />

      <BatchSeenModal
        open={isBatchSeenOpen}
        importPlaceholder={universeConfig.batchImportPlaceholder}
        movies={fullCatalog}
        entries={library.entries}
        customSeenCount={library.customSeenTitles.length}
        onClose={() => setIsBatchSeenOpen(false)}
        onConfirmCatalogIds={(ids) => {
          const targetUniverse = universeRef.current;
          const next = batchMarkSeen(librariesRef.current[targetUniverse], ids);
          updateUniverseLibrary(targetUniverse, () => next);
          if (authUser?.uid) {
            for (const id of ids) {
              const entry = next.entries[id];
              if (entry) {
                void syncMovieEntryToCloud(authUser.uid, targetUniverse, id, entry).catch(() => {});
              }
            }
          }
          showToast(`${ids.length} filmes marcados como assistidos.`);
        }}
        onImportExternalList={(titles) => {
          const targetUniverse = universeRef.current;
          const result = importExternalSeenTitles(
            librariesRef.current[targetUniverse],
            fullCatalog,
            titles,
          );
          updateUniverseLibrary(targetUniverse, () => result.nextState);
          if (authUser?.uid) {
            void mergeLocalLibraryIntoCloud(authUser.uid, targetUniverse, result.nextState).catch(
              () => {},
            );
          }
          showToast(
            `Bagagem atualizada: ${result.matchedCatalogCount} do catálogo + ${result.addedExternalCount} externos bloqueados.`,
          );
        }}
      />

      <RouletteModal
        movie={rouletteMovie}
        poolSize={watchlistMovies.length > 0 ? watchlistMovies.length : discoverList.length}
        onClose={() => setRouletteMovie(null)}
        onSpinAgain={handleOpenRoulette}
        onMarkSeen={(id) => {
          handleDecision(id, 'seen', 'liked');
          showToast('Filme marcado como assistido.');
        }}
      />

      <MovieDetailModal
        movie={selectedDetailMovie}
        entry={selectedDetailMovie ? library.entries[selectedDetailMovie.id] : undefined}
        onClose={() => setSelectedDetailMovie(null)}
        onMarkSeen={(id, sentiment) => {
          handleDecision(id, 'seen', sentiment ?? 'liked');
          showToast(
            sentiment === 'disliked'
              ? 'Marcado como assistido (Não curti).'
              : 'Marcado como assistido (Curti).',
          );
        }}
        onMoveToWatchlist={(id) => handleDecision(id, 'watchlist')}
        onFindSimilar={handleFindSimilar}
      />

      {/* Magical Portal Transition Overlay between Nocturna and Matinê */}
      <UniverseTransitionOverlay transition={universeTransition} />

      {/* Offline indicator (invisible when online) */}
      <OfflineIndicator />

      {/* Quiet Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-2.5 text-xs font-medium shadow-xl backdrop-blur-md md:bottom-6 ${
            toast.tone === 'error'
              ? 'border-[#E1A8B6] bg-[#F6DCE2]/95 text-[#7D1E39] dark:border-rose-500/50 dark:bg-rose-950/90 dark:text-rose-100'
              : 'border-[#DFCBC1] bg-[#FAF3EE]/95 text-[#2D1E25] dark:border-zinc-700 dark:bg-[#141418]/95 dark:text-zinc-100'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
