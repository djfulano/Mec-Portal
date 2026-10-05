import React, { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";

export default function Mikrotiks() {
  const [mikrotiks, setMikrotiks] = useState([]);
  const [portais, setPortais] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [hotspotLog, setHotspotLog] = useState([]);
  const [enviandoHotspot, setEnviandoHotspot] = useState(null);
  const [enviandoLogin, setEnviandoLogin] = useState(null);
  const [enviandoStatus, setEnviandoStatus] = useState(null);
  const [mikrotikInfo, setMikrotikInfo] = useState(null);
  const [form, setForm] = useState({ nome: "", ip: "", usuario: "", senha: "", porta: 8728, end_hotspot: "", portal_id: "" });
  const [erro, setErro] = useState("");
  const [editandoId, setEditandoId] = useState(null);

  const token = localStorage.getItem("admin_token");

  const carregarPortais = async () => {
    try {
      const res = await fetch("/api/portais", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setPortais(data);
    } catch (err) { console.error(err); }
  };

  // Wizard states
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardMikrotikId, setWizardMikrotikId] = useState(null);
  const [scanData, setScanData] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [wizardConfig, setWizardConfig] = useState({
    interface: "", localAddress: "10.5.50.1/24", poolName: "hs-pool", poolRange: "10.5.50.2-10.5.50.254", dnsName: ""
  });

  const abrirWizard = async (id) => {
    setWizardMikrotikId(id);
    setScanning(true);
    setScanData(null);
    setShowWizard(true);
    setWizardStep(0);
    setWizardConfig({ interface: "", localAddress: "10.5.50.1/24", poolName: "hs-pool", poolRange: "10.5.50.2-10.5.50.254", dnsName: "" });

    try {
      const res = await fetch(`/api/mikrotiks/${id}/scan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message); setShowWizard(false); return; }
      setScanData(data);
      if (data.interfaces?.length > 0) {
        setWizardConfig(c => ({ ...c, interface: data.interfaces[0]?.name || "ether2" }));
      }
      if (data.pools?.length > 0) {
        setWizardConfig(c => ({ ...c, poolName: data.pools[0].name, poolRange: data.pools[0].ranges }));
      }
    } catch (err) {
      alert("Erro ao escanear Mikrotik");
      setShowWizard(false);
    } finally {
      setScanning(false);
    }
  };

  const executarWizard = async () => {
    setEnviandoHotspot(wizardMikrotikId);
    setShowWizard(false);
    setHotspotLog([]);
    setShowLogModal(true);

    try {
      const res = await fetch(`/api/mikrotiks/${wizardMikrotikId}/enviar-hotspot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(wizardConfig),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "step") {
              setHotspotLog(prev => [...prev, `[${event.status}] ${event.message}`]);
            } else if (event.type === "error") {
              setHotspotLog(prev => [...prev, `[erro] ${event.message}`]);
            } else if (event.type === "done") {
              if (event.success) {
                setHotspotLog(prev => [...prev, "--- Configuracao finalizada com sucesso! ---"]);
              }
              carregarMikrotiks();
            }
          } catch (e) { /* parse error, ignora */ }
        }
      }
    } catch (err) {
      setHotspotLog(prev => [...prev, `[erro] Falha de conexao: ${err.message}`]);
    } finally {
      setEnviandoHotspot(null);
    }
  };

const carregarMikrotiks = async () => {
  try {
    const res = await fetch("/api/mikrotiks", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    // Inicia todos com status "loading"
    const mikrotiksComStatus = data.map(m => ({ ...m, status: "loading" }));
    setMikrotiks(mikrotiksComStatus);

    // Testa conexão de cada Mikrotik
    for (const m of data) {
      try {
        const res = await fetch(`/api/mikrotiks/${m.id}/testar`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        setMikrotiks(prev => prev.map(item =>
          item.id === m.id
            ? { ...item, status: res.ok ? "online" : "offline" }
            : item
        ));
      } catch {
        setMikrotiks(prev => prev.map(item =>
          item.id === m.id
            ? { ...item, status: "offline" }
            : item
        ));
      }
    }
  } catch (err) {
    setErro("Erro ao buscar Mikrotiks");
  }
};
  const salvarMikrotik = async (e) => {
    e.preventDefault();
    setErro("");

    const method = editandoId ? "PUT" : "POST";
    const url = editandoId ? `/api/mikrotiks/${editandoId}` : "/api/mikrotiks";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (!res.ok) {
        setErro(data.message || "Erro ao salvar");
      } else {
        setShowModal(false);
        setForm({ nome: "", ip: "", usuario: "", senha: "", porta: 8728, end_hotspot: "", portal_id: "" });
        setEditandoId(null);
        carregarMikrotiks();
      }
    } catch {
      setErro("Erro de conexão");
    }
  };

const editar = (mikrotik) => {
  setForm({ ...mikrotik, end_hotspot: mikrotik.end_hotspot || "", portal_id: mikrotik.portal_id || "" });
  setEditandoId(mikrotik.id);
  setShowModal(true);
};

  const remover = async (id) => {
    if (!confirm("Deseja realmente remover este Mikrotik?")) return;
    try {
      await fetch(`/api/mikrotiks/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      carregarMikrotiks();
    } catch {
      alert("Erro ao deletar Mikrotik");
    }
  };

  const testarConexao = async (id) => {
    try {
      const res = await fetch(`/api/mikrotiks/${id}/testar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok) {
        alert("✅ Conexão bem-sucedida com o Mikrotik.");
      } else {
        alert(`❌ Falha: ${data.message}`);
      }
    } catch {
      alert("Erro ao testar conexão");
    }
  };

  const abrirInfo = async (id) => {
    try {
      const res = await fetch(`/api/mikrotiks/${id}/info`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMikrotikInfo(data);
        setShowInfoModal(true);
      } else {
        alert(`Erro ao obter informações: ${data.message}`);
      }
    } catch {
      alert("Erro ao conectar ao Mikrotik");
    }
  };

  const enviarLogin = async (id) => {
    setEnviandoLogin(id);
    try {
      const res = await fetch(`/api/mikrotiks/${id}/enviar-login`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      alert(data.message);
    } catch {
      alert("Erro de conexão ao enviar login.html");
    } finally {
      setEnviandoLogin(null);
    }
  };

  const enviarStatus = async (id) => {
    setEnviandoStatus(id);
    try {
      const res = await fetch(`/api/mikrotiks/${id}/enviar-status`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      alert(data.message);
    } catch {
      alert("Erro de conexão ao enviar status.html");
    } finally {
      setEnviandoStatus(null);
    }
  };

  useEffect(() => {
    carregarMikrotiks();
    carregarPortais();
  }, []);

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Mikrotiks</h1>
        <button
          onClick={() => { setShowModal(true); setForm({ nome: "", ip: "", usuario: "", senha: "", porta: 8728, end_hotspot: "", portal_id: "" }); setEditandoId(null); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded shadow"
        >
          + Adicionar Mikrotik
        </button>
      </div>

      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
          <span className="text-gray-300">📶</span> Equipamentos Cadastrados
        </h2>
        {erro && <p className="text-red-600 mb-4">{erro}</p>}
        <table className="w-full text-left text-sm">
          <thead className="text-gray-500 border-b border-gray-800">
            <tr>
              <th className="p-2">Nome</th>
              <th className="p-2">IP</th>
              <th className="p-2">Portal</th>
              <th className="p-2">Status</th>
              <th className="p-2">Usuários Ativos</th>
              <th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {mikrotiks.map((m) => (
              <tr key={m.id} className="border-b hover:bg-[#151821]">
                <td className="p-2 font-medium text-white">{m.nome}</td>
                <td className="p-2">{m.ip}</td>
                <td className="p-2">
                  {m.portal_nome ? (
                    <span className="text-xs px-2 py-0.5 rounded border border-blue-800/50 bg-blue-900/20 text-blue-400">{m.portal_nome}</span>
                  ) : (
                    <span className="text-xs text-gray-600">Nenhum</span>
                  )}
                </td>
                <td className="p-2">
                  {m.status === "loading" ? (
                    <span className="text-gray-500 text-xs">Verificando...</span>
                  ) : (
                    <span className={`text-xs px-3 py-1 rounded-full text-white ${m.status === "online" ? "bg-green-600" : "bg-red-600"}`}>
                      {m.status === "online" ? "Online" : "Offline"}
                    </span>
                  )}
                </td>
                <td className="p-2">{m.usuarios_ativos}</td>
                <td className="p-2">
                  <div className="flex gap-1">
                    <button onClick={() => abrirWizard(m.id)} title="Enviar Hotspot" className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${enviandoHotspot === m.id ? 'bg-yellow-600 text-white animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-500'}`} disabled={enviandoHotspot === m.id}>
                      {enviandoHotspot === m.id ? "Enviando..." : "Hotspot"}
                    </button>
                    <button onClick={() => enviarLogin(m.id)} title="Enviar login.html" className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${enviandoLogin === m.id ? 'bg-yellow-600 text-white animate-pulse' : 'bg-green-700 text-white hover:bg-green-600'}`} disabled={enviandoLogin === m.id}>
                      {enviandoLogin === m.id ? "Enviando..." : "Login"}
                    </button>
                    <button onClick={() => enviarStatus(m.id)} title="Enviar status.html" className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${enviandoStatus === m.id ? 'bg-yellow-600 text-white animate-pulse' : 'bg-teal-700 text-white hover:bg-teal-600'}`} disabled={enviandoStatus === m.id}>
                      {enviandoStatus === m.id ? "Enviando..." : "Status"}
                    </button>
                    <button onClick={() => testarConexao(m.id)} title="Testar" className="border border-gray-700 text-gray-300 px-2 py-1 rounded text-xs hover:bg-[#252b3b] cursor-pointer">Testar</button>
                    <button onClick={() => abrirInfo(m.id)} title="Info" className="border border-gray-700 text-gray-300 px-2 py-1 rounded text-xs hover:bg-[#252b3b] cursor-pointer">Info</button>
                    <button onClick={() => editar(m)} title="Editar" className="border border-gray-700 text-gray-300 px-2 py-1 rounded text-xs hover:bg-[#252b3b] cursor-pointer">Editar</button>
                    <button onClick={() => remover(m.id)} title="Remover" className="border border-red-800/50 text-red-400 px-2 py-1 rounded text-xs hover:bg-red-900/20 cursor-pointer">Remover</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInfoModal && mikrotikInfo && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1d27] rounded-xl border border-gray-700 w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Informações do Mikrotik</h3>
              <button onClick={() => setShowInfoModal(false)} className="text-gray-500 hover:text-gray-300">×</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0d1117] p-4 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-500">Modelo</p>
                <p className="font-medium">{mikrotikInfo.modelo}</p>
              </div>
              <div className="bg-[#0d1117] p-4 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-500">Versão</p>
                <p className="font-medium">{mikrotikInfo.versao}</p>
              </div>
              <div className="bg-[#0d1117] p-4 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-500">Uptime</p>
                <p className="font-medium">{mikrotikInfo.uptime}</p>
              </div>
              <div className="bg-[#0d1117] p-4 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-500">CPU</p>
                <p className="font-medium">{mikrotikInfo.cpu}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1d27] rounded-xl border border-gray-700 w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{editandoId ? "Editar Mikrotik" : "Adicionar Mikrotik"}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300">×</button>
            </div>

            <form onSubmit={salvarMikrotik} className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Nome</label>
                <input
                  placeholder="Ex: Mikrotik Principal"
                  className="w-full bg-[#0d1117] border border-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Endereço IP</label>
                <input
                  placeholder="192.168.1.1"
                  className="w-full bg-[#0d1117] border border-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  value={form.ip}
                  onChange={(e) => setForm({ ...form, ip: e.target.value })}
                  required
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-sm text-gray-400">Usuário</label>
                  <input
                    className="w-full bg-[#0d1117] border border-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                    value={form.usuario}
                    onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                    required
                  />
                </div>
                <div className="w-32">
                  <label className="text-sm text-gray-400">Porta API</label>
                  <input
                    type="number"
                    className="w-full bg-[#0d1117] border border-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                    value={form.porta}
                    onChange={(e) => setForm({ ...form, porta: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Senha</label>
                <input
                  type="password"
                  className="w-full bg-[#0d1117] border border-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Endereço Hotspot</label>
                <input
                  type="text"
                  className="w-full bg-[#0d1117] border border-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="http://192.168.1.1/login"
                  value={form.end_hotspot}
                  onChange={(e) => setForm({ ...form, end_hotspot: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Portal Captive</label>
                <select
                  className="w-full bg-[#0d1117] border border-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
                  value={form.portal_id}
                  onChange={(e) => setForm({ ...form, portal_id: e.target.value })}
                >
                  <option value="">Nenhum</option>
                  {portais.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome} ({p.tipo})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded border hover:bg-[#151821]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-neutral-800"
                >
                  {editandoId ? "Atualizar" : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hotspot Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] rounded-xl border border-gray-700 w-full max-w-xl p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                Hotspot Setup
              </h3>
              <button onClick={() => setShowWizard(false)} className="text-gray-400 hover:text-white cursor-pointer">×</button>
            </div>

            {scanning ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-10 h-10 border-3 border-gray-700 border-t-blue-500 rounded-full animate-spin mb-4" style={{borderWidth: '3px'}}></div>
                <p className="text-gray-400">Escaneando Mikrotik...</p>
              </div>
            ) : scanData && (
              <div className="space-y-4">
                {/* Status */}
                <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500">Interfaces</span>
                      <p className="text-white font-medium">{scanData.interfaces?.length || 0}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Pools</span>
                      <p className="text-white font-medium">{scanData.pools?.length || 0}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Hotspot Ativo</span>
                      <p className="text-white font-medium">{scanData.hotspots?.length ? "Sim" : "Não"}</p>
                    </div>
                  </div>
                </div>

                {/* Interface Selection */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Interface do Hotspot</label>
                  <select
                    className="w-full bg-[#0d1117] border border-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                    value={wizardConfig.interface}
                    onChange={(e) => setWizardConfig({ ...wizardConfig, interface: e.target.value })}
                  >
                    {scanData.interfaces?.map(i => (
                      <option key={i.name} value={i.name}>
                        {i.name} ({i.type}){i.disabled === "true" ? " [desabilitada]" : ""}
                      </option>
                    ))}
                  </select>
                  {scanData.addresses?.filter(a => a.interface === wizardConfig.interface).map(a => (
                    <p key={a.address} className="text-xs text-green-500 mt-1">IP atual: {a.address}</p>
                  ))}
                </div>

                {/* Local Address */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Endereço IP do Hotspot (gateway)</label>
                  <input
                    className="w-full bg-[#0d1117] border border-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    value={wizardConfig.localAddress}
                    onChange={(e) => setWizardConfig({ ...wizardConfig, localAddress: e.target.value })}
                    placeholder="10.5.50.1/24"
                  />
                  <p className="text-xs text-gray-600 mt-1">Será atribuído à interface se ainda não tiver IP</p>
                </div>

                {/* Pool */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nome do Pool</label>
                    <input
                      className="w-full bg-[#0d1117] border border-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      value={wizardConfig.poolName}
                      onChange={(e) => setWizardConfig({ ...wizardConfig, poolName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Range do Pool</label>
                    <input
                      className="w-full bg-[#0d1117] border border-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      value={wizardConfig.poolRange}
                      onChange={(e) => setWizardConfig({ ...wizardConfig, poolRange: e.target.value })}
                      placeholder="10.5.50.2-10.5.50.254"
                    />
                  </div>
                </div>
                {scanData.pools?.length > 0 && (
                  <div className="text-xs text-gray-600">
                    Pools existentes: {scanData.pools.map(p => `${p.name} (${p.ranges})`).join(", ")}
                  </div>
                )}

                {/* DNS Name */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">DNS Name (opcional)</label>
                  <input
                    className="w-full bg-[#0d1117] border border-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    value={wizardConfig.dnsName}
                    onChange={(e) => setWizardConfig({ ...wizardConfig, dnsName: e.target.value })}
                    placeholder="hotspot.minharede.com"
                  />
                </div>

                {/* RADIUS + Walled Garden info */}
                <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800 text-xs text-gray-400 space-y-1">
                  <p className="text-gray-500 font-medium mb-1">Será configurado automaticamente:</p>
                  <p>• RADIUS Client → 10.8.0.1:1812/1813</p>
                  <p>• Walled Garden → domínio do sistema liberado</p>
                  <p>• Login URL → redirect para o portal vinculado</p>
                  {scanData.radius?.length > 0 && (
                    <p className="text-yellow-500 mt-1">Atenção: RADIUS existente será atualizado ({scanData.radius[0].address})</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                  <button
                    onClick={() => setShowWizard(false)}
                    className="px-4 py-2 text-sm text-gray-300 border border-gray-700 rounded hover:bg-[#252b3b] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={executarWizard}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 cursor-pointer font-medium"
                  >
                    Configurar Hotspot
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hotspot Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] rounded-xl border border-gray-700 w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                Log de Configuracao
                {enviandoHotspot && (
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin"></div>
                )}
              </h3>
              <button onClick={() => { if (!enviandoHotspot) setShowLogModal(false); }} className={`text-gray-400 hover:text-white cursor-pointer ${enviandoHotspot ? 'opacity-30 cursor-not-allowed' : ''}`}>×</button>
            </div>
            <div className="bg-[#0d1117] rounded-lg p-4 font-mono text-xs max-h-80 overflow-y-auto space-y-1" ref={el => { if (el) el.scrollTop = el.scrollHeight; }}>
              {hotspotLog.length === 0 && enviandoHotspot && (
                <div className="text-gray-500 animate-pulse">Conectando ao Mikrotik...</div>
              )}
              {hotspotLog.map((line, i) => (
                <div key={i} className={`flex items-start gap-2 ${
                  line.includes('[erro]') ? 'text-red-400' :
                  line.includes('[aviso]') ? 'text-yellow-400' :
                  line.startsWith('---') ? 'text-blue-400 font-semibold mt-2' :
                  'text-green-400'
                }`}>
                  <span className="text-gray-600 select-none shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowLogModal(false)}
                disabled={!!enviandoHotspot}
                className={`px-4 py-2 rounded cursor-pointer text-sm ${enviandoHotspot ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
              >
                {enviandoHotspot ? "Aguarde..." : "Fechar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

