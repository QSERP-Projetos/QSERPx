import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAddOutline,
  IoArrowBack,
  IoCloseCircleOutline,
  IoCloseOutline,
  IoHelpCircleOutline,
  IoRefreshOutline,
  IoSearchOutline,
} from 'react-icons/io5';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../contexts/ToastContext';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { GlobalConfig } from '../../../services/globalConfig';
import {
  acoesUsuariosCall,
  consultarCepCall,
  incluirClienteCall,
  listaClientesCall,
  obterUsuariosTransacoesSistemaAcaoCall,
} from '../../../services/apiCalls';
import { getApiErrorMessage } from '../../../utils/getApiErrorMessage';

type Cliente = {
  codigo_Cliente?: number;
  nome_Fantasia?: string;
  razao_Social?: string;
  cep_Entrega?: string;
  endereco_Entrega?: string;
  estado_Entrega?: string;
  bairro_Entrega?: string;
  cidade_Entrega?: string;
  numero_Entrega?: string;
  complemento_Entrega?: string;
  fisica_Juridica?: number | string;
  cgc_Cpf?: string;
  num_Telefone?: string;
  endereco_Eletronico?: string;
  ibge?: number | string;
};

const getRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const asText = (value: any) => String(value ?? '').trim();
const onlyDigits = (value: string) => value.replace(/\D+/g, '');
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const formatCpf = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const formatCnpj = (value: string) => {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

const formatDocumento = (value: string, pessoa: '1' | '2') => {
  return pessoa === '1' ? formatCpf(value) : formatCnpj(value);
};

const formatCep = (value: string) => {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

type SortField = 'codigo' | 'nome' | 'cidade';
type SortDirection = 'asc' | 'desc';

type ClienteFormErrors = {
  nome?: string;
  razaoSocial?: string;
  cep?: string;
  endereco?: string;
  uf?: string;
  bairro?: string;
  cidade?: string;
  numero?: string;
  cpfCnpj?: string;
  email?: string;
};

const PESSOA_OPTIONS = [
  { value: '1', label: 'Física' },
  { value: '2', label: 'Jurídica' },
];

export function ClientesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sortField, setSortField] = useState<SortField>('codigo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [avisoOpen, setAvisoOpen] = useState(false);
  const [clienteOpen, setClienteOpen] = useState(false);
  const [modoConsulta, setModoConsulta] = useState(true);

  const [formNome, setFormNome] = useState('');
  const [formRazaoSocial, setFormRazaoSocial] = useState('');
  const [formPessoa, setFormPessoa] = useState<'1' | '2'>('1');
  const [formCpfCnpj, setFormCpfCnpj] = useState('');
  const [formCep, setFormCep] = useState('');
  const [formEndereco, setFormEndereco] = useState('');
  const [formUf, setFormUf] = useState('');
  const [formBairro, setFormBairro] = useState('');
  const [formCidade, setFormCidade] = useState('');
  const [formNumero, setFormNumero] = useState('');
  const [formComplemento, setFormComplemento] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formIbge, setFormIbge] = useState('');
  const [formErrors, setFormErrors] = useState<ClienteFormErrors>({});

  const registrarAcoesUsuario = useCallback(async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();
    const usuario = GlobalConfig.getUsuario();
    const idSessao = GlobalConfig.getIdSessaoUsuario();

    if (!baseUrl || !token || !usuario) {
      throw new Error('Informações de sessão não encontradas.');
    }

    await acoesUsuariosCall(baseUrl, token, {
      codigoEmpresa: codigoEmpresa ?? undefined,
      idSessao: idSessao ?? undefined,
      codigoUsuario: usuario,
    });

    return { baseUrl, token, usuario };
  }, []);

  const carregarClientes = useCallback(
    async (codigoCliente?: number | null) => {
      const baseUrl = GlobalConfig.getBaseUrl();
      const token = GlobalConfig.getJwToken();
      const usuario = GlobalConfig.getUsuario();
      const nivel = GlobalConfig.getNivelUsuario();

      if (!baseUrl || !token || !usuario) {
        showToast('Informações de sessão não encontradas.', 'error');
        return;
      }

      setLoading(true);
      try {
        const resp = await listaClientesCall(baseUrl, token, {
          codigoUsuario: usuario,
          codigoCliente: codigoCliente ?? undefined,
          filtro: '',
          nivel: nivel ?? '',
        });

        if (!resp.succeeded) {
          setClientes([]);
          showToast('Não foi possível carregar os clientes.', 'error');
          return;
        }

        setClientes(getRows(resp.jsonBody || resp.data));
      } catch (error: any) {
        setClientes([]);
        showToast(error?.message || 'Erro ao carregar clientes.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void carregarClientes();
  }, [carregarClientes]);

  const clientesFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clientes;

    return clientes.filter((item) => {
      const codigo = asText(item?.codigo_Cliente).toLowerCase();
      const nome = asText(item?.nome_Fantasia).toLowerCase();
      const razao = asText(item?.razao_Social).toLowerCase();
      return codigo.includes(term) || nome.includes(term) || razao.includes(term);
    });
  }, [clientes, search]);

  const clientesOrdenados = useMemo(() => {
    const list = [...clientesFiltrados];

    const getText = (value: any) => asText(value).toLocaleUpperCase('pt-BR');

    list.sort((a, b) => {
      if (sortField === 'codigo') {
        const aNum = Number(asText(a?.codigo_Cliente));
        const bNum = Number(asText(b?.codigo_Cliente));
        const safeANum = Number.isFinite(aNum) ? aNum : 0;
        const safeBNum = Number.isFinite(bNum) ? bNum : 0;
        return sortDirection === 'asc' ? safeANum - safeBNum : safeBNum - safeANum;
      }

      if (sortField === 'nome') {
        const aText = getText(a?.nome_Fantasia);
        const bText = getText(b?.nome_Fantasia);
        const comparison = aText.localeCompare(bText, 'pt-BR');
        return sortDirection === 'asc' ? comparison : comparison * -1;
      }

      const aCidade = getText(a?.cidade_Entrega);
      const bCidade = getText(b?.cidade_Entrega);
      const comparison = aCidade.localeCompare(bCidade, 'pt-BR');
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return list;
  }, [clientesFiltrados, sortDirection, sortField]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection('asc');
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return '▲▼';
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  const limparFormulario = () => {
    setFormNome('');
    setFormRazaoSocial('');
    setFormPessoa('1');
    setFormCpfCnpj('');
    setFormCep('');
    setFormEndereco('');
    setFormUf('');
    setFormBairro('');
    setFormCidade('');
    setFormNumero('');
    setFormComplemento('');
    setFormTelefone('');
    setFormEmail('');
    setFormIbge('');
    setFormErrors({});
  };

  const preencherFormulario = (cliente: Cliente, consulta: boolean) => {
    const pessoaRaw = asText(cliente?.fisica_Juridica);
    const pessoa: '1' | '2' = pessoaRaw === '1' || pessoaRaw.toUpperCase().startsWith('F') ? '1' : '2';

    setModoConsulta(consulta);
    setFormNome(asText(cliente?.nome_Fantasia));
    setFormRazaoSocial(asText(cliente?.razao_Social));
    setFormPessoa(pessoa);
    setFormCpfCnpj(formatDocumento(asText(cliente?.cgc_Cpf), pessoa));
    setFormCep(formatCep(asText(cliente?.cep_Entrega)));
    setFormEndereco(asText(cliente?.endereco_Entrega));
    setFormUf(asText(cliente?.estado_Entrega));
    setFormBairro(asText(cliente?.bairro_Entrega));
    setFormCidade(asText(cliente?.cidade_Entrega));
    setFormNumero(asText(cliente?.numero_Entrega));
    setFormComplemento(asText(cliente?.complemento_Entrega));
    setFormTelefone(asText(cliente?.num_Telefone));
    setFormEmail(asText(cliente?.endereco_Eletronico));
    setFormIbge(asText(cliente?.ibge));
    setFormErrors({});
  };

  const abrirConsulta = async (cliente: Cliente) => {
    try {
      const { baseUrl, token, usuario } = await registrarAcoesUsuario();

      const resp = await obterUsuariosTransacoesSistemaAcaoCall(baseUrl, token, usuario, '24', '1');
      if (!resp.succeeded) {
        showToast('Você não possui permissão para consultar clientes.', 'error');
        return;
      }

      preencherFormulario(cliente, true);
      setClienteOpen(true);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao consultar cliente.', 'error');
    }
  };

  const abrirNovoCliente = async () => {
    try {
      const { baseUrl, token, usuario } = await registrarAcoesUsuario();

      const resp = await obterUsuariosTransacoesSistemaAcaoCall(baseUrl, token, usuario, '23', '1');
      if (!resp.succeeded) {
        showToast('Você não possui permissão para incluir novos clientes.', 'error');
        return;
      }

      limparFormulario();
      setModoConsulta(false);
      setClienteOpen(true);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao abrir inclusão de cliente.', 'error');
    }
  };

  const consultarCep = async () => {
    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();

    if (!baseUrl || !token) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    const cep = onlyDigits(formCep);
    if (cep.length !== 8) {
      showToast('Informe um CEP válido com 8 números.', 'error');
      return;
    }

    try {
      const resp = await consultarCepCall(baseUrl, token, cep);
      if (!resp.succeeded) {
        showToast('CEP informado está incorreto.', 'error');
        return;
      }

      const data = resp.jsonBody ?? resp.data ?? {};
      if (!data?.logradouro) {
        showToast('CEP informado está incorreto.', 'error');
        return;
      }

      setFormEndereco(asText(data?.logradouro));
      setFormUf(asText(data?.uf));
      setFormBairro(asText(data?.bairro));
      setFormCidade(asText(data?.localidade));
      setFormIbge(asText(data?.ibge));
      setFormCep(formatCep(cep));
    } catch (error: any) {
      showToast(error?.message || 'Erro ao consultar CEP.', 'error');
    }
  };

  const handlePessoaChange = (nextPessoa: '1' | '2') => {
    setFormPessoa(nextPessoa);
    setFormCpfCnpj((prev) => formatDocumento(prev, nextPessoa));
  };

  const salvarCliente = async () => {
    if (saving) return;

    const baseUrl = GlobalConfig.getBaseUrl();
    const token = GlobalConfig.getJwToken();
    const codigoEmpresa = GlobalConfig.getCodEmpresa();

    if (!baseUrl || !token) {
      showToast('Informações de sessão não encontradas.', 'error');
      return;
    }

    const nomeFantasia = formNome.trim();
    const razaoSocial = formRazaoSocial.trim();
    const cepEntrega = onlyDigits(formCep);
    const numeroEndereco = formNumero.trim();
    const endereco = formEndereco.trim();
    const estado = formUf.trim().toUpperCase();
    const bairro = formBairro.trim();
    const cidade = formCidade.trim();
    const complemento = formComplemento.trim();
    const cnpjCpf = onlyDigits(formCpfCnpj);
    const telefone = onlyDigits(formTelefone);
    const email = formEmail.trim();
    const ibgeDigits = onlyDigits(formIbge);
    const ibge = ibgeDigits ? Number(ibgeDigits) : null;

    const nextErrors: ClienteFormErrors = {};

    if (!nomeFantasia) {
      nextErrors.nome = 'Nome é obrigatório.';
    }

    if (!razaoSocial) {
      nextErrors.razaoSocial = 'Razão social é obrigatória.';
    }

    if (cepEntrega.length !== 8) {
      nextErrors.cep = 'CEP deve conter 8 números.';
    }

    if (!numeroEndereco) {
      nextErrors.numero = 'Número é obrigatório.';
    }

    if (!endereco) nextErrors.endereco = 'Endereço é obrigatório.';
    if (!bairro) nextErrors.bairro = 'Bairro é obrigatório.';
    if (!cidade) nextErrors.cidade = 'Cidade é obrigatória.';
    if (estado.length !== 2) nextErrors.uf = 'UF deve ter 2 letras.';

    if (formPessoa === '1' && cnpjCpf && cnpjCpf.length !== 11) {
      nextErrors.cpfCnpj = 'CPF inválido. Informe 11 números.';
    }

    if (formPessoa === '2' && cnpjCpf && cnpjCpf.length !== 14) {
      nextErrors.cpfCnpj = 'CNPJ inválido. Informe 14 números.';
    }

    if (email && !isValidEmail(email)) {
      nextErrors.email = 'Informe um e-mail válido.';
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const resp = await incluirClienteCall(baseUrl, token, {
        codigoEmpresa: codigoEmpresa ?? null,
        razaoSocial,
        nomeFantasia,
        cepEntrega,
        endereco,
        estado,
        bairro,
        numero: numeroEndereco,
        complemento,
        fisicaJuridica: formPessoa === '1' ? 'Física' : 'Jurídica',
        cgcCpf: cnpjCpf,
        numTelefone: telefone,
        enderecoEletronico: email,
        ibge: Number.isFinite(ibge) ? ibge : null,
        cidade,
      });

      if (!resp.succeeded) {
        const apiMessage = getApiErrorMessage(resp, 'Não foi possível incluir o cliente.');
        showToast(apiMessage || 'Não foi possível incluir o cliente.', 'error');
        return;
      }

      showToast('Cliente incluído com sucesso.', 'success');
      setClienteOpen(false);
      await carregarClientes();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao incluir cliente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="clientes-page list-layout-page">
      <section className="clientes-page__header">
        <div className="clientes-page__title-wrap">
          <button className="icon-button" type="button" onClick={() => navigate(ROUTES.home)} aria-label="Voltar">
            <IoArrowBack size={18} />
          </button>
          <div>
            <h1>Clientes</h1>
            <p>Consulta e cadastro rápido de clientes.</p>
          </div>
        </div>
      </section>

      <section className="clientes-panel list-layout-panel">
        <div className="clientes-panel__top list-layout-panel__top">
          <div className="clientes-panel__summary">
            <strong>Total de registros</strong>
            <span>{clientesFiltrados.length} encontrados</span>
          </div>

          <div className="list-layout-controls clientes-panel__controls">
            <label className="list-layout-field list-layout-field--xl clientes-search" aria-label="Pesquisar cliente">
              <span className="clientes-search__label--desktop">Pesquisar</span>
              <span className="clientes-search__label--mobile">Clientes</span>
              <div className="clientes-search__input-wrap">
                <IoSearchOutline size={16} aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Pesquisar código, nome ou razão social"
                />

                {search.trim() ? (
                  <button
                    type="button"
                    className="clientes-search__clear"
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
              onClick={() => setAvisoOpen(true)}
              aria-label="Aviso"
              title="Aviso"
            >
              <IoHelpCircleOutline size={16} />
            </button>

            <button
              className="icon-button module-action-button"
              type="button"
              onClick={() => void carregarClientes()}
              aria-label="Atualizar"
              title="Atualizar"
            >
              <IoRefreshOutline size={16} />
            </button>

            <button
              className="icon-button module-action-button module-action-button--primary"
              type="button"
              onClick={() => void abrirNovoCliente()}
              aria-label="Novo cliente"
              title="Novo cliente"
            >
              <IoAddOutline size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="module-empty">Carregando clientes...</p>
        ) : clientesOrdenados.length === 0 ? (
          <p className="module-empty">Nenhum cliente encontrado.</p>
        ) : (
          <>
          <div className="table-scroll clientes-table-wrap">
            <table className="clientes-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="clientes-table__sort" onClick={() => handleSort('nome')}>
                      NOME FANTASIA <span>{getSortIndicator('nome')}</span>
                    </button>
                  </th>
                  <th>Razão social</th>
                  <th>
                    <button type="button" className="clientes-table__sort" onClick={() => handleSort('cidade')}>
                      CIDADE <span>{getSortIndicator('cidade')}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {clientesOrdenados.map((item, index) => {
                  const codigo = asText(item?.codigo_Cliente);
                  const nome = asText(item?.nome_Fantasia);
                  const razao = asText(item?.razao_Social);
                  const cidade = asText(item?.cidade_Entrega);
                  const uf = asText(item?.estado_Entrega);

                  return (
                    <tr
                      key={`${codigo || 'cliente'}-${index}`}
                      onClick={() => void abrirConsulta(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          void abrirConsulta(item);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td>{nome || '-'}</td>
                      <td>{razao || '-'}</td>
                      <td>{[cidade, uf].filter(Boolean).join(' / ') || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="clientes-cards">
            {clientesOrdenados.map((item, index) => {
              const codigo = asText(item?.codigo_Cliente);
              const razao = asText(item?.razao_Social);

              return (
                <article
                  key={`card-${codigo || 'cliente'}-${index}`}
                  className="clientes-card"
                  onClick={() => void abrirConsulta(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      void abrirConsulta(item);
                    }
                  }}
                  tabIndex={0}
                >
                  <div className="clientes-card__row">
                    <span>RAZAO SOCIAL</span>
                    <strong>{razao || '-'}</strong>
                  </div>
                </article>
              );
            })}
          </div>
          </>
        )}
      </section>

      {avisoOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card">
            <header className="modal-card__header">
              <h2>Aviso</h2>
              <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setAvisoOpen(false)}>
                <IoCloseOutline size={18} />
              </button>
            </header>

            <p className="module-empty">
              Os clientes cadastrados aqui devem ser confirmados no sistema Q4 em VENDAS &gt; FUNCOES &gt; CLIENTES
              PENDENTES.
            </p>
          </article>
        </section>
      )}

      {clienteOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="modal-card modal-card--wide">
            <header className="modal-card__header">
              <h2>{modoConsulta ? 'Consulta cliente' : 'Incluir cliente'}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => {
                  if (saving) return;
                  setClienteOpen(false);
                }}
              >
                <IoCloseOutline size={18} />
              </button>
            </header>

            <section className="module-form">
              <div className="form-grid-3">
                <label className="form-grid-3__full">
                  <span>Nome</span>
                  <input
                    className={formErrors.nome ? 'module-input-error' : ''}
                    value={formNome}
                    onChange={(event) => {
                      setFormNome(event.target.value);
                      if (formErrors.nome) setFormErrors((prev) => ({ ...prev, nome: undefined }));
                    }}
                    readOnly={modoConsulta}
                  />
                  {formErrors.nome && !modoConsulta ? <small className="module-field-error">{formErrors.nome}</small> : null}
                </label>

                <label className="form-grid-3__full">
                  <span>Razão social</span>
                  <input
                    className={formErrors.razaoSocial ? 'module-input-error' : ''}
                    value={formRazaoSocial}
                    onChange={(event) => {
                      setFormRazaoSocial(event.target.value);
                      if (formErrors.razaoSocial) setFormErrors((prev) => ({ ...prev, razaoSocial: undefined }));
                    }}
                    readOnly={modoConsulta}
                  />
                  {formErrors.razaoSocial && !modoConsulta ? <small className="module-field-error">{formErrors.razaoSocial}</small> : null}
                </label>

                <label>
                  <span>Tipo pessoa</span>
                  <SearchableSelect
                    value={formPessoa}
                    onChange={(nextValue) => handlePessoaChange(nextValue as '1' | '2')}
                    options={PESSOA_OPTIONS}
                    ariaLabel="Tipo pessoa"
                    searchPlaceholder="Pesquisar tipo"
                    disabled={modoConsulta}
                  />
                </label>

                <label>
                  <span>{formPessoa === '1' ? 'CPF' : 'CNPJ'}</span>
                  <input
                    className={formErrors.cpfCnpj ? 'module-input-error' : ''}
                    value={formCpfCnpj}
                    onChange={(event) => {
                      setFormCpfCnpj(formatDocumento(event.target.value, formPessoa));
                      if (formErrors.cpfCnpj) setFormErrors((prev) => ({ ...prev, cpfCnpj: undefined }));
                    }}
                    readOnly={modoConsulta}
                    inputMode="numeric"
                    maxLength={formPessoa === '1' ? 14 : 18}
                  />
                  {formErrors.cpfCnpj && !modoConsulta ? <small className="module-field-error">{formErrors.cpfCnpj}</small> : null}
                </label>

                <label>
                  <span>CEP</span>
                  <div className={`clientes-cep-input${modoConsulta ? ' is-readonly' : ''}`}>
                    <input
                      className={formErrors.cep ? 'module-input-error' : ''}
                      value={formCep}
                      onChange={(event) => {
                        setFormCep(formatCep(event.target.value));
                        if (formErrors.cep) setFormErrors((prev) => ({ ...prev, cep: undefined }));
                      }}
                      readOnly={modoConsulta}
                      inputMode="numeric"
                      maxLength={9}
                    />

                    {!modoConsulta && (
                      <button
                        className="icon-button module-action-button clientes-cep-search"
                        type="button"
                        onClick={() => void consultarCep()}
                        disabled={saving}
                        aria-label="Buscar CEP"
                        title="Buscar CEP"
                      >
                        <IoSearchOutline size={16} />
                      </button>
                    )}
                  </div>
                  {formErrors.cep && !modoConsulta ? <small className="module-field-error">{formErrors.cep}</small> : null}
                </label>

                <label className="form-grid-3__full">
                  <span>Endereço</span>
                  <input
                    className={formErrors.endereco ? 'module-input-error' : ''}
                    value={formEndereco}
                    onChange={(event) => {
                      setFormEndereco(event.target.value);
                      if (formErrors.endereco) setFormErrors((prev) => ({ ...prev, endereco: undefined }));
                    }}
                    readOnly
                  />
                  {formErrors.endereco && !modoConsulta ? <small className="module-field-error">{formErrors.endereco}</small> : null}
                </label>

                <label>
                  <span>UF</span>
                  <input
                    className={formErrors.uf ? 'module-input-error' : ''}
                    value={formUf}
                    onChange={(event) => {
                      setFormUf(event.target.value);
                      if (formErrors.uf) setFormErrors((prev) => ({ ...prev, uf: undefined }));
                    }}
                    readOnly
                  />
                  {formErrors.uf && !modoConsulta ? <small className="module-field-error">{formErrors.uf}</small> : null}
                </label>

                <label>
                  <span>Bairro</span>
                  <input
                    className={formErrors.bairro ? 'module-input-error' : ''}
                    value={formBairro}
                    onChange={(event) => {
                      setFormBairro(event.target.value);
                      if (formErrors.bairro) setFormErrors((prev) => ({ ...prev, bairro: undefined }));
                    }}
                    readOnly
                  />
                  {formErrors.bairro && !modoConsulta ? <small className="module-field-error">{formErrors.bairro}</small> : null}
                </label>

                <label>
                  <span>Cidade</span>
                  <input
                    className={formErrors.cidade ? 'module-input-error' : ''}
                    value={formCidade}
                    onChange={(event) => {
                      setFormCidade(event.target.value);
                      if (formErrors.cidade) setFormErrors((prev) => ({ ...prev, cidade: undefined }));
                    }}
                    readOnly
                  />
                  {formErrors.cidade && !modoConsulta ? <small className="module-field-error">{formErrors.cidade}</small> : null}
                </label>

                <label>
                  <span>Número</span>
                  <input
                    className={formErrors.numero ? 'module-input-error' : ''}
                    value={formNumero}
                    onChange={(event) => {
                      setFormNumero(event.target.value);
                      if (formErrors.numero) setFormErrors((prev) => ({ ...prev, numero: undefined }));
                    }}
                    readOnly={modoConsulta}
                  />
                  {formErrors.numero && !modoConsulta ? <small className="module-field-error">{formErrors.numero}</small> : null}
                </label>

                <label>
                  <span>Complemento</span>
                  <input
                    value={formComplemento}
                    onChange={(event) => setFormComplemento(event.target.value)}
                    readOnly={modoConsulta}
                  />
                </label>

                <label>
                  <span>Telefone</span>
                  <input
                    value={formTelefone}
                    onChange={(event) => setFormTelefone(event.target.value)}
                    readOnly={modoConsulta}
                  />
                </label>

                <label>
                  <span>E-mail</span>
                  <input
                    className={formErrors.email ? 'module-input-error' : ''}
                    value={formEmail}
                    onChange={(event) => {
                      setFormEmail(event.target.value);
                      if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    readOnly={modoConsulta}
                  />
                  {formErrors.email && !modoConsulta ? <small className="module-field-error">{formErrors.email}</small> : null}
                </label>

                <label>
                  <span>IBGE</span>
                  <input value={formIbge} onChange={(event) => setFormIbge(event.target.value)} readOnly />
                </label>
              </div>

              <div className="form-actions clientes-modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setClienteOpen(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>

                {!modoConsulta && (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void salvarCliente()}
                    disabled={saving}
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                )}
              </div>
            </section>
          </article>
        </section>
      )}
    </main>
  );
}
