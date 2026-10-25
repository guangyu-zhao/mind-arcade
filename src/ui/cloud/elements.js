import { element } from '../dom.js';
import { text } from '../../i18n/cloud.js';
export function labeled(tag, key, className = '') {
  const node = element(tag, className, text(key));
  node.dataset.cloudText = key;
  return node;
}
export function button(key, action, primary = false) {
  const node = labeled('button', key, `cloud-button${primary ? ' cloud-primary' : ''}`);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
