import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { RequireAuth } from './RequireAuth';
import { ConfigPage } from '../pages/ConfigPage';
import { ConfigInicialPage } from '../pages/ConfigInicialPage';
import { LoginPage } from '../pages/LoginPage';
import { SelectCompanyPage } from '../pages/SelectCompanyPage';
import { HomePage } from '../pages/HomePage';
import { PedidoVendaPage } from '../features/vendas/pages/PedidoVendaPage';
import { PedidoVendaRepresentantesPage } from '../features/vendas/pages/PedidoVendaRepresentantesPage';
import { ApontamentoProducaoPage } from '../features/pcp/pages/ApontamentoProducaoPage';
import { ParadasMaquinaPage } from '../features/pcp/pages/ParadasMaquinaPage';
import { OrdensFabricacaoPage } from '../features/pcp/pages/OrdensFabricacaoPage';
import { PreparacaoMaquinaPage } from '../features/pcp/pages/PreparacaoMaquinaPage';
import { OrdensServicoPage } from '../features/servico/pages/OrdensServicoPage';
import { ApontamentoMaoObraPage } from '../features/servico/pages/ApontamentoMaoObraPage';
import { PedidoCompraLiberacaoPage } from '../features/compras/pages/PedidoCompraLiberacaoPage';
import { ClientesPage } from '../features/basico/pages/ClientesPage';
import { TipoApontamentoPage } from '../features/seguranca/pages/TipoApontamentoPage';
import { SessoesPage } from '../features/seguranca/pages/SessoesPage';
import { UsuariosPage } from '../features/seguranca/pages/UsuariosPage';
import { OrdensManutencaoPage } from '../features/manutencao/pages/OrdensManutencaoPage';
import { FichaInspecaoProcessoPage } from '../features/qualidade/pages/FichaInspecaoProcessoPage';
import { FichaInspecaoRecebimentoPage } from '../features/qualidade/pages/FichaInspecaoRecebimentoPage';
import { AppShellLayout } from '../layouts/AppShellLayout';

const DashboardFinanceiroPage = lazy(() =>
  import('../features/dashboards/pages/DashboardFinanceiroPage').then((module) => ({
    default: module.DashboardFinanceiroPage,
  })),
);

const DashboardVendasPage = lazy(() =>
  import('../features/dashboards/pages/DashboardVendasPage').then((module) => ({
    default: module.DashboardVendasPage,
  })),
);

export function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.root} element={<Navigate to={ROUTES.login} replace />} />
      <Route path={ROUTES.config} element={<ConfigPage />} />
      <Route path={ROUTES.configInicial} element={<ConfigInicialPage />} />
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.selectCompany} element={<SelectCompanyPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShellLayout />}>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route
            path={ROUTES.dashboardFinanceiro}
            element={
              <Suspense fallback={<p className="module-empty">Carregando dashboard financeiro...</p>}>
                <DashboardFinanceiroPage />
              </Suspense>
            }
          />
          <Route
            path={ROUTES.dashboardVendas}
            element={
              <Suspense fallback={<p className="module-empty">Carregando dashboard de vendas...</p>}>
                <DashboardVendasPage />
              </Suspense>
            }
          />
          <Route path={ROUTES.pedidoVenda} element={<PedidoVendaPage />} />
          <Route path={ROUTES.pedidoVendaRepresentantes} element={<PedidoVendaRepresentantesPage />} />
          <Route path={ROUTES.pedidoVendaNovo} element={<Navigate to={ROUTES.pedidoVenda} replace />} />
          <Route path={`${ROUTES.pedidoVendaEditar}/:numPedido`} element={<Navigate to={ROUTES.pedidoVenda} replace />} />
          <Route path={ROUTES.pcpApontamentoProducao} element={<ApontamentoProducaoPage />} />
          <Route path={ROUTES.pcpParadasMaquina} element={<ParadasMaquinaPage />} />
          <Route path={ROUTES.pcpOrdensFabricacao} element={<OrdensFabricacaoPage />} />
          <Route path={ROUTES.pcpPreparacaoMaquina} element={<PreparacaoMaquinaPage />} />
          <Route path={ROUTES.servicoOrdens} element={<OrdensServicoPage />} />
          <Route path={ROUTES.servicoApontamentoMaoObra} element={<ApontamentoMaoObraPage />} />
          <Route path={ROUTES.comprasPedidoLiberacao} element={<PedidoCompraLiberacaoPage />} />
          <Route path={ROUTES.basicoClientes} element={<ClientesPage />} />
          <Route path={ROUTES.segurancaUsuarios} element={<UsuariosPage />} />
          <Route path={ROUTES.segurancaTipoApontamento} element={<TipoApontamentoPage />} />
          <Route path={ROUTES.segurancaSessoes} element={<SessoesPage />} />
          <Route path={ROUTES.manutencaoOrdens} element={<OrdensManutencaoPage />} />
          <Route path={ROUTES.qualidadeFichaProcesso} element={<FichaInspecaoProcessoPage />} />
          <Route path={ROUTES.qualidadeFichaRecebimento} element={<FichaInspecaoRecebimentoPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
    </Routes>
  );
}
