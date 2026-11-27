export type AppUniverse = 'nocturna' | 'matine';

export type HorrorSubgenre =
  | 'Psicológico'
  | 'Sobrenatural'
  | 'Folk & Culto'
  | 'Thriller Noir'
  | 'Cósmico & Sci-Fi'
  | 'Found Footage'
  | 'Slasher & Sobrevivência'
  | 'Internacional';

export type RomComSubgenre =
  | 'Natal & Fim de Ano'
  | 'Clássico Romântico'
  | 'Inimigos a Amantes'
  | 'Falso Namoro'
  | 'Amigos a Amantes'
  | 'Segunda Chance'
  | 'Viagem & Destino'
  | 'Drama Romântico'
  | 'Internacional Rom-Com';

export type Subgenre = HorrorSubgenre | RomComSubgenre;

export type ObscurityTier = 'Blockbuster' | 'Clássico' | 'Cult' | 'Lado B' | 'Raridade';

export type ObscurityFilter = 'all' | 'blockbusters' | 'deep-cuts' | 'classics';

export type DecadeFilter = 'all' | 'recent' | '2020s' | '2010s' | '2000s' | 'classic';

export type AudioFilter = 'all' | 'dubbed-only' | 'dubbed-or-must-see';

export type MovieDecision = 'seen' | 'watchlist' | 'skipped';

export type SeenSentiment = 'liked' | 'disliked';

export type AppTab = 'discover' | 'watchlist' | 'seen';

export interface Movie {
  id: string;
  title: string;
  originalTitle: string;
  searchTitle?: string;
  year: number;
  director: string;
  country: string;
  runtimeMinutes: number;
  imdbRating: number;
  subgenre: Subgenre;
  secondaryTag?: string;
  obscurity: ObscurityTier;
  hasPtBrDub: boolean;
  synopsis: string;
  editorialNote: string;
  streamingHint?: string;
  posterUrl?: string;
  isAiDiscovered?: boolean;
}

export interface UserMovieEntry {
  status: MovieDecision;
  sentiment?: SeenSentiment;
  personalRating?: number; // 1..5 stars when seen
  updatedAt: number;
}

export interface HistoryAction {
  movieId: string;
  previousEntry: UserMovieEntry | undefined;
  newStatus: MovieDecision;
}

export interface AvoidPreferences {
  presets: string[];
  customNotes: string[];
}

export interface UserLibraryState {
  entries: Record<string, UserMovieEntry>;
  history: HistoryAction[];
  discoveredMovies: Movie[];
  customSeenTitles: string[];
  avoidPreferences: AvoidPreferences;
}

export interface TasteProfile {
  likedTitles: string[];
  dislikedTitles: string[];
  watchlistTitles: string[];
  skippedTitles: string[];
  preferredSubgenres: Subgenre[];
  avoidedSubgenres: Subgenre[];
  subgenreWeights: Partial<Record<Subgenre, number>>;
  signalCount: number;
}

export interface FilterState {
  subgenre: Subgenre | 'all';
  minImdb: number;
  obscurity: ObscurityFilter;
  decade: DecadeFilter;
  audio: AudioFilter;
  search: string;
}
