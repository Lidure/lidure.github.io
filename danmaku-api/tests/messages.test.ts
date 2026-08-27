import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
