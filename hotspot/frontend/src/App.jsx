import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Login from "./pages/admin/Login";
import Unidades from "./pages/admin/Unidades";
import PortalDesigner from "./pages/admin/PortalDesigner";
import CaptivePortal from "./pages/public/CaptivePortal";
import MeusDados from "./pages/public/MeusDados";
import Dashboard from "./pages/admin/Dashboard";
import Mikrotiks from "./pages/admin/Mikrotiks";
import Planos from "./pages/admin/Planos";
import Configuracoes from "./pages/admin/Configuracoes";
import Pagamentos from "./pages/admin/Pagamentos";
import UsuariosRadius from "./pages/admin/UsuariosRadius";
import LgpdCadastros from "./pages/admin/LgpdCadastros";
import Sessoes from "./pages/admin/Sessoes";
import SessoesLog from "./pages/admin/SessoesLog";
import Usuarios from "./pages/admin/Usuarios";
import Wireguard from "./pages/admin/Wireguard";
import Portais from "./pages/admin/Portais";
import PortalEditor from "./pages/admin/PortalEditor";
import Leads from "./pages/admin/Leads";
import Compliance from "./pages/admin/Compliance";
import EmpresasAdmin from "./pages/admin/EmpresasAdmin";
import GruposPermissao from "./pages/admin/GruposPermissao";
import WhatsApp from "./pages/admin/WhatsApp";
import Campanhas from "./pages/admin/Campanhas";
import CampanhaEditor from "./pages/admin/CampanhaEditor";
import Empresas from "./pages/super/Empresas";
import SuperDashboard from "./pages/super/SuperDashboard";
import Backups from "./pages/super/Backups";
import AtualizarSistema from "./pages/super/AtualizarSistema";
import PublicarAtualizacao from "./pages/super/PublicarAtualizacao";

import PlanosCliente from "./pages/public/PlanosCliente";
import Pagamento from "./pages/public/Pagamento";
import LgpdAuto from "./pages/public/LgpdAuto";
import CadastroLGPD from "./pages/public/CadastroLGPD";
import CadastroLead from "./pages/public/CadastroLead";
import CadastroLeadPassivo from "./pages/public/CadastroLeadPassivo";
import CadastroCliente from "./pages/public/CadastroCliente";
import Registro from "./pages/public/Registro";
import CampanhaPlayer from "./pages/public/CampanhaPlayer";
import LoginHotspot from "./pages/public/LoginHotspot";

// Componente de proteção
const RotaPrivada = ({ children }) => {
  const { user, loading } = useAuth();
  const { empresaSlug } = useParams();
  if (loading) return null;
  if (!user) return <Navigate to="/" />;
  if (user.role !== "super_admin" && empresaSlug !== user.empresa_slug)
    return <Navigate to={`/admin/${user.empresa_slug}`} replace />;
  return children;
};

const RotaSuper = ({ children }) => {
  const { user, loading, isSuperAdmin } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" />;
  if (!isSuperAdmin)
    return <Navigate to={`/admin/${user.empresa_slug}`} replace />;
  return children;
};

// Redireciona /admin para /admin/:slug
const AdminRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" />;
  return (
    <Navigate
      to={
        user.role === "super_admin" ? "/super" : `/admin/${user.empresa_slug}`
      }
      replace
    />
  );
};

function App() {
  return (
    <Routes>
      {/* Público */}
      <Route path="/" element={<Login />} />
      <Route path="/wifi/:equipmentId" element={<CaptivePortal />} />
      <Route path="/meus-dados" element={<MeusDados />} />
      <Route path="/cadastro-cliente" element={<CadastroCliente />} />
      <Route path="/planos-cliente" element={<PlanosCliente />} />
      <Route path="/pagamento/:id" element={<Pagamento />} />
      <Route path="/lgpd" element={<LgpdAuto />} />
      <Route path="/cadastro" element={<CadastroLGPD />} />
      <Route path="/lead" element={<CadastroLead />} />
      <Route path="/lead-passivo" element={<CadastroLeadPassivo />} />
      <Route path="/login-hotspot" element={<LoginHotspot />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/campanha/:portalId" element={<CampanhaPlayer />} />

      {/* Redirect /admin -> /admin/:slug */}
      <Route path="/admin" element={<AdminRedirect />} />

      {/* Admin (protegidas com empresa slug) */}
      <Route
        path="/admin/:empresaSlug"
        element={
          <RotaPrivada>
            <Unidades />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/unidades"
        element={
          <RotaPrivada>
            <Unidades />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/portais/:portalId/configurar"
        element={
          <RotaPrivada>
            <PortalDesigner />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/empresas"
        element={
          <RotaPrivada>
            <EmpresasAdmin />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/mikrotiks"
        element={
          <RotaPrivada>
            <Mikrotiks />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/vpn"
        element={
          <RotaPrivada>
            <Wireguard />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/portais"
        element={
          <RotaPrivada>
            <Unidades initialTab="Portais" />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/portais/:portalId/editor"
        element={
          <RotaPrivada>
            <PortalEditor />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/planos"
        element={
          <RotaPrivada>
            <Planos />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/configuracoes"
        element={
          <RotaPrivada>
            <Configuracoes />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/pagamentos"
        element={
          <RotaPrivada>
            <Pagamentos />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/radius"
        element={
          <RotaPrivada>
            <UsuariosRadius />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/lgpd"
        element={
          <RotaPrivada>
            <LgpdCadastros />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/sessoes"
        element={
          <RotaPrivada>
            <Sessoes />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/sessoeslog"
        element={
          <RotaPrivada>
            <SessoesLog />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/leads"
        element={
          <RotaPrivada>
            <Leads />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/compliance"
        element={
          <RotaPrivada>
            <Compliance />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/usuarios"
        element={
          <RotaPrivada>
            <Usuarios />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/grupos-permissao"
        element={
          <RotaPrivada>
            <GruposPermissao />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/whatsapp"
        element={
          <RotaPrivada>
            <WhatsApp />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/campanhas"
        element={
          <RotaPrivada>
            <Campanhas />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/campanhas/:id"
        element={
          <RotaPrivada>
            <CampanhaEditor />
          </RotaPrivada>
        }
      />

      {/* Super Admin */}
      <Route
        path="/super/usuarios"
        element={
          <RotaSuper>
            <Usuarios global />
          </RotaSuper>
        }
      />
      <Route
        path="/super"
        element={
          <RotaSuper>
            <SuperDashboard />
          </RotaSuper>
        }
      />
      <Route
        path="/super/empresas"
        element={
          <RotaSuper>
            <Empresas />
          </RotaSuper>
        }
      />
      <Route
        path="/super/atualizar"
        element={
          <RotaSuper>
            <AtualizarSistema />
          </RotaSuper>
        }
      />
      <Route
        path="/super/backups"
        element={
          <RotaSuper>
            <Backups />
          </RotaSuper>
        }
      />
      <Route
        path="/super/publicar-atualizacao"
        element={
          <RotaSuper>
            <PublicarAtualizacao />
          </RotaSuper>
        }
      />
    </Routes>
  );
}

export default App;
