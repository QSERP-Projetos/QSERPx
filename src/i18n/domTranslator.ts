/**
 * Tradutor de interface do QSERPx.
 *
 * O sistema é escrito em português. Quando o usuário escolhe outro idioma
 * (Inglês, Espanhol ou Japonês), este módulo troca na tela todos os textos
 * conhecidos pelo dicionário do idioma (src/i18n/locales/*.json):
 *   - textos visíveis (rótulos, botões, títulos, mensagens, avisos/toasts);
 *   - atributos placeholder, title, aria-label e alt.
 *
 * Funciona sem precisar alterar cada tela: um MutationObserver acompanha o
 * que o React desenha e traduz na hora, antes de a tela ser pintada.
 * O texto original em português fica guardado, então voltar para "Português"
 * restaura tudo sem recarregar a página.
 *
 * Textos com partes variáveis usam {0}, {1}... no dicionário, por exemplo
 *   "Empresa: {0}" -> "Company: {0}"
 *
 * Para não traduzir um trecho (dados do usuário, por exemplo), marque o
 * elemento com o atributo data-no-translate.
 *
 * Novos textos: rode `node scripts/i18n-extract.cjs` (lista o que falta) e
 * acrescente a tradução nos três arquivos de src/i18n/locales.
 */

export type UiLanguage = 'pt' | 'en' | 'es' | 'ja';

type Dict = Record<string, string>;
type Template = { re: RegExp; out: string; prefix: string; lowerGuard: number[] };

const LOADERS: Record<Exclude<UiLanguage, 'pt'>, () => Promise<{ default: Dict }>> = {
  en: () => import('./locales/en.json'),
  es: () => import('./locales/es.json'),
  ja: () => import('./locales/ja.json'),
};

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE']);
const HAS_LETTER = /[A-Za-zÀ-ÿ]/;

let current: UiLanguage = 'pt';
let dict: Dict = {};
let dictLower = new Map<string, string>();
let templatesByPrefix = new Map<string, Template[]>();
let templatesLoose: Template[] = [];
let observer: MutationObserver | null = null;
let loadToken = 0;
let originalTitle: string | null = null;

/** Texto original (pt) de cada nó de texto e o último valor que escrevemos nele. */
const textOriginal = new WeakMap<Text, string>();
const textWritten = new WeakMap<Text, string>();
/** Idem para atributos. */
const attrOriginal = new WeakMap<Element, Map<string, string>>();
const attrWritten = new WeakMap<Element, Map<string, string>>();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildTemplates(d: Dict) {
  templatesByPrefix = new Map();
  templatesLoose = [];
  for (const [pt, out] of Object.entries(d)) {
    if (!/\{\d+\}/.test(pt)) continue;
    const order: number[] = [];
    const lowerGuard: number[] = [];
    const source = pt
      .split(/(\{\d+\})/)
      .map((part, idx, parts) => {
        const prev = idx > 0 ? parts[idx - 1] : '';
        const m = part.match(/^\{(\d+)\}$/);
        if (m) {
          if (/(^|\s)$/.test(prev)) lowerGuard.push(order.length);
          order.push(Number(m[1]));
          return '([\\s\\S]+?)';
        }
        return escapeRe(part);
      })
      .join('');
    const tpl: Template = {
      re: new RegExp(`^${source}$`),
      out: out.replace(/\{(\d+)\}/g, (_, i) => `{@${order.indexOf(Number(i))}}`),
      prefix: pt.split('{')[0],
      lowerGuard,
    };
    const key = tpl.prefix.slice(0, 3);
    if (key.length < 3) templatesLoose.push(tpl);
    else {
      const list = templatesByPrefix.get(key) ?? [];
      list.push(tpl);
      templatesByPrefix.set(key, list);
    }
  }
}

function translateCore(core: string): string | null {
  const direct = dict[core];
  if (direct !== undefined) return direct;
  const folded = dictLower.get(core.toLowerCase());
  if (folded !== undefined) return folded;
  // "Texto:" / "Texto *" / "Texto..." derivados de uma chave conhecida
  const suffix = core.match(/^(.*?)(\s*[:*]+|\.\.\.|…)$/);
  if (suffix && dict[suffix[1]] !== undefined) return dict[suffix[1]] + suffix[2];
  const candidates = [...(templatesByPrefix.get(core.slice(0, 3)) ?? []), ...templatesLoose];
  for (const tpl of candidates) {
    if (!core.startsWith(tpl.prefix)) continue;
    const m = tpl.re.exec(core);
    // "Pedido {0}" não deve casar com "Pedido de venda": parte variável começando em
    // minúscula depois de um espaço é texto, não dado.
    if (m && tpl.lowerGuard.some((i) => /^[a-zà-ÿ][^\s]*\s/.test(m[i + 1] ?? ''))) continue;
    if (m) return tpl.out.replace(/\{@(\d+)\}/g, (_, i) => translateCore(m[Number(i) + 1]) ?? m[Number(i) + 1]);
  }
  return null;
}

/** Traduz uma frase avulsa para o idioma atual (útil em código que monta textos). */
export function translateText(value: string): string {
  if (current === 'pt' || !value || !HAS_LETTER.test(value)) return value;
  const core = value.trim();
  if (!core) return value;
  const tr = translateCore(core.replace(/\s+/g, ' '));
  if (tr == null) return value;
  const lead = value.match(/^\s*/)?.[0] ?? '';
  const trail = value.match(/\s*$/)?.[0] ?? '';
  return lead + tr + trail;
}

function skipped(el: Element | null, includeSelf = true): boolean {
  for (let e = includeSelf ? el : el?.parentElement ?? null; e; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName)) return true;
    if (e.hasAttribute('data-no-translate') || e.getAttribute('translate') === 'no') return true;
    if ((e as HTMLElement).isContentEditable) return true;
  }
  return false;
}

function handleText(node: Text) {
  const value = node.nodeValue ?? '';
  if (textWritten.get(node) === value) return; // fomos nós que escrevemos
  textOriginal.set(node, value);
  textWritten.delete(node);
  if (current === 'pt' || !HAS_LETTER.test(value)) return;
  if (skipped(node.parentElement)) return;
  const tr = translateText(value);
  if (tr !== value) {
    textWritten.set(node, tr);
    node.nodeValue = tr;
  }
}

function handleAttr(el: Element, name: string) {
  const value = el.getAttribute(name);
  if (value == null) return;
  const written = attrWritten.get(el);
  if (written?.get(name) === value) return;
  let orig = attrOriginal.get(el);
  if (!orig) {
    orig = new Map();
    attrOriginal.set(el, orig);
  }
  orig.set(name, value);
  written?.delete(name);
  if (current === 'pt' || !HAS_LETTER.test(value) || el.hasAttribute('data-no-translate') || skipped(el, false)) return;
  const tr = translateText(value);
  if (tr !== value) {
    let w = written;
    if (!w) {
      w = new Map();
      attrWritten.set(el, w);
    }
    w.set(name, tr);
    el.setAttribute(name, tr);
  }
}

function handleElement(el: Element) {
  for (const name of ATTRS) if (el.hasAttribute(name)) handleAttr(el, name);
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    handleText(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as Element;
    if (SKIP_TAGS.has(el.tagName)) return;
    handleElement(el);
  }
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) handleText(n as Text);
    else handleElement(n as Element);
  }
}

/** Reaplica o idioma atual em toda a tela, partindo sempre do texto original. */
function retranslateAll() {
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n as Text;
      const orig = textOriginal.get(t);
      if (orig !== undefined && t.nodeValue === textWritten.get(t)) {
        textWritten.delete(t);
        t.nodeValue = orig; // volta ao pt; handleText abaixo traduz de novo
      }
      handleText(t);
    } else {
      const el = n as Element;
      const orig = attrOriginal.get(el);
      const written = attrWritten.get(el);
      for (const name of ATTRS) {
        if (!el.hasAttribute(name)) continue;
        if (orig?.has(name) && written?.get(name) === el.getAttribute(name)) {
          written.delete(name);
          el.setAttribute(name, orig.get(name)!);
        }
        handleAttr(el, name);
      }
    }
  }
  if (originalTitle == null) originalTitle = document.title;
  document.title = translateText(originalTitle);
}

function startObserver() {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'characterData') handleText(m.target as Text);
      else if (m.type === 'attributes') handleAttr(m.target as Element, m.attributeName!);
      else m.addedNodes.forEach((n) => walk(n));
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  });
}

/** Define o idioma da interface. Português é o idioma de origem (sem dicionário). */
export async function setUiLanguage(language: UiLanguage): Promise<void> {
  const token = ++loadToken;
  document.documentElement.lang = language === 'pt' ? 'pt-BR' : language;
  let next: Dict = {};
  if (language !== 'pt') {
    try {
      next = (await LOADERS[language]()).default;
    } catch {
      next = {};
    }
  }
  if (token !== loadToken) return; // outra troca começou nesse meio tempo
  current = language;
  dict = next;
  dictLower = new Map(Object.entries(next).map(([k, v]) => [k.toLowerCase(), v]));
  buildTemplates(dict);
  startObserver();
  retranslateAll();
}

export function getUiLanguage(): UiLanguage {
  return current;
}
