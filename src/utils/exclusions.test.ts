import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_MOVIES } from '../data/movies';
import { ROMCOM_SEED_MOVIES } from '../data/romcomMovies';
import {
  DEFAULT_AVOID_PREFERENCES,
  buildAvoidPromptDirectives,
  countActiveAvoids,
  getActiveAvoidLabels,
  isExplorationAngleCompatible,
  isMovieBlockedByPreferences,
  sanitizeAvoidPreferences,
} from './exclusions';

test('asian-cinema preset blocks Japanese, Korean, Taiwanese, Thai, and Indonesian films without affecting Western/Latin films', () => {
  const prefs = { presets: ['asian-cinema'], customNotes: [] };

  const cureJapan = SEED_MOVIES.find((m) => m.id === 'cure-1997')!;
  const wailingKorea = SEED_MOVIES.find((m) => m.country.toLowerCase().includes('coreia'))!;
  const hereditaryUsa = SEED_MOVIES.find((m) => m.id === 'hereditario-2018')!;

  assert.equal(isMovieBlockedByPreferences(cureJapan, prefs, 'nocturna'), true);
  assert.equal(isMovieBlockedByPreferences(wailingKorea, prefs, 'nocturna'), true);
  assert.equal(isMovieBlockedByPreferences(hereditaryUsa, prefs, 'nocturna'), false);

  // Also blocks synthetic Thai / Indonesian / Indian releases
  const thaiSample = { ...hereditaryUsa, id: 'thai-1', country: 'Tailândia', title: 'O Médium' };
  const indianSample = { ...hereditaryUsa, id: 'ind-1', country: 'Índia', title: 'Tumbbad' };
  assert.equal(isMovieBlockedByPreferences(thaiSample, prefs, 'nocturna'), true);
  assert.equal(isMovieBlockedByPreferences(indianSample, prefs, 'nocturna'), true);
});

test('custom natural-language notes match synonyms, regions, and themes across both universes', () => {
  const sampleBase = SEED_MOVIES[0];
  const clownMovie = {
    ...sampleBase,
    id: 'clown-test',
    title: 'Terrifier',
    synopsis: 'Um palhaço sinistro aterroriza uma pequena cidade na noite de Halloween.',
  };
  const asianMovie = {
    ...sampleBase,
    id: 'korean-test',
    country: 'Coreia do Sul',
    title: 'Invasão Zumbi',
    synopsis: 'Um surto viral transforma passageiros de um trem em zumbis.',
  };

  assert.equal(
    isMovieBlockedByPreferences(
      clownMovie,
      { presets: [], customNotes: ['filmes com palhaços'] },
      'nocturna',
    ),
    true,
  );
  assert.equal(
    isMovieBlockedByPreferences(
      sampleBase,
      { presets: [], customNotes: ['filmes com palhaços'] },
      'nocturna',
    ),
    false,
  );
  assert.equal(
    isMovieBlockedByPreferences(
      asianMovie,
      { presets: [], customNotes: ['não gosto de filmes asiáticos'] },
      'nocturna',
    ),
    true,
  );
});

test('found-footage and old-classics presets filter accurately', () => {
  const ffMovie = SEED_MOVIES.find((m) => m.subgenre === 'Found Footage')!;
  const oldMovie = { ...SEED_MOVIES[0], id: 'old-1978', year: 1978 };
  const modernMovie = { ...SEED_MOVIES[0], id: 'modern-2023', year: 2023 };

  assert.equal(
    isMovieBlockedByPreferences(ffMovie, { presets: ['found-footage'], customNotes: [] }, 'nocturna'),
    true,
  );
  assert.equal(
    isMovieBlockedByPreferences(oldMovie, { presets: ['old-classics'], customNotes: [] }, 'nocturna'),
    true,
  );
  assert.equal(
    isMovieBlockedByPreferences(modernMovie, { presets: ['old-classics'], customNotes: [] }, 'nocturna'),
    false,
  );
});

test('Matinê presets and prompt directives work independently from Nocturna', () => {
  const prefs = sanitizeAvoidPreferences({
    presets: ['asian-cinema', 'musicals', 'invalid-preset'],
    customNotes: ['  filmes de vampiros  ', 'filmes de vampiros', 'x'],
  });

  assert.deepEqual(prefs.presets, ['asian-cinema', 'musicals']);
  assert.deepEqual(prefs.customNotes, ['filmes de vampiros']);
  assert.equal(countActiveAvoids(prefs), 3);

  const matineLabels = getActiveAvoidLabels(prefs, 'matine');
  assert.deepEqual(matineLabels, ['Cinema asiático', 'Musicais', 'filmes de vampiros']);

  const directives = buildAvoidPromptDirectives(prefs, 'matine');
  assert.equal(directives.length, 3);
  assert.match(directives[0], /NUNCA recomende filmes asiáticos/i);
  assert.match(directives[2], /filmes de vampiros/i);

  // Confirm romcom seed movie is unblocked when not Asian or musical
  const westernRomcom = ROMCOM_SEED_MOVIES.find(
    (m) => m.country.includes('Estados Unidos') || m.country.includes('Reino Unido') || m.country.includes('EUA'),
  )!;
  assert.ok(westernRomcom, 'should find a Western rom-com seed movie');
  assert.equal(isMovieBlockedByPreferences(westernRomcom, prefs, 'matine'), false);
});

test('isExplorationAngleCompatible skips Asian exploration angles when Asian cinema is blocked', () => {
  const asianAngle =
    'Foque em cinema asiático (Japão, Coreia do Sul, Tailândia, Taiwan, Indonésia) e festivais internacionais menos óbvios.';
  const euroAngle =
    'Foque em terror e thriller europeu (França, Espanha, Dinamarca, Noruega, Áustria, Reino Unido).';

  const blockAsian = { presets: ['asian-cinema'], customNotes: [] };
  assert.equal(isExplorationAngleCompatible(asianAngle, blockAsian), false);
  assert.equal(isExplorationAngleCompatible(euroAngle, blockAsian), true);
  assert.equal(isExplorationAngleCompatible(asianAngle, DEFAULT_AVOID_PREFERENCES), true);
});
