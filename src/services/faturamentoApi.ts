import apiManager, { ApiCallType, type ApiCallResponse } from './apiManager';
import { GlobalConfig } from './globalConfig';

export interface SerieDisponivelDto {
  serieNf: string;
  numUltimaNf: number;
  proximoNumero: number;
  tipoNota: number;
  tipoNotaDescricao: string;
  imprimeNota?: number | null;
}

export interface ComboOptionDto {
  value: string;
  label: string;
}

export interface CfopPorCfoDto {
  codigoFiscal: string;
  tributacaoIcms: number;
  tributacaoIpi: number;
  tributacaoPisCofins: number;
  cfopRetorno: boolean;
  codigoCbenef?: string | null;
  cstIbsCbs?: string | null;
  classTribIbsCbs?: string | null;
  cstIs?: string | null;
  classTribIs?: string | null;
}

export interface NaturezaOperacaoFaturamentoDto {
  codigoCfo: string;
  descricaoCfo: string;
  entradaSaida: number;
  geraOperFinanc: boolean;
  icmsSobreFrete: boolean;
  icmsSobreIpi: boolean;
  tipoOperacao: number;
  atualizaEstoque: boolean;
  baixaPrograma: boolean;
  geraAvisoEmb: boolean;
  calcDiferencaAliqIcms: number;
  ipiSobreFrete: boolean;
  consumidorFinal: boolean;
  calculoFcp: number;
  tipoIpiDevolucao: number;
  informarTotais: boolean;
  primeiroCfop?: string | null;
  primeiroCfopRetorno?: string | null;
  qtdCfops: number;
  cfops: CfopPorCfoDto[];
}

export interface FaturamentoCombosDto {
  codigoEmpresa: number;
  contingenciaAtual: number;
  contingenciaMotivoAtual?: number | null;
  versaoNfe: string;
  superSimples: boolean;
  layoutReformaTributaria: boolean;
  somaValoresImposto: boolean;
  tipoDanfePadrao: number;
  ufEmpresa?: string | null;
  seriesNfe: SerieDisponivelDto[];
  seriesServico: SerieDisponivelDto[];
  naturezasSaida: NaturezaOperacaoFaturamentoDto[];
  naturezasEntrada: NaturezaOperacaoFaturamentoDto[];
  transportadoras: ComboOptionDto[];
  condicoesPagto: ComboOptionDto[];
  locaisEmbarque: ComboOptionDto[];
  motivosCancelamento: ComboOptionDto[];
  motivosContingencia: ComboOptionDto[];
  destinatarios: ComboOptionDto[];
}

export type AbaGerenciadorNfe = 'emitidas' | 'canc_divergentes' | 'pre_emitidas' | 'todas';

export interface NotaFiscalGerenciadorItemDto {
  numNotaFiscal: string;
  serNotaFiscal: string;
  dataEmissao: string;
  entradaSaida: 'E' | 'S' | string;
  tipoNotaFiscal: string;
  tipoNotaDescricao: string;
  codigoCfo?: string | null;
  tipoDestinatario?: string | null;
  codigoDestinatario?: number | null;
  nomeDestinatario: string;
  valorTotalNota: number;
  situacaoNota: number;
  situacaoDescricao: string;
  ultimoRetorno: string;
  chaveAcessoNfe?: string | null;
  autorizacaoNfe?: string | null;
  autorizada: boolean;
  tipoEmissao: number;
  enviarEmailDanfe: number;
  enviarEmailLaudo: number;
  possuiXml: boolean;
  observacao?: string | null;
}

export interface OcorrenciaNfeDto {
  numOcorrencia: number;
  codigoOcorrencia: number;
  descrOcorrencia: string;
  dataOcorrencia: string;
  horaOcorrencia?: string | null;
  numEvento?: number | null;
}

export interface CartaCorrecaoItemDto {
  numCorrecao: number;
  dataCorrecao?: string | null;
  horaCorrecao?: string | null;
  motivoCorrecao?: string | null;
  protocoloCce?: string | null;
}

export interface NotaFiscalItemAlteracaoDto {
  numItem: number;
  codigoMaterial: string;
  descricaoMaterial?: string | null;
  descricaoComplem?: string | null;
  qtdMaterial: number;
  unidMedida?: string | null;
  valorUnitario: number;
  valorTotalItem?: number;
  codigoFiscal?: string | null;
  classificacaoFiscal?: string | null;
  codigoLote?: string | null;
  numPedidoCliente?: string | null;
  tributacaoIcms?: string | null;
  tributacaoIpi?: string | null;
  tributacaoPis?: string | null;
  tributacaoCofins?: string | null;
  codigoCsosn?: string | null;
  origemMercadoria?: string | null;
  numDocumentoFci?: string | null;
  codigoEnqIpi?: string | null;
  codigoCest?: string | null;
  codigoCbenef?: string | null;
  codificacaoNve?: string | null;
  motivoIcmsDeson?: number | null;
  valorIcmsDeson?: number;
  percDescontoIcms?: number | null;
  valorDescIcms?: number;
  aliquotaIcms: number;
  aliquotaIpi: number;
  aliquotaPis: number;
  aliquotaCofins: number;
  percBaseIcms: number;
  percMva?: number;
  aliquotaIcmsSubst?: number;
  valorBaseIpi: number;
  valorBaseIcms: number;
  valorBasePis: number;
  valorBaseCofins: number;
  valorIpi: number;
  valorIcms: number;
  valorIcmsSubst: number;
  valorBaseIcmsSubst: number;
  percAdicIcmsFcp?: number | null;
  aliquotaIcmsDest?: number | null;
  aliquotaIcmsInter?: number | null;
  percPartilhaIcms?: number | null;
  valorIcmsFcp?: number;
  valorBaseIcmsDest?: number;
  valorIcmsDest?: number;
  valorIcmsRemet?: number;
  aliquotaIi?: number;
  valorBaseIi?: number;
  valorIi?: number;
  valorDespAdu?: number;
  valorFrete?: number;
  valorSeguro?: number;
  valorOutrasDesp?: number;
  valorDesconto?: number;
  cstIs?: string | null;
  classTribIs?: string | null;
  valorBaseIs?: number | null;
  aliquotaIs?: number | null;
  valorIs?: number | null;
  cstIbsCbs?: string | null;
  classTribIbsCbs?: string | null;
  valorBaseIbsCbs?: number | null;
  aliquotaIbsUf?: number | null;
  valorIbsUf?: number | null;
  aliquotaIbsMun?: number | null;
  valorIbsMun?: number | null;
  aliquotaCbs?: number | null;
  valorCbs?: number | null;
  valorPis?: number;
  valorCofins?: number;
}

export interface NotaFiscalDetalheCompletoDto {
  codigoEmpresa: number;
  numNotaFiscal: string;
  serNotaFiscal: string;
  entradaSaida: string;
  tipoNotaFiscal: string;
  tipoNotaDescricao?: string;
  dataEmissao: string;
  dataEntrega?: string | null;
  horaEntrega?: string | null;
  codigoCfo?: string | null;
  naturezaOperacao?: string | null;
  condicaoPagto?: number | null;
  descricaoCondicaoPagto?: string | null;
  numPedido?: number | null;
  geraOperFin?: boolean;
  atualizaEstoque?: boolean;
  codigoUsuario?: string | null;
  responsavelFrete?: number | null;
  codigoTransportadora?: number | null;
  nomeTransportadora?: string | null;
  respRedespacho?: number | null;
  placaVeiculo?: string | null;
  indicadorPresenca?: number | null;
  codigoLocalEmbarque?: number | null;
  marcaVolumes?: string | null;
  numeracaoVolumes?: string | null;
  obsEntrega?: string | null;
  pesoBruto?: number;
  pesoLiquido?: number;
  valorTransporte?: number;
  baseIcmsTranspRet?: number;
  aliquotaIcmsTranspRet?: number;
  valorIcmsTranspRet?: number;
  cfopTransporte?: string | null;
  tipoDestinatario?: string | null;
  codigoDestinatario?: number | null;
  nomeDestinatario: string;
  situacaoNota: number;
  autorizacaoNfe?: string | null;
  chaveAcessoNfe?: string | null;
  valorTotalItens: number;
  valorDesconto: number;
  baseIcms: number;
  valorIcms: number;
  baseIcmsSubst: number;
  valorIcmsSubst: number;
  valorDescIcms: number;
  baseIpi: number;
  valorTotalIpi: number;
  valorFrete: number;
  valorSeguro: number;
  valorOutrasDesp: number;
  valorTotalNota: number;
  valorIcmsFcp: number;
  valorBaseIcmsDest: number;
  valorIcmsDest: number;
  valorIcmsRemet: number;
  qtdVolumes: number;
  especieVolumes?: string | null;
  valorBaseIbsCbs?: number | null;
  valorTotalIbs?: number | null;
  valorTotalCbs?: number | null;
  valorBaseIs?: number | null;
  valorIs?: number | null;
  observacao?: string | null;
  itens: NotaFiscalItemAlteracaoDto[];
  ocorrencias: OcorrenciaNfeDto[];
  cartasCorrecao: CartaCorrecaoItemDto[];
}

export interface AlterarNotaFiscalRequest {
  codigoEmpresa?: number;
  numNotaFiscal: string;
  serNotaFiscal: string;
  tipoNotaFiscal?: string | null;
  situacaoNota: number;
  zerarAutorizacaoPreNota: boolean;
  dataEntrega?: string | null;
  horaEntrega?: string | null;
  codigoCfo?: string | null;
  condicaoPagto?: number | null;
  responsavelFrete?: number | null;
  codigoTransportadora?: number | null;
  respRedespacho?: number | null;
  placaVeiculo?: string | null;
  indicadorPresenca?: number | null;
  codigoLocalEmbarque?: number | null;
  qtdVolumes: number;
  especieVolumes?: string | null;
  marcaVolumes?: string | null;
  numeracaoVolumes?: string | null;
  pesoBruto: number;
  pesoLiquido: number;
  obsEntrega?: string | null;
  valorTransporte: number;
  baseIcmsTranspRet: number;
  aliquotaIcmsTranspRet: number;
  valorIcmsTranspRet: number;
  cfopTransporte?: string | null;
  valorTotalItens: number;
  valorFrete: number;
  valorSeguro: number;
  valorOutrasDesp: number;
  valorDesconto: number;
  valorTotalNota: number;
  baseIcms: number;
  valorIcms: number;
  baseIcmsSubst: number;
  valorIcmsSubst: number;
  valorDescIcms: number;
  baseIpi: number;
  valorTotalIpi: number;
  valorIcmsFcp: number;
  valorBaseIcmsDest: number;
  valorIcmsDest: number;
  valorIcmsRemet: number;
  valorBaseIbsCbs?: number | null;
  valorTotalIbs?: number | null;
  valorTotalCbs?: number | null;
  valorBaseIs?: number | null;
  valorIs?: number | null;
  observacao?: string | null;
  itens: NotaFiscalItemAlteracaoDto[];
}

export interface CartaCorrecaoRequest {
  codigoEmpresa?: number;
  numNotaFiscal: string;
  serNotaFiscal: string;
  dataCorrecao: string;
  horaCorrecao?: string | null;
  textoCorrecao: string;
  confirmarSubstituicaoMenor: boolean;
  usuario?: string;
}

export interface InutilizarNumeracaoRequest {
  codigoEmpresa?: number;
  serNotaFiscal: string;
  numInicial: number;
  numFinal: number;
  codigoMotivo: number;
  justificativa: string;
  usuario?: string;
}

export interface AlterarContingenciaRequest {
  codigoEmpresa?: number;
  tipoContingencia: number;
  codigoMotivo?: number | null;
  usuario?: string;
}

export interface CancelarNotaFiscalRequest {
  codigoEmpresa?: number;
  numNotaFiscal: string;
  serNotaFiscal: string;
  codigoMotivo: number;
  justificativa: string;
  confirmarExcluirSemSefaz: boolean;
  apenasCancelarSemExcluir?: boolean;
  confirmarMesmoComIntegracaoContabil: boolean;
  confirmarMesmoComCpQuitada: boolean;
  usuario?: string;
}

export interface CancelarNotaFiscalResponse {
  sucesso: boolean;
  exigeConfirmacao: boolean;
  tipoConfirmacao?: string | null;
  mensagem: string;
  excluidaSistema: boolean;
}

export interface NotaFiscalKeyRequest {
  codigoEmpresa?: number;
  numNotaFiscal: string;
  serNotaFiscal: string;
  tipoDanfe?: 5 | 6 | number | null;
  preNota?: boolean;
  usuario?: string;
}

export interface OrdemSeparacaoFilaDto {
  numSeparacao: number;
  dataSeparacao: string;
  codigoCliente: number;
  nomeCliente: string;
  codigoCfo?: string | null;
  naturezaOperacao?: string | null;
  codigoUsuario?: string | null;
  estadoEntrega?: string | null;
  cgcCpf?: string | null;
  situacaoSeparacao: number;
  situacaoDescricao: string;
  geraOperFinanc: boolean;
}

export interface SolicitacaoDiversaFilaDto {
  numSolicitacao: number;
  dataSolicitacao: string;
  entradaSaida: number;
  entradaSaidaDescricao: string;
  tipoDestinatario: string;
  codigoDestinatario: number;
  nomeDestinatario: string;
  motivoSolicitacao?: string | null;
  codigoSolicitante?: string | null;
  numSeparacao?: number | null;
}

export interface FaturamentoFilaResponseDto {
  contingenciaAtual: number;
  ordensSeparacao: OrdemSeparacaoFilaDto[];
  solicitacoesDiversas: SolicitacaoDiversaFilaDto[];
}

export interface FilaDetalheItemDto {
  numItem: number;
  codigoMaterial: string;
  descricaoMaterial: string;
  qtd: number;
  unidMedida: string;
  valorUnitario: number;
  valorTotal: number;
  codigoLote?: string | null;
  codigoFiscal?: string | null;
  observacao?: string | null;
}

export interface FilaDetalheDto {
  tipo: string;
  numero: number;
  titulo: string;
  campos: ComboOptionDto[];
  itens: FilaDetalheItemDto[];
  servicos: NotaFiscalServicoDto[];
}

export interface FornecedorCnpjOptionDto {
  codigoFornecedor: number;
  nomeFantasia: string;
  razaoSocial: string;
  numCgc?: string | null;
}

export interface GerarNfRetornoResponseDto {
  sucesso: boolean;
  requerEscolhaFornecedor: boolean;
  requerConfirmacaoSemSaldo: boolean;
  mensagem: string;
  fornecedores: FornecedorCnpjOptionDto[];
  solicitacoesGeradas: number[];
}

export interface EmissaoVendaItemDto {
  numItem: number;
  codigoMaterial: string;
  descricaoMaterial?: string | null;
  codigoFiscal?: string | null;
  codigoLote?: string | null;
  codigoLocal: number;
  qtdSeparada: number;
  unidMedida: string;
  numPedido?: number | null;
  numPedidoCliente?: string | null;
  precoUnitario: number;
  valorTotalItem: number;
  classificacaoFiscal?: string | null;
  cstIbsCbs?: string | null;
  classTribIbsCbs?: string | null;
}

export interface PagamentoAntecipadoDisponivelDto {
  numNotaFiscal: string;
  serNotaFiscal: string;
  chaveAcessoNfe?: string | null;
  dataEmissao: string;
  valorTotalNota: number;
  selecionado: boolean;
}

export interface ComponenteTerceiroNfOpcaoDto {
  numReceb: number;
  numNfReceb?: string | null;
  serNfReceb?: string | null;
  dataReceb?: string | null;
  saldoDisponivel: number;
  qtdRetornar: number;
}

export interface ComponenteTerceiroMatDto {
  codigoMaterial: string;
  descricaoMaterial: string;
  unidMedida: string;
  qtdNecessaria: number;
  notasRecebimento: ComponenteTerceiroNfOpcaoDto[];
}

export interface TerceiroSelecaoInputDto {
  codigoMaterial: string;
  numReceb: number;
  qtdRetorno: number;
}

export interface EmissaoVendaPrepDto {
  codigoEmpresa: number;
  numSeparacao: number;
  codigoCliente: number;
  nomeCliente: string;
  estadoEntrega?: string | null;
  cepEntrega?: string | null;
  codigoSuframa?: string | null;
  condicaoPagto?: number | null;
  descricaoCondicaoPagto?: string | null;
  permiteEditarParcelas: boolean;
  selecionarNfsRetorno: boolean;
  dataEmissao: string;
  dataSaida?: string | null;
  horaSaida?: string | null;
  codigoCfo?: string | null;
  responsavelFrete: number;
  codigoTransportadora?: number | null;
  respRedespacho?: number | null;
  placaVeiculo?: string | null;
  qtdVolumes: number;
  especieVolumes?: string | null;
  marcaVolumes?: string | null;
  numeracaoVolumes?: string | null;
  pesoBruto: number;
  pesoLiquido: number;
  valorFrete: number;
  valorSeguro: number;
  outrasDespesas: number;
  percDesconto: number;
  indicadorPresenca: number;
  codigoLocalEmbarque?: number | null;
  observacao?: string | null;
  avisoFaturamento?: string | null;
  valorTransporte?: number | null;
  baseIcmsTranspRet?: number | null;
  aliquotaIcmsTranspRet?: number | null;
  valorIcmsTranspRet?: number | null;
  cfopTransporte?: string | null;
  codigoMunicipioTransp?: number | null;
  serieSelecionada: string;
  proximoNumeroNf: number;
  situacaoDestinoPadrao: number;
  seriesDisponiveis: SerieDisponivelDto[];
  itens: EmissaoVendaItemDto[];
  pagamentosAntecipados: PagamentoAntecipadoDisponivelDto[];
  componentesTerceiro: ComponenteTerceiroMatDto[];
}

export interface ConfirmarEmissaoVendaRequest {
  codigoEmpresa?: number;
  numSeparacao: number;
  serieNf: string;
  destino: number;
  tipoDanfe: 5 | 6;
  dataSaida?: string | null;
  horaSaida?: string | null;
  codigoCfo: string;
  responsavelFrete: number;
  codigoTransportadora?: number | null;
  respRedespacho?: number | null;
  placaVeiculo?: string | null;
  qtdVolumes: number;
  especieVolumes?: string | null;
  marcaVolumes?: string | null;
  numeracaoVolumes?: string | null;
  pesoBruto: number;
  pesoLiquido: number;
  valorFrete: number;
  valorSeguro: number;
  outrasDespesas: number;
  percDesconto: number;
  indicadorPresenca: number;
  codigoLocalEmbarque?: number | null;
  observacao?: string | null;
  valorTransporte?: number | null;
  baseIcmsTranspRet?: number | null;
  aliquotaIcmsTranspRet?: number | null;
  valorIcmsTranspRet?: number | null;
  cfopTransporte?: string | null;
  codigoMunicipioTransp?: number | null;
  itensCfop: EmissaoVendaItemDto[];
  pagamentosAntecipados: PagamentoAntecipadoDisponivelDto[];
  selecionarTerceirosAutomaticamente: boolean;
  terceirosSelecionados: TerceiroSelecaoInputDto[];
  confirmarDivergenciaCompon: boolean;
  usuario?: string;
}

export interface NotaFiscalItemDiAdicDto {
  numAdicao: number;
  numSeqAdicao: number;
  codigoFabricante: string;
  valorDesconto?: number | null;
  numeroDrawback?: string | null;
}

export interface NotaFiscalItemDiDto {
  numItem: number;
  numeroDi: string;
  dataRegistroDi?: string | null;
  codigoLocalDesembaraco?: number | null;
  dataDesembaraco?: string | null;
  codigoExportador: string;
  viaTransporte: number;
  valorAfrmm?: number | null;
  tipoIntermedio: number;
  codigoCliente?: number | null;
  adicoes: NotaFiscalItemDiAdicDto[];
}

export interface NotaFiscalItemDeDto {
  numItem: number;
  numDe: number;
  numeroDrawback?: string | null;
  numeroRe?: string | null;
  numReceb?: number | null;
  qtdExportado?: number | null;
}

export interface NotaFiscalReferenciadaDto {
  numNfOrigem: string;
  serNfOrigem: string;
  dataEmissao?: string | null;
  chaveAcessoNfe?: string | null;
}

export interface NotaFiscalItemComplemDto {
  codigoMaterial: string;
  numNfOrigem: string;
  serNfOrigem: string;
  qtdFaturada: number;
  precoNegociado?: number | null;
  dataVigencia?: string | null;
}

export interface NotaFiscalItemDevDto {
  codigoMaterial: string;
  numReceb: number;
  numItem: number;
  numNfOrigem?: string | null;
  qtdDevolvida: number;
  codigoDevolucao: number;
}

export interface NotaFiscalServicoDto {
  numItem: number;
  descricaoServico?: string | null;
  qtdServico?: number | null;
  valorUnitario?: number | null;
  valorTotal?: number | null;
}

export interface NotaFiscalItemDiversaDto extends NotaFiscalItemAlteracaoDto {
  percBaseIcmsSubst: number;
  percReducaoIcmsSt: number;
  valorTotalItem: number;
  numDocFci?: string | null;
}

export interface EmissaoDiversaPrepDto {
  codigoEmpresa: number;
  numSolicitacao: number;
  numNotaTmp: string;
  tipoMovimentoEstoque: number;
  entradaSaida: 'E' | 'S' | string;
  isServico: boolean;
  tipoNotaFiscal: string;
  tipoDestinatario: string;
  codigoDestinatario: number;
  nomeDestinatario: string;
  cnpjEmpresa?: string | null;
  cnpjDestinatario?: string | null;
  permiteEditarTotaisManual: boolean;
  dataEmissao: string;
  dataEntrega?: string | null;
  horaEntrega?: string | null;
  codigoCfo?: string | null;
  condicaoPagto?: number | null;
  permiteEditarParcelas: boolean;
  responsavelFrete?: number | null;
  codigoTransportadora?: number | null;
  placaVeiculo?: string | null;
  qtdVolumes?: number | null;
  especieVolumes?: string | null;
  marcaVolumes?: string | null;
  numeracaoVolumes?: string | null;
  pesoBruto?: number | null;
  pesoLiquido?: number | null;
  valorFrete: number;
  valorSeguro: number;
  valorOutrasDesp: number;
  percDescEspec: number;
  baseIcms: number;
  valorIcms: number;
  baseIpi: number;
  valorTotalIpi: number;
  valorTotalItens: number;
  valorTotalNota: number;
  aliquotaIss: number;
  aliquotaIrrf: number;
  aliquotaCsll: number;
  indicadorPresenca: number;
  codigoLocalEmbarque?: number | null;
  tipoNotaCred?: number | null;
  observacao?: string | null;
  valorTransporte?: number | null;
  baseIcmsTranspRet?: number | null;
  aliquotaIcmsTranspRet?: number | null;
  valorIcmsTranspRet?: number | null;
  cfopTransporte?: string | null;
  codigoMunicipioTransp?: number | null;
  serieSelecionada: string;
  proximoNumeroNf: number;
  situacaoDestinoPadrao: number;
  seriesDisponiveis: SerieDisponivelDto[];
  itens: NotaFiscalItemDiversaDto[];
  servicos: NotaFiscalServicoDto[];
  declaracoesImportacao: NotaFiscalItemDiDto[];
  declaracoesExportacao: NotaFiscalItemDeDto[];
  notasReferenciadas: NotaFiscalReferenciadaDto[];
  itensComplem: NotaFiscalItemComplemDto[];
  itensDevolucao: NotaFiscalItemDevDto[];
  itensTerceiro: TerceiroSelecaoInputDto[];
}

export interface ConfirmarEmissaoDiversaRequest {
  codigoEmpresa?: number;
  numSolicitacao: number;
  numNotaTmp: string;
  serieNf: string;
  destino: number;
  tipoDanfe: 5 | 6;
  dataEmissao: string;
  dataEntrega?: string | null;
  horaEntrega?: string | null;
  codigoCfo: string;
  condicaoPagto?: number | null;
  responsavelFrete: number;
  codigoTransportadora?: number | null;
  placaVeiculo?: string | null;
  qtdVolumes: number;
  especieVolumes?: string | null;
  marcaVolumes?: string | null;
  numeracaoVolumes?: string | null;
  pesoBruto: number;
  pesoLiquido: number;
  valorFrete: number;
  valorSeguro: number;
  valorOutrasDesp: number;
  percDescEspec: number;
  baseIcmsInformada?: number | null;
  valorIcmsInformado?: number | null;
  baseIpiInformada?: number | null;
  valorTotalItensInformado?: number | null;
  valorTotalNotaInformado?: number | null;
  aliquotaIss: number;
  aliquotaIrrf: number;
  aliquotaCsll: number;
  indicadorPresenca: number;
  codigoLocalEmbarque?: number | null;
  tipoNotaCred?: number | null;
  observacao?: string | null;
  valorTransporte?: number | null;
  baseIcmsTranspRet?: number | null;
  aliquotaIcmsTranspRet?: number | null;
  valorIcmsTranspRet?: number | null;
  cfopTransporte?: string | null;
  codigoMunicipioTransp?: number | null;
  selecionarTerceirosAutomaticamente: boolean;
  manterValoresOrigemRetorno: boolean;
  itens: NotaFiscalItemDiversaDto[];
  servicos: NotaFiscalServicoDto[];
  declaracoesImportacao: NotaFiscalItemDiDto[];
  declaracoesExportacao: NotaFiscalItemDeDto[];
  notasReferenciadas: NotaFiscalReferenciadaDto[];
  itensComplem: NotaFiscalItemComplemDto[];
  itensDevolucao: NotaFiscalItemDevDto[];
  itensTerceiro: TerceiroSelecaoInputDto[];
  usuario?: string;
}

export interface RecebimentoTerceiroSaldoDto {
  numReceb: number;
  codigoMaterial: string;
  numNfReceb?: string | null;
  serNfReceb?: string | null;
  dataReceb?: string | null;
  saldoDevolver: number;
}

export interface ParcelaDuplicataDto {
  numLanc: number;
  numDocumento?: string | null;
  dataVencimento?: string | null;
  valorReceber: number;
}

export interface SalvarParcelasFinalizarRequest {
  codigoEmpresa?: number;
  numNotaFiscal: string;
  serNotaFiscal: string;
  destino: number;
  tipoDanfe: 5 | 6;
  confirmarDiferencaCentavos: boolean;
  parcelas: ParcelaDuplicataDto[];
  usuario?: string;
}

export interface ConfirmarEmissaoResultDto {
  sucesso: boolean;
  exigeConfirmacao: boolean;
  tipoConfirmacao?: string | null;
  mensagem: string;
  numNotaFiscal: string;
  serNotaFiscal: string;
  situacaoNota: number;
  valorTotalNota: number;
  valorTotalIbs: number;
  valorTotalCbs: number;
  valorIs: number;
  requerEdicaoParcelas: boolean;
  parcelas: ParcelaDuplicataDto[];
  xmlGerado: boolean;
  sefazOk?: boolean;
  autorizadaSefaz: boolean;
  protocoloAutorizacao?: string | null;
  chaveAcessoNfe?: string | null;
  mensagemSefaz?: string | null;
}

const getCtx = () => {
  const baseUrl = GlobalConfig.getBaseUrl().replace(/\/$/, '');
  const token = GlobalConfig.getJwToken();
  const codigoEmpresa = Number(GlobalConfig.getCodEmpresa() ?? 0);
  const usuario = GlobalConfig.getUsuario() || 'ADMIN';
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  return { baseUrl, headers, codigoEmpresa, usuario };
};

const extractError = (resp: ApiCallResponse<any>, fallback: string): string => {
  const body = resp.jsonBody ?? resp.data;
  if (body && typeof body === 'object') {
    const msg = body.mensagem ?? body.Mensagem ?? body.message ?? body.detail ?? body.title;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  if (typeof resp.bodyText === 'string' && resp.bodyText.trim()) {
    try {
      const parsed = JSON.parse(resp.bodyText);
      const msg = parsed?.mensagem ?? parsed?.Mensagem ?? parsed?.message ?? parsed?.detail;
      if (typeof msg === 'string' && msg.trim()) return msg.trim();
    } catch {
      return resp.bodyText.trim();
    }
  }
  return fallback;
};

export const formatCurrencyBr = (val?: number | null): string =>
  Number(val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatDecimal = (val?: number | null, dec = 2): string =>
  Number(val ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const toBrDateFromIso = (iso?: string | null): string => {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

export const toIsoDateFromBr = (br?: string | null): string | undefined => {
  if (!br) return undefined;
  const m = br.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
};

export const getFirstDayMonthBr = (): string => {
  const d = new Date();
  return `01/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export const getTodayBr = (): string => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export const getNowHm = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const abrirBlobPdf = (pdfBlob: Blob) => {
  const blobUrl = URL.createObjectURL(pdfBlob);
  const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};

export async function obterCombosFaturamento(): Promise<FaturamentoCombosDto> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<FaturamentoCombosDto>(
    `${baseUrl}/api/v1/faturamento/combos`,
    ApiCallType.GET,
    headers,
    { codigoEmpresa },
  );
  if (!resp.succeeded || !resp.data) throw new Error(extractError(resp, 'Erro ao carregar parâmetros de faturamento.'));
  return resp.data;
}

export async function obterProximoNumeroSerie(serieNf: string): Promise<SerieDisponivelDto> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<SerieDisponivelDto>(
    `${baseUrl}/api/v1/faturamento/proximo-numero`,
    ApiCallType.GET,
    headers,
    { codigoEmpresa, serieNf },
  );
  if (!resp.succeeded || !resp.data) throw new Error(extractError(resp, 'Erro ao obter numeração da série.'));
  return resp.data;
}

export async function listarNotasGerenciador(params: {
  aba: AbaGerenciadorNfe;
  dataInicio?: string;
  dataFim?: string;
  tipoDestinatario?: string;
  codigoDestinatario?: number;
  numNota?: string;
  entradaSaida?: string;
  situacaoNota?: number;
  busca?: string;
}): Promise<NotaFiscalGerenciadorItemDto[]> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const query: Record<string, string | number> = { codigoEmpresa, aba: params.aba };
  if (params.dataInicio) query.dataInicio = params.dataInicio;
  if (params.dataFim) query.dataFim = params.dataFim;
  if (params.tipoDestinatario) query.tipoDestinatario = params.tipoDestinatario;
  if (params.codigoDestinatario) query.codigoDestinatario = params.codigoDestinatario;
  if (params.numNota?.trim()) query.numNota = params.numNota.trim();
  if (params.entradaSaida) query.entradaSaida = params.entradaSaida;
  if (params.situacaoNota !== undefined) query.situacaoNota = params.situacaoNota;
  if (params.busca?.trim()) query.busca = params.busca.trim();

  const resp = await apiManager.makeApiCall<NotaFiscalGerenciadorItemDto[]>(
    `${baseUrl}/api/v1/faturamento/notas`,
    ApiCallType.GET,
    headers,
    query,
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao listar notas fiscais.'));
  return Array.isArray(resp.data) ? resp.data : [];
}

export async function obterDetalheNotaFiscal(numNota: string, serNota: string): Promise<NotaFiscalDetalheCompletoDto> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<NotaFiscalDetalheCompletoDto>(
    `${baseUrl}/api/v1/faturamento/notas/${codigoEmpresa}/${encodeURIComponent(numNota)}/${encodeURIComponent(serNota)}`,
    ApiCallType.GET,
    headers,
  );
  if (!resp.succeeded || !resp.data) throw new Error(extractError(resp, 'Erro ao carregar detalhes da NF-e.'));
  return resp.data;
}

export async function alterarNotaFiscal(req: AlterarNotaFiscalRequest): Promise<string> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<{ sucesso: boolean; mensagem: string }>(
    `${baseUrl}/api/v1/faturamento/notas/alterar`,
    ApiCallType.PUT,
    headers,
    {},
    { ...req, codigoEmpresa },
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao alterar NF-e.'));
  return resp.data?.mensagem || 'Nota fiscal alterada com sucesso.';
}

export async function reenviarXmlNotaFiscal(numNotaFiscal: string, serNotaFiscal: string): Promise<string> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<{ sucesso: boolean; mensagem: string }>(
    `${baseUrl}/api/v1/faturamento/notas/reenviar-xml`,
    ApiCallType.POST,
    headers,
    {},
    { codigoEmpresa, numNotaFiscal, serNotaFiscal, usuario },
    { timeoutMs: 60000 },
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao reenviar XML para SEFAZ.'));
  return resp.data?.mensagem || 'XML reenviado com sucesso.';
}

export async function obterXmlNotaFiscal(numNota: string, serNota: string): Promise<string> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<{ xml: string }>(
    `${baseUrl}/api/v1/faturamento/notas/${codigoEmpresa}/${encodeURIComponent(numNota)}/${encodeURIComponent(serNota)}/xml`,
    ApiCallType.GET,
    headers,
  );
  if (!resp.succeeded || !resp.data?.xml) throw new Error(extractError(resp, 'XML da NF-e não encontrado.'));
  return resp.data.xml;
}

export async function consultarNfeSefaz(numNotaFiscal: string, serNotaFiscal: string): Promise<string> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<{ sucesso: boolean; mensagem: string }>(
    `${baseUrl}/api/v1/faturamento/notas/consultar-sefaz`,
    ApiCallType.POST,
    headers,
    {},
    { codigoEmpresa, numNotaFiscal, serNotaFiscal, usuario },
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao consultar NF-e na SEFAZ.'));
  return resp.data?.mensagem || 'Consulta concluída.';
}

export async function emitirCartaCorrecao(req: CartaCorrecaoRequest): Promise<{ sucesso: boolean; exigeConfirmacao?: boolean; mensagem: string }> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<{ sucesso: boolean; exigeConfirmacao?: boolean; mensagem: string }>(
    `${baseUrl}/api/v1/faturamento/notas/cce`,
    ApiCallType.POST,
    headers,
    {},
    { ...req, codigoEmpresa, usuario: req.usuario || usuario },
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao emitir Carta de Correção.'));
  return resp.data || { sucesso: true, mensagem: 'Carta de Correção transmitida.' };
}

export async function inutilizarNumeracao(req: InutilizarNumeracaoRequest): Promise<string> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<{ sucesso: boolean; mensagem: string }>(
    `${baseUrl}/api/v1/faturamento/notas/inutilizar`,
    ApiCallType.POST,
    headers,
    {},
    { ...req, codigoEmpresa, usuario: req.usuario || usuario },
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao inutilizar numeração.'));
  return resp.data?.mensagem || 'Numeração inutilizada com sucesso.';
}

export async function alterarContingenciaNfe(req: AlterarContingenciaRequest): Promise<string> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<{ sucesso: boolean; mensagem: string }>(
    `${baseUrl}/api/v1/faturamento/notas/contingencia`,
    ApiCallType.POST,
    headers,
    {},
    { ...req, codigoEmpresa, usuario: req.usuario || usuario },
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao alterar contingência.'));
  return resp.data?.mensagem || 'Contingência atualizada.';
}

export async function cancelarNotaFiscal(req: CancelarNotaFiscalRequest): Promise<CancelarNotaFiscalResponse> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<CancelarNotaFiscalResponse>(
    `${baseUrl}/api/v1/faturamento/notas/cancelar`,
    ApiCallType.POST,
    headers,
    {},
    { ...req, codigoEmpresa, usuario: req.usuario || usuario },
  );
  if (!resp.succeeded || !resp.data) throw new Error(extractError(resp, 'Erro ao cancelar NF-e.'));
  return resp.data;
}

export async function enviarEmailNotaFiscal(numNotaFiscal: string, serNotaFiscal: string): Promise<string> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<{ sucesso: boolean; mensagem: string }>(
    `${baseUrl}/api/v1/faturamento/notas/enviar-email`,
    ApiCallType.POST,
    headers,
    {},
    { codigoEmpresa, numNotaFiscal, serNotaFiscal, usuario },
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao enviar e-mail da NF-e.'));
  return resp.data?.mensagem || 'E-mail enfileirado para envio.';
}

export async function gerarDanfeFaturamentoPdf(numNotaFiscal: string, serNotaFiscal: string, tipoDanfe: 5 | 6 = 5): Promise<Blob> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<Blob>(
    `${baseUrl}/api/v1/faturamento/notas/danfe`,
    ApiCallType.POST,
    headers,
    {},
    { codigoEmpresa, numNotaFiscal, serNotaFiscal, tipoDanfe },
    { responseType: 'blob', timeoutMs: 45000 },
  );
  if (!resp.succeeded || !(resp.data instanceof Blob) || resp.data.size === 0) {
    throw new Error(extractError(resp, 'Não foi possível gerar o PDF da DANFE.'));
  }
  return resp.data;
}

export async function obterFilaFaturamento(): Promise<FaturamentoFilaResponseDto> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<FaturamentoFilaResponseDto>(
    `${baseUrl}/api/v1/faturamento/fila`,
    ApiCallType.GET,
    headers,
    { codigoEmpresa },
  );
  if (!resp.succeeded || !resp.data) throw new Error(extractError(resp, 'Erro ao carregar fila de faturamento.'));
  return resp.data;
}

export async function obterDetalheFilaFaturamento(tipo: 'OS' | 'SOLIC', numero: number): Promise<FilaDetalheDto> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<FilaDetalheDto>(
    `${baseUrl}/api/v1/faturamento/fila/detalhe/${codigoEmpresa}/${tipo}/${numero}`,
    ApiCallType.GET,
    headers,
  );
  if (!resp.succeeded || !resp.data) throw new Error(extractError(resp, 'Erro ao consultar itens do documento.'));
  return resp.data;
}

export async function cancelarItemFilaFaturamento(tipo: 'OS' | 'SOLIC', numeros: number[]): Promise<string> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<{ sucesso: boolean; mensagem: string }>(
    `${baseUrl}/api/v1/faturamento/fila/cancelar`,
    ApiCallType.POST,
    headers,
    {},
    { codigoEmpresa, tipo, numeros, usuario },
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao cancelar na fila de faturamento.'));
  return resp.data?.mensagem || 'Cancelamento realizado.';
}

export async function gerarNfRetornoTerceiros(
  numerosSeparacao: number[],
  codigoFornecedor?: number,
  confirmarMesmoSemSaldo = false,
): Promise<GerarNfRetornoResponseDto> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<GerarNfRetornoResponseDto>(
    `${baseUrl}/api/v1/faturamento/fila/gerar-nf-retorno`,
    ApiCallType.POST,
    headers,
    {},
    { codigoEmpresa, numerosSeparacao, codigoFornecedor, confirmarMesmoSemSaldo, usuario },
  );
  if (!resp.succeeded || !resp.data) throw new Error(extractError(resp, 'Erro ao gerar solicitação de retorno.'));
  return resp.data;
}

export async function prepararEmissaoVenda(numSeparacao: number): Promise<EmissaoVendaPrepDto> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<EmissaoVendaPrepDto>(
    `${baseUrl}/api/v1/faturamento/venda-os/${codigoEmpresa}/${numSeparacao}`,
    ApiCallType.GET,
    headers,
    { usuario },
  );
  if (!resp.succeeded || !resp.data) throw new Error(extractError(resp, 'Erro ao carregar emissão de NF de venda.'));
  return resp.data;
}

export async function confirmarEmissaoVenda(req: ConfirmarEmissaoVendaRequest): Promise<ConfirmarEmissaoResultDto> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<ConfirmarEmissaoResultDto>(
    `${baseUrl}/api/v1/faturamento/venda-os/confirmar`,
    ApiCallType.POST,
    headers,
    {},
    { ...req, codigoEmpresa, usuario: req.usuario || usuario },
    { timeoutMs: 60000 },
  );
  if (!resp.succeeded || !resp.data) throw new Error(extractError(resp, 'Erro ao confirmar emissão de NF de venda.'));
  return resp.data;
}

export async function prepararEmissaoDiversa(numSolicitacao: number): Promise<EmissaoDiversaPrepDto> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<EmissaoDiversaPrepDto>(
    `${baseUrl}/api/v1/faturamento/diversa/${codigoEmpresa}/${numSolicitacao}`,
    ApiCallType.GET,
    headers,
    { usuario },
  );
  if (!resp.succeeded || !resp.data) throw new Error(extractError(resp, 'Erro ao carregar solicitação diversa para faturamento.'));
  return resp.data;
}

export async function salvarRascunhoDiversa(req: ConfirmarEmissaoDiversaRequest): Promise<string> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<{ sucesso: boolean; mensagem: string }>(
    `${baseUrl}/api/v1/faturamento/diversa/rascunho`,
    ApiCallType.PUT,
    headers,
    {},
    { ...req, codigoEmpresa, usuario: req.usuario || usuario },
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao salvar rascunho da NF.'));
  return resp.data?.mensagem || 'Rascunho salvo.';
}

export async function confirmarEmissaoDiversa(req: ConfirmarEmissaoDiversaRequest): Promise<ConfirmarEmissaoResultDto> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<ConfirmarEmissaoResultDto>(
    `${baseUrl}/api/v1/faturamento/diversa/confirmar`,
    ApiCallType.POST,
    headers,
    {},
    { ...req, codigoEmpresa, usuario: req.usuario || usuario },
    { timeoutMs: 60000 },
  );
  if (!resp.succeeded || !resp.data) throw new Error(extractError(resp, 'Erro ao emitir NF diversa.'));
  return resp.data;
}

export async function listarSaldosTerceirosDisponiveis(
  codigoMaterial: string,
  tipoDestinatario: string,
  codigoDestinatario: number,
): Promise<RecebimentoTerceiroSaldoDto[]> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<RecebimentoTerceiroSaldoDto[]>(
    `${baseUrl}/api/v1/faturamento/diversa/saldos-terceiros`,
    ApiCallType.GET,
    headers,
    { codigoEmpresa, codigoMaterial, tipoDestinatario, codigoDestinatario },
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao carregar saldos de terceiros.'));
  return Array.isArray(resp.data) ? resp.data : [];
}

export async function listarNotasReferenciadasDisponiveis(
  tipoDestinatario: string,
  codigoDestinatario: number,
): Promise<NotaFiscalReferenciadaDto[]> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<NotaFiscalReferenciadaDto[]>(
    `${baseUrl}/api/v1/faturamento/diversa/notas-referenciadas`,
    ApiCallType.GET,
    headers,
    { codigoEmpresa, tipoDestinatario, codigoDestinatario },
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao carregar notas referenciadas.'));
  return Array.isArray(resp.data) ? resp.data : [];
}

export async function listarSaldosDevolucaoRecebimento(
  tipoDestinatario: string,
  codigoDestinatario: number,
): Promise<NotaFiscalItemDevDto[]> {
  const { baseUrl, headers, codigoEmpresa } = getCtx();
  const resp = await apiManager.makeApiCall<NotaFiscalItemDevDto[]>(
    `${baseUrl}/api/v1/faturamento/diversa/saldos-devolucao`,
    ApiCallType.GET,
    headers,
    { codigoEmpresa, tipoDestinatario, codigoDestinatario },
  );
  if (!resp.succeeded) throw new Error(extractError(resp, 'Erro ao carregar saldos para devolução.'));
  return Array.isArray(resp.data) ? resp.data : [];
}

export async function salvarParcelasFinalizar(req: SalvarParcelasFinalizarRequest): Promise<ConfirmarEmissaoResultDto> {
  const { baseUrl, headers, codigoEmpresa, usuario } = getCtx();
  const resp = await apiManager.makeApiCall<ConfirmarEmissaoResultDto>(
    `${baseUrl}/api/v1/faturamento/parcelas/finalizar`,
    ApiCallType.POST,
    headers,
    {},
    { ...req, codigoEmpresa, usuario: req.usuario || usuario },
    { timeoutMs: 60000 },
  );
  if (!resp.succeeded || !resp.data) throw new Error(extractError(resp, 'Erro ao finalizar parcelas e transmitir NF-e.'));
  return resp.data;
}
