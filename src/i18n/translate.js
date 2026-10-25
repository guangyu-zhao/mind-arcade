import zh from './locales/zh.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import de from './locales/de.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };
import ja from './locales/ja.json' with { type: 'json' };
import ko from './locales/ko.json' with { type: 'json' };
import { englishPlurals } from './plurals.js';
export const dictionaries = { zh, en, de, fr, ja, ko };
export const languages = Object.freeze(Object.keys(dictionaries));
export const locales = Object.freeze({
  zh: 'zh-CN',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  ja: 'ja-JP',
  ko: 'ko-KR',
});
export function translate(source, values = {}, language = 'zh') {
  if (source && typeof source === 'object')
    return translate(
      source.source,
      source.values.map((value) => translate(value, {}, language)),
      language,
    );
  const raw = String(source ?? ''),
    key = raw.trim(),
    id = key;
  let template = dictionaries[language]?.[id] ?? en[id];
  if (template === undefined) return raw;
  const plural = englishPlurals[id];
  if (language === 'en' && plural && Number(values[plural.index]) === 1) template = plural.one;
  return raw.replace(key, () =>
    template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? '')),
  );
}
