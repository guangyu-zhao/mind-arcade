import { element, svg } from '../dom.js';
import { labeled, button } from './elements.js';
import { text } from '../../i18n/cloud.js';
import { normalizeUsername } from '../../services/cloud/account.js';
import { errorKey } from '../../services/cloud/errors.js';
export function createAccountDialog(account, isRunning) {
  let authMode = 'login',
    authBusy = false;
  const dialog = element('dialog', 'cloud-dialog');
  document.body.append(dialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    }
  });
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  function openDialog(mode = 'login') {
    if (isRunning() || !account.state.ready || authBusy) return;
    authMode = mode;
    renderDialog();
    if (!dialog.open) dialog.showModal();
  }
  function renderDialog() {
    if (!dialog || authBusy) return;
    const previousName = dialog.querySelector('[name=username]')?.value || '';
    dialog.replaceChildren();
    const heading = element('div', 'cloud-heading'),
      close = element('button', 'cloud-button cloud-close');
    close.type = 'button';
    close.dataset.cloudLabel = 'close';
    close.setAttribute('aria-label', text('close'));
    close.title = text('close');
    const closeIcon = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    closeIcon.append(svg('path', { d: 'm6 6 12 12M18 6 6 18' }));
    close.append(closeIcon);
    close.addEventListener('click', () => dialog.close());
    heading.append(labeled('h2', 'account'), close);
    dialog.append(heading);
    const { user, profile } = account.state;
    if (user) {
      dialog.append(
        element('p', '', profile?.username || user.user_metadata?.username || text('account')),
      );
      const out = button('logout', async () => {
        out.disabled = true;
        const errorNode = element('p', 'cloud-form-error');
        errorNode.setAttribute('role', 'alert');
        dialog.querySelector('.cloud-form-error')?.remove();
        dialog.append(errorNode);
        try {
          await account.signOut();
          dialog.close();
        } catch (error) {
          errorNode.dataset.cloudText = errorKey(error);
          errorNode.textContent = text(errorNode.dataset.cloudText);
        } finally {
          out.disabled = false;
        }
      });
      dialog.append(out);
      return;
    }
    const tabs = element('div', 'cloud-tabs');
    for (const mode of ['login', 'register']) {
      const b = button(mode, () => {
        if (!authBusy) {
          authMode = mode;
          renderDialog();
        }
      });
      b.setAttribute('aria-pressed', String(mode === authMode));
      tabs.append(b);
    }
    dialog.append(tabs);
    const form = element('form', 'cloud-form');
    function field(key, type, autocomplete) {
      const label = element('label'),
        input = element('input', 'cloud-input');
      input.type = type;
      input.name = key;
      input.autocomplete = autocomplete;
      input.required = true;
      label.append(labeled('span', key));
      if (type === 'password') {
        const row = element('div', 'cloud-password');
        const toggle = element('button', 'cloud-button cloud-password-toggle');
        toggle.type = 'button';
        const icon = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
        icon.append(
          svg('path', { d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z' }),
          svg('circle', { cx: 12, cy: 12, r: 3 }),
          svg('path', { d: 'm3 3 18 18', class: 'password-slash' }),
        );
        toggle.append(icon);
        const update = () => {
          const visible = input.type === 'text';
          toggle.dataset.cloudLabel = visible ? 'hidePassword' : 'showPassword';
          toggle.setAttribute('aria-label', text(toggle.dataset.cloudLabel));
          toggle.setAttribute('title', text(toggle.dataset.cloudLabel));
          toggle.setAttribute('aria-pressed', String(visible));
        };
        toggle.addEventListener('click', () => {
          input.type = input.type === 'password' ? 'text' : 'password';
          update();
        });
        update();
        row.append(input, toggle);
        label.append(row);
      } else label.append(input);
      form.append(label);
      return input;
    }
    const name = field('username', 'text', 'username');
    name.maxLength = 48;
    name.autocapitalize = 'none';
    name.spellcheck = false;
    name.value = previousName;
    name.autofocus = true;
    const password = field(
      'password',
      'password',
      authMode === 'login' ? 'current-password' : 'new-password',
    );
    password.minLength = 6;
    password.maxLength = 128;
    let confirmation;
    if (authMode === 'register') {
      confirmation = field('confirm', 'password', 'new-password');
      form.append(
        labeled('p', 'usernameHint', 'cloud-muted'),
        labeled('p', 'passwordHint', 'cloud-muted'),
      );
    }
    const errorNode = element('p', 'cloud-form-error');
    errorNode.setAttribute('role', 'alert');
    form.append(errorNode);
    const send = labeled('button', authMode, 'cloud-button cloud-primary');
    send.type = 'submit';
    form.append(send);
    dialog.append(form);
    if (dialog.open) name.focus({ preventScroll: true });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (authBusy) return;
      const username = normalizeUsername(name.value),
        passwordValue = password.value,
        mode = authMode;
      const showError = (key) => {
        errorNode.dataset.cloudText = key;
        errorNode.textContent = text(key);
      };
      if (
        [...username].length < 2 ||
        [...username].length > 24 ||
        [...username].some(
          (char) =>
            char.codePointAt(0) < 32 || (char.codePointAt(0) >= 127 && char.codePointAt(0) <= 159),
        )
      ) {
        showError('invalidName');
        return;
      }
      if (confirmation && confirmation.value !== password.value) {
        showError('mismatch');
        return;
      }
      authBusy = true;
      send.dataset.cloudText = 'busy';
      send.textContent = text('busy');
      delete errorNode.dataset.cloudText;
      errorNode.textContent = '';
      const controls = [
        ...form.querySelectorAll('input,button'),
        ...tabs.querySelectorAll('button'),
      ];
      controls.forEach((control) => {
        control.disabled = true;
      });
      try {
        await account.authenticate(mode, username, passwordValue);
        password.value = '';
        if (confirmation) confirmation.value = '';
        dialog.close();
      } catch (error) {
        showError(errorKey(error));
      } finally {
        authBusy = false;
        controls.forEach((control) => {
          control.disabled = false;
        });
        send.dataset.cloudText = mode;
        send.textContent = text(mode);
      }
    });
  }
  return {
    open: openDialog,
    close() {
      dialog.close();
    },
    translate() {
      dialog.setAttribute('aria-label', text('account'));
    },
    dispose() {
      dialog.remove();
    },
  };
}
