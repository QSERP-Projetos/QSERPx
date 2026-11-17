/**
 * Lista os textos da interface que ainda não têm tradução.
 *
 *   node scripts/i18n-missing.cjs          -> resumo
 *   node scripts/i18n-missing.cjs --list   -> textos sem tradução (por idioma)
 *
 * Os textos são lidos do código (JSX, placeholders, títulos, mensagens) e
 * comparados com src/i18n/locales/{en,es,ja}.json. Para traduzir, acrescente
 * a chave em português e o texto traduzido nos três arquivos. Partes
 * variáveis usam {0}, {1}...
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'src');
const files = [];
(function walk(d){ for (const f of fs.readdirSync(d)) { const p = path.join(d,f); const st = fs.statSync(p); if (st.isDirectory()) walk(p); else if (/\.(tsx|ts)$/.test(f) && !/\.d\.ts$/.test(f)) files.push(p); } })(root);
const SKIP_ATTR = new Set(['className','key','type','id','name','href','to','role','method','autoComplete','inputMode','htmlFor','rel','target','src','data-testid','pattern','accept','mode','variant','tone','size','align','as','direction','field','value','icon','format']);
const UI_ATTR = new Set(['placeholder','title','aria-label','alt','label','searchPlaceholder','emptyMessage','ariaLabel','subtitle','description','message','confirmLabel','cancelLabel','text','tooltip','emptyText','heading','helperText','loadingText','listTitle']);
const out = new Map();
const add = (s, kind, file) => {
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return;
  if (!/[A-Za-zÀ-ÿ]/.test(s)) return;
  if (s.length > 400) return;
  const k = out.get(s) || { kinds: new Set(), files: new Set() };
  k.kinds.add(kind); k.files.add(path.relative(root, file)); out.set(s, k);
};
const looksUI = (s) => {
  const t = s.trim();
  if (!t) return false;
  if (/^(https?:|\/|\.\/|\.\.\/|#|@|\$\{)/.test(t)) return false;
  if (/^[a-z0-9_.:\-\/\[\]]+$/.test(t)) return false;       // ids, classes, keys
  if (/^[A-Z0-9_]+$/.test(t) && t.length > 3) return false;  // CONSTANTS
  if (/^[a-z]+[A-Z][A-Za-z0-9]*$/.test(t)) return false;     // camelCase
  if (/^[A-Za-z]+_[A-Za-z_0-9]+$/.test(t)) return false;     // snake_Case fields
  if (/[{};]|=>|\bvar\(|px\b|rgba?\(|^\d/.test(t) && !/[À-ÿ]/.test(t)) return false;
  if (/^(GET|POST|PUT|DELETE|PATCH)$/.test(t)) return false;
  if (/^[\w.-]+\.(png|svg|jpg|css|tsx?|json|pdf|xml)$/i.test(t)) return false;
  return /[A-Za-zÀ-ÿ]{2,}/.test(t);
};
for (const file of files) {
  if (/services\/|types\//.test(file) && !/globalConfig/.test(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxText(node)) { add(node.getText(), 'jsx', file); return; }
    if (ts.isJsxAttribute(node)) {
      const n = node.name.getText();
      if (SKIP_ATTR.has(n) && !UI_ATTR.has(n)) return;
    }
    if (ts.isPropertyAssignment(node)) {
      const n = node.name.getText().replace(/['"]/g,'');
      if (SKIP_ATTR.has(n) && n !== 'value') return;
      if (n === 'value' && ts.isStringLiteral(node.initializer)) return;
    }
    if (ts.isCallExpression(node)) {
      const fn = node.expression.getText();
      if (/(localStorage|sessionStorage)\.|querySelector|getElementById|classList|addEventListener|\.(get|set|has|delete)$|^(fetch|console\.\w+|new Error)$|\.includes$|\.startsWith$|\.endsWith$|\.split$|\.replace$|\.match$|\.test$|\.padStart$|toLocaleString|Intl\./.test(fn)) return;
    }
    if (ts.isElementAccessExpression(node)) return;
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(node.operatorToken.kind)) return;
    if (ts.isCaseClause(node)) { node.statements.forEach(visit); return; }
    if (ts.isTypeNode(node) && !ts.isTypeLiteralNode(node)) return;
    if (ts.isLiteralTypeNode(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (looksUI(node.text)) add(node.text, 'str', file);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      let s = node.head.text; let i = 0;
      for (const sp of node.templateSpans) { s += `{${i++}}` + sp.literal.text; }
      if (looksUI(s.replace(/\{\d+\}/g, ''))) add(s, 'tpl', file);
      node.templateSpans.forEach((sp) => visit(sp.expression));
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
const html = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&bull;/g, '•');
const keys = [...out.keys()].map(html).filter((s) => /[a-zà-ÿ]{3,}/i.test(s) && !/--|__|^[a-z]+\.[a-zA-Z]+$/.test(s));
const list = process.argv.includes('--list');
for (const lang of ['en', 'es', 'ja']) {
  const dict = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'locales', `${lang}.json`), 'utf8'));
  const missing = keys.filter((k) => dict[k] === undefined);
  console.log(`${lang}: ${keys.length - missing.length}/${keys.length} textos com tradução (${missing.length} sem)`);
  if (list) missing.forEach((m) => console.log('   ', m));
}
