import React, { useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";

function formatDuracao(segundos) {
  if (!segundos) return "0h 0m";
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

function formatDateTime(dt) {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("pt-BR");
}

export default function Compliance() {
  const [cpf, setCpf] = useState("");
  const [mac, setMac] = useState("");
  const [ip, setIp] = useState("");
  const [username, setUsername] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("admin_token");

  const buildParams = (extraPage) => {
    const params = new URLSearchParams();
    if (cpf.trim()) params.set("cpf", cpf.trim());
    if (mac.trim()) params.set("mac", mac.trim());
    if (ip.trim()) params.set("ip", ip.trim());
    if (username.trim()) params.set("username", username.trim());
    if (dataInicio) params.set("data_inicio", dataInicio);
    if (dataFim) params.set("data_fim", dataFim);
    params.set("page", extraPage || page);
    params.set("per_page", perPage);
    return params.toString();
  };

  const buscar = async (pg = 1) => {
    try {
      setLoading(true);
      setPage(pg);
      const res = await fetch(`/api/compliance?${buildParams(pg)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setLogs(json.data || []);
      setTotal(json.total || 0);
    } catch (err) {
      console.error("Erro ao buscar logs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (cpf.trim()) params.set("cpf", cpf.trim());
      if (mac.trim()) params.set("mac", mac.trim());
      if (ip.trim()) params.set("ip", ip.trim());
      if (username.trim()) params.set("username", username.trim());
      if (dataInicio) params.set("data_inicio", dataInicio);
      if (dataFim) params.set("data_fim", dataFim);

      const res = await fetch(`/api/compliance/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "compliance_logs.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao exportar CSV:", err);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    buscar(1);
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Marco Civil - Logs de Conexao</h1>
            <p className="text-gray-400 text-sm mt-1">
              Consulta de registros de conexao conforme Marco Civil da Internet (Lei 12.965/2014)
            </p>
          </div>
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors text-sm cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar CSV
          </button>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="bg-[#1a1d27] rounded-xl border border-gray-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">CPF</label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 bg-[#0f111a] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">MAC</label>
              <input
                type="text"
                value={mac}
                onChange={(e) => setMac(e.target.value)}
                placeholder="AA:BB:CC:DD:EE:FF"
                className="w-full px-3 py-2 bg-[#0f111a] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">IP</label>
              <input
                type="text"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.0.1"
                className="w-full px-3 py-2 bg-[#0f111a] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="usuario"
                className="w-full px-3 py-2 bg-[#0f111a] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Data Inicio</label>
              <input
                type="datetime-local"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f111a] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Data Fim</label>
              <input
                type="datetime-local"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f111a] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </form>

        {/* Results */}
        <div className="bg-[#1a1d27] rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {total > 0 ? `${total} registro(s) encontrado(s)` : "Nenhum registro"}
            </span>
            {totalPages > 1 && (
              <span className="text-xs text-gray-500">
                Pagina {page} de {totalPages}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase bg-[#0f111a]">
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">MAC</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">NAS IP</th>
                  <th className="px-4 py-3">Inicio</th>
                  <th className="px-4 py-3">Fim</th>
                  <th className="px-4 py-3">Duracao</th>
                  <th className="px-4 py-3">Entrada</th>
                  <th className="px-4 py-3">Saida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {logs.length === 0 && !loading && (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-gray-500">
                      Utilize os filtros acima para buscar registros de conexao.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!loading &&
                  logs.map((log, i) => (
                    <tr key={i} className="hover:bg-[#252b3b] transition-colors">
                      <td className="px-4 py-3 text-white font-mono text-xs">{log.username}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{log.cpf || "-"}</td>
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">{log.mac}</td>
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">{log.ip_atribuido}</td>
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">{log.nas_ip}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{formatDateTime(log.inicio_conexao)}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{formatDateTime(log.fim_conexao)}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{formatDuracao(log.duracao_segundos)}</td>
                      <td className="px-4 py-3 text-green-400 text-xs">{formatBytes(log.bytes_entrada)}</td>
                      <td className="px-4 py-3 text-blue-400 text-xs">{formatBytes(log.bytes_saida)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-800 flex items-center justify-center gap-2">
              <button
                onClick={() => buscar(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1 text-sm bg-[#0f111a] border border-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, idx) => {
                let pageNum;
                if (totalPages <= 7) {
                  pageNum = idx + 1;
                } else if (page <= 4) {
                  pageNum = idx + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + idx;
                } else {
                  pageNum = page - 3 + idx;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => buscar(pageNum)}
                    className={`px-3 py-1 text-sm rounded cursor-pointer ${
                      pageNum === page
                        ? "bg-blue-600 text-white"
                        : "bg-[#0f111a] border border-gray-700 text-gray-400 hover:text-white"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => buscar(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm bg-[#0f111a] border border-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                Proximo
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
