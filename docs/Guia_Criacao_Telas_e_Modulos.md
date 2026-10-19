# Guia de Desenvolvimento: Criação de Telas, Módulos, Rotas e APIs no QSErpx

Este documento serve como referência técnica para qualquer desenvolvedor que precise adicionar novos módulos, telas, menus, rotas, tabelas (DataTables) ou integrações de API no projeto **QSErpx**.

---

## 1. Visão Geral da Arquitetura

O **QSErpx** é uma Single Page Application construída com:
- **React 19** + **TypeScript** + **Vite**
- **Roteamento:** `react-router-dom` (v7)
- **Ícones:** `react-icons/io5` (Ionicons 5)
- **Design System / Estilos:** CSS modular global (`src/styles/global.css` e `src/styles/app.css`) com suporte nativo a temas Claro/Escuro via variáveis CSS (`--color-bg`, `--color-surface`, `--color-border`, etc.)
- **Configurações e Sessão:** `GlobalConfig` (`src/services/globalConfig.ts`) para `baseUrl`, `token`, `usuario`, `empresa`.
- **Notificações:** Hook `useToast` (`src/contexts/ToastContext.tsx`).

### Estrutura de Diretórios Relevante

```text
src/
├── components/          # Componentes globais (SearchableSelect, ListSearchField, Sidebar, etc.)
├── constants/
│   └── routes.ts        # Constante central com todas as rotas (ROUTES)
├── contexts/            # Contextos React (ToastContext, ThemeContext, LanguageContext)
├── features/            # Módulos do sistema organizados por domínio de negócio
│   ├── basico/pages/    # Telas de cadastros básicos (Clientes, Serviços, Almoxarifado)
│   ├── vendas/pages/    # Telas de vendas e pedidos
│   ├── pcp/pages/       # Telas de PCP e ordens de fabricação
│   └── ...
├── hooks/
│   └── useDynamicMenu.ts # Carregamento e montagem dos menus da Sidebar
├── layouts/
│   └── AppShellLayout.tsx # Layout mestre (Sidebar, Header, Container de Rotas e Navegação)
├── pages/               # Telas globais (HomePage, LoginPage, ConfigPage)
├── routes/
│   └── AppRouter.tsx    # Configuração central de rotas (<Routes> / <Route>)
├── services/
│   ├── apiManager.ts    # Cliente HTTP base (faz chamadas usando Axios)
│   ├── apiCalls.ts      # Todas as funções de chamadas aos endpoints de API
│   └── globalConfig.ts  # Gerenciador de token JWT, empresa ativa, usuário e baseUrl
└── styles/
    ├── global.css       # Variáveis de tema (dark/light), fontes, reset
    └── app.css          # Classes utilitárias do layout (.clientes-page, .modal-card, etc.)
```

---

## 2. Passo a Passo: Criando uma Nova Rota e Tela

### Passo 2.1: Definir a Rota em `src/constants/routes.ts`

Sempre cadastre a rota na constante `ROUTES` para garantir autocompletar e tipagem estrita em todo o projeto:

```typescript
// src/constants/routes.ts
export const ROUTES = {
  root: '/',
  login: '/login',
  home: '/home',
  
  // Exemplo de telas existentes:
  basicoClientes: '/basico/clientes',
  basicoServicos: '/basico/servicos',
  basicoAlmoxarifado: '/basico/almoxarifado',
  
  // NOVO EXEMPLO:
  vendasRelatorios: '/vendas/relatorios',
} as const;
```

---

### Passo 2.2: Criar o Arquivo da Tela em `src/features/<modulo>/pages/`

Crie o arquivo da tela, por exemplo: `src/features/vendas/pages/RelatoriosVendasPage.tsx`.

Estrutura básica padrão do sistema:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBack, IoRefreshOutline, IoAddOutline } from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { ListSearchField } from '../../../components/ListSearchField';

export function RelatoriosVendasPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  return (
    <main className="clientes-page list-layout-page">
      {/* 1. CABEÇALHO */}
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button
            className="icon-button"
            type="button"
            onClick={() => navigate(ROUTES.home)}
            aria-label="Voltar para o início"
          >
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Relatórios de Vendas</h1>
            <p>Consulta consolidada de métricas e pedidos.</p>
          </div>
        </div>
      </section>

      {/* 2. PAINEL DE CONTEÚDO */}
      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>0 encontrados</span>
          </div>

          <div className="list-layout-controls clientes-panel__controls">
            <ListSearchField
              value={search}
              onChange={setSearch}
              mobileLabel="Pesquisar"
              placeholder="Pesquisar por código ou descrição..."
              className="clientes-search"
            />

            <button
              className="icon-button module-action-button"
              type="button"
              onClick={() => showToast('Atualizando dados...', 'info')}
              title="Atualizar"
            >
              <IoRefreshOutline size={16} />
            </button>
          </div>
        </div>

        {/* 3. ÁREA DE DADOS / TABELA */}
        <p className="module-empty">Nenhum registro encontrado.</p>
      </section>
    </main>
  );
}
```

---

### Passo 2.3: Registrar a Rota em `src/routes/AppRouter.tsx`

Abra `src/routes/AppRouter.tsx`:
1. Importe o componente da página criado.
2. Adicione o `<Route>` dentro do bloco de rotas autenticadas sob o `<Route element={<AppShellLayout />}>`:

```tsx
// 1. Importação
import { RelatoriosVendasPage } from '../features/vendas/pages/RelatoriosVendasPage';

// 2. Registro dentro de <Route element={<AppShellLayout />}>:
<Route path={ROUTES.vendasRelatorios} element={<RelatoriosVendasPage />} />
```

---

## 3. Como Configurar o Menu e Navegação

O sistema carrega os menus pela **Sidebar** a partir do backend (via transações do usuário) ou por definições manuais/fallback.

Para que o clique no menu navegue para a tela correta, existem 3 pontos a verificar:

### 3.1: Configurar a Resolução da Transação em `src/layouts/AppShellLayout.tsx`

A função `resolveRouteFromTransaction(transactionCode, title)` mapeia a opção do menu para a rota:

```typescript
// src/layouts/AppShellLayout.tsx
const resolveRouteFromTransaction = (transactionCode: string, title: string): string | undefined => {
  const normalizedCode = String(transactionCode || '').toUpperCase();
  const normalizedTitle = String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const codeRouteMap: Record<string, string> = {
    // Código da transação mapeado para a rota:
    VEN001: ROUTES.pedidoVendaRepresentantes,
    VEN002: ROUTES.pedidoVenda,
    VEN004: ROUTES.vendasRelatorios, // <--- NOVO CÓDIGO AQUI
    BAS001: ROUTES.basicoClientes,
    BAS002: ROUTES.basicoServicos,
    BAS003: ROUTES.basicoAlmoxarifado,
  };

  const routeByCode = codeRouteMap[normalizedCode];

  // Fallback por palavra-chave no título (caso o código venha diferente do backend):
  const routeByTitle =
    (normalizedTitle.includes('relatorio') && normalizedTitle.includes('venda')
      ? ROUTES.vendasRelatorios
      : undefined) ||
    (normalizedTitle.includes('almoxarif') ? ROUTES.basicoAlmoxarifado : undefined) ||
    (normalizedTitle.includes('cliente') ? ROUTES.basicoClientes : undefined);

  return routeByCode || routeByTitle;
};
```

> **Dica:** Repita o mesmo mapeamento em `src/pages/HomePage.tsx` na função `resolveRouteFromTransaction` para que os atalhos da tela inicial também funcionem corretamente.

---

### 3.2: Garantir a Opção no Menu em `src/hooks/useDynamicMenu.ts`

Se você deseja adicionar um **Novo Módulo Completo** ou uma **Nova Opção** dentro de um módulo existente:

#### Caso A: Adicionar um Novo Módulo Raiz
Adicione no array `menuConfigs` em `useDynamicMenu.ts`:
```typescript
const menuConfigs = [
  { id: 'dashboards', title: 'Dashboards', icon: 'stats-chart-outline', code: 'DSB' },
  { id: 'basico', title: 'Básico', icon: 'list-outline', code: 'BAS' },
  { id: 'vendas', title: 'Vendas', icon: 'cart-outline', code: 'VEN' },
  // NOVO MÓDULO:
  { id: 'logistica', title: 'Logística', icon: 'bus-outline', code: 'LOG' },
];
```

#### Caso B: Garantir uma Nova Opção dentro de um Módulo Existente
Caso a transação ainda não exista cadastrada na tabela do banco de dados, você pode forçar a inserção para desenvolvimento em `useDynamicMenu.ts`:

```typescript
// Localize onde o menu do módulo é tratado:
const basicoIndex = menusComDocumentos.findIndex((item) => item.id === 'basico' || item.transactionCode === 'BAS');
const novaOpcaoSubitem = { title: 'Minha Nova Tela', transactionCode: 'BAS004' };

if (basicoIndex >= 0) {
  const basicoMenu = menusComDocumentos[basicoIndex];
  const jaExiste = basicoMenu.subitems.some((s) => s.transactionCode === 'BAS004');
  if (!jaExiste) {
    basicoMenu.subitems.push(novaOpcaoSubitem);
  }
}
```

---

## 4. Como Criar Novas Chamadas de API (GET, POST, PUT, DELETE)

Todas as requisições HTTP do sistema devem ser centralizadas em `src/services/apiCalls.ts` e utilizar o `apiManager`.

### 4.1: Padrão em `src/services/apiCalls.ts`

```typescript
import apiManager, { ApiCallType, ApiCallResponse } from './apiManager';

const normalizeBaseUrl = (url: string) => url?.replace(/\/$/, '') || '';

// ----------------------------------------------------------------------
// 1. GET (Listagem com filtros opcionais)
// ----------------------------------------------------------------------
export const listarAlmoxarifadosCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  filtros?: { search?: string; status?: number }
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/Almoxarifado`;
  const queryParams: Record<string, string> = {};

  if (filtros?.search) queryParams.search = filtros.search;
  if (filtros?.status != null) queryParams.status = String(filtros.status);

  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    queryParams
  );
};

// ----------------------------------------------------------------------
// 2. POST (Inclusão)
// ----------------------------------------------------------------------
export const adicionarAlmoxarifadoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  body: {
    Codigo_Almox: number;
    Descricao_Almox: string;
    Endereco_Almox: string;
    Usuarios?: { Codigo_Usuario: string }[];
  }
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/Almoxarifado`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    body
  );
};

// ----------------------------------------------------------------------
// 3. PUT (Alteração)
// ----------------------------------------------------------------------
export const atualizarAlmoxarifadoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  body: {
    Codigo_Almox: number;
    Descricao_Almox: string;
    Endereco_Almox: string;
  }
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/Almoxarifado/${body.Codigo_Almox}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.PUT,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    body
  );
};

// ----------------------------------------------------------------------
// 4. DELETE (Exclusão)
// ----------------------------------------------------------------------
export const deletarAlmoxarifadoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  codigoAlmox: number
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/Almoxarifado/${codigoAlmox}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.DELETE,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}
  );
};
```

---

## 5. Como Usar as APIs na Tela (Ao Carregar e em Botões)

### 5.1: Pegando Sessão e Tratando Erros

Use sempre `GlobalConfig` para obter a URL base e o Token:
```typescript
import { GlobalConfig } from '../../../services/globalConfig';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';
import { useToast } from '../../../contexts/ToastContext';

const baseUrl = GlobalConfig.getBaseUrl();
const token = GlobalConfig.getJwToken();
```

### 5.2: Executando GET ao carregar a tela

```tsx
const [dados, setDados] = useState<any[]>([]);
const [loading, setLoading] = useState(false);
const { showToast } = useToast();

const carregarDados = useCallback(async () => {
  const baseUrl = GlobalConfig.getBaseUrl();
  const token = GlobalConfig.getJwToken();

  if (!baseUrl || !token) {
    showToast('Sessão expirada ou não configurada.', 'error');
    return;
  }

  setLoading(true);
  try {
    const resp = await listarAlmoxarifadosCall(baseUrl, token);
    if (!resp.succeeded) {
      showToast(getApiErrorMessage(resp, 'Erro ao carregar dados.'), 'error');
      return;
    }

    // apiManager retorna resp.jsonBody ou resp.data
    const rows = Array.isArray(resp.jsonBody) ? resp.jsonBody : resp.data ?? [];
    setDados(rows);
  } catch (err: any) {
    showToast(err?.message || 'Falha de comunicação com o servidor.', 'error');
  } finally {
    setLoading(false);
  }
}, [showToast]);

useEffect(() => {
  void carregarDados();
}, [carregarDados]);
```

### 5.3: Executando POST/PUT ao Salvar e DELETE ao Excluir

```tsx
// Salvar (POST ou PUT)
const handleSalvar = async (e: React.FormEvent) => {
  e.preventDefault();
  const baseUrl = GlobalConfig.getBaseUrl();
  const token = GlobalConfig.getJwToken();

  try {
    const payload = { Codigo_Almox: 1, Descricao_Almox: 'Galpão 1', Endereco_Almox: 'Rua A' };
    const resp = isEdicao 
      ? await atualizarAlmoxarifadoCall(baseUrl, token, payload)
      : await adicionarAlmoxarifadoCall(baseUrl, token, payload);

    if (!resp.succeeded) {
      showToast(getApiErrorMessage(resp, 'Não foi possível salvar.'), 'error');
      return;
    }

    showToast('Registro salvo com sucesso!', 'success');
    setModalOpen(false);
    await carregarDados(); // Recarrega a tabela
  } catch (err: any) {
    showToast(err?.message || 'Erro ao salvar.', 'error');
  }
};

// Excluir (DELETE)
const handleExcluir = async (codigo: number) => {
  const baseUrl = GlobalConfig.getBaseUrl();
  const token = GlobalConfig.getJwToken();

  try {
    const resp = await deletarAlmoxarifadoCall(baseUrl, token, codigo);
    if (!resp.succeeded) {
      showToast(getApiErrorMessage(resp, 'Não foi possível excluir.'), 'error');
      return;
    }

    showToast('Registro excluído com sucesso.', 'success');
    await carregarDados();
  } catch (err: any) {
    showToast(err?.message || 'Erro ao excluir.', 'error');
  }
};
```

---

## 6. Como Construir DataTables e Modais no Padrão QSErpx

O layout das tabelas do QSErpx utiliza classes prontas em `app.css` que garantem:
- Estilo padronizado com cabeçalhos sticky
- Alternância de cores em linhas pares/ímpares
- Destaque ao passar o mouse (`:hover`)
- Versão responsiva com `clientes-cards` no mobile

### Estrutura Completa de Tabela + Cards:

```tsx
<div className="table-scroll clientes-table-wrap">
  <table className="clientes-table">
    <thead>
      <tr>
        <th style={{ width: '100px' }}>
          <button type="button" className="clientes-table__sort" onClick={() => handleSort('codigo')}>
            CÓDIGO <span>{sortField === 'codigo' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
          </button>
        </th>
        <th>
          <button type="button" className="clientes-table__sort" onClick={() => handleSort('descricao')}>
            DESCRIÇÃO <span>{sortField === 'descricao' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
          </button>
        </th>
        <th style={{ width: '100px', textAlign: 'center' }}>AÇÕES</th>
      </tr>
    </thead>
    <tbody>
      {itensFiltrados.map((item) => (
        <tr key={item.codigo} onClick={() => abrirEdicao(item)}>
          <td><strong>#{item.codigo}</strong></td>
          <td>{item.descricao}</td>
          <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="table-actions" style={{ justifyContent: 'center' }}>
              <button type="button" title="Editar" onClick={() => abrirEdicao(item)}>
                <IoCreateOutline size={16} />
              </button>
              <button type="button" title="Excluir" onClick={() => confirmarExclusao(item)}>
                <IoTrashOutline size={16} />
              </button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

{/* Visualização para Celulares e Tablets pequenos */}
<div className="clientes-cards">
  {itensFiltrados.map((item) => (
    <article key={item.codigo} className="clientes-card" onClick={() => abrirEdicao(item)}>
      <div className="clientes-card__row">
        <span>CÓDIGO</span>
        <strong>#{item.codigo}</strong>
      </div>
      <div className="clientes-card__row">
        <span>DESCRIÇÃO</span>
        <strong>{item.descricao}</strong>
      </div>
    </article>
  ))}
</div>
```

### Estrutura Padrão de Modal:

```tsx
{isModalOpen && (
  <section className="modal-backdrop" role="dialog" aria-modal="true">
    <article className="modal-card modal-card--wide">
      <header className="modal-card__header">
        <h2>{isNovo ? 'Novo Registro' : 'Editar Registro'}</h2>
        <button type="button" className="icon-button" onClick={() => setIsModalOpen(false)}>
          <IoCloseOutline size={18} />
        </button>
      </header>

      <form onSubmit={handleSalvar} className="module-form">
        <div className="form-grid-3">
          <label>
            <span>Código</span>
            <input type="text" value={formCodigo} readOnly disabled />
          </label>
          <label style={{ gridColumn: 'span 2' }}>
            <span>Descrição *</span>
            <input
              type="text"
              required
              value={formDescricao}
              onChange={(e) => setFormDescricao(e.target.value)}
            />
          </label>
        </div>

        <div className="form-actions clientes-modal-actions">
          <button type="button" className="secondary-button" onClick={() => setIsModalOpen(false)}>
            Cancelar
          </button>
          <button type="submit" className="primary-button">
            Salvar
          </button>
        </div>
      </form>
    </article>
  </section>
)}
```

---

## 7. Checklist Rápido para Adicionar uma Nova Tela

1. [ ] Criar o componente em `src/features/<modulo>/pages/MinhaNovaPage.tsx`.
2. [ ] Adicionar a constante em `src/constants/routes.ts`.
3. [ ] Adicionar `<Route path={ROUTES.minhaRota} element={<MinhaNovaPage />} />` em `src/routes/AppRouter.tsx`.
4. [ ] Mapear o código da transação/título em `src/layouts/AppShellLayout.tsx` (`resolveRouteFromTransaction`).
5. [ ] Mapear em `src/pages/HomePage.tsx` (`resolveRouteFromTransaction`).
6. [ ] Se a transação ainda não estiver na API de permissões, incluir no fallback em `src/hooks/useDynamicMenu.ts`.
7. [ ] Criar as funções de chamada em `src/services/apiCalls.ts`.
8. [ ] Rodar `npm run build` no terminal para garantir que não há erros de tipagem TypeScript.

