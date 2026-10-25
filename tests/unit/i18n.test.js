import test from 'node:test';
import assert from 'node:assert/strict';
import { dictionaries, languages, translate } from '../../src/i18n/translate.js';
const parameters = (text) => [...new Set(text.match(/\{\w+\}/g) || [])].sort();
test('six locale dictionaries have identical IDs and placeholders', () => {
  const ids = Object.keys(dictionaries.zh).sort();
  for (const language of languages) {
    assert.deepEqual(Object.keys(dictionaries[language]).sort(), ids);
    for (const id of ids)
      assert.deepEqual(
        parameters(dictionaries[language][id]),
        parameters(dictionaries.en[id]),
        `${language}:${id}`,
      );
  }
});
test('translation IDs survive language changes and recursively translate message arguments', () => {
  for (const language of languages) {
    const value = translate({ source: 'ui.row-value-column-value', values: [2, 3] }, {}, language);
    assert.match(value, /2/);
    assert.match(value, /3/);
  }
  assert.equal(translate('ui.value-items', [1], 'en'), '1 item');
  assert.equal(translate('ui.value-items', [2], 'en'), '2 items');
});
