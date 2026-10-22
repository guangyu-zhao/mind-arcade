import { translate, languages, locales } from './translate.js';
const storageKey = 'mini-games.language.v1';
const names = ['中文', 'English', 'Deutsch', 'Français', '日本語', '한국어'];
let language = 'zh',
  mounted = false,
  registrations = 0;
const sources = new WeakMap(),
  references = new Set();
function savedLanguage() {
  try {
    const value = localStorage.getItem(storageKey);
    if (languages.includes(value)) return value;
  } catch {}
  return language;
}
function track(node) {
  let data = sources.get(node);
  if (!data) {
    data = {};
    sources.set(node, data);
    references.add(new WeakRef(node));
    if (++registrations % 256 === 0) prune();
  }
  return data;
}
function prune() {
  for (const ref of references) {
    const node = ref.deref();
    if (!node) references.delete(ref);
  }
}
const tr = (source, values) => translate(source, values, language);
function refresh() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = tr(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-attrs]').forEach((node) => {
    for (const [name, id] of Object.entries(JSON.parse(node.dataset.i18nAttrs)))
      node.setAttribute(name, tr(id));
  });
  for (const ref of references) {
    const node = ref.deref();
    if (!node) {
      references.delete(ref);
      continue;
    }
    if (!node.isConnected) continue;
    const data = sources.get(node);
    if (data.text !== undefined) node.textContent = tr(data.text);
    for (const [name, value] of data.attributes || [])
      if (node.hasAttribute(name)) node.setAttribute(name, tr(value));
  }
  document.querySelectorAll('[data-language-select]').forEach((select) => {
    select.value = language;
    select.setAttribute('aria-label', tr('ui.language'));
  });
}
function choose(next, persist = true) {
  if (!languages.includes(next)) return;
  if (persist) {
    try {
      localStorage.setItem(storageKey, next);
    } catch {}
  }
  if (next === language) return;
  language = next;
  if (!mounted) return;
  refresh();
  window.dispatchEvent(new Event('mindlab-language-change'));
  window.dispatchEvent(new Event('languagechange'));
}
export function mountLanguage() {
  if (mounted) return;
  mounted = true;
  language = savedLanguage();
  document.querySelectorAll('[data-language-select]').forEach((select) => {
    languages.forEach((code, index) => {
      const option = document.createElement('option');
      option.value = code;
      option.lang = locales[code];
      option.textContent = names[index];
      select.append(option);
    });
    select.addEventListener('change', () => choose(select.value));
  });
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey) choose(event.newValue || 'zh', false);
  });
  window.addEventListener('pageshow', () => choose(savedLanguage(), false));
  refresh();
}
export const GameI18n = {
  message: (source, ...values) => ({ source, values }),
  translate: tr,
  text(node, source) {
    track(node).text = source;
    node.removeAttribute?.('data-i18n');
    node.textContent = tr(source);
  },
  attribute(node, name, source) {
    const data = track(node);
    data.attributes ??= new Map();
    data.attributes.set(name, source);
    node.setAttribute(name, tr(source));
  },
  replaceChildren(node, ...children) {
    delete track(node).text;
    node.removeAttribute('data-i18n');
    node.replaceChildren(...children);
  },
  get locale() {
    return locales[language];
  },
};
export const Text = Object.freeze({
  languages,
  locales,
  t: (entry, values = {}) => translate(entry, values, language),
  get language() {
    return language;
  },
  get locale() {
    return locales[language];
  },
});
