import { parseFragment, serialize } from 'parse5';
import { dictionaries, translate } from '../src/i18n/translate.js';
function translateId(id) {
  if (!Object.hasOwn(dictionaries.zh, id)) throw new Error(`Unknown translation ID: ${id}`);
  return translate(id);
}
export function localizeHTML(html) {
  const tree = parseFragment(html);
  function visit(node) {
    const id = node.attrs?.find((a) => a.name === 'data-i18n')?.value;
    if (id) node.childNodes = [{ nodeName: '#text', value: translateId(id), parentNode: node }];
    const attributes = node.attrs?.find((a) => a.name === 'data-i18n-attrs')?.value;
    for (const [name, key] of Object.entries(JSON.parse(attributes || '{}'))) {
      const value = translateId(key),
        attr = node.attrs.find((a) => a.name === name);
      if (attr) attr.value = value;
      else node.attrs.push({ name, value });
    }
    node.childNodes?.forEach(visit);
  }
  visit(tree);
  return serialize(tree);
}
