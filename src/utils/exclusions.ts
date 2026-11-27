import type { AppUniverse, AvoidPreferences } from '../types/movie';

export interface AvoidPresetDefinition {
  id: string;
  label: string;
  shortDesc: string;
  universes: AppUniverse[];
  promptRule: string;
}

export const DEFAULT_AVOID_PREFERENCES: AvoidPreferences = {
  presets: [],
  customNotes: [],
};

export const AVOID_PRESETS: AvoidPresetDefinition[] = [
  {
    id: 'asian-cinema',
    label: 'Cinema asiático',
    shortDesc: 'Japão, Coreia do Sul, China, Tailândia, Taiwan, Indonésia e Índia',
    universes: ['nocturna', 'matine'],
    promptRule:
      'NUNCA recomende filmes asiáticos (Coreia do Sul, Japão, China, Taiwan, Hong Kong, Tailândia, Indonésia, Filipinas, Vietnã, Malásia, Singapura ou Índia), nem doramas, K-horror, J-horror ou produções faladas em idiomas asiáticos.',
  },
  {
    id: 'found-footage',
    label: 'Found Footage',
    shortDesc: 'Câmera na mão, falsos documentários e gravações encontradas',
    universes: ['nocturna'],
    promptRule:
      'NUNCA recomende filmes de Found Footage, mockumentary, câmera na mão ou gravações encontradas.',
  },
  {
    id: 'extreme-gore',
    label: 'Gore extremo e tortura',
    shortDesc: 'Violência gráfica explícita, splatter e body horror pesado',
    universes: ['nocturna'],
    promptRule:
      'NUNCA recomende filmes de gore extremo, torture porn, splatter ou violência gráfica explícita.',
  },
  {
    id: 'zombies',
    label: 'Zumbis e epidemias',
    shortDesc: 'Mortos-vivos, vírus e apocalipse zumbi',
    universes: ['nocturna'],
    promptRule:
      'NUNCA recomende filmes de zumbis, mortos-vivos ou apocalipse viral de infectados.',
  },
  {
    id: 'religious-exorcism',
    label: 'Possessão e exorcismo',
    shortDesc: 'Demônios, rituais religiosos e padres exorcistas',
    universes: ['nocturna'],
    promptRule:
      'NUNCA recomende filmes focados em exorcismo, possessão demoníaca ou terror religioso de igrejas/freiras.',
  },
  {
    id: 'musicals',
    label: 'Musicais',
    shortDesc: 'Filmes com cenas cantadas e números musicais',
    universes: ['matine'],
    promptRule:
      'NUNCA recomende musicais ou romances em que os personagens cantam números musicais.',
  },
  {
    id: 'sad-drama',
    label: 'Drama triste / Chororô',
    shortDesc: 'Finais trágicos, doenças ou melodrama pesado',
    universes: ['matine'],
    promptRule:
      'NUNCA recomende dramas tristes, histórias sobre doenças terminais, luto pesado ou romances com final trágico.',
  },
  {
    id: 'teen-highschool',
    label: 'Romance adolescente',
    shortDesc: 'Ensino médio, escola, baile e histórias teen',
    universes: ['matine'],
    promptRule:
      'NUNCA recomende romances adolescentes (high school, ensino médio, baile de formatura ou público teen). Prefira protagonistas adultos.',
  },
  {
    id: 'period-costume',
    label: 'Romance de época',
    shortDesc: 'Século XIX, realeza histórica e figurino antigo',
    universes: ['matine'],
    promptRule:
      'NUNCA recomende romances históricos ou de época (século XVIII/XIX, nobreza antiga ou adaptações de figurino histórico).',
  },
  {
    id: 'old-classics',
    label: 'Filmes muito antigos',
    shortDesc: 'Produções antigas (antes dos anos 85/90) ou em preto e branco',
    universes: ['nocturna', 'matine'],
    promptRule:
      'NUNCA recomende filmes em preto e branco ou muito antigos (evite qualquer filme lançado antes de 1990).',
  },
];

export const VALID_AVOID_PRESET_IDS = new Set(AVOID_PRESETS.map((p) => p.id));

const ASIAN_COUNTRY_KEYWORDS = [
  'japao',
  'japan',
  'coreia',
  'korea',
  'tailandia',
  'thailand',
  'china',
  'taiwan',
  'hong kong',
  'indonesia',
  'filipinas',
  'philippines',
  'vietna',
  'vietnam',
  'india',
  'malasia',
  'malaysia',
  'singapura',
  'singapore',
  'camboja',
  'cambodia',
  'mongolia',
  'paquistao',
  'pakistan',
  'sri lanka',
];

const ASIAN_STYLE_KEYWORDS = [
  'j-horror',
  'k-horror',
  'k-drama',
  'dorama',
  'bollywood',
  'anime',
  'tollywood',
  'cinema asiatico',
  'terror asiatico',
  'terror japones',
  'terror coreano',
  'terror tailandes',
  'terror indonesio',
  'terror taiwanes',
  'romance coreano',
];

const CUSTOM_SYNONYM_MAP: Record<string, string[]> = {
  asiatico: ASIAN_COUNTRY_KEYWORDS,
  asiaticos: ASIAN_COUNTRY_KEYWORDS,
  asiatica: ASIAN_COUNTRY_KEYWORDS,
  asiaticas: ASIAN_COUNTRY_KEYWORDS,
  asia: ASIAN_COUNTRY_KEYWORDS,
  oriental: ASIAN_COUNTRY_KEYWORDS,
  orientais: ASIAN_COUNTRY_KEYWORDS,
  coreano: ['coreia', 'korea', 'k-horror', 'k-drama', 'dorama'],
  coreanos: ['coreia', 'korea', 'k-horror', 'k-drama', 'dorama'],
  coreana: ['coreia', 'korea', 'k-horror', 'k-drama', 'dorama'],
  japones: ['japao', 'japan', 'j-horror', 'anime'],
  japoneses: ['japao', 'japan', 'j-horror', 'anime'],
  japonesa: ['japao', 'japan', 'j-horror', 'anime'],
  chines: ['china', 'hong kong', 'taiwan'],
  chineses: ['china', 'hong kong', 'taiwan'],
  tailandes: ['tailandia', 'thailand'],
  tailandeses: ['tailandia', 'thailand'],
  indiano: ['india', 'bollywood'],
  indianos: ['india', 'bollywood'],
  indiana: ['india', 'bollywood'],
  indonesio: ['indonesia'],
  frances: ['franca', 'france'],
  franceses: ['franca', 'france'],
  espanhol: ['espanha', 'spain'],
  espanhois: ['espanha', 'spain'],
  italiano: ['italia', 'italy'],
  italianos: ['italia', 'italy'],
  brasileiro: ['brasil', 'brazil'],
  brasileiros: ['brasil', 'brazil'],
  palhaco: ['palhaco', 'palhacos', 'clown'],
  palhacos: ['palhaco', 'palhacos', 'clown'],
  vampiro: ['vampiro', 'vampiros', 'vampire', 'dracula'],
  vampiros: ['vampiro', 'vampiros', 'vampire', 'dracula'],
  zumbi: ['zumbi', 'zumbis', 'zombie', 'mortos-vivos'],
  zumbis: ['zumbi', 'zumbis', 'zombie', 'mortos-vivos'],
  tubarao: ['tubarao', 'tubaroes', 'shark'],
  tubaroes: ['tubarao', 'tubaroes', 'shark'],
  aranha: ['aranha', 'aranhas', 'spider'],
  aranhas: ['aranha', 'aranhas', 'spider'],
  fantasma: ['fantasma', 'fantasmas', 'assombrac', 'ghost', 'espirito'],
  fantasmas: ['fantasma', 'fantasmas', 'assombrac', 'ghost', 'espirito'],
  natal: ['natal', 'natalin', 'christmas', 'papai noel'],
  natalino: ['natal', 'natalin', 'christmas', 'papai noel'],
  natalinos: ['natal', 'natalin', 'christmas', 'papai noel'],
};

const STOP_WORDS = new Set([
  'filme',
  'filmes',
  'movie',
  'movies',
  'nao',
  'gosto',
  'curto',
  'quero',
  'evitar',
  'evite',
  'bloquear',
  'bloqueie',
  'odeio',
  'sem',
  'com',
  'para',
  'por',
  'favor',
  'tipo',
  'tipos',
  'estilo',
  'estilos',
  'coisa',
  'coisas',
  'sobre',
  'muito',
  'muita',
  'muitos',
  'muitas',
  'mais',
  'menos',
  'dos',
  'das',
  'nos',
  'nas',
  'uma',
  'uns',
  'umas',
  'que',
  'tenha',
  'tenham',
  'cinema',
  'terror',
  'romance',
  'comedia',
  'romantica',
]);

function normalizeForExclusion(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getPresetsForUniverse(universe: AppUniverse): AvoidPresetDefinition[] {
  return AVOID_PRESETS.filter((preset) => preset.universes.includes(universe));
}

export function sanitizeAvoidPreferences(raw: unknown): AvoidPreferences {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_AVOID_PREFERENCES;
  }
  const obj = raw as { presets?: unknown; customNotes?: unknown };
  const presets = Array.isArray(obj.presets)
    ? Array.from(
        new Set(
          obj.presets
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter((item) => VALID_AVOID_PRESET_IDS.has(item)),
        ),
      ).slice(0, 20)
    : [];

  const seenNotes = new Set<string>();
  const customNotes: string[] = [];
  if (Array.isArray(obj.customNotes)) {
    for (const item of obj.customNotes) {
      if (typeof item !== 'string') continue;
      const cleaned = item.replace(/\s+/g, ' ').trim().slice(0, 80);
      const norm = normalizeForExclusion(cleaned);
      if (cleaned.length < 2 || !norm || seenNotes.has(norm)) continue;
      seenNotes.add(norm);
      customNotes.push(cleaned);
      if (customNotes.length >= 20) break;
    }
  }

  return { presets, customNotes };
}

export function countActiveAvoids(prefs: AvoidPreferences | undefined): number {
  if (!prefs) return 0;
  return prefs.presets.length + prefs.customNotes.length;
}

export function getActiveAvoidLabels(
  prefs: AvoidPreferences | undefined,
  universe: AppUniverse,
): string[] {
  if (!prefs) return [];
  const presetMap = new Map(getPresetsForUniverse(universe).map((p) => [p.id, p.label]));
  const presetLabels = prefs.presets
    .map((id) => presetMap.get(id))
    .filter((label): label is string => Boolean(label));
  return [...presetLabels, ...prefs.customNotes];
}

function matchesAnyKeyword(haystack: string, keywords: string[]): boolean {
  for (const kw of keywords) {
    if (haystack.includes(kw)) return true;
  }
  return false;
}

export interface ExcludableMovie {
  title: string;
  originalTitle?: string;
  year: number;
  director: string;
  country: string;
  subgenre: string;
  secondaryTag?: string;
  synopsis: string;
  editorialNote?: string;
}

function isAsianMovie(
  movie: Pick<ExcludableMovie, 'country' | 'synopsis' | 'editorialNote' | 'secondaryTag'>,
): boolean {
  const countryNorm = normalizeForExclusion(movie.country || '');
  if (matchesAnyKeyword(countryNorm, ASIAN_COUNTRY_KEYWORDS)) {
    return true;
  }
  const metaNorm = normalizeForExclusion(
    `${movie.secondaryTag ?? ''} ${movie.editorialNote ?? ''} ${movie.synopsis ?? ''}`,
  );
  return matchesAnyKeyword(metaNorm, ASIAN_STYLE_KEYWORDS);
}

/**
 * Evaluates whether a movie should be excluded locally according to the user's
 * active preset blocks and custom avoidance rules.
 */
export function isMovieBlockedByPreferences(
  movie: ExcludableMovie,
  prefs: AvoidPreferences | undefined,
  universe: AppUniverse,
): boolean {
  if (!prefs || (prefs.presets.length === 0 && prefs.customNotes.length === 0)) {
    return false;
  }

  const fullText = normalizeForExclusion(
    `${movie.title} ${movie.originalTitle ?? ''} ${movie.country} ${movie.director} ${movie.subgenre} ${movie.secondaryTag ?? ''} ${movie.synopsis} ${movie.editorialNote ?? ''}`,
  );

  for (const presetId of prefs.presets) {
    switch (presetId) {
      case 'asian-cinema':
        if (isAsianMovie(movie)) return true;
        break;
      case 'found-footage':
        if (
          movie.subgenre === 'Found Footage' ||
          matchesAnyKeyword(fullText, [
            'found footage',
            'camera na mao',
            'mockumentary',
            'falso documentario',
            'gravacoes encontradas',
          ])
        ) {
          return true;
        }
        break;
      case 'extreme-gore':
        if (
          matchesAnyKeyword(fullText, [
            'gore extremo',
            'tortura',
            'splatter',
            'body horror',
            'mutilacao',
            'canibal',
            'carnificina',
          ])
        ) {
          return true;
        }
        break;
      case 'zombies':
        if (
          matchesAnyKeyword(fullText, [
            'zumbi',
            'zombie',
            'mortos-vivos',
            'mortos vivos',
            'apocalipse zumbi',
          ])
        ) {
          return true;
        }
        break;
      case 'religious-exorcism':
        if (
          matchesAnyKeyword(fullText, [
            'exorcism',
            'possessao',
            'possuida',
            'possuido',
            'demonio',
            'freira',
          ])
        ) {
          return true;
        }
        break;
      case 'musicals':
        if (
          matchesAnyKeyword(fullText, ['musical', 'numeros musicais', 'broadway', 'cancoes'])
        ) {
          return true;
        }
        break;
      case 'sad-drama':
        if (
          matchesAnyKeyword(fullText, [
            'doenca terminal',
            'cancer',
            'final tragico',
            'tragedia',
            'melodrama',
          ])
        ) {
          return true;
        }
        break;
      case 'teen-highschool':
        if (
          matchesAnyKeyword(fullText, [
            'ensino medio',
            'colegial',
            'high school',
            'adolescente',
            'adolescentes',
            'baile de formatura',
          ])
        ) {
          return true;
        }
        break;
      case 'period-costume':
        if (
          matchesAnyKeyword(fullText, [
            'seculo xix',
            'seculo xviii',
            'vitorian',
            'jane austen',
            'aristocracia',
            'romance de epoca',
          ])
        ) {
          return true;
        }
        break;
      case 'old-classics': {
        const cutoffYear = universe === 'matine' ? 1990 : 1985;
        if (
          movie.year < cutoffYear ||
          matchesAnyKeyword(fullText, ['preto e branco', 'black and white'])
        ) {
          return true;
        }
        break;
      }
      default:
        break;
    }
  }

  for (const note of prefs.customNotes) {
    const normNote = normalizeForExclusion(note);
    if (!normNote) continue;

    // Direct phrase hit
    if (normNote.length >= 4 && fullText.includes(normNote)) {
      return true;
    }

    const tokens = normNote
      .split(' ')
      .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));

    if (tokens.length === 0) continue;

    // Expand synonyms for known regions/themes (e.g. "asiaticos", "indianos", "palhacos")
    let allTokensMatched = true;
    for (const token of tokens) {
      const expanded = CUSTOM_SYNONYM_MAP[token];
      if (expanded) {
        if (!matchesAnyKeyword(fullText, expanded)) {
          allTokensMatched = false;
          break;
        }
      } else {
        const stem = token.length >= 5 && token.endsWith('s') ? token.slice(0, -1) : token;
        if (!fullText.includes(stem)) {
          allTokensMatched = false;
          break;
        }
      }
    }

    if (allTokensMatched) {
      return true;
    }
  }

  return false;
}

/**
 * Generates explicit, high-priority negative rules for Gemini curation prompts
 * (used across both manual and automatic AI calls).
 */
export function buildAvoidPromptDirectives(
  prefs: AvoidPreferences | undefined,
  universe: AppUniverse,
): string[] {
  if (!prefs) return [];
  const directives: string[] = [];
  const validPresets = new Map(getPresetsForUniverse(universe).map((p) => [p.id, p]));

  for (const id of prefs.presets) {
    const preset = validPresets.get(id);
    if (preset) {
      directives.push(preset.promptRule);
    }
  }

  for (const note of prefs.customNotes) {
    directives.push(`NUNCA recomende filmes relacionados a: "${note}".`);
  }

  return directives;
}

/**
 * Prevents the server's rotating exploration angles from contradicting a user's active blocks
 * (for example, skipping the Asian cinema exploration angle when Asian cinema is blocked).
 */
export function isExplorationAngleCompatible(
  angleText: string,
  prefs: AvoidPreferences | undefined,
): boolean {
  if (!prefs || (prefs.presets.length === 0 && prefs.customNotes.length === 0)) {
    return true;
  }
  const normAngle = normalizeForExclusion(angleText);

  if (
    prefs.presets.includes('asian-cinema') &&
    matchesAnyKeyword(normAngle, ['asiatico', 'japao', 'coreia', 'tailandia', 'taiwan', 'indonesia'])
  ) {
    return false;
  }

  if (
    prefs.presets.includes('old-classics') &&
    matchesAnyKeyword(normAngle, ['1970', '1980', 'decadas de 1970'])
  ) {
    return false;
  }

  if (
    prefs.presets.includes('found-footage') &&
    matchesAnyKeyword(normAngle, ['mockumentary', 'found footage'])
  ) {
    return false;
  }

  for (const note of prefs.customNotes) {
    const normNote = normalizeForExclusion(note);
    const tokens = normNote.split(' ').filter((t) => t.length >= 4 && !STOP_WORDS.has(t));
    for (const token of tokens) {
      const expanded = CUSTOM_SYNONYM_MAP[token] ?? [token];
      if (matchesAnyKeyword(normAngle, expanded)) {
        return false;
      }
    }
  }

  return true;
}
