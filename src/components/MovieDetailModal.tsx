import { useEffect } from 'react';
import { BookmarkPlus, Sparkles, Star, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import type { Movie, SeenSentiment, UserMovieEntry } from '../types/movie';
import { MoviePoster } from './MoviePoster';

interface MovieDetailModalProps {
  movie: Movie | null;
  entry?: UserMovieEntry;
  onClose: () => void;
  onMarkSeen: (movieId: string, sentiment?: SeenSentiment) => void;
  onMoveToWatchlist: (movieId: string) => void;
  onFindSimilar: (movie: Movie) => void;
}

export function MovieDetailModal({
  movie,
  entry,
  onClose,
  onMarkSeen,
  onMoveToWatchlist,
  onFindSimilar,
}: MovieDetailModalProps) {
  useEffect(() => {
    if (!movie) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [movie, onClose]);

  if (!movie) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D1E25]/45 dark:bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#DFCBC1] bg-[#FAF3EE] shadow-2xl dark:border-zinc-800 dark:bg-[#111115]">
        <div className="flex items-center justify-between border-b border-[#E5D3CA] px-6 py-4 dark:border-zinc-800">
          <span className="text-xs font-medium text-[#6E5660] dark:text-zinc-400">
            {movie.subgenre} · {movie.obscurity} ·{' '}
            <span
              className={
                movie.hasPtBrDub
                  ? 'text-[#1F5E48] dark:text-zinc-200'
                  : 'text-[#6E5660] dark:text-zinc-400'
              }
            >
              {movie.hasPtBrDub ? 'Dublado PT-BR' : 'Legendado'}
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes do filme"
            className="rounded-lg p-1.5 text-[#6E5660] hover:bg-[#EFE2DA] hover:text-[#2D1E25] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <div className="overflow-hidden rounded-xl border border-[#DFCBC1] dark:border-zinc-800">
              <MoviePoster movie={movie} size="card" priority className="w-full" />
            </div>
          </div>

          <div className="flex flex-col justify-between space-y-5 sm:col-span-7">
            <div className="space-y-3">
              <div>
                <h2
                  id="detail-modal-title"
                  className="font-display text-2xl font-semibold text-[#2D1E25] dark:text-zinc-50 text-balance"
                >
                  {movie.title}
                </h2>
                {movie.originalTitle !== movie.title && (
                  <p className="mt-1 text-xs text-[#6E5660] dark:text-zinc-400">
                    {movie.originalTitle}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6E5660] dark:text-zinc-400">
                <span className="inline-flex items-center gap-1 font-mono-num text-sm font-semibold text-[#2D1E25] dark:text-zinc-100">
                  <Star
                    className="h-4 w-4 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
                    aria-hidden="true"
                  />
                  {movie.imdbRating.toFixed(1)} IMDb
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{movie.year}</span>
                <span aria-hidden="true">·</span>
                <span>{movie.country}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{movie.runtimeMinutes} min</span>
              </div>

              <p className="text-xs text-[#6E5660] dark:text-zinc-400">
                Direção:{' '}
                <span className="font-medium text-[#2D1E25] dark:text-zinc-200">
                  {movie.director}
                </span>
              </p>

              <p className="text-sm leading-relaxed text-[#3E2B33] dark:text-zinc-200">
                {movie.synopsis}
              </p>

              {movie.editorialNote && (
                <p className="text-xs leading-relaxed text-[#6E5660] dark:text-zinc-400 italic">
                  {movie.editorialNote}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              {entry?.status !== 'seen' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onMarkSeen(movie.id, 'liked');
                      onClose();
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D4BEB3] bg-[#F1E5DE] px-3.5 py-2 text-xs font-medium text-[#2D1E25] hover:bg-[#E8D8CF] dark:border-zinc-700 dark:bg-[#18181D] dark:text-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                  >
                    <ThumbsUp className="h-3.5 w-3.5 text-[#1F5E48] dark:text-emerald-400" aria-hidden="true" />
                    Já vi · Curti
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onMarkSeen(movie.id, 'disliked');
                      onClose();
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#DFCBC1] bg-[#FAF3EE] px-3.5 py-2 text-xs font-medium text-[#4C3741] hover:border-[#DFB484] hover:text-[#7D4411] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-300 dark:hover:border-amber-500/40 dark:hover:text-amber-200 transition-colors whitespace-nowrap"
                  >
                    <ThumbsDown className="h-3.5 w-3.5 text-[#9A581B] dark:text-amber-400" aria-hidden="true" />
                    Não curti
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onMoveToWatchlist(movie.id);
                    onClose();
                  }}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D4BEB3] bg-[#F1E5DE] px-4 py-2 text-xs font-medium text-[#2D1E25] hover:bg-[#E8D8CF] dark:border-zinc-700 dark:bg-[#18181D] dark:text-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                >
                  <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                  Voltar para Quero ver
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onFindSimilar(movie);
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#BE3A5E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#A62E4F] dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors whitespace-nowrap"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Mais parecidos com este
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
