# Padrão de Telas do QSERPx

Este documento é o **contrato visual e de comportamento** de toda tela nova do QSERPx.
Siga-o à risca: se uma tela nova seguir tudo o que está aqui, ela fica igual às demais
(fonte, cores, espaçamentos, lista, popups, botões, status, celular e idiomas) sem
precisar de CSS próprio.

> Antes de começar, abra uma tela pronta como referência:
> **`src/features/basico/pages/AlmoxarifadoPage.tsx`** (lista + popup de cadastro com campos obrigatórios).
> Outras boas referências: `ClientesPage.tsx`, `ServicosPage.tsx`, `ContasReceberPage.tsx` (lista com seleção e painel lateral).

Rotas, menu e chamadas de API estão em `docs/Guia_Criacao_Telas_e_Modulos.md`. Este arquivo trata só do **padrão da tela**.

---

## 1. Regras de ouro

1. **Não crie CSS novo para o que já existe.** Página, painel, lista, popup, botões, status, campos e celular já estão prontos em `src/styles/theme.css`. CSS específico só para algo realmente novo, e sempre usando as variáveis de tema.
2. **Sem cores fixas.** Nada de `#fff`, `#16a34a`, `rgb(...)`. Use `var(--color-*)` e `var(--status-*)` (seção 10).
3. **Sem estilo inline em botões** (`width`, `height`, `padding`, `background`, `color`). O tamanho e a cor dos botões são padronizados.
4. **Listagens usam `DataList`**, nunca `<table>` (tabela só dentro de popup para itens de um subformulário).
5. **Popups usam `ModalHeaderActions`** no topo e botão **Fechar/Cancelar no rodapé**.
6. **Status sempre com `StatusBadge`.**
7. **Campos obrigatórios com `useRequiredFields`**: nada vermelho ao abrir, vermelho só ao confirmar.
8. **Textos em português, frases inteiras.** A tradução para EN/ES/JA é automática (seção 12).
9. **Ícones** apenas de `react-icons/io5` (variante `Outline`), tamanho 16 em botões e 18 no "Voltar".
10. Conferir a tela no **celular (390px)**, nos **temas claro e escuro** e em **outro idioma** antes de entregar.

---

## 2. Estrutura de arquivos

```
src/features/<modulo>/pages/MinhaTelaPage.tsx   ← a tela
src/features/<modulo>/components/...            ← popups grandes ou partes reaproveitáveis (opcional)
```

Componentes padrão que você vai usar:

| Componente | Arquivo | Para quê |
|---|---|---|
| `ListSearchField` | `src/components/ListSearchField.tsx` | Campo de pesquisa do topo da lista |
| `DataList`, `DataListItem`, `DataListSortBar` | `src/components/DataList.tsx` | Lista de registros + barra "Ordenar por" |
| `AdvancedFiltersPanel` | `src/components/AdvancedFiltersPanel.tsx` | Painel de filtros avançados |
| `ModalHeaderActions` | `src/components/ModalHeaderActions.tsx` | Botões Expandir + X do popup |
| `StatusBadge` | `src/components/StatusBadge.tsx` | Selo colorido de situação |
| `SearchableSelect` | `src/components/SearchableSelect.tsx` | Combo com pesquisa |
| `CustomDatePicker` / `CustomTimePicker` | `src/components/` | Data (DD/MM/AAAA) e hora (HH:MM) |
| `useRequiredFields` | `src/hooks/useRequiredFields.tsx` | Destaque de campos obrigatórios |
| `useToast` | `src/contexts/ToastContext.tsx` | Mensagens de sucesso/erro/aviso |

---

## 3. Esqueleto da página (copie e adapte)

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoAddOutline, IoArrowBack, IoCreateOutline, IoRefreshOutline, IoTrashOutline } from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { ListSearchField } from '../../../components/ListSearchField';
import { DataList, DataListItem, DataListSortBar } from '../../../components/DataList';
import { StatusBadge } from '../../../components/StatusBadge';

type SortField = 'codigo' | 'descricao' | 'situacao';

export function MinhaTelaPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('codigo');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDirection('asc'); }
  };

  const filtrados = useMemo(() => /* filtrar por search + ordenar */ rows, [rows, search, sortField, sortDirection]);

  return (
    <main className="clientes-page list-layout-page minha-tela-page">
      {/* 1. CABEÇALHO: voltar + título + descrição curta */}
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Minha Tela</h1>
            <p>Consulta e cadastro de registros.</p>
          </div>
        </div>
      </section>

      {/* 2. PAINEL */}
      <section className="clientes-panel list-layout-panel">
        {/* 2a. Topo: total + pesquisa + ações (ícones) */}
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{`${filtrados.length} encontrados`}</span>
          </div>

          <div className="list-layout-controls clientes-panel__controls">
            <ListSearchField
              value={search}
              onChange={setSearch}
              mobileLabel="Minha Tela"
              placeholder="Pesquisar código ou descrição"
            />
            <button className="icon-button module-action-button" type="button"
              onClick={() => void carregar()} aria-label="Atualizar" title="Atualizar" disabled={loading}>
              <IoRefreshOutline size={16} />
            </button>
            <button className="icon-button module-action-button module-action-button--primary" type="button"
              onClick={abrirNovo} aria-label="Novo registro" title="Novo registro">
              <IoAddOutline size={16} />
            </button>
          </div>
        </div>

        {/* 2b. Lista */}
        {loading ? (
          <p className="module-empty">Carregando registros...</p>
        ) : filtrados.length === 0 ? (
          <p className="module-empty">Nenhum registro encontrado.</p>
        ) : (
          <div className="data-cards-region">
            <DataListSortBar
              options={[
                { field: 'codigo', label: 'Código' },
                { field: 'descricao', label: 'Descrição' },
                { field: 'situacao', label: 'Situação' },
              ]}
              active={sortField}
              direction={sortDirection}
              onSort={handleSort}
            />
            <DataList ariaLabel="Registros">
              {filtrados.map((item) => (
                <DataListItem
                  key={item.codigo}
                  code={`#${item.codigo}`}
                  title={item.descricao}
                  subtitle={item.complemento || undefined}
                  details={[
                    { label: 'Data', value: item.data },
                    item.cidade ? { label: 'Cidade', value: item.cidade } : null,
                  ]}
                  status={<StatusBadge label={item.situacao} />}
                  aside={item.valorFormatado}
                  onOpen={() => abrirConsulta(item)}
                  actions={
                    <>
                      <button type="button" className="icon-button" title="Editar" aria-label="Editar"
                        onClick={() => abrirEdicao(item)}>
                        <IoCreateOutline size={16} />
                      </button>
                      <button type="button" className="icon-button icon-button--danger" title="Excluir" aria-label="Excluir"
                        onClick={() => confirmarExclusao(item)}>
                        <IoTrashOutline size={16} />
                      </button>
                    </>
                  }
                />
              ))}
            </DataList>
          </div>
        )}
      </section>

      {/* 3. POPUPS (seção 6) */}
    </main>
  );
}
```

### Regras da página
- Classes da raiz **sempre**: `clientes-page list-layout-page` + uma classe própria (`minha-tela-page`) só se precisar de ajuste específico.
- O título (`h1`) é o nome da tela como aparece no menu; a descrição (`p`) é uma frase curta terminada em ponto.
- **Ações do topo são botões de ícone** (`icon-button module-action-button`). O de incluir usa também `module-action-button--primary` e fica por último. Ordem: Filtros → Atualizar → Novo.
- Estados obrigatórios: **Carregando** (`<p className="module-empty">Carregando ...</p>`) e **Vazio** (`Nenhum ... encontrado.`).
- Datas na lista no formato `DD/MM/AA` ou `DD/MM/AAAA`; valores em `R$ 0,00` (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`).

---

## 4. Lista (`DataListItem`)

| Prop | Uso |
|---|---|
| `code` | Identificador curto acima do título (`#101`, `OS 1001`, `DP 012345`) |
| `title` | Texto principal (nome, descrição) |
| `subtitle` | Linha secundária opcional (razão social, observação) |
| `details` | Até ~5 pares `{ label, value }` curtos; use `null` para omitir um item |
| `status` | `<StatusBadge label={...} />` |
| `aside` | Valor à direita (ex.: total em R$) |
| `actions` | Botões de **ícone** da linha (Editar, Excluir, Imprimir…) |
| `leading` | Elemento à esquerda (ex.: checkbox de seleção) |
| `onOpen` | Clique na linha → abre consulta/detalhe (mostra a seta `>`) |
| `selected` | Destaca a linha selecionada |

- Ações da linha: no máximo 4 ícones. Com 3 ou mais, no celular eles descem para baixo do texto automaticamente.
- Lixeira, cancelar e sair usam `icon-button icon-button--danger` (vermelho no hover). Os demais só `icon-button`.
- Toda ação de ícone tem `title` **e** `aria-label` com o mesmo texto.
- Seleção múltipla: checkbox em `leading` + texto "Selecionar todas" como `children` de `DataListSortBar` (ver `ContasReceberPage.tsx`).

---

## 5. Filtros

- Pesquisa rápida: `ListSearchField` no topo (filtra a lista carregada).
- Filtros que vão para a API (datas, situação, código): botão de ícone `IoFilterOutline` no topo que abre o `AdvancedFiltersPanel`.
- Período: dois `CustomDatePicker` ("Data início" e "Data fim"). Valide que início ≤ fim e mostre a mensagem no padrão "Data início é obrigatória ao filtrar por X."

---

## 6. Popups (modais)

Modelo único para **todos** os popups (cadastro, consulta, confirmação):

```tsx
import { ModalHeaderActions } from '../../../components/ModalHeaderActions';

{open && (
  <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Novo registro">
    <article className="modal-card modal-card--wide">
      <header className="modal-card__header">
        <h2>Novo registro</h2>
        <ModalHeaderActions onClose={fechar} disabled={salvando} />
      </header>

      <form className="module-form" onSubmit={salvar} noValidate>
        {/* campos (seção 7) */}

        <footer className="modal-card__footer">
          <button type="submit" className="primary-button" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" className="secondary-button modal-card__close" onClick={fechar} disabled={salvando}>
            Cancelar
          </button>
        </footer>
      </form>
    </article>
  </section>
)}
```

### Regras dos popups
- **Topo:** título (`h2`) à esquerda; à direita `ModalHeaderActions` = botão **Expandir** + **X**. Em popups pequenos de confirmação use `<ModalHeaderActions onClose={fechar} expandable={false} />`.
- **Rodapé:** `modal-card__footer`. **Botão principal à esquerda** (`primary-button`), **Fechar/Cancelar à direita** (`secondary-button modal-card__close`). A ordem é garantida pelo CSS, mas escreva nessa ordem.
- Popup de consulta (somente leitura): rodapé só com **Fechar**.
- Ação destrutiva no rodapé (ex.: Excluir dentro do cadastro): `secondary-button secondary-button--danger`, primeiro do rodapé.
- Largura: `modal-card` (estreito, confirmações), `modal-card--wide` (cadastros). Não defina `width` fixo.
- O X e o "Cancelar" **só fecham**; nunca executam ação.
- Enquanto salva: botões `disabled` e texto do principal com reticências ("Salvando...", "Excluindo...").

### Popup de confirmação
```tsx
<article className="modal-card">
  <header className="modal-card__header">
    <h2>Confirmar exclusão</h2>
    <ModalHeaderActions onClose={fechar} expandable={false} />
  </header>
  <p>Deseja realmente excluir o registro <strong>#{item.codigo}</strong>?</p>
  <footer className="modal-card__footer">
    <button type="button" className="primary-button primary-button--danger" onClick={excluir}>Sim, excluir</button>
    <button type="button" className="secondary-button modal-card__close" onClick={fechar}>Cancelar</button>
  </footer>
</article>
```
- Pergunta sempre começando com "Deseja ..." e terminando em "?".
- Botão principal no formato "Sim, &lt;ação&gt;" quando for destrutivo.

---

## 7. Formulários e campos obrigatórios

### Layout
```tsx
<div className="form-grid-3">           {/* ou form-grid-2 */}
  <label>
    <span>Código</span>
    <input type="text" value={codigo} readOnly disabled />
  </label>
  <label className="form-grid-3__full">  {/* ocupa a linha toda */}
    <span>Descrição *</span>
    <input ... />
  </label>
</div>
```
- Rótulo sempre em `<span>` dentro do `<label>`. O CSS deixa o rótulo em maiúsculas pequenas.
- Placeholder de exemplo começa com "Ex: ..." ou "Digite ...".
- Datas: `CustomDatePicker`; horas: `CustomTimePicker`; listas: `SearchableSelect` (com `searchPlaceholder="Pesquisar..."`).
- No celular as grades viram uma coluna sozinhas.

### Campos obrigatórios (obrigatório seguir)
Ao **abrir**: nada vermelho. Ao **confirmar** com campo vazio: borda/fundo vermelhos + "Campo obrigatório" embaixo + aviso no topo. Ao preencher, o vermelho some.

```tsx
import { REQUIRED_FIELDS_MESSAGE, useRequiredFields } from '../../../hooks/useRequiredFields';

const obrig = useRequiredFields();

const abrirNovo = () => { limparCampos(); obrig.reset(); setOpen(true); };   // sempre reset ao abrir

const salvar = (e?: React.FormEvent) => {
  e?.preventDefault();
  if (!obrig.validate([descricao, dataInicio, codigoCliente])) {
    showToast(REQUIRED_FIELDS_MESSAGE, 'error');
    return;
  }
  // ... chamada da API
};

// input / textarea
<label>
  <span>Descrição *</span>
  <input className={obrig.inputClass(descricao)} value={descricao} onChange={...} />
  {obrig.error(descricao)}
</label>

// componentes com "casca": CustomDatePicker, CustomTimePicker, SearchableSelect
<CustomDatePicker className={obrig.wrapperClass(dataInicio)} value={dataInicio} onChange={setDataInicio} />
{obrig.error(dataInicio)}
```
- Rótulo de obrigatório termina com **" *"** (espaço + asterisco). Nada de "(obrigatório)" ou cores no rótulo.
- **Não** use o atributo HTML `required`; use `noValidate` no `<form>`.
- Regra de formato (ex.: 6 dígitos, e-mail): mostre a mensagem específica embaixo do campo com `<small className="module-field-error">Informe 6 dígitos</small>` e a classe `module-input-error` no campo.

---

## 8. Botões

| Tipo | Classe | Quando |
|---|---|---|
| Principal | `primary-button` | Salvar, Confirmar, Incluir, Emitir, OK, Sim |
| Secundário | `secondary-button` | Cancelar, Fechar, Voltar, Não, ações auxiliares |
| Destrutivo | `primary-button primary-button--danger` | "Sim, excluir", "Sim, cancelar" |
| Destrutivo secundário | `secondary-button secondary-button--danger` | Excluir/Cancelar dentro de um formulário |
| Atenção | `primary-button--warning` | Ações de risco que não apagam (ex.: estornar) |
| Ícone | `icon-button` | Ações de linha e do topo |
| Ícone destrutivo | `icon-button icon-button--danger` | Lixeira, cancelar, sair |
| Ícone do topo da lista | `icon-button module-action-button` (+ `module-action-button--primary` no "Novo") | Filtros, Atualizar, Novo |

- Tamanho **fixo**: 40px de altura, largura mínima 112px. Não altere.
- Cores automáticas: principal = **oposta ao tema** (escura no claro, clara no escuro); secundário = **cor do tema**.
- Texto do botão: verbo no infinitivo, curto ("Salvar", "Incluir OS", "Baixar selecionadas"). Ícone opcional à esquerda, tamanho 15–16.

---

## 9. Status (situação)

```tsx
<StatusBadge label={item.situacao} />              // cor escolhida pelo texto
<StatusBadge tone="success">Concluído</StatusBadge> // cor explícita
```
Cores automáticas pelo texto:

| Tom | Textos (contém) |
|---|---|
| `success` (verde) | concluído, liberado, aprovado, ativo, autorizado, faturado, emitido, entregue, pago, baixado |
| `info` (azul) | aberto, em andamento, em execução, impresso, processando |
| `warning` (amarelo) | pendente, aguardando, em digitação, gerado, em análise |
| `orange` | em elaboração, devolvido, parcial |
| `accent` (roxo) | enviado, transmitido |
| `danger` (vermelho) | cancelado, reprovado, bloqueado, recusado, erro, vencido |
| `neutral` (cinza) | inativo, suspenso, vazio |

Se a API devolver código (ex.: `A`, `1`), converta para o texto antes (`'A' → 'Aberto'`) para ter cor e tradução.

---

## 10. Cores, fonte e espaçamento

- Fonte: **Plus Jakarta Sans** (já global). Não troque `font-family`.
- Cores (sempre variáveis):
  - Texto: `var(--color-text)`, títulos `var(--color-heading)`, apoio `var(--color-muted)`
  - Fundos: `var(--color-bg)`, `var(--color-surface)`, `var(--color-surface-alt)`, campos `var(--color-input-bg)`
  - Bordas: `var(--color-border)`, `var(--color-border-soft)`
  - Status: `var(--status-success)`, `var(--status-warning)`, `var(--status-danger)`, `var(--status-info)`
- Espaçamentos em múltiplos de 4px (4, 8, 12, 16, 20, 24). Raio: 10px em campos/botões, 14–18px em painéis/cards.
- Efeitos (hover, foco, entrada de tela e de popup) já são globais. Não crie animações próprias.
- Ajustes globais ficam em `src/styles/theme.css`. Se precisar de CSS da tela, coloque no final desse arquivo numa seção nova com comentário, sempre prefixado pela classe da página (`.minha-tela-page ...`).

---

## 11. Mensagens (toast)

```tsx
showToast('Registro incluído com sucesso.', 'success');
showToast('Erro ao incluir registro.', 'error');
showToast('Selecione ao menos um registro.', 'warning');
```
Padrão de texto:
- Sucesso: "&lt;Objeto&gt; &lt;ação no particípio&gt; com sucesso." → "Pedido liberado com sucesso."
- Erro: "Erro ao &lt;ação&gt; &lt;objeto&gt;." → "Erro ao carregar pedidos."
- Validação: frase imperativa → "Informe a Data início.", "Selecione apenas um registro."
- Sessão: "Informações de sessão não encontradas."

---

## 12. Idiomas (PT / EN / ES / JA)

A interface é traduzida automaticamente por `src/i18n/domTranslator.ts` usando os dicionários `src/i18n/locales/en.json`, `es.json`, `ja.json` (chave = texto em português).

Para a tela nova ficar traduzida:
1. Escreva todos os textos em **português correto** (com acentos).
2. **Frase inteira num único texto.** Partes variáveis via template string:
   ```tsx
   // ✅ certo – vira a chave "Você tem {0} pedidos pendentes."
   <p>{`Você tem ${total} pedidos pendentes.`}</p>
   // ❌ errado – vira pedaços soltos ("Você tem", "pedidos pendentes.")
   <p>Você tem {total} pedidos pendentes.</p>
   ```
3. Singular/plural: escolha a frase inteira (`total === 1 ? \`${total} título\` : \`${total} títulos\``).
4. Dados do usuário que não devem ser traduzidos (nomes, descrições digitadas): `data-no-translate` no elemento, quando houver risco de coincidir com uma palavra do sistema.
5. Datas por extenso: use `useLanguage().language` para escolher o locale (`pt-BR`, `en-US`, `es-ES`, `ja-JP`).
6. Ao terminar, rode:
   ```bash
   node scripts/i18n-missing.cjs --list
   ```
   e acrescente as chaves que faltarem nos **três** arquivos de `src/i18n/locales` (mantendo `{0}`, `{1}`… iguais).

---

## 13. Celular

O CSS global já ajusta a tela (seções 12 a 17 de `theme.css`). Para não quebrar:
- Nunca use `width`/`min-width` fixos grandes (`520px`, `800px`); use `%`, `fr` e `minmax(0, 1fr)`.
- Não use `white-space: nowrap` em textos longos.
- Grades de formulário: `form-grid-2` / `form-grid-3` (viram 1 coluna sozinhas).
- Tabela em popup: dentro de `<div className="table-scroll">` (rola na horizontal).
- Teste em 390×844: nada pode sair da tela nem cortar texto de botão.

---

## 14. Não faça

- ❌ `<table>` para listagem principal → use `DataList`.
- ❌ Botões de texto ("Editar", "Excluir") dentro da linha da lista → use ícones.
- ❌ Botão Fechar só no X → sempre também no rodapé.
- ❌ Cores fixas, `style={{ color: ... }}`, `style={{ width: ... }}` em botões.
- ❌ Campo obrigatório já vermelho ao abrir, ou `required` do HTML.
- ❌ Status como texto puro ou com classes próprias → `StatusBadge`.
- ❌ Frases quebradas em pedaços no JSX (atrapalha a tradução).
- ❌ Ícones de outras bibliotecas ou emojis na interface.
- ❌ `alert()` / `confirm()` do navegador → use popup de confirmação + toast.

---

## 15. Checklist de entrega

- [ ] Raiz `clientes-page list-layout-page`, cabeçalho com Voltar + `h1` + descrição.
- [ ] Topo do painel: total, `ListSearchField`, ícones Filtros/Atualizar/Novo.
- [ ] Lista com `DataListSortBar` + `DataList`; estados "Carregando..." e "Nenhum ... encontrado.".
- [ ] Ações da linha como ícones com `title`/`aria-label`; lixeira com `icon-button--danger`.
- [ ] Status com `StatusBadge`.
- [ ] Popups com `ModalHeaderActions` + rodapé `modal-card__footer` (principal à esquerda, Fechar/Cancelar à direita).
- [ ] Campos obrigatórios com `useRequiredFields` (" *" no rótulo, `reset()` ao abrir, `validate()` ao salvar).
- [ ] Mensagens de toast no padrão da seção 11.
- [ ] Sem cores fixas e sem CSS duplicado.
- [ ] Testado em claro/escuro, desktop e celular (390px).
- [ ] `node scripts/i18n-missing.cjs --list` sem textos novos pendentes; testado em outro idioma.
- [ ] `npx tsc -p tsconfig.app.json --noEmit` e `npx eslint <arquivo>` sem erros.
