// Expo Router 57 consumes query-string's CommonJS entry point. Keep the
// patched decoder compatible with bilingual links and malformed input.
import { expect, test } from '@jest/globals';
import { parse } from 'query-string';

test('decodes Arabic query values and spaces', () => {
  expect(parse('name=%D8%A3%D8%AC%D9%8A%D8%A7%D9%84&tag=coffee+shop')).toEqual({
    name: 'أجيال',
    tag: 'coffee shop',
  });
});

test('handles a long malformed percent-encoded value', () => {
  const value = '%C0'.repeat(4000);
  expect(parse(`name=${value}`).name).toBe(value);
});
