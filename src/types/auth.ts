export type SelectCompanyState = {
  usuario: string;
  baseUrl: string;
  selectionToken: string;
  empresas: any[];
  versao: string;
  numHD?: string;
  chaveCriptoHD?: string;
  codigoLicenca?: number | null;
  tipoLicenca?: string | null;
};
