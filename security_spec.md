# Nocturna Security Specification (Phase 0 — Payload-First Security TDD)

## 1. Data Invariants
1. **Strict Ownership & Verified Identity**: Only an authenticated user with `request.auth.token.email_verified == true` and `request.auth.uid == userId` may read, list, create, update, or delete their own documents under `/users/{userId}` and its subcollections (`entries`, `discoveredMovies`, `externalSeen`).
2. **Master Gate**: No subcollection document (`entries`, `discoveredMovies`, `externalSeen`) may be created or updated unless the parent `/users/{userId}` document exists.
3. **Immutable Ownership & Timestamps**: `uid`, `ownerId`, `movieId`, `id`, `chunkId`, and `createdAt` cannot be modified after creation. `createdAt == request.time` on `create`, and `updatedAt == request.time` on both `create` and `update`.
4. **No Shadow Fields**: Every `create` enforces `hasAll` + `hasOnly`; every `update` enforces `affectedKeys().hasOnly(...)` inside action branches wrapped by `isValid[Entity](incoming(), ...)`.
5. **Bounded Sizes & Path Hardening**: All single-document path IDs must pass `isValidId()` (`^[a-zA-Z0-9_\-]+$`, `<= 128` chars), all strings enforce explicit `.size()` bounds matching `firebase-blueprint.json`, and `externalSeen.titles` is strictly bounded (`1..100` items, first element string `<= 160` chars).
6. **Zero Blanket Reads / Secure List Queries**: `/users` cannot be listed. Subcollection `allow list` rules strictly evaluate `resource.data.ownerId == request.auth.uid` without any `get()` or `exists()` calls.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Result in `PERMISSION_DENIED`)
1. **Unauthenticated Read/Write**: Reading `/users/alice/entries/m1` with `request.auth == null`.
2. **Unverified Email Spoof**: Creating `/users/alice` with `request.auth.uid == 'alice'` but `email_verified == false`.
3. **Cross-User Read (PII / Private Library Leak)**: User `bob` reading `/users/alice` or `/users/alice/entries/m1`.
4. **Identity Spoofing on Create**: User `alice` creating `/users/alice/entries/m1` with `ownerId: 'bob'`.
5. **Shadow Field Injection on Create**: Creating `/users/alice` with an extra ghost key `{ isAdmin: true }`.
6. **Shadow Field Injection on Update**: Updating `/users/alice/entries/m1` with `{ status: 'seen', role: 'admin' }`.
7. **Immutable Field Tampering**: Updating `/users/alice/entries/m1` attempting to change `ownerId`, `movieId`, or `createdAt`.
8. **Client Timestamp Forgery**: Creating `/users/alice/entries/m1` with a backdated `createdAt` or `updatedAt != request.time`.
9. **Path ID Poisoning**: Creating `/users/alice/entries/../../bad$id` or a 300-character document ID.
10. **Value / Type Poisoning on Update**: Updating `/users/alice/entries/m1` with `status: 'invalid-state'` or `personalRating: 99`.
11. **Array Overflow (Denial of Wallet)**: Creating `/users/alice/externalSeen/chunk-0` with 101 items in `titles` or non-string first element.
12. **Orphaned Subcollection Write**: Creating `/users/alice/entries/m1` when parent `/users/alice` does not exist.
