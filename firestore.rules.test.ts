import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

test('Dirty Dozen security invariants are structurally enforced in firestore.rules and blueprint', () => {
  assert.ok(fs.existsSync(rulesPath), 'firestore.rules must exist');
  assert.ok(fs.existsSync(blueprintPath), 'firebase-blueprint.json must exist');

  const rules = fs.readFileSync(rulesPath, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8')) as {
    firestore: Record<string, unknown>;
  };

  // 1. Default deny safety net
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);

  // 2. Verified email & strict owner gate
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /request\.auth\.uid == userId/);

  // 3. No blanket list on users; resource.data.ownerId check on subcollection lists
  assert.match(rules, /match \/users\/\{userId\}[\s\S]*allow list: if false;/);
  const listMatches = rules.match(/allow list: if isOwner\(userId\) && resource\.data\.ownerId == request\.auth\.uid;/g);
  assert.equal(listMatches?.length, 7, 'All 7 subcollections (Nocturna + Matinê + Preferences) must enforce resource.data.ownerId on list');

  // 4. Master Gate parent existence check on subcollections
  assert.match(rules, /function parentUserExists\(userId\)/);
  assert.match(rules, /exists\(\/databases\/\$\(database\)\/documents\/users\/\$\(userId\)\)/);

  // 5. Strict validation blueprints + hasOnly shadow-field guards + action-based affectedKeys
  for (const helper of [
    'isValidUserProfile',
    'isValidMovieEntry',
    'isValidDiscoveredMovie',
    'isValidRomcomDiscoveredMovie',
    'isValidExternalSeenChunk',
    'isValidCuratorPreferences',
  ]) {
    assert.ok(rules.includes(`function ${helper}`), `Missing validation blueprint ${helper}`);
  }
  assert.match(rules, /affectedKeys\(\)\.hasOnly/);

  // 6. Temporal integrity & immutability
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rules, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);

  // 7. Bounded array check on externalSeen chunks and preferences
  assert.match(rules, /data\.titles\.size\(\) <= 100/);
  assert.match(rules, /data\.titles\[0\] is string/);
  assert.match(rules, /data\.presets\.size\(\) <= 20/);
  assert.match(rules, /data\.customNotes\.size\(\) <= 20/);

  // 8. Every collection in blueprint is matched in rules
  const blueprintCollections = Object.keys(blueprint.firestore);
  assert.equal(blueprintCollections.length, 8);
});
