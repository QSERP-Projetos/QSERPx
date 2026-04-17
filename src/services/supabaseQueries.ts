import { supabase } from './supabase';

export type LicencaParams = {
  idCliente?: string;
  idLicenca?: string;
};

export type LicencaTransacaoAcaoParams = {
  idLicenca?: string;
  idCliente?: string;
};

export type LicencaPorHdParams = {
  numeroHd: string;
  idSistema?: number;
};

export type LembretesQueryParams = {
  cnpjEmpresa: string;
  codigoUsuario: string;
};

export const buscaLicencaCliente = async ({ idCliente, idLicenca }: LicencaParams) => {
  const { data, error } = await supabase
    .from('licenca_transacao_view')
    .select('*')
    .match({
      ...(idCliente ? { id_cliente: idCliente } : {}),
      ...(idLicenca ? { id_licenca: idLicenca } : {}),
    });
  if (error) throw error;
  return data;
};

export const licencaTransacoesAcao = async ({ idLicenca, idCliente }: LicencaTransacaoAcaoParams) => {
  const { data, error } = await supabase
    .from('licenca_transacoes_acao_view')
    .select('id,id_transacao,codigo_acao,descricao_acao,id_cliente,id_licenca')
    .match({
      ...(idLicenca ? { id_licenca: idLicenca } : {}),
      ...(idCliente ? { id_cliente: idCliente } : {}),
    });
  if (error) throw error;
  return data;
};

export const transacaoAcao = async () => {
  const { data, error } = await supabase
    .from('licenca_transacoes_acao_view')
    .select('id,id_transacao,codigo_acao,descricao_acao');
  if (error) throw error;
  return data;
};

export const licencaPorHd = async ({ numeroHd, idSistema = 1 }: LicencaPorHdParams) => {
  const { data, error } = await supabase
    .from('licenca')
    .select('*')
    .match({ numero_hd: numeroHd, id_sistema: idSistema });
  if (error) throw error;
  return data;
};

// ============================================
// API: Buscar Lembretes do Supabase
// ============================================
export const buscarLembretesQS = async ({ cnpjEmpresa, codigoUsuario }: LembretesQueryParams) => {
  console.log('Query Lembretes - Params:', { cnpjEmpresa, codigoUsuario });

  const { data, error } = await supabase
    .from('lembretes')
    .select('*')
    .eq('cnpj_empresa', cnpjEmpresa)
    .eq('codigo_usuario', codigoUsuario)
    .order('data', { ascending: true });

  if (error) {
    console.error('Erro ao buscar lembretes:', error);
    return [];
  }

  console.log('Lembretes retornados:', data);
  return data || [];
};

// ============================================
// API: Buscar Notificações QS do Supabase
// ============================================
export const buscarNotificacoesQS = async () => {
  const { data, error } = await supabase
    .from('notificacao_QS')
    .select('*')
    .eq('publicado', true)
    .order('data_notificacao', { ascending: false });

  if (error) {
    console.error('Erro ao buscar notificações QS:', error);
    return [];
  }
  return data || [];
};

// ============================================
// API: Criar novo lembrete no Supabase
// ============================================
export const criarLembrete = async (lembrete: {
  titulo: string;
  conteudo: string;
  data: string;
  cnpj_empresa: string;
  codigo_usuario: string;
  cor: string;
}) => {
  const { data, error } = await supabase
    .from('lembretes')
    .insert([lembrete])
    .select();

  if (error) {
    console.error('Erro ao criar lembrete:', error);
    throw error;
  }
  return data;
};

// ============================================
// API: Deletar lembrete do Supabase
// ============================================
export const deleteLembrete = async (params: {
  id: number;
  cnpj_empresa: string;
  codigo_usuario: string;
}) => {
  const { error } = await supabase
    .from('lembretes')
    .delete()
    .match({
      id: params.id,
      cnpj_empresa: params.cnpj_empresa,
      codigo_usuario: params.codigo_usuario,
    });

  if (error) {
    console.error('Erro ao deletar lembrete:', error);
    throw error;
  }
  return true;
};

export default {
  buscaLicencaCliente,
  licencaTransacoesAcao,
  transacaoAcao,
  licencaPorHd,
  buscarLembretesQS,
  buscarNotificacoesQS,
  criarLembrete,
  deleteLembrete,
};
