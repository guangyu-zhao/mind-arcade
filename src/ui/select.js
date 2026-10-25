const enhanced = new WeakSet();
let nextId = 0,
  opened = null,
  positionFrame = 0;

function enhance(root = document) {
  const selects = root instanceof HTMLSelectElement ? [root] : root.querySelectorAll('select');
  for (const select of selects) {
    if (enhanced.has(select) || select.multiple || select.size > 1) continue;
    const wrapper = document.createElement('span');
    wrapper.className = 'select-control';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'select-trigger';
    trigger.id = `select-control-${++nextId}`;
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const value = document.createElement('span');
    value.className = 'select-value';
    const arrow = document.createElement('span');
    arrow.className = 'select-chevron';
    arrow.setAttribute('aria-hidden', 'true');
    trigger.append(value, arrow);
    const menu = document.createElement('div');
    menu.id = `${trigger.id}-options`;
    menu.className = 'select-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'listbox');
    const hasPopover = typeof menu.showPopover === 'function';
    if (hasPopover) menu.setAttribute('popover', 'manual');
    trigger.setAttribute('aria-controls', menu.id);
    select.before(wrapper);
    wrapper.append(select, trigger, menu);
    select.classList.add('select-native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    let options = [],
      active = -1,
      search = '',
      searchedAt = 0;
    const labels = new WeakSet();
    const enabled = (index) => options[index] && !options[index].disabled;

    function focusOption(index) {
      active = index;
      for (const option of options)
        option.node.classList.toggle('is-active', option.index === active);
      const node = options[active]?.node;
      if (!node) {
        trigger.removeAttribute('aria-activedescendant');
        return;
      }
      trigger.setAttribute('aria-activedescendant', node.id);
      const top = node.offsetTop,
        bottom = top + node.offsetHeight;
      if (top < menu.scrollTop + 6) menu.scrollTop = Math.max(0, top - 6);
      else if (bottom > menu.scrollTop + menu.clientHeight - 6)
        menu.scrollTop = bottom - menu.clientHeight + 6;
    }
    function position() {
      if (opened !== control) return;
      const rect = trigger.getBoundingClientRect(),
        viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0,
        top = viewport?.offsetTop || 0;
      const width = viewport?.width || innerWidth,
        height = viewport?.height || innerHeight;
      if (!trigger.getClientRects().length || rect.bottom < top || rect.top > top + height) {
        close();
        return;
      }
      const below = Math.max(0, top + height - rect.bottom - 14),
        above = Math.max(0, rect.top - top - 14);
      const upwards = below < Math.min(menu.scrollHeight, 300) && above > below;
      const menuWidth = Math.min(Math.max(rect.width, 180), width - 24);
      menu.style.width = `${menuWidth}px`;
      menu.style.maxHeight = `${Math.min(320, upwards ? above : below)}px`;
      menu.style.left = `${Math.max(left + 12, Math.min(rect.left, left + width - menuWidth - 12))}px`;
      menu.style.top = `${upwards ? rect.top - menu.getBoundingClientRect().height - 6 : rect.bottom + 6}px`;
    }
    function close() {
      if (opened !== control) return;
      opened = null;
      search = '';
      if (hasPopover && menu.matches(':popover-open')) menu.hidePopover();
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
      wrapper.removeAttribute('data-open');
    }
    function open() {
      if (trigger.disabled || !trigger.getClientRects().length) return;
      opened?.close();
      refresh();
      if (!options.some((option) => !option.disabled)) return;
      opened = control;
      wrapper.dataset.open = '';
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      if (hasPopover) menu.showPopover();
      position();
      if (opened === control)
        focusOption(
          enabled(select.selectedIndex)
            ? select.selectedIndex
            : options.findIndex((option) => !option.disabled),
        );
    }
    function choose(index) {
      if (!enabled(index) || trigger.disabled) return;
      const changed = select.selectedIndex !== index;
      select.selectedIndex = index;
      close();
      refresh();
      if (changed) {
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    function refresh() {
      const wasOpen = opened === control,
        previous = active;
      trigger.disabled = select.matches(':disabled');
      wrapper.hidden = select.hidden;
      const label =
        select.getAttribute('aria-label') ||
        [...select.labels]
          .map((node) => {
            const copy = node.cloneNode(true);
            copy.querySelectorAll('select, .select-control').forEach((control) => control.remove());
            return copy.textContent.trim();
          })
          .join(' ');
      const labelledBy = select.getAttribute('aria-labelledby');
      for (const node of [trigger, menu]) {
        if (labelledBy) node.setAttribute('aria-labelledby', labelledBy);
        else node.removeAttribute('aria-labelledby');
        if (label) node.setAttribute('aria-label', label);
        else node.removeAttribute('aria-label');
      }
      const description = select.getAttribute('aria-describedby');
      if (description) trigger.setAttribute('aria-describedby', description);
      else trigger.removeAttribute('aria-describedby');
      trigger.setAttribute('aria-required', String(select.required));
      for (const labelNode of select.labels) {
        if (labels.has(labelNode)) continue;
        labels.add(labelNode);
        labelNode.addEventListener('click', (event) => {
          if (wrapper.contains(event.target)) return;
          event.preventDefault();
          trigger.focus();
        });
      }
      const selected = select.selectedOptions[0];
      value.textContent = selected?.label || '';
      if (selected?.lang) value.lang = selected.lang;
      else value.removeAttribute('lang');
      options = [...select.options].map((option, index) => {
        const node = document.createElement('div');
        node.className = 'select-option';
        node.id = `${menu.id}-${index}`;
        node.setAttribute('role', 'option');
        const disabled =
          option.disabled ||
          option.parentElement.disabled ||
          option.hidden ||
          option.parentElement.hidden;
        node.setAttribute('aria-selected', String(option.selected));
        node.setAttribute('aria-disabled', String(!!disabled));
        node.hidden = option.hidden || option.parentElement.hidden;
        if (option.lang) node.lang = option.lang;
        const labelNode = document.createElement('span');
        labelNode.textContent = option.label;
        const check = document.createElement('span');
        check.className = 'select-check';
        check.setAttribute('aria-hidden', 'true');
        node.append(labelNode, check);
        node.addEventListener('pointermove', (event) => {
          if (event.pointerType === 'mouse' && !disabled && opened === control && active !== index)
            focusOption(index);
        });
        node.addEventListener('pointerdown', (event) => {
          if (event.pointerType === 'mouse') event.preventDefault();
        });
        node.addEventListener('click', () => {
          choose(index);
          trigger.focus({ preventScroll: true });
        });
        return { node, index, disabled: !!disabled, text: option.label };
      });
      menu.replaceChildren(...options.map((option) => option.node));
      if (wasOpen) {
        if (trigger.disabled || wrapper.hidden || !options.some((option) => !option.disabled))
          close();
        else {
          position();
          if (opened === control)
            focusOption(
              enabled(previous) ? previous : options.findIndex((option) => !option.disabled),
            );
        }
      }
    }
    const control = { close, position, wrapper, menu };
    enhanced.add(select);
    trigger.addEventListener('click', () => (opened === control ? close() : open()));
    wrapper.addEventListener('keyup', (event) => event.stopPropagation());
    trigger.addEventListener('keydown', (event) => {
      event.stopPropagation();
      const key = event.key,
        isOpen = opened === control;
      if (key === 'Tab') {
        if (isOpen) choose(active);
        return;
      }
      if (key === 'Escape') {
        if (isOpen) {
          event.preventDefault();
          close();
        }
        return;
      }
      if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        if (event.repeat) return;
        if (isOpen) choose(active);
        else open();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
        event.preventDefault();
        if (!isOpen) open();
        const available = options
          .filter((option) => !option.disabled)
          .map((option) => option.index);
        if (!available.length) return;
        const index = available.indexOf(active);
        if (key === 'Home') focusOption(available[0]);
        else if (key === 'End') focusOption(available.at(-1));
        else if (isOpen)
          focusOption(
            available[
              Math.max(0, Math.min(available.length - 1, index + (key === 'ArrowDown' ? 1 : -1)))
            ],
          );
        return;
      }
      if (key.length !== 1 || event.isComposing) return;
      event.preventDefault();
      if (!isOpen) open();
      const now = performance.now();
      search = now - searchedAt > 700 ? key : search + key;
      searchedAt = now;
      const query = [...search].every((char) => char === search[0]) ? search[0] : search;
      const normalize = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
      for (
        let step = query.length === 1 ? 1 : 0;
        step < options.length + (query.length === 1 ? 1 : 0);
        step++
      ) {
        const index = (active + step + options.length) % options.length;
        if (enabled(index) && normalize(options[index].text).startsWith(normalize(query))) {
          focusOption(index);
          break;
        }
      }
    });
    select.addEventListener('change', refresh);
    select.addEventListener('input', refresh);
    select.form?.addEventListener('reset', () => queueMicrotask(refresh));
    new MutationObserver(refresh).observe(select, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'disabled',
        'hidden',
        'aria-label',
        'aria-labelledby',
        'aria-describedby',
        'required',
        'selected',
        'value',
        'label',
        'lang',
      ],
    });
    const fieldset = select.closest('fieldset');
    if (fieldset)
      new MutationObserver(refresh).observe(fieldset, {
        attributes: true,
        attributeFilter: ['disabled'],
      });
    refresh();
  }
}
document.addEventListener(
  'pointerdown',
  (event) => {
    if (opened && !opened.wrapper.contains(event.target)) opened.close();
  },
  true,
);
document.addEventListener('focusin', (event) => {
  if (opened && !opened.wrapper.contains(event.target)) opened.close();
});
function reposition(event) {
  if (!opened || (event.target instanceof Node && opened.menu.contains(event.target))) return;
  cancelAnimationFrame(positionFrame);
  positionFrame = requestAnimationFrame(() => opened?.position());
}
window.addEventListener('resize', reposition);
document.addEventListener('scroll', reposition, true);
window.visualViewport?.addEventListener('resize', reposition);
window.visualViewport?.addEventListener('scroll', reposition);
window.addEventListener('pagehide', () => opened?.close());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) opened?.close();
});
const Select = Object.freeze({ enhance });
if (document.readyState === 'complete') enhance();
else document.addEventListener('DOMContentLoaded', () => enhance(), { once: true });
export { Select };
