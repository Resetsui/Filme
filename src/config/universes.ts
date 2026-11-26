import { SEED_MOVIES, SUBGENRE_OPTIONS } from '../data/movies';
import { ROMCOM_SEED_MOVIES, ROMCOM_SUBGENRE_OPTIONS } from '../data/romcomMovies';
import type { AppUniverse, Movie, Subgenre } from '../types/movie';

export interface UniverseConfig {
  id: AppUniverse;
  name: string;
  shortLabel: string;
  genreSummary: string;
  documentTitle: string;
  storageKey: string;
  latestRadarKey: string;
  backupFilename: string;
  seedMovies: Movie[];
  subgenreOptions: Array<{ value: Subgenre | 'all'; label: string }>;
  defaultSubgenre: Subgenre;
  discoverSubtitle: string;
  moodPlaceholder: string;
  moodPresets: string[];
  batchImportPlaceholder: string;
  watchlistSubtitle: string;
  seenSubtitle: string;
}

export const UNIVERSE_CONFIGS: Record<AppUniverse, UniverseConfig> = {
  nocturna: {
    id: 'nocturna',
    name: 'Nocturna',
    shortLabel: 'Terror & Thriller',
    genreSummary: 'Terror, suspense e thrillers',
    documentTitle: 'Nocturna — Curadoria de Terror & Thriller',
    storageKey: 'nocturna:library:v1',
    latestRadarKey: 'nocturna:latest-radar-at',
    backupFilename: 'nocturna-biblioteca.json',
    seedMovies: SEED_MOVIES,
    subgenreOptions: SUBGENRE_OPTIONS,
    defaultSubgenre: 'Psicológico',
    discoverSubtitle:
      'Busca 10 filmes reais de terror ou thriller, cruza com o que você curtiu e rejeitou e coloca as capas direto no topo da sua fila.',
    moodPlaceholder: 'Ex.: algo tenso como O Lamento ou Cure, mas que pouca gente conhece...',
    moodPresets: [
      'Terror psicológico sufocante sem jumpscare barato',
      'Suspense policial sombrio e chuvoso com reviravolta',
      'Terror asiático ou europeu pouco conhecido',
      'Cultos bizarros e folclore perturbador',
      'Ficção científica claustrofóbica com final marcante',
    ],
    batchImportPlaceholder:
      'Exemplos suportados:\nInvocação do Mal\nMidsommar\nSinister (2012)\nThe Descent\nOu cole diretamente o conteúdo de um watched.csv do Letterboxd / IMDb',
    watchlistSubtitle:
      'Sua seleção pessoal para escolher o filme da noite sem ficar rolando catálogo.',
    seenSubtitle:
      'Marque o que você curtiu ou não curtiu para recalibrar automaticamente a fila e a Curadoria IA.',
  },
  matine: {
    id: 'matine',
    name: 'Matinê',
    shortLabel: 'Comédia Romântica & Natal',
    genreSummary: 'Comédias românticas, romances leves e especiais de Natal',
    documentTitle: 'Matinê — Curadoria de Comédia Romântica & Natal',
    storageKey: 'matine:library:v1',
    latestRadarKey: 'matine:latest-radar-at',
    backupFilename: 'matine-biblioteca.json',
    seedMovies: ROMCOM_SEED_MOVIES,
    subgenreOptions: ROMCOM_SUBGENRE_OPTIONS,
    defaultSubgenre: 'Clássico Romântico',
    discoverSubtitle:
      'Busca 10 filmes reais de comédia romântica (incluindo especiais de Natal), aprende com o que você curtiu e coloca as capas no topo da fila.',
    moodPlaceholder:
      'Ex.: comédia romântica natalina aconchegante com neve, ou algo leve como Questão de Tempo...',
    moodPresets: [
      'Comédia romântica natalina aconchegante com neve e clima de fim de ano',
      'Inimigos que se apaixonam com química e humor afiado',
      'Clássico romântico confortável dos anos 90 ou 2000',
      'Viagem inesquecível pela Europa com romance leve',
      'Namoro de mentira que vira paixão de verdade',
    ],
    batchImportPlaceholder:
      'Exemplos suportados:\nO Amor Não Tira Férias\nSimplesmente Amor\nUm Lugar Chamado Notting Hill\nComo Perder um Homem em 10 Dias\nOu cole diretamente o conteúdo de um watched.csv do Letterboxd / IMDb',
    watchlistSubtitle:
      'Sua lista particular de romances e especiais de Natal prontos para a próxima sessão com pipoca.',
    seenSubtitle:
      'Marque os romances que você amou ou não curtiu para a Curadoria IA acertar cada vez mais no seu estilo.',
  },
};
