import { Film, ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePosterUrl } from '../hooks/usePosterUrl';
import type { Movie } from '../types/movie';

interface MoviePosterProps {
  movie: Movie;
  size?: 'hero' | 'card' | 'thumb';
  className?: string;
  priority?: boolean;
}

export function MoviePoster({
  movie,
  size = 'card',
  className = '',
  priority = false,
}: MoviePosterProps) {
  const { url, isLoading } = usePosterUrl(movie);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    setLoadedUrl(null);
    setFailedUrl(null);
  }, [movie.id]);

  const hasValidCandidate = Boolean(url && failedUrl !== url);
  const isOfficialLoaded = hasValidCandidate && loadedUrl === url;
  const isStillFetching = isLoading || (hasValidCandidate && !isOfficialLoaded);
  const isUnavailable = !isStillFetching && !isOfficialLoaded;

  return (
    <div
      data-testid="movie-poster"
      data-poster-state={isOfficialLoaded ? 'loaded' : isStillFetching ? 'loading' : 'unavailable'}
      className={`relative overflow-hidden bg-[#ECE0D8] dark:bg-[#141418] select-none ${className}`}
      style={{ aspectRatio: '2 / 3' }}
    >
      {/* Clean minimalist loading state (zero fake cover artwork) */}
      {isStillFetching && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-center bg-[#ECE0D8] dark:bg-[#141418] ${
            size === 'thumb' ? 'p-2' : 'p-5'
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DFCBC1] bg-[#FAF3EE]/80 text-[#9B7E88] animate-pulse dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-500">
            <Film className={size === 'thumb' ? 'h-4 w-4' : 'h-5 w-5'} />
          </div>
          {size !== 'thumb' && (
            <p className="text-[11px] font-medium text-[#7C636D] dark:text-zinc-500">
              Buscando capa oficial…
            </p>
          )}
        </div>
      )}

      {/* Honest unavailable cover state — never shows fake/stock movie covers */}
      {isUnavailable && (
        <div
          data-testid="poster-unavailable"
          className={`absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-[#EFE3DC] via-[#EADAD1] to-[#E2CEC4] text-[#2D1E25] dark:from-[#17171C] dark:via-[#121216] dark:to-[#0C0C0F] dark:text-zinc-100 ${
            size === 'thumb' ? 'p-2.5' : size === 'card' ? 'p-4' : 'p-6'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] tracking-wide text-[#7C636D] dark:text-zinc-500">
            <span className="truncate">{movie.director}</span>
            <span className="font-mono-num shrink-0 ml-2">{movie.year}</span>
          </div>

          <div className="my-auto flex flex-col items-center justify-center text-center px-1">
            <div
              className={`flex items-center justify-center rounded-2xl border border-dashed border-[#CDB4AA] bg-[#FAF3EE]/70 text-[#8A6D77] dark:border-zinc-700/80 dark:bg-zinc-900/70 dark:text-zinc-400 ${
                size === 'thumb' ? 'h-8 w-8 rounded-xl' : size === 'card' ? 'h-11 w-11' : 'h-14 w-14'
              }`}
            >
              <ImageOff
                className={size === 'thumb' ? 'h-3.5 w-3.5' : size === 'card' ? 'h-5 w-5' : 'h-6 w-6'}
              />
            </div>
            <p
              className={`mt-2.5 font-medium text-[#6B535D] dark:text-zinc-400 ${
                size === 'thumb'
                  ? 'text-[10px] leading-tight'
                  : size === 'card'
                    ? 'text-xs leading-snug'
                    : 'text-sm leading-snug'
              }`}
            >
              {size === 'thumb' ? 'Sem capa' : 'Não foi possível encontrar a capa'}
            </p>
          </div>

          <div className="space-y-1 border-t border-[#DFCBC1] pt-2.5 dark:border-zinc-800/80">
            <p
              className={`font-display font-semibold leading-tight text-balance text-[#2D1E25] dark:text-zinc-100 ${
                size === 'hero'
                  ? 'text-lg sm:text-xl'
                  : size === 'card'
                    ? 'text-sm line-clamp-2'
                    : 'text-[11px] line-clamp-2'
              }`}
            >
              {movie.title}
            </p>
            {size === 'hero' && movie.originalTitle !== movie.title && (
              <p className="text-[11px] text-[#7C636D] dark:text-zinc-500 truncate">
                {movie.originalTitle}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Official theatrical movie poster fetched via verified allowlisted proxy */}
      {hasValidCandidate && url && (
        <img
          src={url}
          alt={`Pôster oficial do filme ${movie.title} (${movie.year})`}
          referrerPolicy="no-referrer"
          loading={priority ? 'eager' : 'lazy'}
          onLoad={() => setLoadedUrl(url)}
          onError={() => setFailedUrl(url)}
          draggable={false}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            isOfficialLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Subtle hairline inner rim */}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-[#2D1E25]/10 dark:ring-white/10" />
    </div>
  );
}
