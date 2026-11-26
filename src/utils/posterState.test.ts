import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePosterVisualState } from './posterState';

test('returns loaded immediately when image URL is already decoded in cache (back card promoted to front)', () => {
  const state = resolvePosterVisualState({
    url: '/api/poster-image?url=https%3A%2F%2Fm.media-amazon.com%2Fposter.jpg',
    isFetchingUrl: false,
    loadedUrl: null,
    failedUrl: null,
    isDecodedInCache: true,
  });
  assert.equal(state, 'loaded');
});

test('returns loaded when onLoad recorded matching loadedUrl', () => {
  const url = '/api/poster-image?url=https%3A%2F%2Fm.media-amazon.com%2Fa.jpg';
  const state = resolvePosterVisualState({
    url,
    isFetchingUrl: false,
    loadedUrl: url,
    failedUrl: null,
    isDecodedInCache: false,
  });
  assert.equal(state, 'loaded');
});

test('returns loading while switching to a new uncached URL even if loadedUrl holds previous URL', () => {
  const state = resolvePosterVisualState({
    url: '/api/poster-image?url=https%3A%2F%2Fm.media-amazon.com%2Fb.jpg',
    isFetchingUrl: false,
    loadedUrl: '/api/poster-image?url=https%3A%2F%2Fm.media-amazon.com%2Fa.jpg',
    failedUrl: null,
    isDecodedInCache: false,
  });
  assert.equal(state, 'loading');
});

test('returns unavailable when server resolved null poster', () => {
  const state = resolvePosterVisualState({
    url: null,
    isFetchingUrl: false,
    loadedUrl: null,
    failedUrl: null,
    isDecodedInCache: false,
  });
  assert.equal(state, 'unavailable');
});

test('returns unavailable when current candidate URL failed to load', () => {
  const url = '/api/poster-image?url=https%3A%2F%2Fm.media-amazon.com%2Fbroken.jpg';
  const state = resolvePosterVisualState({
    url,
    isFetchingUrl: false,
    loadedUrl: null,
    failedUrl: url,
    isDecodedInCache: false,
  });
  assert.equal(state, 'unavailable');
});

test('returns loading while poster URL lookup is still in flight', () => {
  const state = resolvePosterVisualState({
    url: null,
    isFetchingUrl: true,
    loadedUrl: null,
    failedUrl: null,
    isDecodedInCache: false,
  });
  assert.equal(state, 'loading');
});
