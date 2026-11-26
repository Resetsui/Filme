import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIVERSE_CONFIGS } from '../config/universes';
import { SEED_MOVIES } from '../data/movies';
import { ROMCOM_SEED_MOVIES } from '../data/romcomMovies';
import {
  DEFAULT_FILTERS,
  INITIAL_LIBRARY_STATE,
  applyMovieDecision,
  batchMarkSeen,
  buildFullCatalog,
  computeTasteProfile,
  filterMovies,
  getLibraryCounts,
  importExternalSeenTitles,
  parseImportedTitles,
  parseStoredLibrary,
  pickRandomMovie,
  rankMoviesByTaste,
  resetSkippedMovies,
  setPersonalRating,
  setSeenSentiment,
  undoLastDecision,
} from './movieFilters';

test('filters movies accurately by subgenre, IMDb threshold, obscurity, and decade', () => {
  const highRatedDeepCuts = filterMovies(
    SEED_MOVIES,
    {
      ...DEFAULT_FILTERS,
      minImdb: 7.0,
      obscurity: 'deep-cuts',
      decade: '2020s',
    },
    {},
    'discover',
  );

  assert.ok(highRatedDeepCuts.length > 0, 'should find 2020s deep cuts with IMDb >= 7.0');
  for (const movie of highRatedDeepCuts) {
    assert.ok(movie.imdbRating >= 7.0);
    assert.ok(movie.year >= 2020);
    assert.ok(movie.obscurity === 'Lado B' || movie.obscurity === 'Raridade');
  }

  const noirOnly = filterMovies(
    SEED_MOVIES,
    { ...DEFAULT_FILTERS, subgenre: 'Thriller Noir' },
    {},
    'discover',
  );
  assert.ok(noirOnly.length >= 4);
  assert.ok(noirOnly.every((m) => m.subgenre === 'Thriller Noir'));
});

test('marking movies as seen, watchlist, and skipped updates counts and supports undo', () => {
  const first = SEED_MOVIES[0];
  const second = SEED_MOVIES[1];
  const third = SEED_MOVIES[2];

  let state = INITIAL_LIBRARY_STATE;
  state = applyMovieDecision(state, first.id, 'watchlist', 1000);
  state = applyMovieDecision(state, second.id, 'seen', 2000);
  state = applyMovieDecision(state, third.id, 'skipped', 3000);

  const counts = getLibraryCounts(SEED_MOVIES, state.entries);
  assert.equal(counts.watchlist, 1);
  assert.equal(counts.seen, 1);
  assert.equal(counts.skipped, 1);
  assert.equal(counts.unwatched, SEED_MOVIES.length - 3);

  const discoverDeck = filterMovies(SEED_MOVIES, DEFAULT_FILTERS, state.entries, 'discover');
  assert.equal(discoverDeck.some((m) => m.id === first.id), false);
  assert.equal(discoverDeck.some((m) => m.id === second.id), false);
  assert.equal(discoverDeck.some((m) => m.id === third.id), false);

  const undoResult = undoLastDecision(state);
  assert.equal(undoResult.restoredMovieId, third.id);
  assert.equal(undoResult.nextState.entries[third.id], undefined);
  assert.equal(getLibraryCounts(SEED_MOVIES, undoResult.nextState.entries).skipped, 0);
});

test('personal rating clamps to 1-5 and batchMarkSeen marks multiple movies', () => {
  let state = INITIAL_LIBRARY_STATE;
  state = batchMarkSeen(state, [SEED_MOVIES[0].id, SEED_MOVIES[1].id], 5000);
  assert.equal(state.entries[SEED_MOVIES[0].id]?.status, 'seen');
  assert.equal(state.entries[SEED_MOVIES[1].id]?.status, 'seen');

  state = setPersonalRating(state, SEED_MOVIES[0].id, 9);
  assert.equal(state.entries[SEED_MOVIES[0].id]?.personalRating, 5);

  state = setPersonalRating(state, SEED_MOVIES[0].id, 0);
  assert.equal(state.entries[SEED_MOVIES[0].id]?.personalRating, 1);
});

test('resetSkippedMovies restores only skipped items while keeping seen and watchlist', () => {
  let state = INITIAL_LIBRARY_STATE;
  state = applyMovieDecision(state, SEED_MOVIES[0].id, 'seen', 1000);
  state = applyMovieDecision(state, SEED_MOVIES[1].id, 'watchlist', 2000);
  state = applyMovieDecision(state, SEED_MOVIES[2].id, 'skipped', 3000);

  const next = resetSkippedMovies(state);
  assert.equal(next.entries[SEED_MOVIES[0].id]?.status, 'seen');
  assert.equal(next.entries[SEED_MOVIES[1].id]?.status, 'watchlist');
  assert.equal(next.entries[SEED_MOVIES[2].id], undefined);
});

test('pickRandomMovie avoids repeating the excluded movie when alternatives exist', () => {
  const pool = SEED_MOVIES.slice(0, 3);
  const picked = pickRandomMovie(pool, pool[0].id, () => 0);
  assert.ok(picked);
  assert.notEqual(picked.id, pool[0].id);
});

test('buildFullCatalog deduplicates discovered films and parseStoredLibrary handles corrupt JSON', () => {
  const duplicate = { ...SEED_MOVIES[0], id: 'dup-id' };
  const merged = buildFullCatalog(SEED_MOVIES, [duplicate]);
  assert.equal(merged.length, SEED_MOVIES.length);

  const invalid = parseStoredLibrary('{broken json');
  assert.deepEqual(invalid, INITIAL_LIBRARY_STATE);

  const valid = parseStoredLibrary(
    JSON.stringify({
      entries: {
        [SEED_MOVIES[0].id]: { status: 'seen', personalRating: 4, updatedAt: 1234 },
        bad: { status: 'unknown' },
      },
      discoveredMovies: [],
    }),
  );
  assert.equal(valid.entries[SEED_MOVIES[0].id]?.personalRating, 4);
  assert.equal(valid.entries['bad'], undefined);
});

test('parseImportedTitles supports Letterboxd CSV and plain text lists', () => {
  const csv = [
    'Date,Name,Year,Letterboxd URI',
    '2024-01-12,"Hereditary",2018,https://boxd.it/1',
    '2024-01-15,"The Wailing",2016,https://boxd.it/2',
    '2024-01-16,"Sinister, Part 1",2012,https://boxd.it/3',
  ].join('\n');

  const parsedCsv = parseImportedTitles(csv);
  assert.deepEqual(parsedCsv, ['Hereditary', 'The Wailing', 'Sinister, Part 1']);

  const plain = '1. Cure (1997)\n- Midsommar\n• cure\n';
  const parsedPlain = parseImportedTitles(plain);
  assert.deepEqual(parsedPlain, ['Cure', 'Midsommar']);
});

test('importExternalSeenTitles marks catalog matches as seen and stores external titles', () => {
  const result = importExternalSeenTitles(
    INITIAL_LIBRARY_STATE,
    SEED_MOVIES,
    ['Hereditary', 'Cure', 'Midsommar', 'The Descent'],
    9000,
  );

  assert.equal(result.matchedCatalogCount, 2);
  assert.equal(result.addedExternalCount, 2);
  assert.equal(result.nextState.entries['hereditario-2018']?.status, 'seen');
  assert.equal(result.nextState.entries['cure-1997']?.status, 'seen');
  assert.deepEqual(result.nextState.customSeenTitles, ['Midsommar', 'The Descent']);
});

test('seen sentiment liked/disliked updates taste profile and re-ranks discovery deck', () => {
  const psychMovie = SEED_MOVIES.find((m) => m.subgenre === 'Psicológico')!;
  const supernaturalMovie = SEED_MOVIES.find((m) => m.subgenre === 'Sobrenatural')!;

  let state = INITIAL_LIBRARY_STATE;
  state = applyMovieDecision(state, psychMovie.id, 'seen', 1000, 'liked');
  state = applyMovieDecision(state, supernaturalMovie.id, 'seen', 2000, 'disliked');

  assert.equal(state.entries[psychMovie.id]?.sentiment, 'liked');
  assert.equal(state.entries[supernaturalMovie.id]?.sentiment, 'disliked');

  const profile = computeTasteProfile(SEED_MOVIES, state.entries);
  assert.deepEqual(profile.likedTitles, [psychMovie.title]);
  assert.deepEqual(profile.dislikedTitles, [supernaturalMovie.title]);
  assert.ok(profile.preferredSubgenres.includes('Psicológico'));
  assert.ok(profile.avoidedSubgenres.includes('Sobrenatural'));

  const remaining = filterMovies(SEED_MOVIES, DEFAULT_FILTERS, state.entries, 'discover');
  const ranked = rankMoviesByTaste(remaining, profile);
  assert.equal(ranked[0]?.subgenre, 'Psicológico');
  assert.notEqual(ranked[0]?.subgenre, 'Sobrenatural');

  // Toggling sentiment via setSeenSentiment updates profile immediately
  const toggled = setSeenSentiment(state, supernaturalMovie.id, 'liked', 3000);
  const nextProfile = computeTasteProfile(SEED_MOVIES, toggled.entries);
  assert.equal(nextProfile.dislikedTitles.length, 0);
  assert.equal(nextProfile.likedTitles.length, 2);
});

test('audio filter supports dubbed-only and dubbed-or-must-see (subtitled >= 7.5 IMDb)', () => {
  const dubbedOnly = filterMovies(
    SEED_MOVIES,
    { ...DEFAULT_FILTERS, audio: 'dubbed-only' },
    {},
    'discover',
  );
  assert.ok(dubbedOnly.length > 0);
  assert.ok(dubbedOnly.every((m) => m.hasPtBrDub === true));

  const dubbedOrMustSee = filterMovies(
    SEED_MOVIES,
    { ...DEFAULT_FILTERS, audio: 'dubbed-or-must-see' },
    {},
    'discover',
  );
  assert.ok(dubbedOrMustSee.length > dubbedOnly.length, 'should include high-rated subtitled gems');
  for (const movie of dubbedOrMustSee) {
    assert.ok(
      movie.hasPtBrDub === true || movie.imdbRating >= 7.5,
      `Expected ${movie.title} to be dubbed or IMDb >= 7.5`,
    );
  }
});

test('obscurity filter supports blockbusters tier with high-budget horror and thriller films', () => {
  const blockbusters = filterMovies(
    SEED_MOVIES,
    { ...DEFAULT_FILTERS, obscurity: 'blockbusters' },
    {},
    'discover',
  );
  assert.ok(blockbusters.length >= 10, 'should have rich set of blockbuster titles');
  assert.ok(blockbusters.every((m) => m.obscurity === 'Blockbuster'));
});

test('decade filter "recent" dynamically matches only current and previous year releases', () => {
  const currentYear = new Date().getFullYear();
  const sample = [
    { ...SEED_MOVIES[0], id: 'new-1', year: currentYear },
    { ...SEED_MOVIES[1], id: 'new-2', year: currentYear - 1 },
    { ...SEED_MOVIES[2], id: 'older-1', year: currentYear - 2 },
  ];
  const recent = filterMovies(sample, { ...DEFAULT_FILTERS, decade: 'recent' }, {}, 'discover');
  assert.deepEqual(
    recent.map((m) => m.id),
    ['new-1', 'new-2'],
  );
});

test('Nocturna and Matinê universes maintain 100% isolated catalogs, storage keys, subgenres, and taste profiles', () => {
  assert.notEqual(UNIVERSE_CONFIGS.nocturna.storageKey, UNIVERSE_CONFIGS.matine.storageKey);
  assert.notEqual(UNIVERSE_CONFIGS.nocturna.latestRadarKey, UNIVERSE_CONFIGS.matine.latestRadarKey);
  assert.ok(ROMCOM_SEED_MOVIES.length >= 40, 'Matinê catalog should have >= 40 curated rom-coms');

  const horrorIds = new Set(SEED_MOVIES.map((m) => m.id));
  for (const romcom of ROMCOM_SEED_MOVIES) {
    assert.equal(horrorIds.has(romcom.id), false, `Movie id ${romcom.id} must not collide across universes`);
  }

  // Liking/disliking movies in Nocturna must never pollute Matinê's taste profile or counts
  let nocturnaState = INITIAL_LIBRARY_STATE;
  nocturnaState = applyMovieDecision(nocturnaState, SEED_MOVIES[0].id, 'watchlist', 1000);
  nocturnaState = applyMovieDecision(nocturnaState, SEED_MOVIES[1].id, 'seen', 2000, 'liked');

  const matineState = INITIAL_LIBRARY_STATE;
  const matineCounts = getLibraryCounts(ROMCOM_SEED_MOVIES, matineState.entries);
  assert.equal(matineCounts.watchlist, 0);
  assert.equal(matineCounts.seen, 0);
  assert.equal(matineCounts.unwatched, ROMCOM_SEED_MOVIES.length);

  // Even if Nocturna entries were ever passed against Matinê catalog, zero rom-com tastes leak
  const crossProfile = computeTasteProfile(ROMCOM_SEED_MOVIES, nocturnaState.entries);
  assert.equal(crossProfile.signalCount, 0);
  assert.deepEqual(crossProfile.likedTitles, []);
  assert.deepEqual(crossProfile.preferredSubgenres, []);

  // Matinê subgenre filter works cleanly (including Natal & Fim de Ano personalization)
  const enemiesToLovers = filterMovies(
    ROMCOM_SEED_MOVIES,
    { ...DEFAULT_FILTERS, subgenre: 'Inimigos a Amantes' },
    {},
    'discover',
  );
  assert.ok(enemiesToLovers.length >= 4);
  assert.ok(enemiesToLovers.every((m) => m.subgenre === 'Inimigos a Amantes'));

  const christmasRomcoms = filterMovies(
    ROMCOM_SEED_MOVIES,
    { ...DEFAULT_FILTERS, subgenre: 'Natal & Fim de Ano' },
    {},
    'discover',
  );
  assert.ok(
    christmasRomcoms.length >= 12,
    'Matinê should have at least 12 curated Christmas rom-coms',
  );
  assert.ok(christmasRomcoms.every((m) => m.subgenre === 'Natal & Fim de Ano'));
});

