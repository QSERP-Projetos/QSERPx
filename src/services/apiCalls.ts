import apiManager, { ApiCallType, ApiCallResponse } from './apiManager';

const normalizeBaseUrl = (url: string) => url?.replace(/\/$/, '') || '';

export type TokenParams = {
  usuario?: string;
  nomeEmpresa?: string;
  codigoEmpresa?: number;
  chaveApi?: string;
  idGuid?: string;
  tipo?: number;
  retornarComoXml?: boolean;
};

export type LicencaPayload = {
  id?: number;
  situacao_licenca?: number;
  data_validade?: string;
  mensagem_fim_validade?: string;
  dias_ant_mensagem_fim_validade?: number;
  numero_acessos?: number;
  numero_hd?: string;
  instancia_sql?: string;
  nome_banco?: string;
  versao_sistema?: string;
  usuario_sql?: string;
  senha_sql?: string;
  versao_limite?: string;
  tipo_licenca?: number;
  tipo_banco?: number;
};

export type PedidosVendaParams = {
  codigoEmpresa: string | number;
  codigoPedido?: string;
  situacao?: string;
  vendedor?: string;
  cliente?: string;
  dataDe?: string;
  dataAte?: string;
  tipo?: number;
  emitente?: string;
  nivelUsuario?: number;
};

export type LicencaTransacaoModel = any;

export type LoginResponse = any;
export type UsuarioDetalheResponse = any;

export type ListPedidoCompraParams = {
  codigoEmpresa: number;
};

export type AdicionarSessaoSistemaPayload = {
  usuario: string;
  idsistema: number;
  codigoempresa: string | number;
  versao: string;
  uuidNavegador: string;
  maxsessoes: number;
};

// ============================================
// API: Obter Usuários Transações Sistema Ação
// ============================================
export const obterUsuariosTransacoesSistemaAcaoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  codigoUsuario: string,
  codigoAcaoString: string | number,
  idTransacaoString: string | number,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ObterUsuariosTransacoesSistemaAcao/${codigoUsuario}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      codigoAcaoString,
      idTransacaoString,
    },
  );
};

// ============================================
// API: Ações Usuários
// ============================================
export const acoesUsuariosCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    codigoEmpresa?: number;
    idSessao?: number;
    codigoUsuario?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/AdicionarAcoesUsuarios`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Codigo_Empresa: payload.codigoEmpresa,
      Id_Sessao: payload.idSessao,
      Codigo_Usuario: payload.codigoUsuario,
    },
  );
};

// ============================================
// API: Lista Usuarios
// ============================================
export const listUsuariosCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  codigoUsuario?: string,
): Promise<ApiCallResponse> => {
  const suffix = codigoUsuario ? `/${codigoUsuario}` : '';
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/usuarios${suffix}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Alterar Parametros Usuarios
// ============================================
export const alterarParamUsuariosCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  codigoUsuario: string,
  payload: {
    nomeUsuario: string;
    senhaUsuario: string;
    nivelUsuario: number;
    eMailUsuario: string;
    eMailSenha: string;
    usuarioExterno: number;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/usuarios/${codigoUsuario}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.PUT,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Nome_Usuario: payload.nomeUsuario,
      Senha_Usuario: payload.senhaUsuario,
      Nivel_Usuario: payload.nivelUsuario,
      E_mail_Usuario: payload.eMailUsuario,
      E_mail_Senha: payload.eMailSenha,
      Usuario_Externo: payload.usuarioExterno,
    },
  );
};

// ============================================
// API: Obter Transacoes Sistema
// ============================================
export const obterTransacoesSistemaCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  exibeHistorico?: boolean,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ObterTransacoesSistema`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      exibeHistorico,
    },
  );
};

// ============================================
// API: Obter Transacoes Sistema Acao
// ============================================
export const obterTransacoesSistemaAcaoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  idTransacao: string,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ObterTransacoesSistemaAcao`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      IdTransacao: idTransacao,
    },
  );
};

// ============================================
// API: Adicionar Usuarios Transacoes Sistema Acao
// ============================================
export const adicionarUsuariosTransacoesSistemaAcaoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    idUsuarioTransacao: number;
    idTransacaoAcao: number;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/AdicionarUsuariosTransacoesSistemaAcao`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Id_Usuario_Transacao: payload.idUsuarioTransacao,
      Id_Transacao_Acao: payload.idTransacaoAcao,
    },
  );
};

// ============================================
// API: Deletar Usuario Transacao Sistema Acao
// ============================================
export const deletarUsuarioTransacaoSistemaAcaoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  idUsuarioTransacaoAcao: number,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/DeletarUsuarioTransacaoSistemaAcao/${idUsuarioTransacaoAcao}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.DELETE,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Adicionar Usuarios Transacoes Sistema
// ============================================
export const adicionarUsuariosTransacoesSistemaCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    idTransacao?: number;
    codigoUsuario: string;
    codigoTransacao: string;
    transacaoFavorita?: number;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/AdicionarUsuariosTransacoesSistema`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Id_Transacao: payload.idTransacao,
      Codigo_Usuario: payload.codigoUsuario,
      Codigo_Transacao: payload.codigoTransacao,
      Transacao_Favorita: payload.transacaoFavorita ?? 0,
    },
  );
};

// ============================================
// API: Lista Vendedores
// ============================================
export const listaVendedoresCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  codigoUsuario: string,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ListaVendedores/${codigoUsuario}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      CodUsuario: codigoUsuario,
    },
  );
};

// ============================================
// API: Lista Representantes
// ============================================
export const listaRepresentantesCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  codEmpresa: number | string,
  codRepresentante?: string,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ListaRepresentantes/`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      codEMPRESA: codEmpresa,
      codRepresentante: codRepresentante ?? '',
    },
  );
};

// ============================================
// API: Lista Condição de Pagamento
// ============================================
export const listaCondicaoPagtoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  codigoPagto?: string | number,
): Promise<ApiCallResponse> => {
  const suffix = codigoPagto ? `/${codigoPagto}` : '';
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ListaCondicaoPagto${suffix}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Lista Transportadoras
// ============================================
export const listaTransportadorasCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ListaTransportadoras`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Tabela Preço Itens
// ============================================
export const tabelaPrecoItensCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  codTabela: string | number,
  codEmpresa: string | number,
  filtro: string,
  percDescontoCliente: string,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/TabelaPrecosItens/${codTabela}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      CodEmpresa: codEmpresa,
      Filtro: filtro ?? '',
      PercDescontoCLiente: percDescontoCliente ?? '0',
    },
  );
};

// ============================================
// API: Listar Apontamentos Produção
// ============================================
export const listApontamentosProducaoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  params: {
    codigoEmpresa?: number;
    numOrdem?: string;
    dataInicio?: string;
    dataFim?: string;
    codProd?: string;
    usuario?: string;
    funcionario?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ApontamentosProducao`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      Codigo_Empresa: params.codigoEmpresa,
      Num_Ordem: params.numOrdem ?? '',
      Data_Inicio: params.dataInicio ?? '',
      Data_Fim: params.dataFim ?? '',
      usuario: params.usuario ?? '',
      Cod_Prod: params.codProd ?? '',
      Funcionario: params.funcionario ?? '',
    },
  );
};

// ============================================
// API: Listar Ordens de Fabricacao
// ============================================
export const listOrdensFabricacaoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  params: {
    tipo?: number;
    codigoEmpresa?: number;
    numOrdem?: string;
    dataInicio?: string;
    dataFim?: string;
    produto?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/OrdensFabricacao`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      Tipo: params.tipo,
      Codigo_Empresa: params.codigoEmpresa,
      Num_Ordem: params.numOrdem ?? '',
      Data_Inicio: params.dataInicio ?? '',
      Data_Fim: params.dataFim ?? '',
      Produto: params.produto ?? '',
    },
  );
};

// ============================================
// API: Listar Ordens de Servico
// ============================================
export const listOrdensServicosCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  params: {
    codigoEmpresa?: number | string;
    codigoUsuario?: string;
    numOrdem?: string;
    numIdent?: string;
    dataInicio?: string;
    dataFim?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/OrdensServico`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      codigo_usuario: params.codigoUsuario ?? '',
      num_Ordem: params.numOrdem ?? '',
      num_ident: params.numIdent ?? '',
      codigo_empresa: params.codigoEmpresa ?? '',
      Data_Inicio: params.dataInicio ?? '',
      Data_Fim: params.dataFim ?? '',
    },
  );
};

// ============================================
// API: Lista Tipo Ordem de Servico
// ============================================
export const listaTipoOrdemServicoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ListaTipoDeOrdemDeServico`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Lista Centro de Custo
// ============================================
export const listaCentroCustoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ListaCentroDeCusto`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Incluir Ordem de Servico
// ============================================
export const incluirOrdemServicoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    empresa?: number;
    tipoOrdem?: number;
    centroCusto?: number;
    codigoCliente?: number;
    descricaoServico?: string;
    qtdServico?: string;
    unidMedida?: string;
    identEquipamento?: string;
    codigoProduto?: string;
    dataInicioPrev?: string;
    dataFimPrev?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/OrdensServico`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Codigo_Empresa: payload.empresa,
      Tipo_Ordem: payload.tipoOrdem,
      Centro_Custo: payload.centroCusto,
      Codigo_Cliente: payload.codigoCliente,
      Descricao_Servico: payload.descricaoServico ?? '',
      Qtd_Servico: payload.qtdServico ?? '',
      Unid_Medida: payload.unidMedida ?? '',
      Ident_Equipamento: payload.identEquipamento ?? '',
      Codigo_Produto: payload.codigoProduto ?? '',
      Data_Inicio_Prev: payload.dataInicioPrev ?? '',
      Data_Fim_Prev: payload.dataFimPrev ?? '',
    },
  );
};

// ============================================
// API: Lista Fichas de Inspecao
// ============================================
export const listFichaInspecaoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  params: {
    tipoLaudo?: string;
    tipoListagem?: number;
    codigoEmpresa?: number;
    usuarioAtual?: string;
    codigoMaterial?: string;
    codigoLote?: string;
    dataInicio?: string;
    dataFim?: string;
    numLaudo?: number;
    situacaoLaudo?: number | string | null;
    numItem?: number;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/LaudosDeInspecao`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      Tipo_Laudo: params.tipoLaudo ?? '',
      Tipo_Listagem: params.tipoListagem,
      Codigo_Empresa: params.codigoEmpresa,
      Usuario_Atual: params.usuarioAtual ?? '',
      Codigo_Material: params.codigoMaterial ?? '',
      Codigo_Lote: params.codigoLote ?? '',
      Data_Inicio: params.dataInicio ?? '',
      Data_Fim: params.dataFim ?? '',
      Num_Laudo: params.numLaudo ?? 0,
      Situacao_Laudo: params.situacaoLaudo ?? null,
      Num_Item: params.numItem ?? 0,
    },
  );
};

// ============================================
// API: Lista Funcionarios
// ============================================
export const listaFuncionariosCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  codUsuario: string,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ListaFuncionarios`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      CodUsuario: codUsuario,
    },
  );
};

// ============================================
// API: Lista Centro Trabalho
// ============================================
export const listaCentroTrabalhoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ListaCentroTrabalho`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Busca Funcionario
// ============================================
export const buscaFuncionarioCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  codigoRegistro: string,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/BuscaFuncionario/${codigoRegistro}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Listar Apontamentos Mao de Obra
// ============================================
export const listApontamentoMaoDeObraCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  params: {
    codigoEmpresa: number | string;
    dataInicio?: string;
    dataFim?: string;
    codigoFuncionario?: string;
    apenasPendentes?: boolean;
    codigoCTrab?: string | null;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ApontamentosMaoDeObra/`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      codigoEmpresa: params.codigoEmpresa,
      dataInicio: params.dataInicio ?? '',
      dataFim: params.dataFim ?? '',
      codigoFuncionario: params.codigoFuncionario ?? '',
      apenasPendentes: params.apenasPendentes ?? false,
      codigoCTrab: params.codigoCTrab ?? null,
    },
  );
};

// ============================================
// API: Incluir Apontamento Mao de Obra
// ============================================
export const incluirApontamentoMaoDeObraCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  tipo: string,
  payload: {
    codigoEmpresa?: number;
    numRegistro?: string;
    numOrdem?: number;
    numSequencia?: number;
    encerrarOS?: boolean;
    codigoCTrab?: string;
    dataServico?: string;
    horaInicio?: string;
    horaFim?: string;
    tipoApont?: number;
    usuarioAtual?: string;
    id?: number;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ApontamentosMaoDeObra/${tipo}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Codigo_Empresa: payload.codigoEmpresa,
      Num_Registro: payload.numRegistro ?? '',
      Num_Ordem: payload.numOrdem ?? undefined,
      Num_Sequencia: payload.numSequencia ?? undefined,
      Encerrar_OS: payload.encerrarOS ?? false,
      Codigo_CTrab: payload.codigoCTrab ?? '',
      Data_Servico: payload.dataServico ?? '',
      Hora_Inicio: payload.horaInicio ?? '',
      Hora_Fim: payload.horaFim ?? '',
      Tipo_Apont: payload.tipoApont ?? undefined,
      Id: payload.id ?? undefined,
      Usuario_Atual: payload.usuarioAtual ?? '',
    },
  );
};

// ============================================
// API: Finalizar Apontamento Mao de Obra
// ============================================
export const finalizarApontamentoMaoDeObraCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  params: {
    codigoEmpresa: number | string;
    numOrdem: number | string;
    idApont: number | string;
    horaFim: string;
    usuarioAtual: string;
    encerrarOS?: boolean;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ApontamentosMaoDeObra`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.PUT,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      codigoEmpresa: params.codigoEmpresa,
      numOrdem: params.numOrdem,
      idApont: params.idApont,
      horaFim: params.horaFim,
      usuarioAtual: params.usuarioAtual,
      encerrarOS: params.encerrarOS ?? false,
    },
  );
};

// ============================================
// API: Busca OF
// ============================================
export const buscaOFCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  codigoEmpresa: number,
  numOF: string,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/BuscaOF/${codigoEmpresa}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      Num_OF: numOF,
    },
  );
};

// ============================================
// API: Busca Operacao
// ============================================
export const buscaOperCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  params: {
    codigoProduto: string;
    numProcesso?: number;
    numRevisao?: number;
    numOperacao?: number;
    situacaoOF?: number;
    tipoApont?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/BuscaOper/${params.codigoProduto}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      Num_Processo: params.numProcesso,
      Num_Revisao: params.numRevisao,
      Num_Operacao: params.numOperacao,
      SituacaoOF: params.situacaoOF,
      Tipo_Apont: params.tipoApont ?? '',
    },
  );
};

// ============================================
// API: Busca Material
// ============================================
export const buscaMaterialCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  codDescMaterial?: string,
): Promise<ApiCallResponse> => {
  const filtro = codDescMaterial?.trim() || '';
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/BuscaMaterial/${filtro}`;
  return apiManager.makeApiCall(url, ApiCallType.GET, jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {});
};

// ============================================
// API: Motivo Rejeicao
// ============================================
export const listMotivoRejeicaoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/MotivoRejeicao`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Motivo Bloqueio
// ============================================
export const listMotivoBloqueioCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/MotivoBloqueio`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Motivo Demerito
// ============================================
export const listMotivoDemeritoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/MotivoDemerito`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Lista Inspetores
// ============================================
export const listaInspetoresCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/Inspetores`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Lista Equipamentos
// ============================================
export const listaEquipamentosCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  params: {
    numEquipamento?: string;
    exibeInativos?: boolean;
    exibeBloqueados?: boolean;
    exibeSucateados?: boolean;
    exibeIdentComponente?: boolean;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ListaEquipamentos/${params.numEquipamento ?? ''}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      Exibe_Inativos: params.exibeInativos,
      Exibe_Bloqueados: params.exibeBloqueados,
      Exibe_Sucateados: params.exibeSucateados,
      Exibe_Ident_Componente: params.exibeIdentComponente,
    },
  );
};

// ============================================
// API: Motivo Parada Máquina
// ============================================
export const listMotivoParadaMaquinaCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  params?: {
    codigoEmpresa?: number;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/MotivoParadaMaquina`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      Codigo_Empresa: params?.codigoEmpresa,
    },
  );
};

// ============================================
// API: Listar Paradas de Máquina
// ============================================
export const listParadasMaquinaCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  params: {
    codigoEmpresa?: number;
    numMaquina?: string;
    dataInicio?: string;
    dataFim?: string;
    usuario?: string;
    numOrdem?: string;
    origem?: number;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ParadasMaquina`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      Codigo_Empresa: params.codigoEmpresa,
      Num_Ordem: params.numOrdem ?? '',
      Data_Inicio: params.dataInicio ?? '',
      Data_Fim: params.dataFim ?? '',
      Num_Maquina: params.numMaquina ?? '',
      Usuario: params.usuario ?? '',
      Origem: params.origem ?? undefined,
    },
  );
};

// ============================================
// API: Incluir Parada Máquina Padrão
// ============================================
export const incluirParadaMaquinaPadraoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    codigoEmpresa?: number;
    numOrdem?: number;
    numMaquina?: string;
    dataInicio?: string;
    horaInicio?: string;
    dataFim?: string;
    horaFim?: string;
    codigoMotivo?: string;
    usuario?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ParadasMaquina/Padrao`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Codigo_Empresa: payload.codigoEmpresa,
      Num_Ordem: payload.numOrdem ?? 0,
      Num_Maquina: payload.numMaquina ?? '',
      Data_Inicio: payload.dataInicio ?? '',
      Hora_Inicio: payload.horaInicio ?? '',
      Data_Fim: payload.dataFim ?? '',
      Hora_Fim: payload.horaFim ?? '',
      Codigo_Motivo: payload.codigoMotivo ?? '',
      Usuario: payload.usuario ?? '',
    },
  );
};

// ============================================
// API: Incluir Parada Máquina Cronometro
// ============================================
export const incluirParadaMaquinaCronometroCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    codigoEmpresa?: number;
    numOrdem?: number;
    numMaquina?: string;
    codigoMotivo?: string;
    usuario?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ParadasMaquina/Cronometro`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Codigo_Empresa: payload.codigoEmpresa,
      Num_Ordem: payload.numOrdem ?? 0,
      Num_Maquina: payload.numMaquina ?? '',
      Codigo_Motivo: payload.codigoMotivo ?? '',
      Usuario: payload.usuario ?? '',
    },
  );
};

// ============================================
// API: Alterar Parada Máquina Cronometro (Concluir)
// ============================================
export const alterarParadaMaquinaCronometroCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    codigoEmpresa?: number;
    numOrdem?: string;
    usuario?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ParadasMaquina`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.PUT,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Codigo_Empresa: payload.codigoEmpresa,
      Num_Ordem: payload.numOrdem ?? '',
      Usuario: payload.usuario ?? '',
    },
  );
};

// ============================================
// API: Incluir Apontamento Producao Padrao
// ============================================
export const incluirApontProdPadraoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    codigoEmpresa?: number;
    numApontamento?: number;
    numOrdem?: string;
    numOperacao?: number;
    numMaquina?: string;
    numRegistro?: string;
    dataInicio?: string;
    horaInicio?: string;
    dataFim?: string;
    horaFim?: string;
    codigoMotivo?: string;
    codigoBloqueio?: string;
    usuario?: string;
    qtdProduzida?: string;
    qtdRejeitada?: string;
    permitirApontamentoSemOperacao?: boolean;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ApontamentosProducao/Padrao`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Codigo_Empresa: payload.codigoEmpresa,
      Num_Apontamento: payload.numApontamento ?? 0,
      Num_Ordem: payload.numOrdem,
      Num_Operacao: payload.numOperacao,
      Num_Maquina: payload.numMaquina ?? '',
      Num_Registro: payload.numRegistro ?? '',
      Data_Inicio: payload.dataInicio ?? '',
      Hora_Inicio: payload.horaInicio ?? '',
      Data_Fim: payload.dataFim ?? '',
      Hora_Fim: payload.horaFim ?? '',
      Codigo_Motivo: payload.codigoMotivo ?? '',
      Codigo_Bloqueio: payload.codigoBloqueio ?? '',
      Usuario: payload.usuario ?? '',
      Qtd_Produzida: payload.qtdProduzida ?? '0',
      Qtd_Rejeitada: payload.qtdRejeitada ?? '0',
      Permitir_Apontamento_Sem_Operacao: payload.permitirApontamentoSemOperacao ? 1 : 0,
      Validar_Operacao: payload.permitirApontamentoSemOperacao ? 0 : 1,
    },
  );
};

// ============================================
// API: Incluir Apontamento Producao Cronometro
// ============================================
export const incluirApontProdCronometroCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    codigoEmpresa?: number;
    numOrdem?: string;
    numOperacao?: number;
    numMaquina?: string;
    numRegistro?: string;
    usuario?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ApontamentosProducao/Cronometro`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Codigo_Empresa: payload.codigoEmpresa,
      Num_Ordem: payload.numOrdem ?? '',
      Num_Operacao: payload.numOperacao,
      Num_Maquina: payload.numMaquina ?? '',
      Num_Registro: payload.numRegistro ?? '',
      Usuario: payload.usuario ?? '',
    },
  );
};

// ============================================
// API: Alterar Apontamento Producao Cronometro (Concluir)
// ============================================
export const alterarApontProdCronometroCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    codigoEmpresa?: number;
    numApontamento?: number;
    numOrdem?: string;
    codigoMotivo?: string;
    codigoBloqueio?: string;
    qtdProduzida?: string;
    qtdRejeitada?: string;
    usuario?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ApontamentosProducao`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.PUT,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Codigo_Empresa: payload.codigoEmpresa,
      Num_Apontamento: payload.numApontamento ?? 0,
      Num_Ordem: payload.numOrdem ?? '',
      Codigo_Motivo: payload.codigoMotivo ?? '',
      Codigo_Bloqueio: payload.codigoBloqueio ?? '',
      Qtd_Produzida: payload.qtdProduzida ?? '0',
      Qtd_Rejeitada: payload.qtdRejeitada ?? '0',
      Usuario: payload.usuario ?? '',
    },
  );
};

// ============================================
// API: Incluir Preparacao de Maquina
// ============================================
export const incluirPreparacaoMaquinaCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    codigoEmpresa?: number;
    numOrdem?: string;
    numOperacao?: number;
    dataInicSetup?: string;
    horaInicSetup?: string;
    dataFimSetup?: string;
    horaFimSetup?: string;
    numRegistro?: string;
    numMaquina?: string;
    usuario?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/PreparacaoMaquina`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Codigo_Empresa: payload.codigoEmpresa,
      Num_Ordem: payload.numOrdem ?? '',
      Num_Operacao: payload.numOperacao,
      Data_Inic_Setup: payload.dataInicSetup ?? '',
      Hora_Inic_Setup: payload.horaInicSetup ?? '',
      Data_Fim_Setup: payload.dataFimSetup ?? '',
      Hora_Fim_Setup: payload.horaFimSetup ?? '',
      Num_Registro: payload.numRegistro ?? '',
      Num_Maquina: payload.numMaquina ?? '',
      Usuario: payload.usuario ?? '',
    },
  );
};

// ============================================
// API: List Preparacao Maquina
// ============================================
export const listPreparacaoMaquinaCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  params: {
    codigoEmpresa?: number;
    numOrdem?: string;
    dataInicio?: string;
    dataFim?: string;
    numMaquina?: string;
    situacaoOF?: number;
    usuario?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/PreparacaoMaquina`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      Codigo_Empresa: params.codigoEmpresa,
      Num_Ordem: params.numOrdem ?? '',
      Data_Inicio: params.dataInicio ?? '',
      Data_Fim: params.dataFim ?? '',
      Num_Maquina: params.numMaquina ?? '',
      SituacaoOF: params.situacaoOF,
      Usuario: params.usuario ?? '',
    },
  );
};


// ============================================
// API: Empresa
// ============================================
export const empresaCall = async (
  url: string,
  codigoEmpresa: string,
  jwtToken: string
): Promise<ApiCallResponse> => {
  return apiManager.makeApiCall(
    `${url}/api/v1/empresas/${codigoEmpresa}`,
    ApiCallType.GET,
    {
      'Authorization': `Bearer ${jwtToken}`,
    }
  );
};

// ============================================
// API: List Preparacao Maquina Equipamentos
// ============================================
export const listPreparacaoMaquinaEquipCall = async (
  url: string,
  codigoEmpresa: number,
  numOrdem: string,
  numOperacao: number,
  numApont: number,
  jwtToken: string
): Promise<ApiCallResponse> => {
  return apiManager.makeApiCall(
    `${url}/api/v1/PreparacaoMaquina/Equipamentos`,
    ApiCallType.GET,
    {
      'Authorization': `Bearer ${jwtToken}`,
    },
    {
      'Codigo_Empresa': codigoEmpresa,
      'Num_Ordem': numOrdem,
      'Num_Operacao': numOperacao,
      'Num_Apont': numApont,
    }
  );
};

// ============================================
// API: Deletar Usuario Transacao Sistema
// ============================================
export const deletarUsuarioTransacaoSistemaCall = async (
  url: string,
  jwtToken: string,
  codigoUsuario: string,
  codigoTransacao: string
): Promise<ApiCallResponse> => {
  return apiManager.makeApiCall(
    `${url}/api/v1/DeletarUsuarioTransacaoSistema/${codigoUsuario}/${codigoTransacao}`,
    ApiCallType.DELETE,
    {
      'Authorization': `Bearer ${jwtToken}`,
    },
    {
      'codigoUsuario': codigoUsuario,
      'codigoTransacao': codigoTransacao,
    }
  );
};

// ============================================
// API: Health Check (/api/v1/url)
// ============================================
export const healthCheckCall = async (baseUrl: string): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/url`;
  return apiManager.makeApiCall(url, ApiCallType.GET);
};

// ============================================
// API: Token
// ============================================
export const tokenCall = async (
  baseUrl: string,
  params: TokenParams,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/token`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    {},
    {
      Usuario: params.usuario ?? '',
      Codigo_Empresa: params.codigoEmpresa ?? 0,
      Nome_Empresa: params.nomeEmpresa ?? '',
      Chave_Api: params.chaveApi ?? '',
      IdGuid: params.idGuid ?? '',
      Tipo: params.tipo ?? 1,
      RetornarComoXml: params.retornarComoXml ?? false,
    },
  );
};

// ============================================
// API: Consulta Licenca
// ============================================
export const consultaLicencaCall = async (
  baseUrl: string,
  token: string | undefined,
  idLicenca?: number,
  numHD?: string,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ConsultaLicencaSistema`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    token ? { Authorization: `Bearer ${token}` } : {},
    { idLicenca, numHD: numHD },
  );
};

// ============================================
// API: Adicionar Licenca
// ============================================
export const adicionarLicencaCall = async (
  baseUrl: string,
  token: string | undefined,
  payload: LicencaPayload,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/AdicionarLicencaSistema`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    token ? { Authorization: `Bearer ${token}` } : {},
    {},
    payload,
  );
};

// ============================================
// API: Buscar Numero HD
// ============================================
export const buscarNumeroHDCall = async (
  baseUrl: string,
  token: string | undefined,
  retornarComoXml?: boolean,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/BuscarNumeroHD`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    token ? { Authorization: `Bearer ${token}` } : {},
    { RetornarComoXml: retornarComoXml },
  );
};

// ============================================
// API: Verifica Versao
// ============================================
export const verificaVersaoCall = async (
  baseUrl: string,
  token: string | undefined,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/VerificaVersao`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    token ? { Authorization: `Bearer ${token}` } : {},
  );
};

// ============================================
// API: Login (gera sessão)
// ============================================
export const loginCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  usuario: string,
  senha: string,
): Promise<ApiCallResponse<LoginResponse>> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/login`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    { usuario, senha },
  );
};

// ============================================
// API: Login por usuário (lista empresas)
// ============================================
export const loginUsuarioCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  usuario: string,
): Promise<ApiCallResponse<LoginResponse>> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/login/${usuario}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Usuários (detalhe)
// ============================================
export const usuarioDetalheCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  usuario: string,
): Promise<ApiCallResponse<UsuarioDetalheResponse>> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/usuarios/${usuario}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Adicionar Sessao Sistema
// ============================================
export const adicionarSessaoSistemaCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: AdicionarSessaoSistemaPayload,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/AdicionarSessaoSistema`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    payload,
  );
};

// ============================================
// API: Obter Usuarios Transacoes Sistema
// ============================================
export const obterUsuariosTransacoesSistemaCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  codigoUsuario: string,
  codigoTransacao: string | null,
  menu: boolean,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ObterUsuariosTransacoesSistema`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      codigousuario: codigoUsuario,
      codigotransacao: codigoTransacao ?? '',
      menu,
    },
  );
};

// ============================================
// API: Lista Clientes
// ============================================
export const listaClientesCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  params: {
    codigoUsuario: string;
    codigoCliente?: number | null;
    filtro?: string;
    nivel?: string | number;
  },
): Promise<ApiCallResponse> => {
  const codigoCliente = params.codigoCliente == null ? '' : String(params.codigoCliente);
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ListaCliente/${params.codigoUsuario}/${codigoCliente}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      filtro: params.filtro ?? '',
      Nivel: params.nivel ?? '',
    },
  );
};

// ============================================
// API: Clientes (v1)
// ============================================
export const listaClientesV1Call = async (
  baseUrl: string,
  jwtToken: string | undefined,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/Clientes`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Lista Unidade Medida
// ============================================
export const listaUnidadeMedidaCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ListaUnidadeMedida`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Lista Maquinas
// ============================================
export const listaMaquinasCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ListaMaquinas`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Listar Ordens de Manutencao
// ============================================
export const listOrdensManutCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  params: {
    tipo: number;
    codigoEmpresa: number | string;
    codigoUsuario?: string;
    numOrdem?: string;
    numIdent?: string;
    dataInicio?: string;
    dataFim?: string;
    situacaoOrdem?: number;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/OrdensManut`
    + `?tipo=${encodeURIComponent(String(params.tipo ?? 2))}`
    + `&codigo_usuario=${encodeURIComponent(String(params.codigoUsuario ?? ''))}`
    + `&num_Ordem=${encodeURIComponent(String(params.numOrdem ?? ''))}`
    + `&num_ident=${encodeURIComponent(String(params.numIdent ?? ''))}`
    + `&codigo_empresa=${encodeURIComponent(String(params.codigoEmpresa ?? ''))}`
    + `&Data_Inicio=${encodeURIComponent(String(params.dataInicio ?? ''))}`
    + `&Data_Fim=${encodeURIComponent(String(params.dataFim ?? ''))}`
    + `&situacao_ordem=${encodeURIComponent(String(params.situacaoOrdem ?? 99))}`;

  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Incluir Ficha de Inspecao
// ============================================
export const incluirFichaInspecaoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    codigoEmpresa?: number;
    usuarioAtual?: string;
    codigoLote?: string;
    dataInspecao?: string;
    codigoInspetor?: number;
    tipoLaudo?: string;
    obsInspecao?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/LaudosDeInspecao`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Codigo_Empresa: payload.codigoEmpresa,
      Usuario_Atual: payload.usuarioAtual ?? '',
      Codigo_Lote: payload.codigoLote ?? '',
      Data_Inspecao: payload.dataInspecao ?? '',
      Codigo_Inspetor: payload.codigoInspetor ?? 0,
      Tipo_Laudo: payload.tipoLaudo ?? '',
      Obs_Inspecao: payload.obsInspecao ?? '',
    },
  );
};

// ============================================
// API: Alterar Laudo de Inspecao
// ============================================
export const alterarLaudoInspecaoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    tipoLaudo?: string;
    tipoAcao?: string;
    unidadeMedida?: string;
    codigoEmpresa?: number;
    usuarioAtual?: string;
    dataConfirmacao?: string;
    numLaudo?: number;
    qtdAprovada?: number | null;
    qtdReprovada?: number | null;
    qtdDestruida?: number | null;
    codigoInspetor?: number | null;
    motivoBloqueio?: number | null;
    motivoSucata?: number | null;
    codigoDemerito?: number | null;
    observacaoConfirmacao?: string;
    resultadosItensJson?: any;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/LaudosDeInspecao/AlterarLaudo/${payload.tipoAcao ?? ''}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.PUT,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Tipo_Laudo: payload.tipoLaudo ?? '',
      Unidade_Medida: payload.unidadeMedida ?? '',
      Codigo_Empresa: payload.codigoEmpresa,
      Usuario_Atual: payload.usuarioAtual ?? '',
      Data_Confirmacao: payload.dataConfirmacao ?? '',
      Num_Laudo: payload.numLaudo ?? 0,
      Qtd_Aprovada: payload.qtdAprovada ?? null,
      Qtd_Reprovada: payload.qtdReprovada ?? null,
      Qtd_Destruida: payload.qtdDestruida ?? null,
      Codigo_Inspetor: payload.codigoInspetor ?? null,
      Motivo_Bloqueio: payload.motivoBloqueio ?? null,
      Motivo_Sucata: payload.motivoSucata ?? null,
      Codigo_Demerito: payload.codigoDemerito ?? null,
      Observacao_Confirmacao: payload.observacaoConfirmacao ?? '',
      Resultados_Itens: payload.resultadosItensJson ?? null,
    },
  );
};

// ============================================
// API: Incluir Valores Laudo Inspecao
// ============================================
export const incluirValoresLaudoInspecaoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    valoresMedicaoList?: string[];
    codigoEmpresa?: number;
    numLaudo?: number;
    numItem?: number;
    usuarioAtual?: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/LaudosDeInspecao/AdicionarValoresLaudo`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Codigo_Empresa: payload.codigoEmpresa,
      Usuario_Atual: payload.usuarioAtual ?? '',
      Codigo_Lote: '',
      Data_Inspecao: '',
      Codigo_Inspetor: 0,
      Tipo_Laudo: '',
      Obs_Inspecao: '',
      Num_Laudo: payload.numLaudo ?? 0,
      Num_Item: payload.numItem ?? 0,
      Valores_Medicao: payload.valoresMedicaoList ?? [],
    },
  );
};

// ============================================
// API: Incluir Ordem de Manutencao
// ============================================
export const incluirOrdemManutCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    codigoEmpresa: number | string;
    numIdent: string;
    abertoPor: string;
    motivoAbertura: string;
    prioridade: string;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/OrdensManut`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Codigo_Empresa: payload.codigoEmpresa,
      Num_Ident: payload.numIdent,
      Aberto_Por: payload.abertoPor,
      Motivo_Abertura: payload.motivoAbertura,
      Prioridade: payload.prioridade,
    },
  );
};

// ============================================
// API: Consultar CEP
// ============================================
export const consultarCepCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  cep: string,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/ConsultaCep/${cep}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
  );
};

// ============================================
// API: Incluir Cliente
// ============================================
export const incluirClienteCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    codigoEmpresa?: number | string | null;
    razaoSocial: string;
    nomeFantasia: string;
    cepEntrega: string;
    endereco: string;
    estado: string;
    bairro: string;
    numero: string;
    complemento: string;
    fisicaJuridica: 'Física' | 'Jurídica';
    cgcCpf: string;
    numTelefone: string;
    enderecoEletronico: string;
    ibge: number | null;
    cidade: string;
  },
): Promise<ApiCallResponse> => {
  const toNullable = (value: string) => {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : null;
  };

  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/CadastrarCliente`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Codigo_Empresa: payload.codigoEmpresa ?? null,
      Razao_Social: payload.razaoSocial,
      Nome_Fantasia: payload.nomeFantasia,
      CEP: payload.cepEntrega,
      Endereco: payload.endereco,
      UF: payload.estado,
      Bairro: payload.bairro,
      Numero: payload.numero,
      Complemento: toNullable(payload.complemento),
      IBGE: payload.ibge,
      Cidade: payload.cidade,
      FisJur: payload.fisicaJuridica,
      CnpjCpf: toNullable(payload.cgcCpf),
      Telefone: toNullable(payload.numTelefone),
      Email: toNullable(payload.enderecoEletronico),
    },
  );
};

// ============================================
// API: Pedidos de Venda
// ============================================
export const pedidosVendaCall = async (
  baseUrl: string,
  params: PedidosVendaParams,
  jwtToken?: string,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/PedidosVenda`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      Tipo: params.tipo,
      Num_Pedido: params.codigoPedido,
      Codigo_Empresa: params.codigoEmpresa,
      Data_De: params.dataDe,
      Data_Ate: params.dataAte,
      Situacao_Pedido: params.situacao,
      Emitente: params.emitente,
      Nivel_Usuario: params.nivelUsuario,
      Cliente: params.cliente,
      Vendedor: params.vendedor,
    },
  );
};

// ============================================
// API: Pedidos de Compra (Listagem)
// ============================================
export const listPedidosCompraCall = async (
  baseUrl: string,
  params: ListPedidoCompraParams,
  jwtToken?: string,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/PedidosCompraPendentes/${params.codigoEmpresa}`;
  return apiManager.makeApiCall(url, ApiCallType.GET, jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {});
};

// ============================================
// API: Pedidos de Compra (Liberar/Estornar)
// ============================================
export const pedidoCompraPutCall = async (
  baseUrl: string,
  params: {
    numPedido: string | number;
    codigoEmpresa: string | number;
    tipoAcao: string | number;
    tipoPedido?: string | number;
    usuario?: string;
    senha?: string;
  },
  jwtToken?: string,
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/PedidosCompra/${params.numPedido}`
    + `?Codigo_Empresa=${params.codigoEmpresa}`
    + `&Tipo_Acao=${params.tipoAcao}`
    + `&Tipo_Pedido=${params.tipoPedido ?? ''}`
    + `&Usuario=${params.usuario ?? ''}`
    + `&Senha=${params.senha ?? ''}`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.PUT,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
  );
};

// ============================================
// API: Inserir ou Atualizar Transacao
// ============================================
export const inserirOuAtualizarTransacaoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  licencaTransacaoViewModel: LicencaTransacaoModel[],
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/InserirOuAtualizarTransacao`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    { LicencaTransacaoViewModel: licencaTransacaoViewModel },
  );
};

// ============================================
// API: Inserir Transacoes Sistema Acao
// ============================================
export const inserirTransacoesSistemaAcaoCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  transacoesAcao: any[],
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/InserirTransacoesSistemaAcao`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    { transacoesAcao },
  );
};

// ============================================
// API: List Notificações
// ============================================
export const alterarNotificacaoCall = async (
  url: string,
  jwtToken: string,
  codigoEmpresa: number,
  codigoUsuario: string,
  idNotificacao: number,
): Promise<ApiCallResponse> => {
  return apiManager.makeApiCall(
    `${url}/api/v1/Notificações`,
    ApiCallType.PUT,
    { 'Authorization': `Bearer ${jwtToken}` },
    {},
    {
      Codigo_Empresa: codigoEmpresa,
      Codigo_Usuario: codigoUsuario,
      ID_Notificacao: idNotificacao,
    },
  );
};

export const listNotificacoesCall = async (
  url: string,
  codigoEmpresa: number,
  codigoUsuario: string,
  jwtToken: string,
  naoLidas?: boolean
): Promise<ApiCallResponse> => {
  return apiManager.makeApiCall(
    `${url}/api/v1/Notificações`,
    ApiCallType.GET,
    {
      'Authorization': `Bearer ${jwtToken}`,
    },
    {
      'Codigo_Empresa': codigoEmpresa,
      'Codigo_Usuario': codigoUsuario,
      'Nao_Lidas': naoLidas !== undefined ? naoLidas : true,
    }
  );
};

// ============================================
// API: Logout
// ============================================
export const logoutCall = async (
  url: string,
  codigoEmpresa: number,
  idSessao: number,
  jwtToken: string
): Promise<ApiCallResponse> => {
  return apiManager.makeApiCall(
    `${url}/api/v1/Logout/?CodigoEmpresa=${codigoEmpresa}&IdSessao=${idSessao}`,
    ApiCallType.PUT,
    {
      'Authorization': `Bearer ${jwtToken}`,
    },
    {}
  );
};

// ============================================
// API: Busca Sessão Usuário
// ============================================
export const buscaSessaoUsuarioCall = async (
  url: string,
  jwtToken: string,
  idSessao: number
): Promise<ApiCallResponse> => {
  return apiManager.makeApiCall(
    `${url}/api/v1/sessao/${idSessao}`,
    ApiCallType.GET,
    {
      'Authorization': `Bearer ${jwtToken}`,
    }
  );
};

// ============================================
// API: Busca Sessões
// ============================================
export const buscaSessoesCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  params: {
    codigoUsuario?: string;
    idSistema?: number;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/Sessoes`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.GET,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {
      Codigo_Usuario: params.codigoUsuario ?? '',
      Id_Sistema: params.idSistema ?? 1,
    },
  );
};

// ============================================
// API: Adicionar Usuario Sistema Log
// ============================================
export const adicionarUsuarioSistemaLogCall = async (
  baseUrl: string,
  jwtToken: string | undefined,
  payload: {
    usuario: string;
    menu: string;
    acao: string;
    codigoTransacao?: string;
    nomeCampo?: string;
    valorAntigo?: string;
    valorNovo?: string;
    idTransacao?: number;
  },
): Promise<ApiCallResponse> => {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/AdicionarUsuarioSistemaLog`;
  return apiManager.makeApiCall(
    url,
    ApiCallType.POST,
    jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    {},
    {
      Usuario: payload.usuario,
      Menu: payload.menu,
      Acao: payload.acao,
      ID_Transacao: payload.idTransacao,
      Codigo_Transacao: payload.codigoTransacao ?? '',
      Nome_Campo: payload.nomeCampo ?? '',
      Valor_Antigo: payload.valorAntigo ?? '',
      Valor_Novo: payload.valorNovo ?? '',
    },
  );
};

// ============================================
// API: Teste URL (Health Check)
// ============================================
export const testeUrlCall = async (url: string): Promise<ApiCallResponse> => {
  return apiManager.makeApiCall(
    `${url}/api/v1/url`,
    ApiCallType.GET,
    {},
    {}
  );
};

// ============================================
// TEMPLATE: Adicione mais APIs aqui seguindo o padrão acima
// ============================================

/*
EXEMPLO DE COMO ADICIONAR NOVA API:

export const minhaNovaApiCall = async (
  url: string,
  parametro1: string,
  parametro2: number,
  jwtToken: string
): Promise<ApiCallResponse> => {
  return apiManager.makeApiCall(
    `${url}/api/v1/endpoint`,
    ApiCallType.GET, // ou POST, PUT, DELETE, PATCH
    {
      'Authorization': `Bearer ${jwtToken}`,
      // outros headers aqui
    },
    {
      'param1': parametro1,
      'param2': parametro2,
      // outros params aqui
    },
    // body (para POST/PUT/PATCH)
    // { campo: valor }
  );
};
*/

export default {
  empresaCall,
  listPreparacaoMaquinaEquipCall,
  deletarUsuarioTransacaoSistemaCall,
  healthCheckCall,
  tokenCall,
  consultaLicencaCall,
  adicionarLicencaCall,
  buscarNumeroHDCall,
  verificaVersaoCall,
  pedidosVendaCall,
  listPedidosCompraCall,
  pedidoCompraPutCall,
  inserirOuAtualizarTransacaoCall,
  inserirTransacoesSistemaAcaoCall,
  obterUsuariosTransacoesSistemaAcaoCall,
  acoesUsuariosCall,
  listUsuariosCall,
  alterarParamUsuariosCall,
  obterTransacoesSistemaCall,
  obterTransacoesSistemaAcaoCall,
  adicionarUsuariosTransacoesSistemaCall,
  adicionarUsuariosTransacoesSistemaAcaoCall,
  deletarUsuarioTransacaoSistemaAcaoCall,
  listaVendedoresCall,
  listaRepresentantesCall,
  listaClientesCall,
  listaClientesV1Call,
  listaUnidadeMedidaCall,
  listaCondicaoPagtoCall,
  listaTransportadorasCall,
  listApontamentosProducaoCall,
  listApontamentoMaoDeObraCall,
  listOrdensServicosCall,
  incluirOrdemServicoCall,
  incluirApontamentoMaoDeObraCall,
  finalizarApontamentoMaoDeObraCall,
  listaTipoOrdemServicoCall,
  listaCentroCustoCall,
  listaFuncionariosCall,
  listaCentroTrabalhoCall,
  buscaFuncionarioCall,
  listaMaquinasCall,
  buscaOFCall,
  buscaOperCall,
  buscaMaterialCall,
  listMotivoRejeicaoCall,
  listMotivoBloqueioCall,
  listMotivoDemeritoCall,
  listMotivoParadaMaquinaCall,
  listParadasMaquinaCall,
  listaInspetoresCall,
  listaEquipamentosCall,
  incluirFichaInspecaoCall,
  alterarLaudoInspecaoCall,
  incluirValoresLaudoInspecaoCall,
  incluirParadaMaquinaPadraoCall,
  incluirParadaMaquinaCronometroCall,
  alterarParadaMaquinaCronometroCall,
  incluirApontProdPadraoCall,
  incluirApontProdCronometroCall,
  alterarApontProdCronometroCall,
  incluirPreparacaoMaquinaCall,
  listPreparacaoMaquinaCall,
  listNotificacoesCall,
  alterarNotificacaoCall,
  buscaSessaoUsuarioCall,
  testeUrlCall,
  logoutCall,
  buscaSessoesCall,
  adicionarUsuarioSistemaLogCall,
};
