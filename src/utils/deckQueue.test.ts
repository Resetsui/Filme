import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_MOVIES } from '../data/movies';
import {
  EMPTY_DECK_QUEUE,
  reconcileDeckQueue,
  resolveDeckMovies,
} from './deckQueue';

const [mA, mB, mC, mD, mX, mY] = SEED_MOVIES.slice(0, 6);

test('background sync or AI refill NEVER displaces the active front card or peeking back card', () => {
  // Initial load with A, B, C, D
  let queue = reconcileDeckQueue(EMPTY_DECK_QUEUE, [mA, mB, mC, mD], { mode: 'reset' });
  assert.deepEqual(queue.order, [mA.id, mB.id, mC.id, mD.id]);

  // Background AI refill + 12h radar prepends X and Y with highest taste rank!
  // Front card (A) and peeking back card (B) MUST stay locked; X and Y queue right behind them!
  queue = reconcileDeckQueue(queue, [mX, mY, mA, mB, mC, mD], { mode: 'background' });
  assert.deepEqual(queue.order, [mA.id, mB.id, mX.id, mY.id, mC.id, mD.id]);
  assert.equal(queue.heldFrontMovie, null);

  const resolved = resolveDeckMovies(queue, [mX, mY, mA, mB, mC, mD]);
  assert.equal(resolved[0].id, mA.id);
  assert.equal(resolved[1].id, mB.id);
  assert.equal(resolved[2].id, mX.id);
});

test('advancing past the front card promotes the exact peeking back card and seamlessly brings queued AI/synced cards next', () => {
  let queue = reconcileDeckQueue(EMPTY_DECK_QUEUE, [mA, mB, mC], { mode: 'reset' });
  // Background arrival queues X, Y behind A, B
  queue = reconcileDeckQueue(queue, [mX, mY, mA, mB, mC], { mode: 'background' });
  assert.deepEqual(queue.order, [mA.id, mB.id, mX.id, mY.id, mC.id]);

  // User swipes A -> A is removed from candidates, B glides smoothly to index 0, X is now peeking at index 1!
  queue = reconcileDeckQueue(queue, [mX, mY, mB, mC], {
    mode: 'advance',
    actedMovieId: mA.id,
  });
  assert.deepEqual(queue.order, [mB.id, mX.id, mY.id, mC.id]);
});

test('remote background sync that marks the currently viewed movie as seen holds it on screen until the user moves on', () => {
  let queue = reconcileDeckQueue(EMPTY_DECK_QUEUE, [mA, mB, mC], { mode: 'reset' });

  // Device 2 marks mA as seen -> Firestore snapshot removes mA from unwatched candidates
  // User on Device 1 is STILL looking at mA -> mA must NOT vanish mid-read!
  queue = reconcileDeckQueue(queue, [mB, mC, mX], {
    mode: 'background',
    previousFrontMovie: mA,
  });
  assert.equal(queue.heldFrontMovie?.id, mA.id);
  assert.deepEqual(queue.order, [mA.id, mB.id, mC.id, mX.id]);

  const resolvedWhileReading = resolveDeckMovies(queue, [mB, mC, mX]);
  assert.equal(resolvedWhileReading[0].id, mA.id);
  assert.equal(resolvedWhileReading[1].id, mB.id);

  // User now swipes/skips mA -> heldFrontMovie clears cleanly, mB becomes front, synced queue flows!
  queue = reconcileDeckQueue(queue, [mB, mC, mX], {
    mode: 'advance',
    actedMovieId: mA.id,
  });
  assert.equal(queue.heldFrontMovie, null);
  assert.deepEqual(queue.order, [mB.id, mC.id, mX.id]);
});

test('explicit reset (filter/block change) and pin (undo/thumbnail jump) update the front card immediately', () => {
  let queue = reconcileDeckQueue(EMPTY_DECK_QUEUE, [mA, mB, mC], { mode: 'reset' });

  // Explicit pin (e.g. Undo or clicking upcoming thumbnail C)
  queue = reconcileDeckQueue(queue, [mA, mB, mC], {
    mode: 'pin',
    pinnedMovieId: mC.id,
  });
  assert.deepEqual(queue.order, [mC.id, mA.id, mB.id]);

  // Explicit reset (e.g. user enabled "Cinema asiático" block which removes mC)
  queue = reconcileDeckQueue(queue, [mB, mD], { mode: 'reset' });
  assert.deepEqual(queue.order, [mB.id, mD.id]);
  assert.equal(queue.heldFrontMovie, null);
});
