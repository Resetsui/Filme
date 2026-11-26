import { useEffect } from 'react';
import { Check, Dices, Star, X } from 'lucide-react';
import type { Movie } from '../types/movie';
import { MoviePoster } from './MoviePoster';

interface RouletteModalProps {
  movie: Movie | null;
  poolSize: number;
  onClose: () => void;
  onSpinAgain: () => void;
  onMarkSeen: (movieId: string) => void;
}

export function RouletteModal({
  movie,
  poolSize,
  onClose,
  onSpinAgain,
  onMarkSeen,
}: RouletteModalProps) {
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
      aria-labelledby="roulette-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D1E25]/45 dark:bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#DFCBC1] bg-[#FAF3EE] shadow-2xl dark:border-zinc-800 dark:bg-[#111115]">
        <div className="flex items-center justify-between border-b border-[#E5D3CA] px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-sm font-medium text-[#2D1E25] dark:text-zinc-200">
            <Dices className="h-4 w-4 text-[#BE3A5E] dark:text-rose-500" aria-hidden="true" />
            <span>Escolha da sessão</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar sorteio"
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
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E5660] dark:text-zinc-400">
                <span className="text-[#A62E4F] dark:text-rose-400">{movie.subgenre}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{movie.year}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{movie.runtimeMinutes} min</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    movie.hasPtBrDub
                      ? 'text-[#1F5E48] dark:text-zinc-200'
                      : 'text-[#6E5660] dark:text-zinc-400'
                  }
                >
                  {movie.hasPtBrDub ? 'Dublado PT-BR' : 'Legendado'}
                </span>
              </div>

              <h2
                id="roulette-modal-title"
                className="font-display text-2xl font-semibold text-[#2D1E25] dark:text-zinc-50 text-balance"
              >
                {movie.title}
              </h2>

              <div className="flex items-center gap-2 text-sm">
                <Star
                  className="h-4 w-4 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
                  aria-hidden="true"
                />
                <span className="font-mono-num font-semibold text-[#2D1E25] dark:text-zinc-100">
                  {movie.imdbRating.toFixed(1)}
                </span>
                <span className="text-xs text-[#6E5660] dark:text-zinc-500">IMDb · {movie.director}</span>
              </div>

              <p className="text-sm leading-relaxed text-[#3E2B33] dark:text-zinc-300">
                {movie.synopsis}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-lg bg-[#BE3A5E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A62E4F] dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors whitespace-nowrap"
              >
                Vou assistir hoje
              </button>

              {poolSize > 1 && (
                <button
                  type="button"
                  onClick={onSpinAgain}
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-[#D4BEB3] bg-[#F1E5DE] px-4 py-2 text-sm font-medium text-[#2D1E25] hover:bg-[#E8D8CF] dark:border-zinc-700 dark:bg-[#18181D] dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                >
                  <Dices className="h-4 w-4" aria-hidden="true" />
                  Sortear outro
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onMarkSeen(movie.id);
                  onClose();
                }}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-[#DFCBC1] px-3.5 py-2 text-xs font-medium text-[#5C454F] hover:text-[#2D1E25] dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors whitespace-nowrap"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Já vi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
