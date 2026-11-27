import {
  acoesUsuariosCall,
  adicionarLicencaCall,
  adicionarSessaoSistemaCall,
  buscarNumeroHDCall,
  consultaLicencaCall,
  inserirOuAtualizarTransacaoCall,
  inserirTransacoesSistemaAcaoCall,
  obterUsuariosTransacoesSistemaCall,
  usuarioDetalheCall,
} from './apiCalls';
import { buscaLicencaCliente, licencaPorHd, licencaTransacoesAcao } from './supabaseQueries';
import { GlobalConfig } from './globalConfig';

type CompleteCompanyParams = {
  baseUrl: string;
  accessToken: string;
  usuario: string;
  versao: string;
  empresa: any;
  preloadedHd?: {
    numHD?: string;
    chaveCriptoHD?: string;
  };
};

type CompleteCompanyResult = {
  success: boolean;
  message?: string;
  hdSemLicenca?: string;
};

const formatDate = (value?: string) => {
  if (!value) return undefined;
  const d = new Date(value);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const completeCompanySession = async ({
  baseUrl,
  accessToken,
  usuario,
  versao,
  empresa,
  preloadedHd,
}: CompleteCompanyParams): Promise<CompleteCompanyResult> => {
  const nomeFantasia = empresa?.empresa?.nome_Fantasia || empresa?.empresa?.nome_fantasia || '';
  const codigoEmpresa =
    empresa?.empresa?.codigo_empresa || empresa?.empresa?.codigo_Empresa || empresa?.empresa?.Codigo_Empresa || 0;
  const cnpj = empresa?.empresa?.num_CGC || empresa?.empresa?.num_cgc || empresa?.empresa?.Num_CGC || '';

  GlobalConfig.setJwToken(accessToken);
  GlobalConfig.setUsuario(usuario);
  GlobalConfig.setNomeEmpresa(nomeFantasia);
  GlobalConfig.setCodEmpresa(Number(codigoEmpresa));
  GlobalConfig.setCnpj(cnpj);

  const idSessaoAtual = GlobalConfig.getIdSessaoUsuario();
  if (idSessaoAtual) {
    await acoesUsuariosCall(baseUrl, accessToken, {
      codigoEmpresa: Number(codigoEmpresa),
      idSessao: idSessaoAtual,
      codigoUsuario: usuario,
    });
  }

  const userDet = await usuarioDetalheCall(baseUrl, accessToken, usuario);
  if (!userDet.succeeded) {
    return { success: false, message: 'O usuário não possui nível cadastrado no sistema.' };
  }

  const nivelUsuario = (userDet.data as any)?.nivel_Usuario ?? (userDet.data as any)?.nivel_usuario ?? 0;
  GlobalConfig.setNivelUsuario(Number(nivelUsuario) || 0);
  // Tipo de menu e preferencia local do front-end (por usuario), nao vem do banco.
  GlobalConfig.aplicarTipoMenuUsuario(usuario);

  let numHD = preloadedHd?.numHD || '';
  let chaveHD = preloadedHd?.chaveCriptoHD || '';

  if (!numHD) {
    const hdResp = await buscarNumeroHDCall(baseUrl, accessToken, false);
    numHD = (hdResp.data as any)?.num_HD || (hdResp.data as any)?.num_hd || '';
    chaveHD = (hdResp.data as any)?.chave_Criptografada || (hdResp.data as any)?.chave_criptografada || '';
    if (!hdResp.succeeded || !numHD) {
      return { success: false, message: 'Falha ao buscar Número do HD, verifique sua conexão.' };
    }
  }

  GlobalConfig.setNumHD(numHD);
  GlobalConfig.setChaveCriptoHD(chaveHD);

  const licencas = await licencaPorHd({ numeroHd: numHD, idSistema: 1 });
  if (!licencas || licencas.length === 0) {
    return {
      success: false,
      message: 'Licença não encontrada, entre em contato com o suporte.',
      hdSemLicenca: numHD,
    };
  }

  const lic = licencas[0] as any;
  const idLicenca = lic?.id;
  const idCliente = lic?.id_cliente;
  const numeroAcessos = lic?.numero_acessos ?? 0;
  const situacaoLicenca = lic?.situacao_licenca ?? 0;
  const dataValida = lic?.data_validade ?? lic?.data_valida ?? lic?.dataValida;

  GlobalConfig.setNumAcessos(numeroAcessos);
  GlobalConfig.setSituacaoLicenca(situacaoLicenca);
  GlobalConfig.setDataValidadeLicenca(dataValida);

  const addResp = await adicionarLicencaCall(baseUrl, accessToken, {
    id: lic?.id,
    situacao_licenca: lic?.situacao_licenca,
    data_validade: formatDate(lic?.data_validade),
    mensagem_fim_validade: lic?.mensagem_fim_validade,
    dias_ant_mensagem_fim_validade: lic?.dias_ant_mensagem_fim_validade,
    numero_acessos: lic?.numero_acessos,
    numero_hd: numHD,
    instancia_sql: lic?.instancia_sql,
    nome_banco: lic?.nome_banco,
    versao_sistema: lic?.versao_sistema,
    usuario_sql: lic?.usuario_sql,
    senha_sql: lic?.senha_sql,
    versao_limite: lic?.versao_limite,
    tipo_licenca: lic?.tipo_licenca,
    tipo_banco: lic?.tipo_banco,
  });

  if (!addResp.succeeded) {
    return { success: false, message: 'Falha ao gravar dados da licença.' };
  }

  const consultaResp = await consultaLicencaCall(baseUrl, accessToken, idLicenca, numHD);
  if (!consultaResp.succeeded) {
    return { success: false, message: 'Falha ao consultar a licença gravada.' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validadeDate = dataValida ? new Date(dataValida) : undefined;
  const vencida = validadeDate ? validadeDate.getTime() < today.getTime() : false;
  const bloqueada = situacaoLicenca === 9;

  if (vencida || bloqueada) {
    const parts: string[] = [];
    if (vencida) parts.push('Licença vencida');
    if (bloqueada) parts.push('Licença bloqueada');
    return { success: false, message: parts.join(' e ') };
  }

  const licencaCliente = await buscaLicencaCliente({
    idCliente: idCliente?.toString(),
    idLicenca: idLicenca?.toString(),
  });

  if (!licencaCliente || licencaCliente.length === 0) {
    return { success: false, message: 'Transações da licença não encontradas.' };
  }

  const incluirResp = await inserirOuAtualizarTransacaoCall(baseUrl, accessToken, licencaCliente);
  if (!incluirResp.succeeded) {
    return { success: false, message: 'Falha ao sincronizar transações.' };
  }

  const transacoesAcoes = await licencaTransacoesAcao({
    idLicenca: idLicenca?.toString(),
    idCliente: idCliente?.toString(),
  });

  if (!transacoesAcoes) {
    return { success: false, message: 'Falha ao buscar ações de transações.' };
  }

  const inserirAcoesResp = await inserirTransacoesSistemaAcaoCall(baseUrl, accessToken, transacoesAcoes);
  if (!inserirAcoesResp.succeeded) {
    return { success: false, message: 'Falha ao inserir ações de transações.' };
  }

  const uuidNavegador = await GlobalConfig.ensureUuidNavegador();

  const adicionarSessaoResp = await adicionarSessaoSistemaCall(baseUrl, accessToken, {
    usuario,
    idsistema: 1,
    codigoempresa: Number(codigoEmpresa),
    versao,
    uuidNavegador,
    maxsessoes: Number(numeroAcessos) || 0,
  });

  if (!adicionarSessaoResp.succeeded) {
    const message = (adicionarSessaoResp.data as any)?.message || (adicionarSessaoResp.jsonBody as any)?.message;
    return { success: false, message: message || 'Erro ao adicionar sessão do usuário.' };
  }

  const idSessaoUsuario = Number(
    (adicionarSessaoResp.data as any)?.idSessao || (adicionarSessaoResp.data as any)?.id_sessao,
  );
  if (idSessaoUsuario) GlobalConfig.setIdSessaoUsuario(idSessaoUsuario);

  const transResp = await obterUsuariosTransacoesSistemaCall(baseUrl, accessToken, usuario, '', false);
  const payload = transResp.data as any;
  const listaTransacoes = Array.isArray(payload?.transacoes)
    ? payload.transacoes
    : Array.isArray(payload)
      ? payload
      : [];

  const nivelCalc =
    payload?.NivelUsuario ??
    payload?.nivelUsuario ??
    (Array.isArray(listaTransacoes) && listaTransacoes.length > 0
      ? listaTransacoes[0]?.NivelUsuario ?? listaTransacoes[0]?.nivelUsuario
      : GlobalConfig.getNivelUsuario());

  const nivelNum = Number(nivelCalc || GlobalConfig.getNivelUsuario() || 0);

  GlobalConfig.setListaTransacaoUsuarioQSERPx(Array.isArray(listaTransacoes) ? listaTransacoes : []);
  GlobalConfig.setNivelUsuario(nivelNum);

  if ((!Array.isArray(listaTransacoes) || listaTransacoes.length === 0) && nivelNum < 9) {
    return { success: false, message: 'Este usuário não possui transações para acessar o sistema.' };
  }

  return { success: true };
};
