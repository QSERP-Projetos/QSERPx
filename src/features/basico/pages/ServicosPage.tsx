import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoArrowBack,
  IoCloseCircleOutline,
  IoCloseOutline,
  IoCreateOutline,
  IoRefreshOutline,
  IoSearchOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { GlobalConfig } from '../../../services/globalConfig';
import { listaServicosCall, nbsCall, obterTributacoesCall, adicionarServicoCall, atualizarServicoCall, deletarServicoCall } from '../../../services/apiCalls';
import { SearchableSelect } from '../../../components/SearchableSelect';

type Servico = {
  codigo_Servico?: number | null;
  descr_Resumida?: string | null;
  descr_Completa?: string | null;
  tributacao_PIS?: string | null;
  descricao_Tributacao_PIS?: string | null;
  tributacao_Cofins?: string | null;
  descricao_Tributacao_Cofins?: string | null;
  codigo_Serv_LC116?: string | null;
  codigo_Tipo_Credito?: string | null;
  descricao_Tipo_Credito?: string | null;
  codigo_Credito?: string | null;
  descricao_Credito?: string | null;
  classificacao_Servico_MO_Emp?: string | null;
  servico_ativo?: number | null;
  csT_IBS_CBS?: string | null;
  descricao_CST_IBS_CBS?: string | null;
  classTrib_IBS_CBS?: string | null;
  descricao_Tributacao_IBS_CBS?: string | null;
  csT_IS?: string | null;
  descricao_CST_IS?: string | null;
  classTrib_IS?: string | null;
  descricao_Tributacao_IS?: string | null;
  cod_NBS?: string | null;
  trib_IS?: number | null;
  capitulo?: string | null;
  posicao?: string | null;
  item?: string | null;
  destino_Servico?: string | null;
};

type HelpTribItem = { codigo: string; descricao: string };

const getRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const asText = (value: any) => String(value ?? '');

export function ServicosPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [, setSelectedServico] = useState<Servico | null>(null);
  const [consultaOpen, setConsultaOpen] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [form, setForm] = useState<Servico>({});
  const [nbsLoading, setNbsLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Servico | null>(null);

  const helpTribSelectRef = useRef<(codigo: string, descricao: string) => void>(() => { });
  const [helpTrib, setHelpTrib] = useState<{
    open: boolean;
    titulo: string;
    loading: boolean;
    items: HelpTribItem[];
  }>({ open: false, titulo: '', loading: false, items: [] });

  const abrirHelpTrib = useCallback(
    async (tipo: string, titulo: string, onSelect: (codigo: string, descricao: string) => void) => {
      helpTribSelectRef.current = onSelect;
      setHelpTrib({ open: true, titulo, loading: true, items: [] });
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      if (!baseUrl || !token) {
        showToast('Informações de sessão não encontradas.', 'error');
        setHelpTrib((prev) => ({ ...prev, open: false, loading: false }));
        return;
      }
      try {
        const resp = await obterTributacoesCall(baseUrl, token, tipo);
        const rows = getRows(resp.jsonBody ?? resp.data);
        setHelpTrib((prev) => ({ ...prev, loading: false, items: rows }));
      } catch (err: any) {
        showToast(err?.message || 'Erro ao carregar tributações.', 'error');
        setHelpTrib((prev) => ({ ...prev, open: false, loading: false }));
      }
    },
    [showToast],
  );

  const buscarNbs = useCallback(async () => {
    const codigo = asText(form.cod_NBS);
    if (!codigo) {
      showToast('Informe o código NBS antes de buscar.', 'info');
      return;
    }
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }
    const hoje = new Date();
    const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    setNbsLoading(true);
    try {
      const resp = await nbsCall(baseUrl, token, codigo, data);
      if (!resp.succeeded) {
        showToast('NBS não encontrado.', 'error');
        return;
      }
      const d = resp.jsonBody ?? resp.data;
      setForm((prev) => ({
        ...prev,
        trib_IS: d.tributadoPeloImpostoSeletivo === true ? -1 : 0,
        capitulo: d.capitulo ?? prev.capitulo,
        posicao: d.posicao ?? prev.posicao,
        item: d.item ?? prev.item,
      }));
    } catch (err: any) {
      showToast(err?.message || 'Erro ao buscar NBS.', 'error');
    } finally {
      setNbsLoading(false);
    }
  }, [form.cod_NBS, showToast]);

  const carregarServicos = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();

    if (!baseUrl || !token) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    setLoading(true);
    try {
      const resp = await listaServicosCall(baseUrl, token);

      if (!resp.succeeded) {
        setServicos([]);
        showToast('Não foi possível carregar os serviços.', 'error');
        return;
      }

      setServicos(getRows(resp.jsonBody || resp.data));
    } catch (error: any) {
      setServicos([]);
      showToast(error?.message || 'Erro ao carregar serviços.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const salvarServico = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }
    if (!form.descr_Resumida?.trim()) {
      showToast('O campo Descrição é obrigatório.', 'info');
      return;
    }
    const isEdicao = !!form.codigo_Servico;
    setSalvando(true);
    try {
      const payload = {
        Codigo_Servico: isEdicao ? (form.codigo_Servico as number) : 0,
        Descr_Resumida: asText(form.descr_Resumida).trim(),
        Descr_Completa: asText(form.descr_Completa).trim(),
        Tributacao_PIS: asText(form.tributacao_PIS).trim(),
        Tributacao_Cofins: asText(form.tributacao_Cofins).trim(),
        Codigo_Serv_LC116: asText(form.codigo_Serv_LC116).trim(),
        Codigo_Tipo_Credito: asText(form.codigo_Tipo_Credito).trim(),
        Codigo_Credito: asText(form.codigo_Credito).trim(),
        Classificacao_Servico_MO_Emp: asText(form.classificacao_Servico_MO_Emp).trim(),
        Servico_Ativo: form.servico_ativo ?? -1,
        CST_IBS_CBS: asText(form.csT_IBS_CBS),
        Descricao_CST_IBS_CBS: asText(form.descricao_CST_IBS_CBS),
        ClassTrib_IBS_CBS: asText(form.classTrib_IBS_CBS),
        Descricao_Tributacao_IBS_CBS: asText(form.descricao_Tributacao_IBS_CBS),
        CST_IS: asText(form.csT_IS),
        Descricao_CST_IS: asText(form.descricao_CST_IS),
        ClassTrib_IS: asText(form.classTrib_IS),
        Descricao_Tributacao_IS: asText(form.descricao_Tributacao_IS),
        Cod_NBS: asText(form.cod_NBS),
        Trib_IS: form.trib_IS ?? 0,
        Capitulo: asText(form.capitulo),
        Posicao: asText(form.posicao),
        Item: asText(form.item),
        Destino_Servico: asText(form.destino_Servico),
      };
      const resp = isEdicao
        ? await atualizarServicoCall(baseUrl, token, payload)
        : await adicionarServicoCall(baseUrl, token, payload);
      if (!resp.succeeded) {
        const msg = resp.jsonBody?.message || 'Erro ao salvar serviço.';
        showToast(msg, 'error');
        return;
      }
      showToast(isEdicao ? 'Serviço atualizado com sucesso!' : 'Serviço adicionado com sucesso!', 'success');
      setConsultaOpen(false);
      void carregarServicos();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar serviço.', 'error');
    } finally {
      setSalvando(false);
    }
  }, [form, showToast, carregarServicos]);

  useEffect(() => {
    void carregarServicos();
  }, [carregarServicos]);

  const servicosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return servicos;

    return servicos.filter((item) => {
      const descricao = asText(item?.descr_Resumida).toLowerCase();
      const destino = asText(item?.destino_Servico).toLowerCase();
      return descricao.includes(term) || destino.includes(term);
    });
  }, [servicos, search]);

  const getStatusLabel = (ativo: any) => {
    const value = Number(ativo);
    return value === 0 ? 'Inativo' : 'Ativo';
  };

  const getStatusClass = (ativo: any) => {
    const value = Number(ativo);
    return value === 0 ? 'status-badge status-badge--inactive' : 'status-badge status-badge--active';
  };

  const abrirConsulta = async (item: Servico) => {
    setSelectedServico(item);
    setModoEdicao(false);
    setConsultaOpen(true);

    // Busca descrições em paralelo para os campos que têm código
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) { setForm(item); return; }

    const buscar = async (tipo: string, cod: string | null | undefined): Promise<string> => {
      if (!cod) return '';
      try {
        const r = await obterTributacoesCall(baseUrl, token, `${tipo}/${cod}`);
        const body = r.jsonBody ?? r.data;
        // Pode retornar array ou objeto único
        if (Array.isArray(body)) return body[0]?.descricao ?? '';
        if (body?.descricao) return body.descricao;
        if (Array.isArray(body?.data)) return body.data[0]?.descricao ?? '';
        if (body?.data?.descricao) return body.data.descricao;
        const rows = getRows(body);
        return rows[0]?.descricao ?? '';
      } catch { return ''; }
    };

    const [
      descCredito,
      descTipoCredito,
      descPIS,
      descCofins,
      descCBSIBS,
      descIS,
      descClassCBSIBS,
      descClassIS,
    ] = await Promise.all([
      buscar('credito', item.codigo_Credito),
      buscar('TipoCredito', item.codigo_Tipo_Credito),
      buscar('PISCofins', item.tributacao_PIS),
      buscar('PISCofins', item.tributacao_Cofins),
      buscar('CBSIBS', item.csT_IBS_CBS),
      buscar('IS', item.csT_IS),
      item.csT_IBS_CBS && item.classTrib_IBS_CBS
        ? buscar(`ClassTribIBSCBS/${item.csT_IBS_CBS}`, item.classTrib_IBS_CBS)
        : Promise.resolve(''),
      item.csT_IS && item.classTrib_IS
        ? buscar(`ClassTribIS/${item.csT_IS}`, item.classTrib_IS)
        : Promise.resolve(''),
    ]);

    setForm({
      ...item,
      descricao_Credito: descCredito || item.descricao_Credito,
      descricao_Tipo_Credito: descTipoCredito || item.descricao_Tipo_Credito,
      descricao_Tributacao_PIS: descPIS || item.descricao_Tributacao_PIS,
      descricao_Tributacao_Cofins: descCofins || item.descricao_Tributacao_Cofins,
      descricao_CST_IBS_CBS: descCBSIBS || item.descricao_CST_IBS_CBS,
      descricao_CST_IS: descIS || item.descricao_CST_IS,
      descricao_Tributacao_IBS_CBS: descClassCBSIBS || item.descricao_Tributacao_IBS_CBS,
      descricao_Tributacao_IS: descClassIS || item.descricao_Tributacao_IS,
    });
  };

  const deletarServico = useCallback((item: Servico, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.codigo_Servico) return;
    setDeleteConfirm(item);
  }, []);

  const confirmarDelete = useCallback(async () => {
    if (!deleteConfirm?.codigo_Servico) return;
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    if (!baseUrl || !token) { showToast('Informações de sessão não encontradas.', 'error'); return; }
    try {
      const resp = await deletarServicoCall(baseUrl, token, deleteConfirm.codigo_Servico);
      if (!resp.succeeded) {
        showToast(resp.jsonBody?.message || 'Erro ao excluir serviço.', 'error');
        return;
      }
      showToast('Serviço excluído com sucesso!', 'success');
      setDeleteConfirm(null);
      void carregarServicos();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao excluir serviço.', 'error');
    }
  }, [deleteConfirm, showToast, carregarServicos]);

  const abrirNovo = () => {
    setForm({});
    setSelectedServico(null);
    setModoEdicao(true);
    setConsultaOpen(true);
  };

  const handleField = (field: keyof Servico, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <main className="servicos-page">
      <section className="servicos-page__header">
        <div className="servicos-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Serviços</h1>
            <p>Consulta de serviços cadastrados.</p>
          </div>
        </div>
      </section>

      <section className="servicos-panel">
        <div className="servicos-panel__top">
          <div className="servicos-panel__summary">
            <strong>Total de registros</strong>
            <span>{servicosFiltrados.length} encontrados</span>
          </div>

          <div className="servicos-panel__controls">
            <label className="list-layout-field list-layout-field--xl servicos-search" aria-label="Pesquisar serviço">
              <span>Pesquisar</span>
              <div className="servicos-search__input-wrap">
                <IoSearchOutline size={16} aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Pesquisar descrição ou destino"
                />
                {search.trim() ? (
                  <button
                    type="button"
                    className="servicos-search__clear"
                    onClick={() => setSearch('')}
                    aria-label="Limpar pesquisa"
                    title="Limpar pesquisa"
                  >
                    <IoCloseCircleOutline size={16} />
                  </button>
                ) : null}
              </div>
            </label>

            <button
              className="icon-button module-action-button"
              type="button"
              onClick={() => void carregarServicos()}
              aria-label="Atualizar"
              title="Atualizar"
            >
              <IoRefreshOutline size={16} />
            </button>

            <button
              className="icon-button module-action-button module-action-button--primary"
              type="button"
              onClick={abrirNovo}
              aria-label="Novo serviço"
              title="Novo serviço"
            >
              <IoAddOutline size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="module-empty">Carregando serviços...</p>
        ) : servicosFiltrados.length === 0 ? (
          <p className="module-empty">Nenhum serviço encontrado.</p>
        ) : (
          <div className="table-scroll servicos-table-wrap">
            <table className="servicos-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Destino</th>
                  <th>Status</th>
                  <th className="servicos-table__col-acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {servicosFiltrados.map((item, index) => {
                  const codigo = asText(item?.codigo_Servico);
                  const descricao = asText(item?.descr_Resumida);
                  const destino = asText(item?.destino_Servico);

                  return (
                    <tr
                      key={`${codigo || 'servico'}-${index}`}
                      className="servicos-table__row--clickable"
                      onClick={() => abrirConsulta(item)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirConsulta(item); } }}
                      tabIndex={0}
                    >
                      <td>{descricao || '-'}</td>
                      <td>{destino || '-'}</td>
                      <td>
                        <span className={getStatusClass(item?.servico_ativo)}>
                          {getStatusLabel(item?.servico_ativo)}
                        </span>
                      </td>
                      <td className="servicos-table__col-acoes">
                        <div className="servicos-table__acoes">
                          <button
                            type="button"
                            className="icon-button servicos-table__btn-acao"
                            aria-label="Editar serviço"
                            title="Editar"
                            onClick={(e) => { e.stopPropagation(); abrirConsulta(item); }}
                          >
                            <IoCreateOutline size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-button servicos-table__btn-acao servicos-table__btn-acao--danger"
                            aria-label="Excluir serviço"
                            title="Excluir"
                            onClick={(e) => deletarServico(item, e)}
                          >
                            <IoTrashOutline size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {consultaOpen && (() => {
        const s = form;
        const ro = !modoEdicao;
        const set = (field: keyof Servico) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleField(field, e.target.value);
        return (
          <section className="modal-backdrop" role="dialog" aria-modal="true">
            <article className="modal-card modal-card--servicos">
              <header className="modal-card__header">
                <h2>{modoEdicao ? (form.codigo_Servico ? 'Editar Serviço' : 'Novo Serviço') : 'Consulta de Serviço'}</h2>
                <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setConsultaOpen(false)}>
                  <IoCloseOutline size={18} />
                </button>
              </header>

              <div className="servicos-consulta-body">
                {/* Linha de cabeçalho: Código (consulta) | Destino | Status */}
                <div className={`servicos-consulta-toprow${modoEdicao ? ' servicos-consulta-toprow--novo' : ''}`}>
                  {!modoEdicao && (
                    <label className="servicos-consulta-label">
                      <span>Código</span>
                      <input readOnly value={asText(s.codigo_Servico)} />
                    </label>
                  )}
                  <label className="servicos-consulta-label">
                    <span>Destino</span>
                    <SearchableSelect
                      options={[
                        { value: 'Recebimento', label: 'Recebimento' },
                        { value: 'Faturamento', label: 'Faturamento' },
                      ]}
                      value={asText(s.destino_Servico)}
                      onChange={(v) => handleField('destino_Servico', v)}
                      enableSearch={false}
                      placeholder="Selecione..."
                      disabled={ro}
                    />
                  </label>
                  <div className="servicos-consulta-label servicos-consulta-status">
                    <span>Status</span>
                    <div className="servicos-consulta-status__value">
                      {ro ? (
                        <span className={`servicos-status-text ${Number(s.servico_ativo) !== 0 ? 'servicos-status-text--ativo' : 'servicos-status-text--inativo'}`}>
                          {getStatusLabel(s.servico_ativo)}
                        </span>
                      ) : (
                        <select
                          className="servicos-status-select"
                          value={String(s.servico_ativo ?? '-1')}
                          onChange={(e) => handleField('servico_ativo', Number(e.target.value))}
                        >
                          <option value="-1">Ativo</option>
                          <option value="0">Inativo</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                {/* Descrição */}
                <label className="servicos-consulta-label">
                  <span>Descrição</span>
                  <input readOnly={ro} value={asText(s.descr_Resumida)} onChange={set('descr_Resumida')} />
                </label>

                {/* Detalhada */}
                <label className="servicos-consulta-label">
                  <span>Detalhada</span>
                  <textarea readOnly={ro} rows={3} value={asText(s.descr_Completa)} onChange={set('descr_Completa')} />
                </label>

                {/* NBS */}
                <div className="servicos-fieldset">
                  <div className="servicos-fieldset__title">NBS (Nomenclatura Brasileira de Serviços)</div>
                  <div className="servicos-fieldset__body">

                    {/* Linha 1: Trib. IS isolado */}
                    <label className="servicos-consulta-label servicos-nbs-tribis-row">
                      <span>Trib. IS</span>
                      <div className="servicos-nbs-checkbox">
                        <input
                          type="checkbox"
                          disabled
                          checked={s.trib_IS !== null && s.trib_IS !== undefined ? s.trib_IS !== 0 : false}
                          onChange={() => { }}
                        />
                      </div>
                    </label>

                    {/* Linha 2: Código + lupa | Posição */}
                    <div className="servicos-nbs-2col">
                      <label className="servicos-consulta-label">
                        <span>Código</span>
                        <div className="servicos-nbs-codigo-wrap">
                          <input readOnly={ro} className="servicos-nbs-codigo-input" value={asText(s.cod_NBS)} onChange={set('cod_NBS')} />
                          <button
                            type="button"
                            className="icon-button servicos-nbs-busca-btn"
                            aria-label="Buscar NBS"
                            title="Buscar NBS"
                            disabled={ro || nbsLoading}
                            onClick={buscarNbs}
                          >
                            <IoSearchOutline size={15} />
                          </button>
                        </div>
                      </label>
                      <label className="servicos-consulta-label">
                        <span>Posição</span>
                        <input readOnly={ro} value={asText(s.posicao)} onChange={set('posicao')} />
                      </label>
                    </div>

                    {/* Linha 3: Capítulo | Item */}
                    <div className="servicos-nbs-2col servicos-nbs-2col--stretch">
                      <label className="servicos-consulta-label">
                        <span>Capítulo</span>
                        <input readOnly={ro} value={asText(s.capitulo)} onChange={set('capitulo')} />
                      </label>
                      <label className="servicos-consulta-label">
                        <span>Item</span>
                        <textarea readOnly={ro} rows={2} value={asText(s.item)} onChange={set('item')} />
                      </label>
                    </div>

                  </div>
                </div>

                {/* Tributação */}
                <div className="servicos-fieldset">
                  <div className="servicos-fieldset__title">Tributação</div>
                  <div className="servicos-fieldset__body">
                    <div className="servicos-trib-2col">

                      {/* Coluna esquerda */}
                      <div className="servicos-trib-col">
                        <div className="servicos-trib-row">
                          <span className="servicos-trib-row__label">Base Crédito</span>
                          <div className="servicos-trib-row__inputs">
                            <input
                              readOnly={ro}
                              className="servicos-trib-row__code"
                              value={asText(s.codigo_Credito)}
                              onChange={(e) => { const v = e.target.value; handleField('codigo_Credito', v); if (!v) handleField('descricao_Credito', ''); }}
                              onKeyDown={(e) => {
                                if (!ro && e.ctrlKey && e.key === 'F3') {
                                  e.preventDefault();
                                  abrirHelpTrib('credito', 'Base Crédito', (cod, desc) => {
                                    handleField('codigo_Credito', cod);
                                    handleField('descricao_Credito', desc);
                                  });
                                }
                              }}
                              title="Ctrl+F3 para pesquisar"
                            />
                            <input readOnly value={asText(s.descricao_Credito)} />
                          </div>
                        </div>
                        <div className="servicos-trib-row">
                          <span className="servicos-trib-row__label">Tipo Crédito</span>
                          <div className="servicos-trib-row__inputs">
                            <input
                              readOnly={ro}
                              className="servicos-trib-row__code"
                              value={asText(s.codigo_Tipo_Credito)}
                              onChange={(e) => { const v = e.target.value; handleField('codigo_Tipo_Credito', v); if (!v) handleField('descricao_Tipo_Credito', ''); }}
                              onKeyDown={(e) => {
                                if (!ro && e.ctrlKey && e.key === 'F3') {
                                  e.preventDefault();
                                  abrirHelpTrib('TipoCredito', 'Tipo Crédito', (cod, desc) => {
                                    handleField('codigo_Tipo_Credito', cod);
                                    handleField('descricao_Tipo_Credito', desc);
                                  });
                                }
                              }}
                              title="Ctrl+F3 para pesquisar"
                            />
                            <input readOnly value={asText(s.descricao_Tipo_Credito)} />
                          </div>
                        </div>
                        <div className="servicos-trib-row">
                          <span className="servicos-trib-row__label">Tributação PIS</span>
                          <div className="servicos-trib-row__inputs">
                            <input
                              readOnly={ro}
                              className="servicos-trib-row__code"
                              value={asText(s.tributacao_PIS)}
                              onChange={(e) => { const v = e.target.value; handleField('tributacao_PIS', v); if (!v) handleField('descricao_Tributacao_PIS', ''); }}
                              onKeyDown={(e) => {
                                if (!ro && e.ctrlKey && e.key === 'F3') {
                                  e.preventDefault();
                                  abrirHelpTrib('PISCofins', 'Tributação PIS', (cod, desc) => {
                                    handleField('tributacao_PIS', cod);
                                    handleField('descricao_Tributacao_PIS', desc);
                                  });
                                }
                              }}
                              title="Ctrl+F3 para pesquisar"
                            />
                            <input readOnly value={asText(s.descricao_Tributacao_PIS)} />
                          </div>
                        </div>
                        <div className="servicos-trib-row">
                          <span className="servicos-trib-row__label">Tributação Cofins</span>
                          <div className="servicos-trib-row__inputs">
                            <input
                              readOnly={ro}
                              className="servicos-trib-row__code"
                              value={asText(s.tributacao_Cofins)}
                              onChange={(e) => { const v = e.target.value; handleField('tributacao_Cofins', v); if (!v) handleField('descricao_Tributacao_Cofins', ''); }}
                              onKeyDown={(e) => {
                                if (!ro && e.ctrlKey && e.key === 'F3') {
                                  e.preventDefault();
                                  abrirHelpTrib('PISCofins', 'Tributação Cofins', (cod, desc) => {
                                    handleField('tributacao_Cofins', cod);
                                    handleField('descricao_Tributacao_Cofins', desc);
                                  });
                                }
                              }}
                              title="Ctrl+F3 para pesquisar"
                            />
                            <input readOnly value={asText(s.descricao_Tributacao_Cofins)} />
                          </div>
                        </div>
                        <div className="servicos-trib-row">
                          <span className="servicos-trib-row__label">Tributação CBS/IBS</span>
                          <div className="servicos-trib-row__inputs">
                            <input
                              readOnly={ro}
                              className="servicos-trib-row__code"
                              value={asText(s.csT_IBS_CBS)}
                              onChange={(e) => { const v = e.target.value; handleField('csT_IBS_CBS', v); if (!v) handleField('descricao_CST_IBS_CBS', ''); }}
                              onKeyDown={(e) => {
                                if (!ro && e.ctrlKey && e.key === 'F3') {
                                  e.preventDefault();
                                  abrirHelpTrib('CBSIBS', 'Tributação CBS/IBS', (cod, desc) => {
                                    handleField('csT_IBS_CBS', cod);
                                    handleField('descricao_CST_IBS_CBS', desc);
                                  });
                                }
                              }}
                              title="Ctrl+F3 para pesquisar"
                            />
                            <input readOnly value={asText(s.descricao_CST_IBS_CBS)} />
                          </div>
                        </div>
                      </div>

                      {/* Coluna direita */}
                      <div className="servicos-trib-col">
                        <div className="servicos-trib-row">
                          <span className="servicos-trib-row__label">Tributação IS</span>
                          <div className="servicos-trib-row__inputs">
                            <input
                              readOnly={ro}
                              className="servicos-trib-row__code"
                              value={asText(s.csT_IS)}
                              onChange={(e) => { const v = e.target.value; handleField('csT_IS', v); if (!v) handleField('descricao_CST_IS', ''); }}
                              onKeyDown={(e) => {
                                if (!ro && e.ctrlKey && e.key === 'F3') {
                                  e.preventDefault();
                                  abrirHelpTrib('IS', 'Tributação IS', (cod, desc) => {
                                    handleField('csT_IS', cod);
                                    handleField('descricao_CST_IS', desc);
                                  });
                                }
                              }}
                              title="Ctrl+F3 para pesquisar"
                            />
                            <input readOnly value={asText(s.descricao_CST_IS)} />
                          </div>
                        </div>
                        <div className="servicos-trib-row">
                          <span className="servicos-trib-row__label">Class. CBS/IBS</span>
                          <div className="servicos-trib-row__inputs">
                            <input
                              readOnly={ro}
                              className="servicos-trib-row__code"
                              value={asText(s.classTrib_IBS_CBS)}
                              onChange={(e) => { const v = e.target.value; handleField('classTrib_IBS_CBS', v); if (!v) handleField('descricao_Tributacao_IBS_CBS', ''); }}
                              onKeyDown={(e) => {
                                if (!ro && e.ctrlKey && e.key === 'F3') {
                                  e.preventDefault();
                                  const codTrib = asText(s.csT_IBS_CBS);
                                  if (!codTrib) { showToast('Preencha o código de Tributação CBS/IBS antes de pesquisar.', 'info'); return; }
                                  abrirHelpTrib(`ClassTribIBSCBS/${codTrib}`, 'Class. CBS/IBS', (cod, desc) => {
                                    handleField('classTrib_IBS_CBS', cod);
                                    handleField('descricao_Tributacao_IBS_CBS', desc);
                                  });
                                }
                              }}
                              title="Ctrl+F3 para pesquisar (requer Tributação CBS/IBS)"
                            />
                            <input readOnly value={asText(s.descricao_Tributacao_IBS_CBS)} />
                          </div>
                        </div>
                        <div className="servicos-trib-row">
                          <span className="servicos-trib-row__label">Class. IS</span>
                          <div className="servicos-trib-row__inputs">
                            <input
                              readOnly={ro}
                              className="servicos-trib-row__code"
                              value={asText(s.classTrib_IS)}
                              onChange={(e) => { const v = e.target.value; handleField('classTrib_IS', v); if (!v) handleField('descricao_Tributacao_IS', ''); }}
                              onKeyDown={(e) => {
                                if (!ro && e.ctrlKey && e.key === 'F3') {
                                  e.preventDefault();
                                  const codTrib = asText(s.csT_IS);
                                  if (!codTrib) { showToast('Preencha o código de Tributação IS antes de pesquisar.', 'info'); return; }
                                  abrirHelpTrib(`ClassTribIS/${codTrib}`, 'Class. IS', (cod, desc) => {
                                    handleField('classTrib_IS', cod);
                                    handleField('descricao_Tributacao_IS', desc);
                                  });
                                }
                              }}
                              title="Ctrl+F3 para pesquisar (requer Tributação IS)"
                            />
                            <input readOnly value={asText(s.descricao_Tributacao_IS)} />
                          </div>
                        </div>
                        <div className="servicos-trib-row">
                          <span className="servicos-trib-row__label">Cod. LC116/03</span>
                          <div className="servicos-trib-row__inputs">
                            <input readOnly={ro} value={asText(s.codigo_Serv_LC116)} onChange={set('codigo_Serv_LC116')} />
                          </div>
                        </div>
                        <div className="servicos-trib-row">
                          <span className="servicos-trib-row__label">REINF (Tab. 6)</span>
                          <div className="servicos-trib-row__inputs">
                            <input readOnly={ro} value={asText(s.classificacao_Servico_MO_Emp)} onChange={set('classificacao_Servico_MO_Emp')} />
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

              {modoEdicao ? (
                <footer className="servicos-consulta-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setConsultaOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={salvarServico}
                    disabled={salvando}
                  >
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                </footer>
              ) : (
                <footer className="servicos-consulta-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setConsultaOpen(false)}
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setModoEdicao(true)}
                  >
                    Editar
                  </button>
                </footer>
              )}
            </article>
          </section>
        );
      })()}

      {/* Modal confirmar exclusão */}
      {deleteConfirm && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirmar exclusão">
          <article className="modal-card">
            <header className="modal-card__header">
              <h2>Confirmar exclusão</h2>
            </header>
            <section className="module-form">
              <p>Deseja excluir o serviço <strong>{deleteConfirm.descr_Resumida}</strong>?</p>
              <div className="form-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancelar
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void confirmarDelete()}
                >
                  Excluir
                </button>
              </div>
            </section>
          </article>
        </section>
      )}

      {/* Help Tributação Modal */}
      {helpTrib.open && (
        <div className="modal-backdrop" onClick={() => setHelpTrib((prev) => ({ ...prev, open: false }))}>
          <article className="modal-card modal-card--help-trib" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <span className="modal-card__title">Help de Tributação — {helpTrib.titulo}</span>
              <button
                type="button"
                className="icon-button"
                onClick={() => setHelpTrib((prev) => ({ ...prev, open: false }))}
                aria-label="Fechar"
              >
                <IoCloseOutline size={20} />
              </button>
            </div>
            {helpTrib.loading ? (
              <div className="help-trib-loading">Carregando...</div>
            ) : (
              <div className="help-trib-table-wrap">
                <table className="help-trib-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {helpTrib.items.map((item) => (
                      <tr
                        key={item.codigo}
                        className="help-trib-table__row"
                        onClick={() => {
                          helpTribSelectRef.current(item.codigo, item.descricao);
                          setHelpTrib((prev) => ({ ...prev, open: false }));
                        }}
                      >
                        <td>{item.codigo}</td>
                        <td>{item.descricao}</td>
                      </tr>
                    ))}
                    {helpTrib.items.length === 0 && (
                      <tr>
                        <td colSpan={2} className="help-trib-empty">Nenhum resultado encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <footer className="help-trib-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setHelpTrib((prev) => ({ ...prev, open: false }))}
              >
                Fechar
              </button>
            </footer>
          </article>
        </div>
      )}
    </main>
  );
}
