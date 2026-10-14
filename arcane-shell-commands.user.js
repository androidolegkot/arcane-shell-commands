// ==UserScript==
// @name         Arcane Shell Commands
// @namespace    https://github.com/androidolegkot/arcane-shell-commands
// @version      0.1.0
// @description  Favorite shell commands menu for Arcane container Shell
// @match        http://localhost:3552/containers/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  // Adapt these selectors if you want to use the script with another panel.
  const SELECTORS = {
    shellInput: 'textarea.xterm-helper-textarea',
    shellHeaderActions: '[data-slot="card-header"] .flex.items-center.gap-2',
    shellTab: 'tab=shell',
    insertBefore: 'button[data-slot="select-trigger"]'
  };

  const STORAGE_KEY = 'arcane-shell-commands.tree.v1';
  const STYLE_ID = 'asc-style';
  const ROOT_ID = 'asc-root';

  // Tree format: folders are objects; command leaves are strings.
  // Example: { "vpn": { "wg": { "de": { "status": "wg show" } } } }
  const DEFAULT_TREE = {};

  let tree = loadTree();
  let root;
  let menu;
  let submenu;
  let activeMode = 'insert';
  let openPath = [];

  function loadTree() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : DEFAULT_TREE;
      return isFolder(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function isFolder(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function saveTree() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree, null, 2));
  }

  function isShellPage() {
    return location.pathname.startsWith('/containers/') &&
      new URLSearchParams(location.search).get('tab') === 'shell';
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} { position: relative; display: inline-flex; font: inherit; z-index: 1000; }
      #${ROOT_ID} button { font: inherit; cursor: pointer; }
      #asc-trigger {
        height: 32px; padding: 0 10px; border: 1px solid var(--border, #d4d4d8);
        border-radius: 8px; background: var(--background, #fff); color: var(--foreground, #18181b);
        white-space: nowrap; font-size: 13px;
      }
      #asc-trigger:hover, .asc-item:hover { background: var(--accent, #f4f4f5); }
      .asc-popup {
        position: absolute; top: calc(100% + 6px); left: 0; min-width: 190px;
        max-width: min(320px, 85vw); max-height: 65vh; overflow: auto;
        padding: 4px; border: 1px solid var(--border, #d4d4d8); border-radius: 10px;
        background: var(--popover, var(--background, #fff)); color: var(--foreground, #18181b);
        box-shadow: 0 8px 28px #0002; z-index: 99999;
      }
      .asc-popup[hidden] { display: none !important; }
      .asc-item {
        display: flex; align-items: center; justify-content: space-between; gap: 14px;
        width: 100%; min-height: 32px; padding: 6px 9px; border: 0; border-radius: 6px;
        background: transparent; color: inherit; text-align: left; font-size: 13px;
      }
      .asc-separator { height: 1px; margin: 4px 5px; background: var(--border, #e4e4e7); }
      .asc-back { color: var(--muted-foreground, #71717a); }
      #asc-editor-backdrop {
        position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
        padding: 20px; background: #0006; z-index: 100000;
      }
      #asc-editor-backdrop[hidden] { display: none !important; }
      #asc-editor {
        display: flex; flex-direction: column; gap: 10px; width: min(680px, 95vw);
        max-height: 85vh; padding: 16px; border: 1px solid var(--border, #d4d4d8);
        border-radius: 12px; background: var(--background, #fff); color: var(--foreground, #18181b);
        box-shadow: 0 12px 40px #0004;
      }
      #asc-editor h3 { margin: 0; font-size: 16px; }
      #asc-json {
        box-sizing: border-box; width: 100%; min-height: 260px; flex: 1; resize: vertical;
        padding: 10px; border: 1px solid var(--border, #d4d4d8); border-radius: 8px;
        background: var(--background, #fff); color: inherit; font: 12px/1.5 monospace;
      }
      .asc-editor-actions { display: flex; justify-content: flex-end; gap: 8px; }
      .asc-editor-actions button {
        padding: 7px 12px; border: 1px solid var(--border, #d4d4d8); border-radius: 7px;
        background: var(--background, #fff); color: inherit;
      }
      .asc-editor-actions .asc-save { background: var(--primary, #2563eb); color: white; border-color: transparent; }
      #asc-error { min-height: 16px; color: #dc2626; font-size: 12px; }
    `;
    document.head.appendChild(style);
  }

  function createRoot() {
    if (document.getElementById(ROOT_ID)) return;
    const select = document.querySelector(SELECTORS.insertBefore);
    if (!select || !isShellPage()) return;

    root = document.createElement('div');
    root.id = ROOT_ID;

    const trigger = document.createElement('button');
    trigger.id = 'asc-trigger';
    trigger.type = 'button';
    trigger.textContent = 'Команды ▾';
    trigger.title = 'Избранные команды';
    trigger.addEventListener('click', () => {
      if (!menu) buildMainMenu();
      menu.hidden = !menu.hidden;
      submenu.hidden = true;
    });

    menu = document.createElement('div');
    menu.className = 'asc-popup';
    menu.hidden = true;

    submenu = document.createElement('div');
    submenu.className = 'asc-popup';
    submenu.style.left = '0';
    submenu.style.top = 'calc(100% + 6px)';
    submenu.hidden = true;

    root.append(trigger, menu, submenu);
    select.parentElement.insertBefore(root, select);
    document.addEventListener('pointerdown', onOutsidePointer);
    document.addEventListener('keydown', onGlobalKeydown);
    addStyles();
    buildMainMenu();
  }

  function onOutsidePointer(event) {
    if (root && !root.contains(event.target)) closeMenus();
  }

  function onGlobalKeydown(event) {
    if (event.key === 'Escape') {
      closeMenus();
      closeEditor();
    }
  }

  function closeMenus() {
    if (menu) menu.hidden = true;
    if (submenu) submenu.hidden = true;
  }

  function addMenuItem(parent, label, onClick, extraClass = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'asc-item ' + extraClass;
    button.textContent = label;
    button.addEventListener('click', onClick);
    parent.appendChild(button);
    return button;
  }

  function buildMainMenu() {
    if (!menu) return;
    menu.replaceChildren();
    addMenuItem(menu, 'Ввести', () => openCommandTree('insert'));
    addMenuItem(menu, 'Выполнить', () => openCommandTree('execute'));
    const separator = document.createElement('div');
    separator.className = 'asc-separator';
    menu.appendChild(separator);
    addMenuItem(menu, 'Редактировать', openEditor);
  }

  function getAtPath(path) {
    let current = tree;
    for (const part of path) {
      if (!isFolder(current) || !(part in current)) return null;
      current = current[part];
    }
    return current;
  }

  function openCommandTree(mode) {
    activeMode = mode;
    openPath = [];
    menu.hidden = true;
    renderCommandTree();
    submenu.hidden = false;
  }

  function renderCommandTree() {
    submenu.replaceChildren();
    const current = getAtPath(openPath);
    if (openPath.length) {
      addMenuItem(submenu, '‹ Назад', () => {
        openPath.pop();
        renderCommandTree();
      }, 'asc-back');
      const sep = document.createElement('div');
      sep.className = 'asc-separator';
      submenu.appendChild(sep);
    }

    if (!isFolder(current) || Object.keys(current).length === 0) {
      const empty = document.createElement('div');
      empty.className = 'asc-item asc-back';
      empty.textContent = 'Нет команд';
      submenu.appendChild(empty);
      return;
    }

    for (const [name, value] of Object.entries(current)) {
      if (isFolder(value)) {
        addMenuItem(submenu, '📁 ' + name + '  ›', () => {
          openPath.push(name);
          renderCommandTree();
        });
      } else if (typeof value === 'string') {
        addMenuItem(submenu, '› ' + name, () => {
          const ok = insertCommand(value);
          if (!ok) {
            alert('Не найдено поле ввода Shell.');
            return;
          }
          if (activeMode === 'execute') sendEnter();
          closeMenus();
        });
      }
    }
  }

  function getShellInput() {
    return document.querySelector(SELECTORS.shellInput);
  }

  function insertCommand(command) {
    const el = getShellInput();
    if (!el) return false;
    el.focus();

    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (!descriptor || !descriptor.set) return false;
    descriptor.set.call(el, command);
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: command
    }));
    return true;
  }

  function sendEnter() {
    const el = getShellInput();
    if (!el) return false;
    el.focus();
    return el.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }));
  }

  let editorBackdrop;

  function openEditor() {
    closeMenus();
    if (!editorBackdrop) buildEditor();
    document.getElementById('asc-json').value = JSON.stringify(tree, null, 2);
    document.getElementById('asc-error').textContent = '';
    editorBackdrop.hidden = false;
    document.getElementById('asc-json').focus();
  }

  function closeEditor() {
    if (editorBackdrop) editorBackdrop.hidden = true;
  }

  function buildEditor() {
    editorBackdrop = document.createElement('div');
    editorBackdrop.id = 'asc-editor-backdrop';
    editorBackdrop.hidden = true;
    editorBackdrop.addEventListener('pointerdown', event => {
      if (event.target === editorBackdrop) closeEditor();
    });

    const panel = document.createElement('section');
    panel.id = 'asc-editor';
    const heading = document.createElement('h3');
    heading.textContent = 'Избранные команды';
    const help = document.createElement('div');
    help.style.cssText = 'font-size:12px;color:var(--muted-foreground,#71717a)';
    help.textContent = 'Папки — объекты, команды — строки. Изменения хранятся в этом браузере.';
    const textarea = document.createElement('textarea');
    textarea.id = 'asc-json';
    textarea.spellcheck = false;
    const error = document.createElement('div');
    error.id = 'asc-error';
    const actions = document.createElement('div');
    actions.className = 'asc-editor-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Отмена';
    cancel.addEventListener('click', closeEditor);

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'asc-save';
    save.textContent = 'Сохранить';
    save.addEventListener('click', () => {
      try {
        const parsed = JSON.parse(textarea.value);
        if (!isFolder(parsed)) throw new Error('Верхний уровень должен быть объектом {}.');
        if (!validateTree(parsed)) throw new Error('Допустимы только папки-объекты и команды-строки.');
        tree = parsed;
        saveTree();
        buildMainMenu();
        closeEditor();
      } catch (errorValue) {
        error.textContent = errorValue.message || 'Некорректный JSON.';
      }
    });

    actions.append(cancel, save);
    panel.append(heading, help, textarea, error, actions);
    editorBackdrop.appendChild(panel);
    document.body.appendChild(editorBackdrop);
  }

  function validateTree(value) {
    if (!isFolder(value)) return false;
    return Object.values(value).every(child =>
      typeof child === 'string' || (isFolder(child) && validateTree(child))
    );
  }

  function ensureMounted() {
    if (!isShellPage()) {
      const existing = document.getElementById(ROOT_ID);
      if (existing) existing.remove();
      root = null;
      return;
    }
    if (!document.getElementById(ROOT_ID)) createRoot();
  }

  // Arcane is a single-page app; keep the button in sync with navigation and rerenders.
  const observer = new MutationObserver(ensureMounted);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      queueMicrotask(ensureMounted);
      return result;
    };
  }
  window.addEventListener('popstate', ensureMounted);
  ensureMounted();
})();
