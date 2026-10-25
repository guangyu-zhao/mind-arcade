import { Text } from '../i18n/runtime.js';
import { element, svg } from './dom.js';
import './settings.css';

export function mountTaskSettings() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const form = sidebar.querySelector('.settings:not([hidden])'),
    scale = sidebar.querySelector('.display-scale-control');
  if (!form && !scale) return;

  const panel = element('section', 'task-settings'),
    toggle = element('button', 'task-settings-toggle'),
    heading = element('span', 'task-settings-heading'),
    title = element('span', 'task-settings-title'),
    summary = element('span', 'task-settings-summary'),
    chevron = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }),
    content = element('div', 'task-settings-content'),
    narrow = matchMedia('(max-width: 900px)'),
    slider = scale?.querySelector('input[type="range"]'),
    reset = slider ? element('button', 'scale-reset') : null;
  let expanded = !narrow.matches;
  const isRunning = () => document.body.classList.contains('running');
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', 'task-settings-content');
  title.id = 'task-settings-title';
  summary.id = 'task-settings-summary';
  toggle.setAttribute('aria-labelledby', title.id);
  toggle.setAttribute('aria-describedby', summary.id);
  panel.setAttribute('aria-labelledby', title.id);
  content.id = 'task-settings-content';
  chevron.append(svg('path', { d: 'm6 9 6 6 6-6' }));
  heading.append(title, chevron);
  toggle.append(heading, summary);
  panel.append(toggle, content);
  (form || scale).before(panel);
  if (form) content.append(form);
  if (scale) content.append(scale);

  function selectedRules() {
    return [...(form?.querySelectorAll('input:checked') || [])].map((input) => {
      const label = input.closest('label')?.textContent.trim() || input.value,
        format = input.closest('fieldset')?.dataset.summaryFormat;
      return format ? Text.t(format, { value: label }) : label;
    });
  }
  function render() {
    const running = isRunning(),
      open = expanded && !running,
      rules = selectedRules();
    title.textContent = Text.t('settings.title');
    summary.textContent = rules.length
      ? rules.join(' · ')
      : Text.t('settings.scale-summary', { value: slider.value });
    toggle.setAttribute('aria-expanded', String(open));
    toggle.disabled = running;
    content.hidden = !open;
    if (reset) {
      reset.textContent = Text.t('settings.restore');
      reset.setAttribute('aria-label', Text.t('settings.restore-scale'));
      reset.style.visibility = slider.value === slider.defaultValue ? 'hidden' : '';
      reset.disabled = running || slider.disabled;
    }
  }
  if (reset) {
    reset.type = 'button';
    scale.append(reset);
    reset.addEventListener('click', () => {
      if (isRunning() || slider.disabled) return;
      slider.value = slider.defaultValue;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      slider.focus({ preventScroll: true });
    });
  }
  toggle.addEventListener('click', () => {
    if (isRunning()) return;
    expanded = !expanded;
    render();
  });
  panel.addEventListener('input', render);
  panel.addEventListener('change', render);
  narrow.addEventListener('change', () => {
    expanded = !narrow.matches;
    render();
  });
  window.addEventListener('mindlab-language-change', render);
  new MutationObserver(render).observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  });
  render();
}
