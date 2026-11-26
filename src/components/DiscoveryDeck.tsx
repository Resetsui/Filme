import { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'motion/react';
import {
  BookmarkPlus,
  Compass,
  Flame,
  Info,
  Link2,
  Loader2,
  RotateCcw,
  SkipForward,
  Snowflake,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Undo2,
} from 'lucide-react';
import { prefetchPoster } from '../hooks/usePosterUrl';
import type {
  AppUniverse,
  Movie,
  MovieDecision,
  SeenSentiment,
  TasteProfile,
} from '../types/movie';
import { MoviePoster } from './MoviePoster';

interface DiscoveryDeckProps {
  universe: AppUniverse;
  movies: Movie[];
  skippedCount: number;
  canUndo: boolean;
  tasteProfile: TasteProfile;
  isFindingSimilar: boolean;
  isAutoRefilling: boolean;
  isRefreshingReleases: boolean;
  autoRefillEnabled: boolean;
  onToggleAutoRefill: () => void;
  onLoadMoreBatch: () => void;
  onRefreshLatestReleases: () => void;
  onDecision: (movieId: string, decision: MovieDecision, sentiment?: SeenSentiment) => void;
  onUndo: () => void;
  onResetFilters: () => void;
  onResetSkipped: () => void;
  onOpenDiscover: () => void;
  onFindSimilar: (movie: Movie) => void;
  onOpenBatchSeen: () => void;
  onCopyMatineLink: () => void;
  onJumpToMovie: (movieId: string) => void;
  onInspectMovie: (movie: Movie) => void;
}

type ExitDirection = 'left' | 'right' | 'up' | 'down' | null;

interface SwipeablePosterCardProps {
  movie: Movie;
  isTop: boolean;
  isChristmasFilm: boolean;
  onSwipeDecision: (decision: MovieDecision, sentiment?: SeenSentiment) => void;
}

const cardVariants = {
  initialBack: {
    scale: 0.91,
    y: 18,
    opacity: 0,
    x: 0,
    zIndex: 5,
  },
  initialFront: {
    scale: 0.96,
    y: 10,
    opacity: 0,
    x: 0,
    zIndex: 20,
  },
  back: {
    scale: 0.95,
    y: 10,
    opacity: 0.55,
    x: 0,
    zIndex: 10,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
  },
  front: {
    scale: 1,
    y: 0,
    opacity: 1,
    x: 0,
    zIndex: 20,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
  },
  exitFront: (dir: ExitDirection) => ({
    x: dir === 'right' ? 420 : dir === 'left' ? -420 : 0,
    y: dir === 'up' ? -340 : dir === 'down' ? 340 : 0,
    opacity: 0,
    scale: 0.96,
    zIndex: 30,
    pointerEvents: 'none' as const,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
  }),
  exitBack: {
    scale: 0.9,
    y: 18,
    opacity: 0,
    zIndex: 1,
    pointerEvents: 'none' as const,
    transition: { duration: 0.16, ease: 'easeOut' as const },
  },
};

function SwipeablePosterCard({
  movie,
  isTop,
  isChristmasFilm,
  onSwipeDecision,
}: SwipeablePosterCardProps) {
  const [isMobileDetailsOpen, setIsMobileDetailsOpen] = useState(false);
  const isDraggingRef = useRef(false);
  const dragReleaseTimerRef = useRef<number | null>(null);

  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const rotate = useTransform(dragX, [-260, 0, 260], [-10, 0, 10]);

  // Dominant-axis directional stamp opacities so diagonal drags never flash conflicting badges
  const rightStampOpacity = useTransform([dragX, dragY], ([x, y]: number[]) => {
    if (x <= 30 || Math.abs(x) < Math.abs(y)) return 0;
    return Math.min(1, (x - 30) / 85);
  });
  const leftStampOpacity = useTransform([dragX, dragY], ([x, y]: number[]) => {
    if (x >= -30 || Math.abs(x) < Math.abs(y)) return 0;
    return Math.min(1, (-x - 30) / 85);
  });
  const upStampOpacity = useTransform([dragX, dragY], ([x, y]: number[]) => {
    if (y >= -28 || Math.abs(y) <= Math.abs(x)) return 0;
    return Math.min(1, (-y - 28) / 72);
  });
  const downStampOpacity = useTransform([dragX, dragY], ([x, y]: number[]) => {
    if (y <= 28 || Math.abs(y) <= Math.abs(x)) return 0;
    return Math.min(1, (y - 28) / 72);
  });

  useEffect(() => {
    if (!isTop && isMobileDetailsOpen) {
      setIsMobileDetailsOpen(false);
    }
  }, [isTop, isMobileDetailsOpen]);

  useEffect(() => {
    return () => {
      if (dragReleaseTimerRef.current !== null) {
        window.clearTimeout(dragReleaseTimerRef.current);
      }
    };
  }, []);

  const handleDragStart = () => {
    if (!isTop) return;
    if (dragReleaseTimerRef.current !== null) {
      window.clearTimeout(dragReleaseTimerRef.current);
      dragReleaseTimerRef.current = null;
    }
    isDraggingRef.current = true;
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!isTop) return;
    dragReleaseTimerRef.current = window.setTimeout(() => {
      isDraggingRef.current = false;
      dragReleaseTimerRef.current = null;
    }, 120);

    const absX = Math.abs(info.offset.x);
    const absY = Math.abs(info.offset.y);

    if (absX >= absY) {
      if (info.offset.x > 105 || info.velocity.x > 480) {
        onSwipeDecision('watchlist');
      } else if (info.offset.x < -105 || info.velocity.x < -480) {
        onSwipeDecision('seen', 'liked');
      }
    } else {
      if (info.offset.y < -85 || info.velocity.y < -450) {
        onSwipeDecision('seen', 'disliked');
      } else if (info.offset.y > 85 || info.velocity.y > 450) {
        onSwipeDecision('skipped');
      }
    }
  };

  const handlePosterClick = () => {
    if (!isTop || isDraggingRef.current) return;
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) return;
    setIsMobileDetailsOpen((prev) => !prev);
  };

  return (
    <motion.div
      data-testid={isTop ? 'active-poster-card' : 'back-poster-card'}
      aria-hidden={!isTop}
      variants={cardVariants}
      initial={isTop ? 'initialFront' : 'initialBack'}
      animate={isTop ? 'front' : 'back'}
      exit={isTop ? 'exitFront' : 'exitBack'}
      style={{ x: dragX, y: dragY, rotate }}
      drag={isTop && !isMobileDetailsOpen}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.85}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handlePosterClick}
      className={`absolute inset-0 rounded-2xl border border-[#DFCBC1] shadow-xl shadow-[#4A2E38]/12 dark:border-zinc-800 dark:shadow-2xl dark:shadow-black/70 overflow-hidden will-change-transform ${
        !isTop
          ? 'pointer-events-none'
          : isMobileDetailsOpen
            ? 'cursor-pointer touch-auto'
            : 'cursor-grab active:cursor-grabbing touch-none'
      }`}
    >
      <MoviePoster movie={movie} size="hero" priority className="w-full rounded-2xl" />

      {/* Mobile-only clean integrated poster overlay: IMDb rating + Title + tap for details */}
      {isTop && !isMobileDetailsOpen && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-4 pb-4 pt-20 lg:hidden">
          <div className="flex items-center justify-between gap-2 text-xs text-zinc-200">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="inline-flex items-center gap-1 font-mono-num font-semibold text-amber-300">
                <Star
                  className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0"
                  aria-hidden="true"
                />
                {movie.imdbRating.toFixed(1)}
              </span>
              <span aria-hidden="true" className="text-zinc-400">·</span>
              <span className="font-mono-num text-zinc-200">{movie.year}</span>
              <span aria-hidden="true" className="text-zinc-400">·</span>
              <span className={movie.hasPtBrDub ? 'text-emerald-300' : 'text-zinc-200'}>
                {movie.hasPtBrDub ? 'Dublado' : 'Legendado'}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMobileDetailsOpen(true);
              }}
              aria-label={`Ver sinopse e detalhes de ${movie.title}`}
              className="pointer-events-auto inline-flex h-7 items-center gap-1 rounded-md border border-white/25 bg-black/65 px-2.5 text-[11px] font-medium text-white backdrop-blur-sm hover:bg-black/85 transition-colors whitespace-nowrap shrink-0"
            >
              <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Sinopse</span>
            </button>
          </div>

          <p className="mt-1.5 font-display text-2xl font-semibold leading-tight text-white text-balance drop-shadow-sm">
            {movie.title}
          </p>
        </div>
      )}

      {/* Mobile-only tap-to-toggle inline details & synopsis overlay (tap again to return to poster) */}
      {isTop && isMobileDetailsOpen && (
        <div
          data-testid="mobile-poster-details"
          className="absolute inset-0 z-20 flex flex-col justify-between bg-[#120D11]/94 p-4 text-zinc-100 backdrop-blur-md lg:hidden animate-[fadeIn_160ms_ease-out]"
        >
          <div className="flex-1 overflow-y-auto pr-0.5 space-y-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-zinc-300">
              {isChristmasFilm ? (
                <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                  <Snowflake className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>Especial Natal</span>
                </span>
              ) : (
                <span className="text-rose-300">{movie.subgenre}</span>
              )}
              <span aria-hidden="true" className="text-zinc-500">·</span>
              <span className="font-mono-num">{movie.year}</span>
              <span aria-hidden="true" className="text-zinc-500">·</span>
              <span className="font-mono-num">{movie.runtimeMinutes} min</span>
              <span aria-hidden="true" className="text-zinc-500">·</span>
              <span className={movie.hasPtBrDub ? 'text-emerald-300' : 'text-zinc-300'}>
                {movie.hasPtBrDub ? 'Dublado PT-BR' : 'Legendado'}
              </span>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold leading-snug text-white text-balance">
                {movie.title}
              </h2>
              {movie.originalTitle !== movie.title && (
                <p className="mt-0.5 text-xs text-zinc-400">{movie.originalTitle}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-white/10 py-2 text-xs text-zinc-300">
              <span className="inline-flex items-center gap-1 font-mono-num font-semibold text-amber-300">
                <Star
                  className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0"
                  aria-hidden="true"
                />
                {movie.imdbRating.toFixed(1)} IMDb
              </span>
              <span aria-hidden="true" className="text-zinc-500">·</span>
              <span>{movie.country}</span>
              <span aria-hidden="true" className="text-zinc-500">·</span>
              <span>{movie.obscurity}</span>
            </div>

            <p className="text-xs text-zinc-300">
              Direção: <span className="font-medium text-white">{movie.director}</span>
              {movie.secondaryTag ? ` · ${movie.secondaryTag}` : ''}
            </p>

            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Sinopse
              </p>
              <p className="text-[13px] leading-relaxed text-zinc-100">{movie.synopsis}</p>
              {movie.editorialNote && (
                <p className="text-xs leading-relaxed text-zinc-400 italic">
                  {movie.editorialNote}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center border-t border-white/10 pt-2.5 text-[11px] font-medium text-zinc-300">
            Toque na capa novamente para voltar
          </div>
        </div>
      )}

      {/* 4-Way Directional Swipe Stamps */}
      {isTop && (
        <>
          <motion.div
            style={{ opacity: rightStampOpacity }}
            aria-hidden="true"
            className="pointer-events-none absolute left-5 top-5 z-10 rounded-md border-2 border-rose-500 bg-black/80 px-3 py-1 text-sm font-semibold tracking-wide text-rose-400"
          >
            Quero ver
          </motion.div>

          <motion.div
            style={{ opacity: leftStampOpacity }}
            aria-hidden="true"
            className="pointer-events-none absolute right-5 top-5 z-10 rounded-md border-2 border-emerald-400 bg-black/80 px-3 py-1 text-sm font-semibold tracking-wide text-emerald-300"
          >
            Já vi · Curti
          </motion.div>

          <motion.div
            style={{ opacity: upStampOpacity }}
            aria-hidden="true"
            className="pointer-events-none absolute bottom-28 lg:bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-md border-2 border-amber-400 bg-black/80 px-3.5 py-1 text-sm font-semibold tracking-wide text-amber-300 whitespace-nowrap"
          >
            Não curti
          </motion.div>

          <motion.div
            style={{ opacity: downStampOpacity }}
            aria-hidden="true"
            className="pointer-events-none absolute top-6 left-1/2 z-10 -translate-x-1/2 rounded-md border-2 border-zinc-300 bg-black/80 px-3.5 py-1 text-sm font-semibold tracking-wide text-zinc-100 whitespace-nowrap"
          >
            Pular
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

export function DiscoveryDeck({
  universe,
  movies,
  skippedCount,
  canUndo,
  tasteProfile,
  isFindingSimilar,
  isAutoRefilling,
  isRefreshingReleases,
  autoRefillEnabled,
  onToggleAutoRefill,
  onLoadMoreBatch,
  onRefreshLatestReleases,
  onDecision,
  onUndo,
  onResetFilters,
  onResetSkipped,
  onOpenDiscover,
  onFindSimilar,
  onOpenBatchSeen,
  onCopyMatineLink,
  onJumpToMovie,
  onInspectMovie,
}: DiscoveryDeckProps) {
  const currentMovie = movies[0] ?? null;
  const nextMovie = movies[1] ?? null;
  const upcoming = movies.slice(1, 5);
  const visibleStack = nextMovie && currentMovie ? [nextMovie, currentMovie] : currentMovie ? [currentMovie] : [];

  const [exitDirection, setExitDirection] = useState<ExitDirection>(null);

  useEffect(() => {
    movies.slice(0, 5).forEach((movie) => prefetchPoster(movie));
  }, [movies]);

  const triggerDecision = (decision: MovieDecision, sentiment?: SeenSentiment) => {
    if (!currentMovie) return;
    setExitDirection(
      decision === 'watchlist'
        ? 'right'
        : decision === 'seen'
          ? sentiment === 'disliked'
            ? 'up'
            : 'left'
          : 'down',
    );
    onDecision(currentMovie.id, decision, sentiment);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (document.querySelector('[role="dialog"]')) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!currentMovie) return;

      const key = event.key.toLowerCase();
      if (event.key === 'ArrowRight' || key === 'q') {
        event.preventDefault();
        triggerDecision('watchlist');
      } else if (event.key === 'ArrowLeft' || key === 'c') {
        event.preventDefault();
        triggerDecision('seen', 'liked');
      } else if (event.key === 'ArrowUp' || key === 'n') {
        event.preventDefault();
        triggerDecision('seen', 'disliked');
      } else if (event.key === 'ArrowDown' || key === 'p') {
        event.preventDefault();
        triggerDecision('skipped');
      } else if (key === 'z' && canUndo) {
        event.preventDefault();
        onUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!currentMovie) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:py-24">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-[#DFCBC1] bg-[#FAF3EE] text-[#6E5660] shadow-xs dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-400">
          <Compass className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="font-display text-2xl font-semibold text-[#2D1E25] dark:text-zinc-50 text-balance sm:text-3xl">
          Você zerou os filmes deste filtro
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[#6E5660] dark:text-zinc-400">
          Nenhum filme inédito corresponde aos filtros atuais. Você pode usar a Curadoria IA para
          garimpar sugestões afinadas ao seu gosto sem repetir o que já assistiu, ou ajustar seus
          filtros.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onLoadMoreBatch}
            disabled={isAutoRefilling}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#BE3A5E] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#A62E4F] dark:bg-rose-600 dark:hover:bg-rose-500 disabled:opacity-60 transition-colors"
          >
            {isAutoRefilling ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{isAutoRefilling ? 'Garimpando +10 filmes...' : 'Garimpar +10 com IA'}</span>
          </button>

          <button
            type="button"
            onClick={onRefreshLatestReleases}
            disabled={isRefreshingReleases}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#E2C29B] bg-[#F7EBDC] px-4 py-2.5 text-sm font-medium text-[#8B4D15] hover:bg-[#F1DFC7] dark:border-zinc-700 dark:bg-[#141418] dark:text-amber-300 dark:hover:bg-zinc-800 disabled:opacity-60 transition-colors"
          >
            {isRefreshingReleases ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Flame className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{isRefreshingReleases ? 'Buscando lançamentos...' : 'Lançamentos atuais'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenDiscover}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#DEC9BF] bg-[#FAF3EE] px-5 py-2.5 text-sm font-medium text-[#2D1E25] hover:bg-[#F0E3DC] dark:border-zinc-700 dark:bg-[#141418] dark:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Personalizar curadoria
          </button>

          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#DFCBC1] bg-transparent px-4 py-2.5 text-sm font-medium text-[#5C454F] hover:text-[#2D1E25] dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Limpar filtros
          </button>

          {skippedCount > 0 && (
            <button
              type="button"
              onClick={onResetSkipped}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#DFCBC1] bg-transparent px-4 py-2.5 text-sm font-medium text-[#5C454F] hover:text-[#2D1E25] dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              Rever {skippedCount} pulados
            </button>
          )}
        </div>
      </div>
    );
  }

  const tasteSummaryParts: string[] = [];
  if (tasteProfile.likedTitles.length > 0) {
    tasteSummaryParts.push(`Curtiu ${tasteProfile.likedTitles.slice(0, 2).join(', ')}`);
  } else if (tasteProfile.watchlistTitles.length > 0) {
    tasteSummaryParts.push(`Interesse em ${tasteProfile.watchlistTitles.slice(0, 2).join(', ')}`);
  }
  if (tasteProfile.dislikedTitles.length > 0) {
    tasteSummaryParts.push(`Evitando linha de ${tasteProfile.dislikedTitles.slice(0, 2).join(', ')}`);
  }

  const isChristmasFilm = currentMovie.subgenre === 'Natal & Fim de Ano';

  return (
    <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 lg:py-7">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-10">
        {/* Left Column: Interactive Swipeable Poster Deck */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div
            className="relative w-full max-w-[332px] sm:max-w-[345px] lg:max-w-[355px]"
            style={{ aspectRatio: '2 / 3' }}
          >
            <AnimatePresence custom={exitDirection} initial={false}>
              {visibleStack.map((movie, idx) => {
                const isTop = idx === visibleStack.length - 1;
                return (
                  <SwipeablePosterCard
                    key={movie.id}
                    movie={movie}
                    isTop={isTop}
                    isChristmasFilm={movie.subgenre === 'Natal & Fim de Ano'}
                    onSwipeDecision={triggerDecision}
                  />
                );
              })}
            </AnimatePresence>
          </div>

          <p className="mt-2.5 hidden lg:block text-xs text-[#7D636D] dark:text-zinc-500 text-center">
            Arraste a capa: ← Curti · → Quero ver · ↑ Não curti · ↓ Pular
          </p>
          <p className="mt-2 lg:hidden text-[11px] text-[#7D636D] dark:text-zinc-500 text-center">
            Arraste em 4 direções · Toque na capa para sinopse
          </p>
        </div>

        {/* Right Column: Editorial Dossier (Desktop) & Primary Decision Controls (All Screens) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4 lg:space-y-5">
          <div className="hidden lg:block space-y-4">
            {/* Quiet unboxed metadata kicker line (Zero-Pill Discipline) */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-[#6E5660] dark:text-zinc-400">
              {isChristmasFilm ? (
                <span className="inline-flex items-center gap-1 text-[#1F5E48] font-semibold">
                  <Snowflake className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Especial Natal</span>
                </span>
              ) : (
                <span className="text-[#A62E4F] dark:text-rose-400">{currentMovie.subgenre}</span>
              )}
              <span aria-hidden="true" className="text-[#CEB8AE] dark:text-zinc-600">·</span>
              <span className="font-mono-num">{currentMovie.year}</span>
              <span aria-hidden="true" className="text-[#CEB8AE] dark:text-zinc-600">·</span>
              <span>{currentMovie.country}</span>
              <span aria-hidden="true" className="text-[#CEB8AE] dark:text-zinc-600">·</span>
              <span className="font-mono-num">{currentMovie.runtimeMinutes} min</span>
              <span aria-hidden="true" className="text-[#CEB8AE] dark:text-zinc-600">·</span>
              <span className="text-[#4C3741] dark:text-zinc-300">{currentMovie.obscurity}</span>
              <span aria-hidden="true" className="text-[#CEB8AE] dark:text-zinc-600">·</span>
              <span
                className={
                  currentMovie.hasPtBrDub
                    ? 'text-[#1F5E48] dark:text-emerald-400/90'
                    : 'text-[#6E5660] dark:text-zinc-400'
                }
              >
                {currentMovie.hasPtBrDub ? 'Dublado PT-BR' : 'Legendado'}
              </span>
              {currentMovie.isAiDiscovered && (
                <>
                  <span aria-hidden="true" className="text-[#CEB8AE] dark:text-zinc-600">·</span>
                  <span className="text-[#9A581B] dark:text-amber-300/90">Curadoria IA</span>
                </>
              )}
            </div>

            {/* Movie Display Title & Original Title */}
            <div>
              <h1
                data-testid="active-movie-title"
                className="font-display text-3xl font-semibold tracking-tight text-[#2D1E25] dark:text-zinc-50 text-balance sm:text-4xl lg:text-[2.7rem] lg:leading-[1.12]"
              >
                {currentMovie.title}
              </h1>
              {currentMovie.originalTitle !== currentMovie.title && (
                <p className="mt-1.5 text-sm text-[#6E5660] dark:text-zinc-400">
                  Título original: {currentMovie.originalTitle}
                </p>
              )}
            </div>

            {/* IMDb Rating & Director — crisp tabular figures */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-[#DFCBC1] dark:border-zinc-800/80 py-3 text-sm">
              <div className="flex items-center gap-2">
                <Star
                  className="h-4 w-4 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400 shrink-0"
                  aria-hidden="true"
                />
                <span className="font-mono-num text-base font-semibold text-[#2D1E25] dark:text-zinc-50">
                  {currentMovie.imdbRating.toFixed(1)}
                </span>
                <span className="text-xs text-[#6E5660] dark:text-zinc-500">IMDb / 10</span>
              </div>

              <div className="text-[#6E5660] dark:text-zinc-400">
                Direção:{' '}
                <span className="font-medium text-[#2D1E25] dark:text-zinc-200">
                  {currentMovie.director}
                </span>
              </div>

              {currentMovie.secondaryTag && (
                <div className="text-[#6E5660] dark:text-zinc-400">
                  Foco:{' '}
                  <span className="font-medium text-[#2D1E25] dark:text-zinc-200">
                    {currentMovie.secondaryTag}
                  </span>
                </div>
              )}
            </div>

            {/* Brief Synopsis */}
            <div className="space-y-2.5">
              <h2 className="text-xs font-medium text-[#7A616B] dark:text-zinc-500">Sinopse</h2>
              <p className="max-w-2xl text-[15px] sm:text-base leading-relaxed text-[#3E2B33] dark:text-zinc-200">
                {currentMovie.synopsis}
              </p>
              {currentMovie.editorialNote && (
                <p className="max-w-2xl text-sm leading-relaxed text-[#6E5660] dark:text-zinc-400 italic">
                  {currentMovie.editorialNote}
                </p>
              )}
            </div>
          </div>

          {/* 4-Way Native Decision Controls: Não curti / Já vi · Curti / Pular / Quero ver */}
          <div className="mx-auto w-full max-w-[332px] sm:max-w-[345px] lg:max-w-none space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-2.5">
              <button
                type="button"
                onClick={() => triggerDecision('seen', 'disliked')}
                aria-label="Já vi e não curti"
                className="inline-flex min-h-[46px] lg:min-h-[48px] items-center justify-center gap-1.5 lg:gap-2 rounded-xl border border-[#DFCBC1] bg-[#FAF3EE] px-3 py-2.5 lg:py-3 text-xs sm:text-sm font-medium text-[#4C3741] hover:border-[#D9A773] hover:bg-[#F7EBDC] hover:text-[#7D4411] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-300 dark:hover:border-amber-500/50 dark:hover:bg-amber-950/20 dark:hover:text-amber-200 active:scale-[0.98] transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <ThumbsDown className="h-4 w-4 text-[#7A616B] dark:text-zinc-400 shrink-0" aria-hidden="true" />
                <span>Não curti</span>
                <kbd className="hidden font-mono-num text-[11px] text-[#9E848E] dark:text-zinc-600 lg:inline">↑</kbd>
              </button>

              <button
                type="button"
                onClick={() => triggerDecision('seen', 'liked')}
                aria-label="Já vi e curti"
                className="inline-flex min-h-[46px] lg:min-h-[48px] items-center justify-center gap-1.5 lg:gap-2 rounded-xl border border-[#D4BEB3] bg-[#FAF3EE] px-3 py-2.5 lg:py-3 text-xs sm:text-sm font-medium text-[#2D1E25] hover:border-[#9EC6B1] hover:bg-[#DFECE5] hover:text-[#184B39] dark:border-zinc-700/80 dark:bg-[#141418] dark:text-zinc-100 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-200 active:scale-[0.98] transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <ThumbsUp className="h-4 w-4 text-[#1F5E48] dark:text-emerald-400/90 shrink-0" aria-hidden="true" />
                <span>Já vi · Curti</span>
                <kbd className="hidden font-mono-num text-[11px] text-[#9E848E] dark:text-zinc-500 lg:inline">←</kbd>
              </button>

              <button
                type="button"
                onClick={() => triggerDecision('skipped')}
                className="inline-flex min-h-[46px] lg:min-h-[48px] items-center justify-center gap-1.5 lg:gap-2 rounded-xl border border-[#DFCBC1] bg-transparent px-3 py-2.5 lg:py-3 text-xs sm:text-sm font-medium text-[#5C454F] hover:border-[#CBB0A3] hover:bg-[#FAF3EE] hover:text-[#2D1E25] dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-[#141418] dark:hover:text-zinc-200 active:scale-[0.98] transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
              >
                <SkipForward className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Pular</span>
                <kbd className="hidden font-mono-num text-[11px] text-[#9E848E] dark:text-zinc-600 lg:inline">↓</kbd>
              </button>

              <button
                type="button"
                onClick={() => triggerDecision('watchlist')}
                className="inline-flex min-h-[46px] lg:min-h-[48px] items-center justify-center gap-1.5 lg:gap-2 rounded-xl bg-[#BE3A5E] px-3 lg:px-4 py-2.5 lg:py-3 text-xs sm:text-sm font-semibold text-white hover:bg-[#A62E4F] dark:bg-rose-600 dark:hover:bg-rose-500 active:scale-[0.98] transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BE3A5E] dark:focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4EAE4] dark:focus-visible:ring-offset-[#09090B]"
              >
                <BookmarkPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Quero ver</span>
                <kbd className="hidden font-mono-num text-[11px] text-rose-100/80 lg:inline">→</kbd>
              </button>
            </div>

            {/* Contextual Utility Row */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="inline-flex min-h-[34px] items-center gap-1.5 font-medium text-[#6E5660] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap"
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Desfazer</span>
                </button>

                <button
                  type="button"
                  onClick={() => onFindSimilar(currentMovie)}
                  disabled={isFindingSimilar}
                  className="inline-flex min-h-[34px] items-center gap-1.5 font-medium text-[#A62E4F] hover:text-[#8E2341] dark:text-rose-400 dark:hover:text-rose-300 disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  {isFindingSimilar ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span className="lg:hidden">
                    {isFindingSimilar ? 'Buscando...' : 'Parecidos'}
                  </span>
                  <span className="hidden lg:inline">
                    {isFindingSimilar ? 'Buscando filmes parecidos...' : 'Mais parecidos com este'}
                  </span>
                </button>
              </div>

              <div className="hidden lg:flex items-center gap-4">
                {universe === 'matine' && (
                  <button
                    type="button"
                    onClick={onCopyMatineLink}
                    className="inline-flex min-h-[34px] items-center gap-1.5 text-[#6E5660] hover:text-[#2D1E25] transition-colors whitespace-nowrap"
                  >
                    <Link2 className="h-3.5 w-3.5 text-[#BE3A5E]" aria-hidden="true" />
                    <span>Copiar link do Matinê</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onOpenBatchSeen}
                  className="inline-flex min-h-[34px] items-center text-[#6E5660] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:text-zinc-200 underline decoration-[#D4BEB3] dark:decoration-zinc-700 underline-offset-4 transition-colors whitespace-nowrap"
                >
                  Marcar clássicos / importar lista
                </button>
              </div>

              <button
                type="button"
                onClick={() => onInspectMovie(currentMovie)}
                className="inline-flex lg:hidden min-h-[34px] items-center gap-1 text-[#5C454F] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors whitespace-nowrap"
              >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Detalhes</span>
              </button>
            </div>

            {/* Native Live Taste Calibration Strip (Desktop) */}
            {tasteSummaryParts.length > 0 && (
              <div
                data-testid="native-taste-strip"
                className="hidden lg:flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DFCBC1] bg-[#FAF3EE] px-4 py-2.5 text-xs shadow-xs dark:border-zinc-800/80 dark:bg-[#111115]"
              >
                <p className="text-[#5C454F] dark:text-zinc-400 truncate max-w-lg">
                  <span className="font-medium text-[#2D1E25] dark:text-zinc-200">
                    Curadoria adaptativa:
                  </span>{' '}
                  {tasteSummaryParts.join(' · ')}
                </p>
                <button
                  type="button"
                  onClick={onLoadMoreBatch}
                  disabled={isAutoRefilling}
                  className="inline-flex items-center gap-1.5 font-medium text-[#A62E4F] hover:text-[#8E2341] dark:text-rose-400 dark:hover:text-rose-300 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                >
                  {isAutoRefilling ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      <span>Calibrando fila...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Calibrar fila com IA</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Upcoming Queue Strip + Infinite Digging Controls (Desktop) */}
          <div className="hidden lg:block border-t border-[#DFCBC1] dark:border-zinc-800/80 pt-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-medium text-[#5C454F] dark:text-zinc-400">
                  Próximos na fila
                </h3>
                <span className="font-mono-num text-xs text-[#7D636D] dark:text-zinc-500">
                  +{Math.max(0, movies.length - 1)} restantes
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoRefillEnabled}
                  onClick={onToggleAutoRefill}
                  className={`inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
                    autoRefillEnabled
                      ? 'text-[#2D1E25] dark:text-zinc-200'
                      : 'text-[#7D636D] hover:text-[#2D1E25] dark:text-zinc-500 dark:hover:text-zinc-300'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                      autoRefillEnabled ? 'bg-[#BE3A5E] dark:bg-rose-600' : 'bg-[#D6C1B7] dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
                        autoRefillEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                  <span>Garimpo infinito</span>
                </button>

                <button
                  type="button"
                  onClick={onRefreshLatestReleases}
                  disabled={isRefreshingReleases}
                  className="inline-flex items-center gap-1.5 font-medium text-[#9A581B] hover:text-[#7D4411] dark:text-amber-300/90 dark:hover:text-amber-200 disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  {isRefreshingReleases ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      <span>Buscando lançamentos...</span>
                    </>
                  ) : (
                    <>
                      <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Lançamentos</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onLoadMoreBatch}
                  disabled={isAutoRefilling}
                  className="inline-flex items-center gap-1.5 font-medium text-[#A62E4F] hover:text-[#8E2341] dark:text-rose-400 dark:hover:text-rose-300 disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  {isAutoRefilling ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      <span>Garimpando +10 filmes...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>+10 novos com IA</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {upcoming.length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {upcoming.map((movie) => (
                  <button
                    key={movie.id}
                    type="button"
                    onClick={() => onJumpToMovie(movie.id)}
                    aria-label={`Ver ${movie.title} agora`}
                    className="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BE3A5E] dark:focus-visible:ring-rose-500 rounded-lg"
                  >
                    <div className="overflow-hidden rounded-lg border border-[#DFCBC1] group-hover:border-[#BE3A5E]/60 dark:border-zinc-800/90 dark:group-hover:border-zinc-500 transition-colors">
                      <MoviePoster
                        movie={movie}
                        size="thumb"
                        className="w-full transition-transform duration-200 group-hover:scale-[1.03]"
                      />
                    </div>
                    <p className="mt-1.5 truncate text-xs font-medium text-[#3E2B33] group-hover:text-[#2D1E25] dark:text-zinc-300 dark:group-hover:text-white">
                      {movie.title}
                    </p>
                    <p className="font-mono-num text-[11px] text-[#7D636D] dark:text-zinc-500">
                      IMDb {movie.imdbRating.toFixed(1)} · {movie.year}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
