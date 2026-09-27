// Quill 2.0.3, vendored locally. Public content still passes through our allowlist.
const WritingEditor = (() => {
  const storage = document.getElementById('j-body');
  const Delta = Quill.import('delta');
  const Embed = Quill.import('blots/embed');
  class PoetryBreak extends Embed {
    static blotName = 'poetryBreak';
    static tagName = 'BR';
    static className = 'poetry-break';
    static value() { return true; }
  }
  Quill.register(PoetryBreak);
  const editor = new Quill('#writing-area', {
    theme: 'snow',
    placeholder: 'Begin writing…',
    formats: ['bold', 'italic', 'header', 'list', 'blockquote', 'align', 'poetryBreak'],
    modules: {
      toolbar: {
        container: '#writing-toolbar',
        handlers: {
          undo() { this.quill.history.undo(); },
          redo() { this.quill.history.redo(); }
        }
      },
      history: { delay: 500, maxStack: 100, userOnly: true },
      keyboard: {
        bindings: {
          poetryBreak: {
            key: 'Enter', shiftKey: true,
            handler(range) {
              // A soft break keeps the poem's lines in the same paragraph.
              this.quill.deleteText(range.index, range.length, 'user');
              this.quill.insertEmbed(range.index, 'poetryBreak', true, 'user');
              this.quill.setSelection(range.index + 1, 0, 'silent');
              return false;
            }
          }
        }
      },
      clipboard: {
        matchers: [[Node.TEXT_NODE, (node, delta) => {
          // Quill's default HTML importer collapses Unicode line separators.
          return node.data.includes('\u2028') ? new Delta().insert(node.data) : delta;
        }], ['BR', (element) => {
          const emptyLine = element.parentElement?.childNodes.length === 1;
          return emptyLine ? new Delta() : new Delta().insert({ poetryBreak: true });
        }]]
      }
    }
  });
  editor.root.setAttribute('role', 'textbox');
  editor.root.setAttribute('aria-multiline', 'true');
  editor.root.setAttribute('aria-labelledby', 'writing-label');
  editor.root.setAttribute('aria-describedby', 'writing-hint');
  editor.root.setAttribute('spellcheck', 'true');
  let loading = false;
  function sync() {
    storage.value = editor.getText().trim() ? Journal.cleanHTML(editor.getSemanticHTML()).replace(/\u2028/g, '<br>') : '';
  }
  editor.on('text-change', () => {
    sync();
    if (!loading) storage.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // Feed only approved formatting into the editor, including on paste.
  editor.root.addEventListener('paste', event => {
    if (!event.clipboardData) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const range = editor.getSelection(true);
    const html = event.clipboardData.getData('text/html');
    const delta = html
      ? editor.clipboard.convert({ html: Journal.cleanHTML(html) })
      : new Delta().insert(event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n'));
    editor.updateContents(new Delta().retain(range.index).delete(range.length).concat(delta), 'user');
    editor.setSelection(range.index + delta.length(), 0, 'silent');
  }, true);
  return {
    set(post) {
      loading = true;
      try {
        if (post?.body_format === 'html') editor.setContents(editor.clipboard.convert({html: Journal.cleanHTML(post.body)}), 'api');
        else editor.setText(post?.body || '', 'api');
        editor.history.clear();
        sync();
      } finally { loading = false; }
    },
    disable(value) { editor.enable(!value); editor.root.setAttribute('aria-disabled', String(value)); },
    text() { return editor.getText().trim(); },
    sync
  };
})();
