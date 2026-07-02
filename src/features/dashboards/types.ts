export type Option = { value: string; label: string };

export type DashboardChartType = 'bar' | 'line' | 'pie' | 'donut' | 'area' | 'bar-horizontal' | 'cards' | 'table';

export type DashboardSeries = {
  key: string;
  label: string;
  color: string;
  format?: 'currency' | 'number' | 'text';
};

export type DashboardRow = {
  key: string;
  label: string;
  order?: number;
  [k: string]: string | number | undefined;
};

export type DashboardTableColumn = {
  key: string;
  label: string;
  format?: 'currency' | 'number' | 'text';
};

export type DashboardKpiCard = {
  key: string;
  label: string;
  value: number;
  format?: 'currency' | 'number';
};

export type DashboardDateErrors = {
  codigoEmpresa?: string;
  dataDe?: string;
  dataAte?: string;
  ano?: string;
};

export type DashboardPCPResumo = {
  totalApontamentos: number;
  totalOrdens: number;
  quantidadeApontada: number;
  horasApontadas: number;
  totalParadas: number;
  horasParadas: number;
};

export type DashboardPCPProducaoPorMaquina = {
  num_Maquina: string;
  descricao_Maquina?: string;
  totalApontamentos: number;
  quantidadeApontada: number;
  horasApontadas: number;
};

export type DashboardPCPProducaoPorCentroTrabalho = {
  codigo_CTrab: string;
  descricao_CTrab: string;
  totalApontamentos: number;
  quantidadeApontada: number;
  horasApontadas: number;
};

export type DashboardPCPParadaPorMotivo = {
  codigo_Parada: number;
  motivo_Parada: string;
  parada_Programada: boolean;
  totalOcorrencias: number;
  horasParadas: number;
};

export type DashboardPCPDadosProducao = {
  tempoProgramadoHoras: number;
  tempoProgramadoMinutos: number;
  paradasDescansoMinutos: number;
  paradasRefeicaoMinutos: number;
  paradasQuebraMinutos: number;
  producaoIdealPPM: number;
  totalProduzidoPecas: number;
  totalRefugoPecas: number;
};

export type DashboardPCPVariaveisSuporte = {
  tempoProducaoPlanejadaMinutos: number;
  tempoOperacionalMinutos: number;
  pecasBoas: number;
};

export type DashboardPCPFatoresOEE = {
  disponibilidade: number;
  performance: number;
  qualidade: number;
  oee: number;
};

export type DashboardPCPMaquinaDisponivel = {
  codigo: string;
  nome: string;
};

export type DashboardPCPFiltros = {
  maquinaSelecionada: string | null;
  metaSelecionada: number;
  mesInicio: string;
  numeroMeses: number;
  maquinasDisponiveis: DashboardPCPMaquinaDisponivel[];
};

export type DashboardPCPCards = {
  oee: number;
  disponibilidade: number;
  performance: number;
  qualidade: number;
};

export type DashboardPCPEvolucaoMensal = {
  mes: string;
  disponibilidade: number;
  qualidade: number;
  performance: number;
  meta: number;
  oee: number;
};

export type DashboardPCPPecasMensal = {
  mes: string;
  pecasBoas: number;
  pecasRuins: number;
};

export type DashboardPCPTemposMensal = {
  mes: string;
  tempoProdutivo: number;
  naoQualidade: number;
  tempoParado: number;
};

export type DashboardPCPFrontend = {
  filtros: DashboardPCPFiltros;
  cards: DashboardPCPCards;
  evolucaoMensal: DashboardPCPEvolucaoMensal[];
  pecasMensal: DashboardPCPPecasMensal[];
  temposMensal: DashboardPCPTemposMensal[];
};

export type DashboardPCPWorldClass = {
  disponibilidade: number;
  performance: number;
  qualidade: number;
  oee: number;
};

export type DashboardPCPResponse = {
  resumo: DashboardPCPResumo;
  dadosProducao: DashboardPCPDadosProducao;
  variaveisSuporte: DashboardPCPVariaveisSuporte;
  fatoresOEE: DashboardPCPFatoresOEE;
  dashboardFrontend: DashboardPCPFrontend;
  worldClass: DashboardPCPWorldClass;
  producaoPorMaquina: DashboardPCPProducaoPorMaquina[];
  producaoPorCentroTrabalho: DashboardPCPProducaoPorCentroTrabalho[];
  paradasPorMotivo: DashboardPCPParadaPorMotivo[];
};
