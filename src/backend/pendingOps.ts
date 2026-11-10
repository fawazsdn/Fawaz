import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

/**
 * Persistent client operation ids for posts and comments.
 *
 * Each draft gets a UUID before anything is sent. The id is stored on the
 * device (per signed-in account and per draft scope), so a retry after a lost
 * response - even after the app was killed - sends the SAME id, and the server
 * (publish_post / add_post_comment) returns the already-created row instead of
 * writing a duplicate. Photos uploaded for the draft are remembered too, so an
 * interrupted batch resumes instead of uploading again.
 *
 * Ids are scoped by account: another account on the same device never reuses
 * them, and the server scopes them per author as well.
 */

export interface PendingOp {
  opId: string;
  createdAt: number;
  /** local photo URI -> uploaded storage path, filled in as each upload completes */
  uploads: Record<string, string>;
}

/** After this, an unfinished draft id is dropped and a new one is used. */
export const PENDING_OP_TTL_MS = 24 * 60 * 60 * 1000;
const PREFIX = 'haratna.pendingOp.v1';

const keyFor = (userId: string, scope: string) => `${PREFIX}:${userId}:${scope}`;

async function read(key: string): Promise<PendingOp | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const op = JSON.parse(raw) as PendingOp;
    if (!op?.opId || Date.now() - op.createdAt > PENDING_OP_TTL_MS) return null;
    return { ...op, uploads: op.uploads ?? {} };
  } catch {
    return null;
  }
}

/** Returns the draft's existing operation (a retry) or starts a new one, persisted before any network call. */
export async function beginOp(userId: string, scope: string): Promise<PendingOp> {
  const key = keyFor(userId, scope);
  const existing = await read(key);
  if (existing) return existing;
  const op: PendingOp = { opId: Crypto.randomUUID(), createdAt: Date.now(), uploads: {} };
  await AsyncStorage.setItem(key, JSON.stringify(op));
  return op;
}

/** Starts a fresh operation for the scope, replacing any previous one. */
export async function restartOp(userId: string, scope: string): Promise<PendingOp> {
  await AsyncStorage.removeItem(keyFor(userId, scope));
  return beginOp(userId, scope);
}

/** Records one completed upload for the operation (so an interrupted batch can resume). */
export async function recordOpUpload(userId: string, scope: string, op: PendingOp, localUri: string, path: string) {
  op.uploads[localUri] = path;
  await AsyncStorage.setItem(keyFor(userId, scope), JSON.stringify(op));
}

export async function forgetOpUploads(userId: string, scope: string, op: PendingOp) {
  op.uploads = {};
  await AsyncStorage.setItem(keyFor(userId, scope), JSON.stringify(op));
}

/** The server confirmed the operation (created or already existing): the draft is done. */
export async function finishOp(userId: string, scope: string) {
  await AsyncStorage.removeItem(keyFor(userId, scope));
}

export const POST_COMPOSER_SCOPE = 'post-composer';
export const commentScope = (postId: string, parentId?: string) => `comment:${postId}:${parentId ?? 'root'}`;
