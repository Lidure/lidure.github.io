import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MESSAGE_REACTION_EMOJIS,
  classifyMessageNoteSize,
  createAuthorToken,
  deriveLegacyNoteMeta,
  hashAuthorToken,
  verifyAuthorToken,
} from '../src/message-board';

const migration = readFileSync(new URL('../migrations/0008_sticky_message_board.sql', import.meta.url), 'utf8');

describe('sticky message board schema', () => {
  it('adds note metadata and one reaction per visitor/message', () => {
    for (const column of ['note_color', 'note_size', 'pos_x', 'pos_y', 'rotation', 'author_token_hash', 'updated_at']) {
      expect(migration).toMatch(new RegExp(`ALTER TABLE guest_messages ADD COLUMN ${column}`));
    }
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS message_reactions/);
    expect(migration).toMatch(/PRIMARY KEY \(message_id, ip_hash\)/);
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id/);
  });
});

describe('sticky message board domain helpers', () => {
  it('classifies notes into three bounded sizes', () => {
    expect(classifyMessageNoteSize('a'.repeat(64))).toBe('small');
    expect(classifyMessageNoteSize('a'.repeat(65))).toBe('medium');
    expect(classifyMessageNoteSize('a'.repeat(220))).toBe('medium');
    expect(classifyMessageNoteSize('a'.repeat(221))).toBe('large');
  });

  it('derives stable legacy metadata without granting ownership', () => {
    const first = deriveLegacyNoteMeta('legacy-id-1', '旧留言');
    const second = deriveLegacyNoteMeta('legacy-id-1', '旧留言');
    expect(second).toEqual(first);
    expect(first.rotation).toBeGreaterThanOrEqual(-4);
    expect(first.rotation).toBeLessThanOrEqual(4);
    expect(first.authorOwned).toBe(false);
  });

  it('creates a one-time token whose hash verifies without storing plaintext', async () => {
    const token = createAuthorToken();
    const hash = await hashAuthorToken(token);
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(hash).not.toContain(token);
    await expect(verifyAuthorToken(token, hash)).resolves.toBe(true);
    await expect(verifyAuthorToken(`${token}x`, hash)).resolves.toBe(false);
  });

  it('limits board quick reactions to the approved set', () => {
    expect(MESSAGE_REACTION_EMOJIS).toEqual(['❤️', '😂', '✨', '👍']);
  });
});
