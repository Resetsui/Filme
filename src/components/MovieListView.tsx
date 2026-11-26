import { useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Dices,
  Download,
  ListChecks,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Movie, SeenSentiment, UserMovieEntry } from '../types/movie';
import { MoviePoster } from './MoviePoster';

interface MovieListViewProps {
  mode: 'watchlist' | 'seen';
  watchlistSubtitle: string;
  seenSubtitle: string;
  movies: Movie[];
  entries: Record<string, UserMovieEntry>;
  customSeenTitles: string[];
  onRemoveCustomSeenTitle: (title: string) => void;
  onSelectMovie: (movie: Movie) => void;
  onMarkSeen: (movieId: string, sentiment?: SeenSentiment) => void;
  onToggleSentiment: (movieId: string, sentiment: SeenSentiment) => void;
  onMoveToWatchlist: (movieId: string) => void;
  onRemoveEntry: (movieId: string) => void;
  onRateMovie: (movieId: string, rating: number) => void;
  onFindSimilar: (movie: Movie) => void;
  onOpenRoulette: () => void;
  onOpenBatchSeen: () => void;
  onExportBackup: () => void;
  onImportBackup: (jsonText: string) => void;
  onGoToDiscover: () => void;
}

type SeenFilterTab = 'all' | 'liked' | 'disliked';

function getEntrySentiment(entry?: UserMovieEntry): SeenSentiment | undefined {
  if (!entry || entry.status !== 'seen') return undefined;
  if (entry.sentiment) return entry.sentiment;
  if (typeof entry.personalRating === 'number') {
    return entry.personalRating <= 2 ? 'disliked' : 'liked';
  }
  return undefined;
}

export function MovieListView({
  mode,
  watchlistSubtitle,
  seenSubtitle,
  movies,
  entries,
  customSeenTitles,
  onRemoveCustomSeenTitle,
  onSelectMovie,
  onMarkSeen,
  onToggleSentiment,
  onMoveToWatchlist,
  onRemoveEntry,
  onRateMovie,
  onFindSimilar,
  onOpenRoulette,
  onOpenBatchSeen,
  onExportBackup,
  onImportBackup,
  onGoToDiscover,
}: MovieListViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [seenFilter, setSeenFilter] = useState<SeenFilterTab>('all');

  const sentimentCounts = useMemo(() => {
    let liked = 0;
    let disliked = 0;
    for (const movie of movies) {
      const s = getEntrySentiment(entries[movie.id]);
      if (s === 'liked') liked += 1;
      else if (s === 'disliked') disliked += 1;
    }
    return { total: movies.length, liked, disliked };
  }, [movies, entries]);

  const displayedMovies = useMemo(() => {
    if (mode !== 'seen' || seenFilter === 'all') return movies;
    return movies.filter((movie) => getEntrySentiment(entries[movie.id]) === seenFilter);
  }, [mode, movies, entries, seenFilter]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportBackup(reader.result);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#DFCBC1] dark:border-zinc-800/80 pb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#2D1E25] dark:text-zinc-50 sm:text-3xl">
            {mode === 'watchlist' ? 'Quero ver' : 'Filmes já assistidos'}
          </h1>
          <p className="mt-1.5 text-sm text-[#6E5660] dark:text-zinc-400">
            {mode === 'watchlist' ? watchlistSubtitle : seenSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {mode === 'watchlist' && movies.length > 0 && (
            <button
              type="button"
              onClick={onOpenRoulette}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#BE3A5E] px-4 py-2 text-sm font-medium text-white hover:bg-[#A62E4F] dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors whitespace-nowrap"
            >
              <Dices className="h-4 w-4" aria-hidden="true" />
              Escolher por mim
            </button>
          )}

          {mode === 'seen' && (
            <>
              <button
                type="button"
                onClick={onOpenBatchSeen}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#D6C1B7] bg-[#FAF3EE] px-4 py-2 text-sm font-medium text-[#2D1E25] hover:bg-[#F0E3DC] dark:border-zinc-700 dark:bg-[#141418] dark:text-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
              >
                <ListChecks className="h-4 w-4" aria-hidden="true" />
                Marcar clássicos que já vi
              </button>

              <button
                type="button"
                onClick={onExportBackup}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#DFCBC1] bg-transparent px-3.5 py-2 text-xs font-medium text-[#4C3741] hover:bg-[#FAF3EE] dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-[#141418] transition-colors whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Exportar lista
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#DFCBC1] bg-transparent px-3.5 py-2 text-xs font-medium text-[#4C3741] hover:bg-[#FAF3EE] dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-[#141418] transition-colors whitespace-nowrap"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                Importar
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleFileChange}
                className="sr-only"
                aria-label="Importar backup JSON"
              />
            </>
          )}
        </div>
      </div>

      {/* Seen mode: Sentiment filter tabs */}
      {mode === 'seen' && movies.length > 0 && (
        <div
          role="group"
          aria-label="Filtrar assistidos por avaliação"
          className="mb-6 flex flex-wrap items-center gap-2"
        >
          {(
            [
              { id: 'all', label: 'Todos', count: sentimentCounts.total },
              { id: 'liked', label: 'Curti', count: sentimentCounts.liked },
              { id: 'disliked', label: 'Não curti', count: sentimentCounts.disliked },
            ] as const
          ).map((tab) => {
            const active = seenFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSeenFilter(tab.id)}
                className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'border-[#2D1E25] bg-[#2D1E25] text-[#FAF3EE] dark:border-zinc-500 dark:bg-zinc-800/90 dark:text-zinc-50'
                    : 'border-[#DFCBC1] bg-[#FAF3EE] text-[#5C454F] hover:text-[#2D1E25] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono-num text-[11px] ${
                    active ? 'text-[#E7D7CF] dark:text-zinc-300' : 'text-[#8E737D]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {displayedMovies.length === 0 ? (
        <div className="py-16 text-center">
          <h2 className="font-display text-xl font-semibold text-[#2D1E25] dark:text-zinc-100">
            {mode === 'watchlist'
              ? 'Sua lista Quero ver ainda está vazia'
              : seenFilter !== 'all'
                ? 'Nenhum filme marcado com esta avaliação'
                : 'Nenhum filme marcado como assistido neste filtro'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#6E5660] dark:text-zinc-400">
            {mode === 'watchlist'
              ? 'Passe as capas na aba Descobrir e salve os filmes que despertarem curiosidade.'
              : seenFilter !== 'all'
                ? 'Use os botões Curti ou Não curti nos filmes assistidos ou direto na fila de descoberta.'
                : 'Marque os clássicos que você já assistiu para limpar seu catálogo e receber recomendações mais certeiras.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {seenFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setSeenFilter('all')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#D6C1B7] bg-[#FAF3EE] px-5 py-2.5 text-sm font-medium text-[#2D1E25] hover:bg-[#F0E3DC] dark:border-zinc-700 dark:bg-[#141418] dark:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Mostrar todos os assistidos
              </button>
            ) : (
              <button
                type="button"
                onClick={onGoToDiscover}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#BE3A5E] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#A62E4F] dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors"
              >
                Ir para Descobrir
              </button>
            )}
            {mode === 'seen' && seenFilter === 'all' && (
              <button
                type="button"
                onClick={onOpenBatchSeen}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#D6C1B7] bg-[#FAF3EE] px-5 py-2.5 text-sm font-medium text-[#2D1E25] hover:bg-[#F0E3DC] dark:border-zinc-800 dark:bg-[#141418] dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                Marcar clássicos rapidamente
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayedMovies.map((movie) => {
            const entry = entries[movie.id];
            const personalRating = entry?.personalRating ?? 0;
            const sentiment = getEntrySentiment(entry);

            return (
              <article
                key={movie.id}
                className="flex flex-col overflow-hidden rounded-xl border border-[#DFCBC1] bg-[#FAF3EE] shadow-xs transition-colors hover:border-[#CBB0A3] dark:border-zinc-800/80 dark:bg-[#111115] dark:hover:border-zinc-700"
              >
                <button
                  type="button"
                  onClick={() => onSelectMovie(movie)}
                  aria-label={`Abrir detalhes de ${movie.title}`}
                  className="group relative block w-full overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BE3A5E] dark:focus-visible:ring-rose-500"
                >
                  <MoviePoster
                    movie={movie}
                    size="card"
                    className="w-full transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </button>

                <div className="flex flex-1 flex-col justify-between p-4 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#6E5660] dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1 font-mono-num font-semibold text-[#2D1E25] dark:text-zinc-100">
                        <Star
                          className="h-3.5 w-3.5 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
                          aria-hidden="true"
                        />
                        {movie.imdbRating.toFixed(1)}
                      </span>
                      <span aria-hidden="true" className="text-[#CEB8AE] dark:text-zinc-600">·</span>
                      <span className="font-mono-num">{movie.year}</span>
                      <span aria-hidden="true" className="text-[#CEB8AE] dark:text-zinc-600">·</span>
                      <span className="truncate">{movie.subgenre}</span>
                      <span aria-hidden="true" className="text-[#CEB8AE] dark:text-zinc-600">·</span>
                      <span
                        className={
                          movie.hasPtBrDub
                            ? 'text-[#1F5E48] dark:text-zinc-300'
                            : 'text-[#6E5660]'
                        }
                      >
                        {movie.hasPtBrDub ? 'Dublado' : 'Legendado'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectMovie(movie)}
                      className="text-left font-display text-lg font-semibold leading-snug text-[#2D1E25] hover:text-[#A62E4F] dark:text-zinc-50 dark:hover:text-rose-400 transition-colors line-clamp-1"
                    >
                      {movie.title}
                    </button>

                    <p className="text-xs leading-relaxed text-[#5C454F] dark:text-zinc-400 line-clamp-2">
                      {movie.synopsis}
                    </p>
                  </div>

                  {/* Seen mode: Sentiment toggle + Personal 1-5 star rating feeds the AI taste profile */}
                  {mode === 'seen' && (
                    <div className="space-y-2.5 border-t border-[#E6D5CC] dark:border-zinc-800/80 pt-3">
                      <div
                        className="grid grid-cols-2 gap-2"
                        role="group"
                        aria-label={`Sinal de gosto para ${movie.title}`}
                      >
                        <button
                          type="button"
                          aria-pressed={sentiment === 'liked'}
                          onClick={() => onToggleSentiment(movie.id, 'liked')}
                          className={`inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                            sentiment === 'liked'
                              ? 'border-[#9EC6B1] bg-[#DFECE5] text-[#184B39] dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200'
                              : 'border-[#DFCBC1] bg-[#F1E5DE] text-[#5C454F] hover:text-[#2D1E25] dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-400 dark:hover:text-zinc-100'
                          }`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                          Curti
                        </button>
                        <button
                          type="button"
                          aria-pressed={sentiment === 'disliked'}
                          onClick={() => onToggleSentiment(movie.id, 'disliked')}
                          className={`inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                            sentiment === 'disliked'
                              ? 'border-[#DFB484] bg-[#F7EBDC] text-[#7D4411] dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200'
                              : 'border-[#DFCBC1] bg-[#F1E5DE] text-[#5C454F] hover:text-[#2D1E25] dark:border-zinc-800 dark:bg-[#16161B] dark:text-zinc-400 dark:hover:text-zinc-100'
                          }`}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                          Não curti
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#7A616B] dark:text-zinc-500">Sua nota</span>
                        <div className="flex items-center gap-1" role="group" aria-label={`Avaliar ${movie.title}`}>
                          {[1, 2, 3, 4, 5].map((starValue) => {
                            const filled = starValue <= personalRating;
                            return (
                              <button
                                key={starValue}
                                type="button"
                                aria-label={`Dar nota ${starValue} de 5 para ${movie.title}`}
                                onClick={() => onRateMovie(movie.id, starValue)}
                                className="p-1 text-[#D1BBB1] hover:text-amber-500 dark:text-zinc-600 dark:hover:text-amber-400 transition-colors"
                              >
                                <Star
                                  className={`h-4 w-4 ${
                                    filled
                                      ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400'
                                      : ''
                                  }`}
                                  aria-hidden="true"
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between gap-2 border-t border-[#E6D5CC] dark:border-zinc-800/80 pt-3">
                    {mode === 'watchlist' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onMarkSeen(movie.id, 'liked')}
                          className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#D4BEB3] bg-[#F1E5DE] px-2.5 text-xs font-medium text-[#2D1E25] hover:bg-[#E8D8CF] dark:border-zinc-700 dark:bg-[#18181D] dark:text-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                        >
                          <ThumbsUp className="h-3.5 w-3.5 text-[#1F5E48] dark:text-emerald-400" aria-hidden="true" />
                          Vi · Curti
                        </button>
                        <button
                          type="button"
                          onClick={() => onMarkSeen(movie.id, 'disliked')}
                          aria-label={`Marcar ${movie.title} como assistido e não curti`}
                          title="Já assisti e não curti"
                          className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-[#DFCBC1] text-[#6E5660] hover:border-[#DFB484] hover:text-[#7D4411] dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-amber-500/40 dark:hover:text-amber-200 transition-colors"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onMoveToWatchlist(movie.id)}
                        className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#DFCBC1] bg-[#F1E5DE] px-3 text-xs font-medium text-[#2D1E25] hover:bg-[#E8D8CF] dark:border-zinc-800 dark:bg-[#18181D] dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                      >
                        <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        Reassistir
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onFindSimilar(movie)}
                      aria-label={`Buscar filmes parecidos com ${movie.title}`}
                      title="Buscar parecidos com IA"
                      className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-[#DFCBC1] text-[#A62E4F] hover:border-[#DE9FB0] hover:bg-[#F6DCE2] dark:border-zinc-800 dark:text-rose-400 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveEntry(movie.id)}
                      aria-label={`Remover ${movie.title} desta lista`}
                      title="Remover da lista"
                      className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-[#DFCBC1] text-[#6E5660] hover:border-[#CBB0A3] hover:text-[#2D1E25] dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-zinc-200 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* External Imported Backlog Section (for veterans with hundreds/thousands of watched films) */}
      {mode === 'seen' && customSeenTitles.length > 0 && (
        <section
          aria-label="Bagagem externa importada"
          className="mt-12 border-t border-[#DFCBC1] dark:border-zinc-800/80 pt-8"
        >
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#2D1E25] dark:text-zinc-100">
                Bagagem externa registrada
              </h2>
              <p className="mt-0.5 text-xs text-[#6E5660] dark:text-zinc-400">
                Estes{' '}
                <span className="font-mono-num font-medium text-[#2D1E25] dark:text-zinc-200">
                  {customSeenTitles.length}
                </span>{' '}
                títulos importados são bloqueados automaticamente na Curadoria IA e no garimpo
                infinito.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {customSeenTitles.slice(0, 60).map((title) => (
              <div
                key={title}
                className="flex items-center justify-between gap-3 border-b border-[#E6D5CC] dark:border-zinc-800/60 py-2"
              >
                <span className="truncate text-[#3E2B33] dark:text-zinc-300">{title}</span>
                <button
                  type="button"
                  onClick={() => onRemoveCustomSeenTitle(title)}
                  aria-label={`Remover ${title} da bagagem externa`}
                  className="text-xs text-[#6E5660] hover:text-[#2D1E25] dark:hover:text-zinc-200 transition-colors shrink-0"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          {customSeenTitles.length > 60 && (
            <p className="mt-3 font-mono-num text-xs text-[#7A616B]">
              +{customSeenTitles.length - 60} títulos adicionais protegidos na memória de exclusão.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
