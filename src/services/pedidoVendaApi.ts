import { GlobalConfig } from './globalConfig';

export interface PedidoVenda {
  num_Pedido: number;
  data_Pedido: string;
  codigo_Cliente: number;
  nome_Cliente: string;
  codigo_Vendedor: number;
  nome_Vendedor: string;
  valor_Total: number;
  situacao: string;
  observacoes?: string;
  nome_Fantasia?: string;
  destinoPedido?: string;
  totalPrecoItens?: string;
  Itens_Pedido?: any[];
}

export type ItemPlanilhaExcel = {
  Codigo_Produto: string;
  Qtd_Produto: number;
};

export type ItensPlanilhaExcelRequest = {
  Codigo_Empresa: number;
  Codigo_Tabela: string;
  Codigo_Cliente: number;
  Condicao_Pagto: number;
  Codigo_Vendedor: number;
  Perc_Desconto?: number;
  Perc_Desconto_Pedido?: number;
  Valor_Frete?: number;
  Tipo_Pedido: number;
  Codigo_Transportadora: number;
  Frete_Por_Conta: number;
  Destino_Pedido: string;
  Codigo_Emitente: string;
  Situacao_Pedido: number;
  Pedido_Cliente: string;
  Data_Entrega: string;
  Itens_Planilha: ItemPlanilhaExcel[];
};

export const getPedidoVendaForEdit = async (
  numPedido: number | string,
  options?: { isRepresentantes?: boolean; situacaoPedido?: string },
): Promise<any> => {
  const baseUrl = GlobalConfig.getBaseUrl();
  const jwToken = GlobalConfig.getJwToken();
  const codigoEmpresa = GlobalConfig.getCodEmpresa();
  const nivelUsuario = Number(GlobalConfig.getNivelUsuario() ?? 0);
  const emitente = GlobalConfig.getUsuario() || '';
  const isRepresentantes = Boolean(options?.isRepresentantes);
  const tipoPedidoVenda = isRepresentantes ? 2 : 1;
  const situacaoPedido = String(options?.situacaoPedido ?? (isRepresentantes ? 'Elaboração' : 'Todos')).trim();
  const includeEmitente = isRepresentantes && nivelUsuario !== 9;
  const today = new Date();
  const dataHoje = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const queryParams = new URLSearchParams({
    Num_Pedido: String(numPedido ?? ''),
    Codigo_Empresa: String(codigoEmpresa ?? ''),
    Data_De: isRepresentantes ? '' : dataHoje,
    Data_Ate: isRepresentantes ? '' : dataHoje,
    Situacao_Pedido: situacaoPedido || (isRepresentantes ? 'Elaboração' : 'Todos'),
    Codigo_Cliente: '',
    Codigo_Vendedor: '',
    Emitente: includeEmitente ? emitente : '',
    Nivel_Usuario: String(nivelUsuario),
    Tipo_Pedido_Venda: String(tipoPedidoVenda),
  });

  const response = await fetch(`${baseUrl}/api/v1/PedidosVenda?${queryParams}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Erro ao buscar pedido para edição: ${text}`);
  }

  return response.json();
};

export const listPedidosVenda = async (params: {
  tipo?: number;
  tipoPedidoVenda?: number;
  numPedido?: string;
  dataDe?: string;
  dataAte?: string;
  situacaoPedido?: string;
  codigoCliente?: string;
  codigoVendedor?: string;
  emitente?: string;
}): Promise<any> => {
  const baseUrl = GlobalConfig.getBaseUrl();
  const jwToken = GlobalConfig.getJwToken();
  const codigoEmpresa = GlobalConfig.getCodEmpresa();
  const nivelUsuario = GlobalConfig.getNivelUsuario();

  const queryParams = new URLSearchParams({
    ...(params.tipo && { Tipo: params.tipo.toString() }),
    ...(params.tipoPedidoVenda && { Tipo_Pedido_Venda: params.tipoPedidoVenda.toString() }),
    ...(params.numPedido && { Num_Pedido: params.numPedido }),
    Codigo_Empresa: codigoEmpresa?.toString() || '',
    ...(params.dataDe && { Data_De: params.dataDe }),
    ...(params.dataAte && { Data_Ate: params.dataAte }),
    ...(params.situacaoPedido && { Situacao_Pedido: params.situacaoPedido }),
    ...(params.codigoCliente && { Codigo_Cliente: params.codigoCliente }),
    ...(params.codigoVendedor && { Codigo_Vendedor: params.codigoVendedor }),
    ...(params.emitente && { Emitente: params.emitente }),
    ...(params.emitente && { Codigo_Emitente: params.emitente }),
  });

  const nivelStr = nivelUsuario?.toString() || '0';
  queryParams.set('Nivel_Usuario', nivelStr);
  queryParams.set('NivelUsuario', nivelStr);

  const response = await fetch(`${baseUrl}/api/v1/PedidosVenda?${queryParams}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    let apiMessage = '';
    try {
      const payload = await response.json();
      apiMessage = String(payload?.message ?? payload?.Message ?? '').trim();
    } catch {
      const text = await response.text().catch(() => '');
      apiMessage = String(text || '').trim();
    }

    if (apiMessage && apiMessage.toLowerCase().includes('nenhum pedido de venda encontrado')) {
      return { data: [], message: apiMessage };
    }

    throw new Error(apiMessage || `Erro ao listar pedidos: ${response.statusText}`);
  }

  return response.json();
};

export const incluirPedidoVenda = async (pedido: any): Promise<any> => {
  const baseUrl = GlobalConfig.getBaseUrl();
  const jwToken = GlobalConfig.getJwToken();

  const response = await fetch(`${baseUrl}/api/v1/PedidosVenda`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pedido),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Erro ao incluir pedido: ${text}`);
  }

  return response.json();
};

export const validarItensPlanilhaExcel = async (payload: ItensPlanilhaExcelRequest): Promise<any> => {
  const baseUrl = GlobalConfig.getBaseUrl();
  const jwToken = GlobalConfig.getJwToken();

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/ValidarItensPlanilhaExcel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = '';
    try {
      const body = await response.json();
      message = String(body?.message ?? body?.Message ?? '').trim();
    } catch {
      const text = await response.text().catch(() => response.statusText);
      message = String(text || '').trim();
    }
    throw new Error(message || `Erro ao validar planilha: ${response.statusText}`);
  }

  return response.json();
};

export const alterarPedidoVenda = async (
  pedido: any,
  numPedido?: number | string,
): Promise<any> => {
  const baseUrl = GlobalConfig.getBaseUrl();
  const jwToken = GlobalConfig.getJwToken();

  let url = `${baseUrl.replace(/\/$/, '')}/api/v1/PedidosVenda`;
  if (typeof numPedido !== 'undefined' && numPedido !== null && numPedido !== '') {
    url = `${url}/${encodeURIComponent(String(numPedido))}`;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${jwToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pedido),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Erro ao alterar pedido: ${text}`);
  }

  return response.json();
};

export const duplicarPedidoVenda = async (
  numPedido: number,
  payload?: { Codigo_Empresa?: number | string; [key: string]: any },
): Promise<any> => {
  const baseUrl = GlobalConfig.getBaseUrl();
  const jwToken = GlobalConfig.getJwToken();
  const body = payload ?? { Codigo_Empresa: GlobalConfig.getCodEmpresa() };

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/DuplicaPedidoVenda/${numPedido}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Erro ao duplicar pedido: ${text}`);
  }

  return response.json();
};

export const deletarPedidoVenda = async (
  numPedido: number,
  codigoEmpresa?: number | string,
  codigoUsuario?: string,
  material?: string | null,
  numItem?: number,
): Promise<any> => {
  const baseUrl = GlobalConfig.getBaseUrl();
  const jwToken = GlobalConfig.getJwToken();
  const codigoEmpresaFinal = codigoEmpresa ?? GlobalConfig.getCodEmpresa();

  const url = new URL(`${baseUrl.replace(/\/$/, '')}/api/v1/PedidosVenda/${numPedido}`);
  url.searchParams.append('Codigo_Empresa', String(codigoEmpresaFinal ?? ''));
  if (codigoUsuario || GlobalConfig.getUsuario()) {
    url.searchParams.append('codigoUsuario', String(codigoUsuario ?? GlobalConfig.getUsuario() ?? ''));
  }
  if (material) url.searchParams.append('material', String(material));
  if (typeof numItem === 'number' && !Number.isNaN(numItem)) {
    url.searchParams.append('numItem', String(numItem));
  }

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${jwToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    let message = String(text || '').trim();

    if (message.startsWith('{')) {
      try {
        const payload = JSON.parse(message);
        const parsedMessage = String(payload?.message ?? payload?.Message ?? '').trim();
        if (parsedMessage) {
          message = parsedMessage;
        }
      } catch {
        // keep original text when payload is not valid JSON
      }
    }

    throw new Error(message || 'Erro ao deletar pedido.');
  }

  return response.json();
};
