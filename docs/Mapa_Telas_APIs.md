# Mapa de Telas e APIs — QSErpx

Documento de referência com todas as telas (páginas) do sistema, suas rotas e todas as chamadas de API (endpoints, métodos HTTP e parâmetros) realizadas por cada uma. Gerado a partir da análise do código-fonte em `src/`.

> **Como manter atualizado:** sempre que uma tela nova for criada ou uma chamada de API for adicionada/alterada, atualize a seção correspondente neste arquivo.

---

## Sumário

1. [Visão geral da arquitetura de API](#visão-geral-da-arquitetura-de-api)
2. [Resumo de rotas por módulo](#resumo-de-rotas-por-módulo)
3. [Autenticação e Configuração](#1-autenticação-e-configuração)
4. [Home](#2-home)
5. [Dashboards](#3-dashboards)
6. [Vendas](#4-vendas)
7. [Básico](#5-básico)
8. [Compras](#6-compras)
9. [Financeiro](#7-financeiro)
10. [Serviço](#8-serviço)
11. [PCP](#9-pcp)
12. [Qualidade](#10-qualidade)
13. [Manutenção](#11-manutenção)
14. [Segurança](#12-segurança)
15. [QS Atualiza](#13-qs-atualiza)

---

## Visão geral da arquitetura de API

- **Base URL principal:** `GlobalConfig.getBaseUrl()` — configurada nas telas de Configuração (`ConfigInicialPage` / `ConfigPage`) e usada por praticamente todas as telas do ERP.
- **Base URL do QS Atualiza:** `GlobalConfig.getBaseUrlQSAtualiza()` — usada apenas pelo módulo `qs-atualiza`.
- **Autenticação:** a maioria das chamadas usa header `Authorization: Bearer {jwtToken}`, com token obtido via `GlobalConfig.getJwToken()`. Endpoints de bootstrap (`/api/v1/url`, `/api/v1/token`, `/api/v1/login`) não exigem token.
- **Camada de acesso (`src/services/apiManager.ts`):** classe `ApiManager` (`makeApiCall`) centraliza chamadas via Axios. Antes de qualquer chamada (exceto login/token/url), verifica a saúde da API (`GET /api/v1/url`) e renova o token automaticamente.
- **Funções de API compartilhadas (`src/services/apiCalls.ts`):** dezenas de funções (`listaVendedoresCall`, `listUsuariosCall`, `acoesUsuariosCall`, etc.) que encapsulam `apiManager.makeApiCall` com endpoint e parâmetros fixos. A maior parte das telas usa essas funções em vez de `fetch` direto.
- **Pedidos de Venda (`src/services/pedidoVendaApi.ts`):** funções dedicadas via `fetch` nativo para CRUD de pedidos de venda.
- **Supabase (`src/services/supabaseQueries.ts` e `src/services/supabase.ts`):** usado para dados que não vêm da API do ERP (versões de sistema, licenças, lembretes, notificações QS).
- **Auditoria:** a maioria das telas de cadastro chama `POST /api/v1/AdicionarAcoesUsuarios` antes de operações de listagem/inclusão para registro de auditoria.
- **Controle de permissão:** telas de cadastro validam permissão do usuário via `GET /api/v1/ObterUsuariosTransacoesSistemaAcao/{codigoUsuario}` (parâmetros `codigoAcaoString` e `idTransacaoString`) antes de abrir formulários de inclusão/edição/exclusão.

---

## Resumo de rotas por módulo

| Módulo | Página | Rota (`ROUTES`) |
|---|---|---|
| Auth | LoginPage | `/login` |
| Auth | ConfigInicialPage | `/config_inicial` |
| Auth | ConfigPage | `/config` |
| Auth | SelectCompanyPage | `/select-company` |
| Home | HomePage | `/home` |
| Dashboards | DashboardFinanceiroPage | `/dashboards/financeiro` |
| Dashboards | DashboardVendasPage | `/dashboards/vendas` |
| Dashboards | DashboardPCPPage | `/dashboards/pcp` |
| Dashboards | DashboardServicosPage | `/dashboards/servicos` |
| Vendas | PedidoVendaPage | `/pedidos-venda` |
| Vendas | PedidoVendaRepresentantesPage | `/pedidos-venda-representantes` |
| PCP | ApontamentoProducaoPage | `/pcp/apontamento-producao` |
| PCP | ParadasMaquinaPage | `/pcp/paradas-maquina` |
| PCP | OrdensFabricacaoPage | `/pcp/ordens-fabricacao` |
| PCP | PreparacaoMaquinaPage | `/pcp/preparacao-maquina` |
| Serviço | OrdensServicoPage | `/servico/ordens-servico` |
| Serviço | ApontamentoMaoObraPage | `/servico/apontamento-mao-obra` |
| Serviço | NotaFiscalServicoPage | `/servico/nota-fiscal` |
| Compras | PedidoCompraLiberacaoPage | `/compras/pedido-liberacao` |
| Básico | ClientesPage | `/basico/clientes` |
| Básico | ServicosPage | `/basico/servicos` |
| Segurança | UsuariosPage | `/seguranca/usuarios` |
| Segurança | TipoApontamentoPage | `/seguranca/tipo-apontamento` |
| Segurança | SessoesPage | `/seguranca/sessoes` |
| Segurança | ParametrosGeraisPage | `/seguranca/parametros-gerais` |
| Manutenção | OrdensManutencaoPage | `/manutencao/ordens` |
| Qualidade | FichaInspecaoProcessoPage | `/qualidade/ficha-inspecao-processo` |
| Qualidade | FichaInspecaoRecebimentoPage | `/qualidade/ficha-inspecao-recebimento` |
| Financeiro | ContasReceberPage | `/financeiro/contas-receber` |
| QS Atualiza | QsAtualizaPage | `/qs-atualiza` |
| QS Atualiza | VersoesPage | `/qs-atualiza/versoes` |

---

## 1. Autenticação e Configuração

### LoginPage
**Arquivo:** `src/pages/LoginPage.tsx` · **Rota:** `/login`
**Objetivo:** Autentica o usuário (usuário/senha), obtém token, dados do usuário, licença atual e verifica bloqueio de licença.

| Método | Endpoint | Parâmetros | Quando é chamado |
|---|---|---|---|
| GET | `/api/v1/url` | — | Health check antes/durante o login |
| GET | `/api/v1/token` | Query: `Usuario`, `Codigo_Empresa`, `Nome_Empresa`, `Chave_Api`, `IdGuid`, `Tipo=1`, `RetornarComoXml` | Gera token inicial (Tipo 1), sem JWT |
| GET | `/api/v1/login` | Query: `usuario`, `senha` | Autentica credenciais (Bearer token tipo 1) |
| GET | `/api/v1/login/{usuario}` | Path: `usuario` | Busca empresas vinculadas ao usuário |
| GET | `/api/v1/usuarios/{codigoUsuarioDetalhe}` | Path: `codigoUsuarioDetalhe` | Busca nível do usuário e tipo de menu |
| GET | `/api/v1/buscaLicencaAtual` | — | Busca código e tipo da licença atual |
| GET | `/api/v1/verificalicencabloqueada` | Query: `CodigoLicenca`, `codigoUsuario`, `nivelUsuario` | Verifica se a licença está bloqueada |

### ConfigInicialPage / ConfigPage (via `ConfigScreen`)
**Arquivos:** `src/pages/ConfigInicialPage.tsx`, `src/pages/ConfigPage.tsx`, `src/components/ConfigScreen.tsx` · **Rotas:** `/config_inicial`, `/config`
**Objetivo:** Configurar/testar a URL do servidor da API, registrar licença via HD da máquina e sincronizar transações/ações do sistema. `ConfigPage` exige `nivel_usuario >= 9`.

| Método | Endpoint / Origem | Parâmetros | Quando é chamado |
|---|---|---|---|
| GET | `/api/v1/url` | — | Testa conectividade com a URL informada |
| GET | `/api/v1/token` | Query: `Usuario=''`, `Codigo_Empresa=0`, `Nome_Empresa=''`, `Chave_Api=''`, `IdGuid=''`, `Tipo=1`, `RetornarComoXml=false` | Gera token inicial após health check |
| GET | `/api/v1/BuscarNumeroHD` | Query: `RetornarComoXml=false` | Obtém número do HD e chave criptografada |
| Supabase | tabela `licenca` | filtro `numero_hd`, `id_sistema=1` | Busca licença associada ao HD |
| POST | `/api/v1/AdicionarLicencaSistema` | Body: `id`, `situacao_licenca`, `data_validade`, `mensagem_fim_validade`, `dias_ant_mensagem_fim_validade`, `numero_acessos`, `numero_hd`, `instancia_sql`, `nome_banco`, `versao_sistema`, `usuario_sql`, `senha_sql`, `versao_limite`, `tipo_licenca`, `tipo_banco` | Registra/atualiza a licença |
| GET | `/api/v1/ConsultaLicencaSistema` | Query: `idLicenca`, `numHD` | Confirma que a licença foi salva |
| Supabase | tabela `licenca_transacao_view` | filtro `id_cliente`, `id_licenca` | Busca transações da licença |
| POST | `/api/v1/InserirOuAtualizarTransacao` | Body: `LicencaTransacaoViewModel[]` | Sincroniza transações no sistema |
| Supabase | tabela `licenca_transacoes_acao_view` | colunas `id, id_transacao, codigo_acao, descricao_acao, id_cliente, id_licenca` | Busca ações disponíveis por transação |
| POST | `/api/v1/InserirTransacoesSistemaAcao` | Body: `transacoesAcao[]` | Sincroniza ações de transação no sistema |

### SelectCompanyPage (via `SelectCompany` + `authFlow.ts`)
**Arquivos:** `src/pages/SelectCompanyPage.tsx`, `src/components/SelectCompany.tsx`, `src/services/authFlow.ts` · **Rota:** `/select-company`
**Objetivo:** Seleção de empresa (quando o usuário tem mais de uma vinculada) e finalização da sessão (`completeCompanySession`).

| Método | Endpoint | Parâmetros | Quando é chamado |
|---|---|---|---|
| GET | `/api/v1/login/{usuario}` | Path: `usuario` | Recarrega lista de empresas, se vazia |
| POST | `/api/v1/AdicionarAcoesUsuarios` | Body: `Codigo_Empresa`, `Id_Sessao`, `Codigo_Usuario` | Registra ação de login (sessão existente) |
| GET | `/api/v1/usuarios/{usuario}` | Path: `usuario` | Busca nível de usuário e tipo de menu |
| GET | `/api/v1/token` | Query: `Usuario`, `Nome_Empresa`, `Codigo_Empresa`, `Chave_Api`, `IdGuid`, `Tipo=2` | Gera token específico da empresa (Tipo 2) |
| GET | `/api/v1/BuscarNumeroHD` | Query: `RetornarComoXml=false` | Obtém número do HD |
| Supabase | tabela `licenca` | filtro `numero_hd`, `id_sistema=1` | Busca licença pelo HD |
| POST | `/api/v1/AdicionarLicencaSistema` | (mesmo payload do `ConfigScreen`) | Registra/atualiza licença |
| GET | `/api/v1/ConsultaLicencaSistema` | Query: `idLicenca`, `numHD` | Confirma registro da licença |
| Supabase | tabela `licenca_transacao_view` | filtro `id_cliente`, `id_licenca` | Busca transações da licença |

---

## 2. Home

### HomePage
**Arquivo:** `src/pages/HomePage.tsx` · **Rota:** `/home`
**Objetivo:** Tela inicial com notificações do sistema, notificações QS e lembretes do usuário (atualização automática a cada 120s).

| Método | Endpoint / Origem | Parâmetros | Quando é chamado |
|---|---|---|---|
| GET | `/api/v1/Notificações` | Query: `Codigo_Empresa`, `Codigo_Usuario`, `Nao_Lidas` (padrão `true`) | Carrega notificações do sistema (load + polling 120s) |
| Supabase | tabela `notificacao_QS` | filtro `publicado=true`, order `data_notificacao desc` | Carrega notificações QS (load + polling) |
| Supabase | tabela `lembretes` | filtro `cnpj_empresa`, `codigo_usuario`, order `data asc` | Carrega lembretes do usuário |
| Supabase (insert) | tabela `lembretes` | `titulo`, `conteudo`, `data`, `cnpj_empresa`, `codigo_usuario`, `cor` | Cria novo lembrete |
| Supabase (delete) | tabela `lembretes` | filtro `id`, `cnpj_empresa`, `codigo_usuario` | Remove lembrete |

---

## 3. Dashboards

Todos os dashboards usam `dashboardApi.ts` (`src/features/dashboards/services/dashboardApi.ts`), método **GET**, timeout de 120s, JWT Bearer e `GlobalConfig.getBaseUrl()`. Datas de filtro são convertidas de `dd/MM/yyyy` para o formato aceito pela API.

| Página | Rota | Endpoint | Parâmetros |
|---|---|---|---|
| DashboardVendasPage | `/dashboards/vendas` | `/api/v1/Dashboards/Vendas` | `Codigo_Empresa`, `Data_De`, `Data_Ate` |
| DashboardServicosPage | `/dashboards/servicos` | `/api/v1/DashboardNFSe` | `CodigoEmpresa`, `dataInicio`, `dataFim` |
| DashboardPCPPage | `/dashboards/pcp` | `/api/v1/Dashboards/PCP` | `Codigo_Empresa`, `Data_De`, `Data_Ate` |
| DashboardFinanceiroPage | `/dashboards/financeiro` | `/api/v1/Dashboards/Financeiro` | `Codigo_Empresa`, `Data_De`, `Data_Ate` (o período é fatiado em requisições mensais via `buildMonthlyChunks()` e os resultados são mesclados) |

Observações:
- **DashboardVendasPage:** resposta traz `Faturamento`, `Atraso`, `Forecast`, `FaturamentoAcumulado`, `MoedasSemCotacao`.
- **DashboardServicosPage:** usa nomes de parâmetro diferentes dos demais (`CodigoEmpresa`/`dataInicio`/`dataFim`); resposta traz `totalFaturado`, `totalImpostos`, `destinatarios[]`.
- **DashboardPCPPage:** resposta traz OEE (`fatoresOEE`), `producaoPorMaquina`, `producaoPorCentroTrabalho`, `paradasPorMotivo`, evolução mensal.
- **DashboardFinanceiroPage:** resposta traz `FluxoCaixaReceitas` e `FluxoCaixaDespesas`, com agrupamento configurável (mês, banco, pessoa, tipo, vendedor, cliente, região).

---

## 4. Vendas

### PedidoVendaPage
**Arquivo:** `src/features/vendas/pages/PedidoVendaPage.tsx` · **Rota:** `/pedidos-venda`
**Objetivo:** Listar, visualizar, editar, duplicar e excluir pedidos de venda. Também usada por `PedidoVendaRepresentantesPage` com `isRepresentantes=true`.

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| GET | `/api/v1/ObterUsuariosTransacoesSistemaAcao/{codigoUsuario}` | Query: `codigoAcaoString` (2=editar, 3=visualizar, 4=excluir, 6=duplicar), `idTransacaoString=24` | Valida permissão antes de editar/visualizar/duplicar/excluir |
| GET | `/api/v1/PedidosVenda` | Query: `Tipo`, `Tipo_Pedido_Venda` (1=normal, 2=representantes), `Num_Pedido`, `Codigo_Empresa`, `Data_De`, `Data_Ate`, `Situacao_Pedido`, `Codigo_Cliente`, `Codigo_Vendedor`, `Emitente`, `Nivel_Usuario` | Lista pedidos (`listPedidosVenda`) |
| GET | `/api/v1/PedidosVenda` | Query iguais + `Num_Pedido` específico | Busca pedido para edição (`getPedidoVendaForEdit`) |
| POST | `/api/v1/DuplicaPedidoVenda/{numPedido}` | Body: `Codigo_Empresa` | Duplica pedido (`duplicarPedidoVenda`) |
| DELETE | `/api/v1/PedidosVenda/{numPedido}` | Query: `Codigo_Empresa`, `codigoUsuario`, `material` (opcional), `numItem` (opcional) | Exclui pedido (`deletarPedidoVenda`) |

### NovoPedidoVendaPage
**Arquivo:** `src/features/vendas/pages/NovoPedidoVendaPage.tsx` · **Rota:** `/pedidos-venda/novo` (redireciona para `/pedidos-venda`, formulário usado dentro da própria página de listagem)
**Objetivo:** Formulário completo de criação/edição de pedido de venda (cliente, itens, tabela de preço, frete, condição de pagamento, importação de planilha Excel).

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| GET | `/api/v1/ListaClientes` | Query: `CodUsuario`, `Codigo_Cliente`, `Filtro`, `Nivel` (9=todos, ou nível do usuário p/ representantes) | Lista clientes |
| GET | `/api/v1/ListaCondicaoPagto` (ou `/{codigoPagto}`) | — | Lista condições de pagamento |
| GET | `/api/v1/ListaVendedores/{codigoUsuario}` | Query: `CodUsuario` | Lista vendedores |
| GET | `/api/v1/ListaTransportadoras` | — | Lista transportadoras |
| GET | `/api/v1/ListaRepresentantes/` | Query: `codEMPRESA`, `codRepresentante` | Lista representantes (apenas pedidos de representantes) |
| GET | `/api/v1/TabelaPrecosItens/{codTabela}` | Query: `CodEmpresa`, `Filtro`, `PercDescontoCLiente` | Consulta tabela de preços/itens |
| POST | `/api/v1/ValidarItensPlanilhaExcel` | Body: `Codigo_Empresa`, `Codigo_Tabela`, `Codigo_Cliente`, `Condicao_Pagto`, `Codigo_Vendedor`, `Perc_Desconto`, `Perc_Desconto_Pedido`, `Valor_Frete`, `Tipo_Pedido`, `Codigo_Transportadora`, `Frete_Por_Conta`, `Destino_Pedido`, `Codigo_Emitente`, `Situacao_Pedido`, `Pedido_Cliente`, `Data_Entrega`, `Itens_Planilha[]` (`Codigo_Produto`, `Qtd_Produto`) | Valida itens importados de planilha Excel |
| POST | `/api/v1/PedidosVenda` | Body: pedido completo (cliente, vendedor, itens, valores) | Cria novo pedido (`incluirPedidoVenda`) |
| PUT | `/api/v1/PedidosVenda` ou `/api/v1/PedidosVenda/{numPedido}` | Body: pedido completo | Atualiza pedido (`alterarPedidoVenda`) |

### PedidoVendaRepresentantesPage
**Arquivo:** `src/features/vendas/pages/PedidoVendaRepresentantesPage.tsx` · **Rota:** `/pedidos-venda-representantes`
**Objetivo:** Wrapper que renderiza `PedidoVendaPage` com `isRepresentantes={true}`. Não possui chamadas próprias — usa os mesmos endpoints de `PedidoVendaPage`, alterando `Tipo_Pedido_Venda=2`, filtros de data vazios e `Situacao_Pedido='Elaboração'` por padrão.

---

## 5. Básico

### ClientesPage
**Arquivo:** `src/features/basico/pages/ClientesPage.tsx` · **Rota:** `/basico/clientes`
**Objetivo:** Listar, consultar e cadastrar clientes, com busca automática de endereço por CEP e dados por CNPJ/CPF.

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| GET | `/api/v1/ListaCliente/{codigoUsuario}/{codigoCliente}` | Query: `filtro`, `nivel` | Lista clientes |
| POST | `/api/v1/AdicionarAcoesUsuarios` | Body: `Codigo_Empresa`, `Id_Sessao`, `Codigo_Usuario` | Log de auditoria |
| GET | `/api/v1/ObterUsuariosTransacoesSistemaAcao/{codigoUsuario}` | Query: `codigoAcaoString` (24=consultar, 23=criar), `idTransacaoString=1` | Valida permissão |
| GET | `/api/v1/ConsultaCep/{cep}` | Path: `cep` (8 dígitos) | Preenche endereço a partir do CEP |
| GET | `/api/v1/ConsultaCnpj/{cnpj}` | Path: `cnpj` (11 ou 14 dígitos) | Preenche dados a partir de CNPJ/CPF |
| POST | `/api/v1/CadastrarCliente` | Body: `Codigo_Empresa`, `Razao_Social`, `Nome_Fantasia`, `CEP`, `Endereco`, `UF`, `Bairro`, `Numero`, `Complemento`, `IBGE`, `Cidade`, `FisJur`, `CnpjCpf`, `Telefone`, `Email` | Cadastra novo cliente |

### ServicosPage
**Arquivo:** `src/features/basico/pages/ServicosPage.tsx` · **Rota:** `/basico/servicos`
**Objetivo:** Cadastro de serviços com classificações tributárias (PIS/COFINS, IBS/CBS, IS, NBS).

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| GET | `/api/v1/ListaServicos` | Query: `CodigoServico` (opc.), `TipoServico` (opc.) | Lista serviços |
| GET | `/api/v1/ObterTributacoes/{tipo}` | Path: tipo (`credito`, `TipoCredito`, `PISCofins`, `CBSIBS`, `IS`, `ClassTribIBSCBS/{cst}`, `ClassTribIS/{cst}`) | Busca classificações tributárias |
| GET | `/api/v1/nbs` | Query: `nbs`, `data` (`yyyy-MM-dd`) | Consulta código NBS |
| POST | `/api/v1/AdicionarServico` | Body: `Codigo_Servico=0`, `Descr_Resumida`, `Descr_Completa`, `Valor_Padrao`, tributações (PIS/COFINS/IBS/CBS/IS), `Cod_NBS`, `Destino_Servico`, etc. | Cria novo serviço |
| PUT | `/api/v1/AtualizarServico` | Body: igual ao de inclusão + `Codigo_Servico` | Atualiza serviço existente |
| DELETE | `/api/v1/DeletarServico/{codigoServico}` | Path: `codigoServico` | Exclui serviço |

---

## 6. Compras

### PedidoCompraLiberacaoPage
**Arquivo:** `src/features/compras/pages/PedidoCompraLiberacaoPage.tsx` · **Rota:** `/compras/pedido-liberacao`
**Objetivo:** Listar pedidos de compra pendentes e permitir liberação/estorno com autenticação de um segundo usuário.

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| POST | `/api/v1/AdicionarAcoesUsuarios` | Body: `Codigo_Empresa`, `Id_Sessao`, `Codigo_Usuario` | Log de auditoria |
| GET | `/api/v1/PedidosCompraPendentes/{codigoEmpresa}` | Path: `codigoEmpresa` | Lista pedidos pendentes |
| GET | `/api/v1/ObterUsuariosTransacoesSistemaAcao/{codigoUsuario}` | Query: `codigoAcaoString=22`, `idTransacaoString=8` | Valida permissão (apenas se `nivel < 3`) |
| GET | `/api/v1/url` | — | Health check antes da liberação |
| GET | `/api/v1/token` | Query: `Usuario`, `Codigo_Empresa`, `Nome_Empresa`, `Chave_Api`, `IdGuid`, `Tipo=2`, `RetornarComoXml=false` | Gera token do usuário liberador |
| PUT | `/api/v1/PedidosCompra/{numPedido}` | Query: `Codigo_Empresa`, `Tipo_Acao` (4=liberar, 3=estornar), `Tipo_Pedido=3`, `Usuario`, `Senha` | Libera (4) ou estorna (3) o pedido |

---

## 7. Financeiro

### ContasReceberPage
**Arquivo:** `src/features/financeiro/pages/ContasReceberPage.tsx` · **Rota:** `/financeiro/contas-receber`
**Objetivo:** Gestão completa de contas a receber: listagem, consulta, baixa, abatimento, estorno, adiantamentos e cancelamento.

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| GET | `/api/v1/ContasReceber` | Query: `CodigoEmpresa`, `dataInicio`, `dataFim`, `NumNf` (opc.), `CodCedente` (opc.), `TipoCedente` (opc.) | Lista contas a receber |
| GET | `/api/v1/ContasReceberNC` | Query: `CodigoEmpresa`, `CodCedente` (opc.), `TipoCedente` (opc.) | Lista contas de nota de crédito |
| GET | `/api/v1/ObterClientesFornecedores` | — | Lista clientes/fornecedores para seleção |
| GET | `/api/v1/ContasReceberSaldoAbater` | Query: `CodigoEmpresa`, `codigoCedente`, `tipoCedente` | Saldo disponível para abatimento |
| GET | `/api/v1/ContasReceberAbatimento` | Query: `CodigoEmpresa`, `CodigoCedente`, `tipoCedente` | Lista registros de abatimento |
| PUT | `/api/v1/AbatimentoDoc` | Body: `CodigoEmpresa`, `NumLanc`, `NumLancAbatimento`, `ValorAbatimento`, `ValorSaldo`, `ValorCalculado`, `Usuario` | Aplica abatimento entre documentos |
| GET | `/api/v1/CabecalhoEstornoAbat` | Query: `codigoEmpresa`, `numLanc` | Cabeçalho para estorno de abatimento |
| GET | `/api/v1/ContasReceberEstornoAbatNC` | Query: `codigoEmpresa`, `codCedente`, `tipoCedente`, `NumLancPrincipal` | Lista NC para estorno de abatimento |
| PUT | `/api/v1/EstornarDocumentoAbat` | Body: `CodigoEmpresa`, `NumLancOriginal`, `NumLancAbatimento`, `ValorEstornar`, `ValorAbatido` | Estorna abatimento |
| GET | `/api/v1/AdiantamentosRecebidos` | Query: `codigoEmpresa`, `codigoCedente`, `tipoCedente`, `tipoAdiantamento` (`A`/`E`) | Lista adiantamentos recebidos/estornos |
| PUT | `/api/v1/EncerrarReabrirAdiantamentos` | Query: `codigoEmpresa`, `NumLanc`, `encerrar`, `temDevolv` | Encerra/reabre adiantamento |
| PUT | `/api/v1/DevolverSaldo` | Query: `codigoEmpresa`, `NumLanc`, `dataDevolucao`, `Usuario`, `devolver`, `temDevolv` | Devolve saldo de adiantamento |
| PUT | `/api/v1/CancelaContasReceber` | Body: `codigoEmpresa`, `docs[]` (`CodigoEmpresa`,`NumLanc`,`TipoDoc`), `cancelaLote`, `excluirOutros`, `descricao`, `usuario` | Cancela uma ou várias contas (lote) |
| GET | `/api/v1/ConsultaPortador` | — | Lista portadores/bancos |
| GET | `/api/v1/ContasFinanceiras` | — | Lista contas financeiras |
| GET | `/api/v1/AtualizaValorCalculado` | Query: `ValorReceber`, `ValorAbatimento`, `ValorAbatido`, `ValorPis`, `ValorCofins`, `ValorDesconto`, `ValorJuros`, `ValorOutrasDesp`, `ValorCalculado`, `Calcular` | Recalcula valor final da conta |
| GET | `/api/v1/ConsultaPedido` | Query: `codigoEmpresa`, `numPedido` | Consulta pedido de venda relacionado |
| GET | `/api/v1/ConsultaNotaCliente` | Query: `codigoEmpresa`, `numNota`, `serNota`, `tipoDest`, `codigoDest` | Consulta nota fiscal do cliente |
| POST | `/api/v1/AdicionaContasReceber` | Body: `codigoEmpesa`, `NumDocumento`, `TipoDoc`, `DataEmissao`, `DataVenciment`, `DataPrevisao`, `Usuario`, `ValorReceber`, `ValorCalculado`, `NumPedido`, `ValorAbatimento`, `ValorDesconto`, `ValorJuros`, `ValorOutrasDesp`, `ValorPis`, `ValorCofins`, `ValorAbatido`, `SituacaoPagto`, `NumParcelas`, `CodigoSacado`, `TipoSacado`, `CodigoPortador`, `NumConta`, `NumNotaFiscal`, `SerNotaFiscal`, `DescricaoLanc`, `JustAlteracao` (entre outros) | Inclui nova conta a receber |
| POST | `/api/v1/BaixaContasRecebPag` | Body: `CodigoEmpresa`, `docs[]`, `Usuario`, `TipoBaixa`, `DataBaixaLote` | Baixa (recebe) contas em lote |
| GET | `/api/v1/ConsltaContaSelect` | Query: `codigoEmpresa`, `numLanc` | Detalha conta para consulta/edição (nome do endpoint contém typo "Conslta") |
| GET | `/api/v1/ContasReceberOcorrencias` | Query: `codigoEmpresa`, `numLanc` | Histórico de ocorrências da conta |

---

## 8. Serviço

### OrdensServicoPage
**Arquivo:** `src/features/servico/pages/OrdensServicoPage.tsx` · **Rota:** `/servico/ordens-servico`
**Objetivo:** Listar e criar ordens de serviço.

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| POST | `/api/v1/AdicionarAcoesUsuarios` | Body: `Codigo_Empresa`, `Id_Sessao`, `Codigo_Usuario` | Log de auditoria |
| GET | `/api/v1/OrdensServico` | Query: `codigo_usuario`, `num_Ordem` (opc.), `num_ident` (opc.), `codigo_empresa`, `Data_Inicio`, `Data_Fim` | Lista ordens de serviço |
| GET | `/api/v1/ListaTipoDeOrdemDeServico` | — | Lista tipos de OS |
| GET | `/api/v1/ListaCentroDeCusto` | — | Lista centros de custo |
| GET | `/api/v1/Clientes` | — | Lista clientes |
| GET | `/api/v1/ListaUnidadeMedida` | — | Lista unidades de medida |
| GET | `/api/v1/BuscaMaterial/{filtro}` | Path: `filtro` | Busca material por código/descrição |
| POST | `/api/v1/OrdensServico` | Body: `Codigo_Empresa`, `Tipo_Ordem`, `Centro_Custo`, `Codigo_Cliente`, `Descricao_Servico`, `Qtd_Servico`, `Unid_Medida`, `Ident_Equipamento`, `Codigo_Produto`, `Data_Inicio_Prev`, `Data_Fim_Prev` | Cria nova OS |

### NotaFiscalServicoPage
**Arquivo:** `src/features/servico/pages/NotaFiscalServicoPage.tsx` · **Rota:** `/servico/nota-fiscal`
**Objetivo:** Emitir, atualizar, cancelar, imprimir e enviar por e-mail Notas Fiscais de Serviço (NFS-e/DPS).

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| GET | `/api/v1/ObterNotasFiscais` | Query: `CodigoEmpresa`, `dataInicio`, `dataFim`, `tipoNota` (opc.), `numNotaFiscal` (opc.), `serie` (opc.) | Lista notas fiscais de serviço |
| GET | `/api/v1/ObterNotaFiscalServicoMod` | Query: `CodigoEmpresa`, `NumNota`, `SerNota` | Detalha nota para edição/consulta |
| POST | `/api/v1/EnviarDPS` | Body: extenso — `CodigoEmpresa`, `TipoNFServico`, `NumNota`, `SerNota`, `CodDestinatario`, `TipoDestinatario`, `CondPagamento`, `CodServico`, valores de impostos (`ValorServico`, `ValorINSS*`, `ValorIRRF`, `ValorISS`, `ValorCSLL`, `ValorPIS`, `ValorCOFINS`, `ValorIBSAjuste`, `ValorCBSAjuste`, etc.), `Usuario`, `versao` | Emite a NFS-e via DPS |
| PUT | `/api/v1/AtualizarNFSe` | Body: mesmo payload de `EnviarDPS` | Atualiza nota existente |
| POST | `/api/v1/CancelarNFSe` | Body: `CodigoEmpresa`, `NumNota`, `SerNota`, `Motivo` | Cancela nota |
| DELETE | `/api/v1/NFSeDelete` | Query: `CodigoEmpresa`, `NumNota`, `SerNota` | Exclui nota não enviada |
| POST | `/api/v1/DanfeNFSe` | Body: `CodigoEmpresa`, `NumNota`, `SerNota` | Gera PDF (DANFE) — retorna Blob |
| POST | `/api/v1/EnviarEmailNFSe` | Body: `CodigoEmpresa`, `Nota`, `Serie` | Envia nota por e-mail |
| GET | `/api/v1/ObterOcorrenciasNotaFiscal` | Query: `CodigoEmpresa`, `NumNota`, `SerNota`, `UltimaOcorrencia` (opc.) | Histórico de ocorrências da nota |
| GET | `/api/v1/ListaCondicaoPagto` (ou `/{codigoPagto}`) | — | Lista condições de pagamento |
| GET | `/api/v1/ListaServicos` | Query: `CodigoServico` (opc.), `TipoServico` (opc.) | Lista serviços cadastrados |
| GET | `/api/v1/ObterEmpresasSeriesNF` | Query: `CodigoEmpresa`, `tipoNota` | Lista séries de nota disponíveis |
| GET | `/api/v1/ObterClientesFornecedores` | — | Busca destinatário da nota |

### ApontamentoMaoObraPage
**Arquivo:** `src/features/servico/pages/ApontamentoMaoObraPage.tsx` · **Rota:** `/servico/apontamento-mao-obra`
**Objetivo:** Registrar e finalizar apontamentos de mão de obra em ordens de serviço (modo padrão ou cronômetro).

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| GET | `/api/v1/ListaFuncionarios` | Query: `CodUsuario` | Lista funcionários do usuário |
| GET | `/api/v1/ListaCentroTrabalho` | — | Lista centros de trabalho |
| GET | `/api/v1/ApontamentosMaoDeObra/` | Query: `codigoEmpresa`, `dataInicio`, `dataFim`, `codigoFuncionario` (opc.), `apenasPendentes` (opc.), `codigoCTrab` (opc.) | Lista apontamentos |
| POST | `/api/v1/ApontamentosMaoDeObra/{tipo}` | Path: `tipo` = `Padrao`/`Cronometro` · Body: `Codigo_Empresa`, `Num_Registro`, `Num_Ordem`, `Num_Sequencia`, `Encerrar_OS`, `Codigo_CTrab`, `Data_Servico`, `Hora_Inicio`, `Hora_Fim`, `Tipo_Apont`, `Usuario_Atual`, `Id` | Cria apontamento |
| GET | `/api/v1/ObterUsuariosTransacoesSistemaAcao/{codigoUsuario}` | Query: `codigoAcaoString`, `idTransacaoString` (15/22) | Valida permissão para finalizar apontamento |
| PUT | `/api/v1/ApontamentosMaoDeObra` | Query: `codigoEmpresa`, `numOrdem`, `idApont`, `horaFim`, `usuarioAtual`, `encerrarOS` (opc.) | Finaliza apontamento (e opcionalmente encerra a OS) |

---

## 9. PCP

### PreparacaoMaquinaPage
**Arquivo:** `src/features/pcp/pages/PreparacaoMaquinaPage.tsx` · **Rota:** `/pcp/preparacao-maquina`

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| GET | `/api/v1/PreparacaoMaquina` | Query: `Codigo_Empresa`, `Num_Ordem` (opc.), `Data_Inicio` (opc.), `Data_Fim` (opc.), `Num_Maquina` (opc.), `SituacaoOF` (padrão 99), `Usuario` | Lista preparações de máquina |
| GET | `/api/v1/ListaMaquinas` | — | Lista máquinas |
| GET | `/api/v1/ListaFuncionarios` | Query: `CodUsuario` | Lista operadores |
| GET | `/api/v1/BuscaOF/{codigoEmpresa}` | Query: `Num_OF` | Busca dados da OF |
| POST | `/api/v1/PreparacaoMaquina` | Body: `Codigo_Empresa`, `Num_Ordem`, `Num_Operacao`, `Data_Inic_Setup`, `Hora_Inic_Setup`, `Data_Fim_Setup`, `Hora_Fim_Setup`, `Num_Registro` (opc.), `Num_Maquina` (opc.), `Usuario` | Cria registro de preparação |

### ParadasMaquinaPage
**Arquivo:** `src/features/pcp/pages/ParadasMaquinaPage.tsx` · **Rota:** `/pcp/paradas-maquina`

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| GET | `/api/v1/ParadasMaquina` | Query: `Codigo_Empresa`, `Num_Ordem` (opc.), `Data_Inicio` (opc.), `Data_Fim` (opc.), `Num_Maquina` (opc.), `Usuario`, `Origem` (opc.) | Lista paradas de máquina |
| GET | `/api/v1/MotivoParadaMaquina` | Query: `Codigo_Empresa` (opc.) | Lista motivos de parada |
| GET | `/api/v1/ListaMaquinas` | — | Lista máquinas |
| GET | `/api/v1/BuscaOF/{codigoEmpresa}` | Query: `Num_OF` | Valida OF (se "Sem OF" não marcado) |
| POST | `/api/v1/ParadasMaquina/Padrao` | Body: `Codigo_Empresa`, `Num_Ordem` (0 se sem OF), `Num_Maquina`, `Data_Inicio`, `Hora_Inicio`, `Data_Fim`, `Hora_Fim`, `Codigo_Motivo`, `Usuario` | Cria registro de parada |

### OrdensFabricacaoPage
**Arquivo:** `src/features/pcp/pages/OrdensFabricacaoPage.tsx` · **Rota:** `/pcp/ordens-fabricacao`

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| GET | `/api/v1/OrdensFabricacao` | Query: `Tipo=1`, `Codigo_Empresa`, `Num_Ordem` (opc.), `Data_Inicio` (opc.), `Data_Fim` (opc.), `Produto` (opc.) | Lista ordens de fabricação (somente leitura) |

### ApontamentoProducaoPage
**Arquivo:** `src/features/pcp/pages/ApontamentoProducaoPage.tsx` · **Rota:** `/pcp/apontamento-producao`

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| GET | `/api/v1/ApontamentosProducao` | Query: `Codigo_Empresa`, `Num_Ordem` (opc.), `Data_Inicio` (opc.), `Data_Fim` (opc.), `usuario`, `Cod_Prod` (opc.), `Funcionario` (opc.) | Lista apontamentos de produção |
| GET | `/api/v1/ListaFuncionarios` | Query: `CodUsuario` | Lista operadores |
| GET | `/api/v1/ListaMaquinas` | — | Lista máquinas |
| GET | `/api/v1/MotivoRejeicao` | — | Lista motivos de rejeição |
| GET | `/api/v1/MotivoBloqueio` | — | Lista motivos de bloqueio |
| GET | `/api/v1/BuscaOF/{codigoEmpresa}` | Query: `Num_OF` | Busca produto/processo/revisão da OF |
| GET | `/api/v1/BuscaOper/{codigoProduto}` | Query: `Num_Processo` (opc.), `Num_Revisao` (opc.), `Num_Operacao`, `SituacaoOF` (opc.), `Tipo_Apont` | Valida operação |
| POST | `/api/v1/ApontamentosProducao/Padrao` | Body: `Codigo_Empresa`, `Num_Apontamento`, `Num_Ordem`, `Num_Operacao`, `Num_Maquina`, `Num_Registro`, `Data_Inicio`, `Hora_Inicio`, `Data_Fim`, `Hora_Fim`, `Codigo_Motivo` (opc.), `Codigo_Bloqueio` (opc.), `Qtd_Produzida`, `Qtd_Rejeitada`, `Usuario`, `Permitir_Apontamento_Sem_Operacao`, `Validar_Operacao` | Cria apontamento padrão (tempo manual) |
| POST | `/api/v1/ApontamentosProducao/Cronometro` | Body: `Codigo_Empresa`, `Num_Ordem`, `Num_Operacao`, `Num_Maquina`, `Num_Registro`, `Usuario` | Inicia apontamento por cronômetro |

---

## 10. Qualidade

`FichaInspecaoPage.tsx` é um componente base **não roteado diretamente**; é reutilizado por `FichaInspecaoProcessoPage` (`tipoLaudo="Processo"`) e `FichaInspecaoRecebimentoPage` (`tipoLaudo="Recebimento"`), cada um passando permissões diferentes.

### FichaInspecaoProcessoPage / FichaInspecaoRecebimentoPage
**Arquivos:** `src/features/qualidade/pages/FichaInspecaoPage.tsx` (base), `FichaInspecaoProcessoPage.tsx`, `FichaInspecaoRecebimentoPage.tsx`
**Rotas:** `/qualidade/ficha-inspecao-processo`, `/qualidade/ficha-inspecao-recebimento`

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| POST | `/api/v1/AdicionarAcoesUsuarios` | Body: `Codigo_Empresa`, `Id_Sessao`, `Codigo_Usuario` | Log de auditoria |
| GET | `/api/v1/ObterUsuariosTransacoesSistemaAcao/{codigoUsuario}` | Query: `codigoAcaoString`, `idTransacaoString` (Processo: ação 18/19, transação 20; Recebimento: ação 20/21, transação 21) | Valida permissão de inclusão/laudo |
| GET | `/api/v1/Inspetores` | — | Lista inspetores |
| GET | `/api/v1/MotivoBloqueio` | — | Lista motivos de bloqueio (somente tipo Recebimento) |
| GET | `/api/v1/MotivoDemerito` | — | Lista motivos de demérito (somente tipo Recebimento) |
| GET | `/api/v1/LaudosDeInspecao` | Query: `Tipo_Laudo`, `Tipo_Listagem`, `Codigo_Empresa`, `Usuario_Atual`, `Codigo_Material` (opc.), `Codigo_Lote` (opc.), `Data_Inicio`, `Data_Fim`, `Num_Laudo` (opc.), `Situacao_Laudo` (opc.), `Num_Item` (opc.) | Lista fichas de inspeção (também usado com múltiplos `Tipo_Listagem` ao abrir um laudo) |
| GET | `/api/v1/url` + `/api/v1/token` | — | Health check + geração de token antes de salvar nova ficha |
| POST | `/api/v1/LaudosDeInspecao` | Body: `Codigo_Empresa`, `Usuario_Atual`, `Codigo_Lote`, `Data_Inspecao`, `Codigo_Inspetor`, `Tipo_Laudo`, `Obs_Inspecao` (opc.) | Cria nova ficha de inspeção |
| PUT | `/api/v1/LaudosDeInspecao/AlterarLaudo/{tipoAcao}` | Body: `Tipo_Laudo`, `Unidade_Medida`, `Codigo_Empresa`, `Usuario_Atual`, `Data_Confirmacao`, `Num_Laudo`, `Qtd_Aprovada`, `Qtd_Reprovada`, `Qtd_Destruida`, `Codigo_Inspetor`, `Motivo_Bloqueio` (se reprovada > 0), `Motivo_Sucata`/`Codigo_Demerito` (se destruída > 0), `Observacao_Confirmacao`, `Resultados_Itens[]` | Salva ou confirma laudo (`tipoAcao` = `Salvar`/`Confirmar`) |
| POST | `/api/v1/LaudosDeInspecao/AdicionarValoresLaudo` | Body: `Codigo_Empresa`, `Usuario_Atual`, `Num_Laudo`, `Num_Item`, `Valores_Medicao[]` + campos padrão | Salva medições de um item do laudo |

---

## 11. Manutenção

### OrdensManutencaoPage
**Arquivo:** `src/features/manutencao/pages/OrdensManutencaoPage.tsx` · **Rota:** `/manutencao/ordens`

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| POST | `/api/v1/AdicionarAcoesUsuarios` | Body: `Codigo_Empresa`, `Id_Sessao`, `Codigo_Usuario` | Log de auditoria |
| GET | `/api/v1/ObterUsuariosTransacoesSistemaAcao/{codigoUsuario}` | Query: `codigoAcaoString=25`, `idTransacaoString=13` | Valida permissão de inclusão |
| GET | `/api/v1/ListaMaquinas` | — | Lista máquinas |
| GET | `/api/v1/OrdensManut` | Query: `tipo=2`, `codigo_usuario`, `num_Ordem` (opc.), `num_ident`, `codigo_empresa`, `Data_Inicio`, `Data_Fim`, `situacao_ordem` (opc., padrão 99) | Lista ordens de manutenção |
| POST | `/api/v1/OrdensManut` | Body: `Codigo_Empresa`, `Num_Ident`, `Aberto_Por`, `Motivo_Abertura`, `Prioridade` (1=baixa, 2=média, 3=alta) | Cria nova ordem de manutenção |

---

## 12. Segurança

### ParametrosGeraisPage
**Arquivo:** `src/features/seguranca/pages/ParametrosGeraisPage.tsx` · **Rota:** `/seguranca/parametros-gerais`

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| GET | `/api/v1/parametrosnfe` | Query: `CodigoEmpresa` | Carrega parâmetros de NF-e |
| GET | `/api/v1/VerificarServicoApi` | — | Verifica status das APIs do governo |
| PUT | `/api/v1/ExecutarServicoApi` | — | Executa as APIs do governo (aguarda 30s e reconsulta status) |
| PUT | `/api/v1/parametrosnfeput` | Body: `Codigo_Empresa`, `Tipo_Gerenciador_NFe`, `Versao_NFe`, `Qtd_Vias_Danfe`, `Tipo_Danfe`, `Diretorio_NFE`, campos de e-mail SMTP/POP (envio e recebimento), `NFe_Ultimo_NSU`, `Endereco_Certificado`, `Senha_Certificado`, `Data_Inicio_Validade`, `Data_Fim_Validade`, `Usuario` | Salva parâmetros de NF-e |
| DELETE | `/api/v1/DeletarCertificado/{codigoEmpresa}` | Path: `codigoEmpresa` | Remove certificado digital |
| POST | `/api/v1/validaCertificado` | Body: `CodigoEmpresa`, `CaminhoArq`, `SenhaCert` | Valida e importa certificado digital |

### TipoApontamentoPage
**Arquivo:** `src/features/seguranca/pages/TipoApontamentoPage.tsx` · **Rota:** `/seguranca/tipo-apontamento`
**Sem chamadas de API** — configura apenas `GlobalConfig` (tipo de apontamento de produção/mão de obra, permissão de apontamento sem operação) localmente.

### SessoesPage
**Arquivo:** `src/features/seguranca/pages/SessoesPage.tsx` · **Rota:** `/seguranca/sessoes`

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| POST | `/api/v1/AdicionarAcoesUsuarios` | Body: `Codigo_Empresa`, `Id_Sessao`, `Codigo_Usuario` | Log de auditoria |
| GET | `/api/v1/usuarios` | — | Lista usuários |
| GET | `/api/v1/Sessoes` | Query: `Codigo_Usuario` (vazio = todos), `Id_Sistema` (padrão 1) | Lista sessões ativas |
| GET | `/api/v1/token` | Query: `usuario`, `nomeEmpresa`, `codigoEmpresa`, `chaveApi`, `idGuid`, `tipo=1`, `retornarComoXml` | Gera token para atualização de licença |
| PUT | `/api/v1/Logout/` | Query: `CodigoEmpresa`, `IdSessao` | Encerra sessão específica |
| POST | `/api/v1/AdicionarUsuarioSistemaLog` | Body: `Usuario`, `Menu='Sessões'`, `Acao='Encerrar Sessão'`, `Codigo_Transacao='CFG008'`, `Nome_Campo`, `Valor_Antigo`, `Valor_Novo`, `ID_Transacao` | Log de auditoria do encerramento |
| POST | `/api/v1/AdicionarLicencaSistema` | Body: (`LicencaPayload`) `id`, `situacao_licenca`, `data_validade`, `numero_acessos`, `numero_hd`, `instancia_sql`, `nome_banco`, `versao_sistema`, `usuario_sql`, `senha_sql`, etc. | Atualiza licença no sistema |
| POST | `/api/v1/InserirOuAtualizarTransacao` | Body: `LicencaTransacaoViewModel[]` | Sincroniza transações da licença |

### UsuariosPage
**Arquivo:** `src/features/seguranca/pages/UsuariosPage.tsx` · **Rota:** `/seguranca/usuarios`
**Acesso:** requer `nivel_usuario >= 9`.

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| POST | `/api/v1/AdicionarAcoesUsuarios` | Body: `Codigo_Empresa`, `Id_Sessao`, `Codigo_Usuario` | Log de auditoria |
| GET | `/api/v1/usuarios` (ou `/{codigoUsuario}`) | — | Lista usuários / detalhe |
| PUT | `/api/v1/usuarios/{codigoUsuario}` | Body: `Nome_Usuario`, `Senha_Usuario`, `Nivel_Usuario`, `E_mail_Usuario`, `E_mail_Senha`, `Usuario_Externo`, `Tipo_Menu_Qserpx` | Atualiza parâmetros do usuário |
| GET | `/api/v1/ObterTransacoesSistema` | Query: `exibeHistorico` | Lista todas as transações/telas do sistema |
| GET | `/api/v1/ObterUsuariosTransacoesSistema` | Query: `codigousuario`, `codigotransacao`, `menu` | Lista transações vinculadas ao usuário |
| POST | `/api/v1/AdicionarUsuariosTransacoesSistema` | Body: `Id_Transacao`, `Codigo_Usuario`, `Codigo_Transacao`, `Transacao_Favorita` | Vincula transação ao usuário |
| DELETE | `/api/v1/DeletarUsuarioTransacaoSistema/{codigoUsuario}/{codigoTransacao}` | Path params | Desvincula transação do usuário |
| GET | `/api/v1/ObterTransacoesSistemaAcao` | Query: `IdTransacao` | Lista ações disponíveis por transação |
| GET | `/api/v1/ObterUsuariosTransacoesSistemaAcao/{codigoUsuario}` | Query: `codigoAcaoString`, `idTransacaoString` | Lista ações vinculadas ao usuário/transação |
| POST | `/api/v1/AdicionarUsuariosTransacoesSistemaAcao` | Body: `Id_Usuario_Transacao`, `Id_Transacao_Acao` | Vincula ação a usuário/transação |
| DELETE | `/api/v1/DeletarUsuarioTransacaoSistemaAcao/{idUsuarioTransacaoAcao}` | Path param | Desvincula ação de usuário/transação |

---

## 13. QS Atualiza

### QsAtualizaPage
**Arquivo:** `src/features/qs-atualiza/pages/QsAtualizaPage.tsx` · **Rota:** `/qs-atualiza`
**Objetivo:** Configurar protocolo/URL do serviço QS Atualiza e validar conectividade antes de liberar o acesso à tela de versões.

| Método | Endpoint | Parâmetros | Descrição |
|---|---|---|---|
| GET | `{protocolo}://{url}/api/v1/status` | — | Health check do servidor QS Atualiza (sem Authorization). Tenta `no-cors` como fallback em caso de erro de CORS |

Base URL configurada é persistida em `GlobalConfig.setBaseUrlQSAtualiza()` / lida via `GlobalConfig.getBaseUrlQSAtualiza()`.

### VersoesPage
**Arquivo:** `src/features/qs-atualiza/pages/VersoesPage.tsx` · **Rota:** `/qs-atualiza/versoes`
**Objetivo:** Consultar versões disponíveis (QSERP, QS API, QS ERPX) em ambiente de Produção/Teste, configurar parâmetros de atualização, bloquear/derrubar sessões e executar a atualização com acompanhamento em tempo real (SSE).

| Método | Endpoint / Origem | Parâmetros | Descrição |
|---|---|---|---|
| Supabase | tabela `sistema_versao` | filtro `id_sistema`, `url_download not null/empty`, order `num_versao desc` | Lista versões disponíveis por sistema (`buscarVersoesPorSistema`) |
| GET | `{baseUrlQSAtualiza}/api/v1/IIS/Sites` | — | Lista sites IIS disponíveis (QS API / QS ERPX) |
| GET | `{prefixoHttp}://{urlApi}/api/v1/url` | — | Testa conectividade da URL da API configurada |
| GET | `{baseUrl}/api/v1/parametrosatualizacao` | Query: `idSistema`, `tipoAmbiente` | Carrega configurações de atualização (caminhos, URL, prefixo, última versão) |
| POST | `{baseUrl}/api/v1/adicionaparametrosatualizacao` | Body: `id_Sistema`, `caminho_Extracao`, `caminho_Destino`, `caminho_Backup`, `caminho_Log`, `tipo_Ambiente`, `prefixo_Http`, `url`, `ultima_Versao`, `codigo_Licenca`, `Atualiza_QSERP` | Salva configurações de atualização (também usado para registrar a versão após atualização bem-sucedida) |
| GET | `{baseUrl}/api/v1/verificalicencabloqueada` | Query: `CodigoLicenca`, `CodigoUsuario`, `nivelUsuario=0` | Verifica se a licença está bloqueada ao carregar a tela |
| GET | `{prefixoHttp}://{urlApi}/api/v1/buscaLicencaAtual` | — | (ambiente Teste) Busca código de licença de teste |
| GET | `{configUrlProtocol}://{configUrlHost}/api/v1/status` | — | Testa URL do QS Atualiza (modal de configuração) |
| POST | `{baseUrl}/api/v1/LogApi` | Body: `CodigoEmpresa`, `DescricaoErro`, `InfComplem` | Loga erro ocorrido durante a atualização |
| POST | `{baseUrlQSAtualiza}/api/v1/update/q4` | Body: `versao`, `urlDownload`, `caminhoExtrair`, `caminhoDestino`, `fazerBackup`, `caminhoBackup`, `scriptSQL`, `scriptPostgres`, `codigoInstalacao`, `urlApiLocal`, `prefixoHttp`, `caminhoLog` | Inicia atualização do QSERP |
| POST | `{baseUrlQSAtualiza}/api/v1/update/qsapi` | Body: `versao`, `urlDownload`, `caminhoExtrair`, `caminhoDestino`, `caminhoBackup`, `caminhoLog`, `usuarioIIS`, `senhaIIS`, `servidorIIS`, `nomeSiteIIS`, `nomeAppPool` | Inicia atualização da QS API |
| POST | `{baseUrlQSAtualiza}/api/v1/update/qserpx` | Body: igual à QS API (sem `nomeAppPool`) | Inicia atualização do QS ERPX |
| GET (SSE) | `{baseUrlQSAtualiza}/api/v1/update/{q4\|qsapi\|qserpx}/stream/{operacaoId}` | — | Acompanha o progresso da atualização em tempo real via `EventSource` |
| PUT | `{baseUrl}/api/v1/DesbloquearLicenca` | Query: `CodigoLicencaBanco` | Desbloqueia a licença (ao final da atualização, manualmente, ou como fallback de erro) |
| PUT | `{baseUrl}/api/v1/BloquearLicenca` | Query: `CodigoLicencaBanco`, `MensagemBloqueio`, `DataHoraBloqueio` | Bloqueia a licença antes de atualizações com script de banco |
| DELETE | `{baseUrl}/api/v1/DerrubarSessoesAll` | Query: `CodigoUsuario` | Derruba todas as sessões ativas antes da atualização |
| GET | `{baseUrl}/api/v1/VerificaVersao` | — | Verifica a versão da QS API instalada (para checar dependência de versão) |

---

*Documento gerado por análise automatizada do código-fonte. Última atualização: 2026-08-18.*
