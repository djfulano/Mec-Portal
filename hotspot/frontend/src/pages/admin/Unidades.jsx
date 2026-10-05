import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import {
  workspace,
  inputClass,
  buttonClass,
} from "../../components/admin/workspaceApi";
export default function Unidades({ initialTab = "Portais" }) {
  const { empresaSlug } = useParams();
  const base = "/admin/" + empresaSlug;
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState(initialTab),
    [records, setRecords] = useState([]),
    [unit, setUnit] = useState(""),
    [users, setUsers] = useState([]),
    [privacy, setPrivacy] = useState(null),
    [pending, setPending] = useState([]),
    [paymentUnit, setPaymentUnit] = useState(null),
    [payment, setPayment] = useState({}),
    [busy, setBusy] = useState(false);
  const load = () =>
    workspace("/overview")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const act = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const categories = {
    Visitantes: "visitors",
    Sessões: "sessions",
    Registros: "logs",
    Pagamentos: "payments",
    Solicitações: "requests",
    NAT: "nat",
  };
  useEffect(() => {
    if (categories[tab])
      workspace(
        "/records/" + categories[tab] + (unit ? "?unit_id=" + unit : ""),
      )
        .then(setRecords)
        .catch((e) => setError(e.message));
    if (tab === "Permissões")
      workspace("/users")
        .then(setUsers)
        .catch((e) => setError(e.message));
    if (tab === "Privacidade")
      workspace("/privacy")
        .then((d) => {
          setPrivacy(d.config);
          setPending(d.pending);
        })
        .catch((e) => setError(e.message));
  }, [tab, unit]);
  const newPortal = () =>
    act(async () => {
      const nome = prompt("Nome do novo portal");
      if (!nome) return;
      const p = await workspace("/portals", { nome });
      window.location.href = base + "/portais/" + p.id + "/configurar";
    });
  const tabs = [
    "Portais",
    "Equipamentos",
    ...Object.keys(categories),
    ...(data?.all_units ? ["Privacidade"] : []),
  ];
  const download = async () => {
    try {
      const r = await fetch(
        "/api/workspace/records/" +
          categories[tab] +
          "?export=csv" +
          (unit ? "&unit_id=" + unit : ""),
        {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("admin_token"),
          },
        },
      );
      if (!r.ok) throw new Error("Não foi possível exportar.");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = tab + ".csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Portais e equipamentos</h1>
          <p className="text-gray-400 mt-2">
            MEC Solution → {data?.company_name || "Empresa"} → Portais → Equipamentos
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="bg-red-950/50 border border-red-800 rounded-lg p-3 text-red-200"
          >
            {error}
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                "px-4 py-2 rounded-lg " +
                (t === tab
                  ? "bg-blue-600 text-white"
                  : "bg-[#1a1d27] text-gray-300")
              }
            >
              {t}
            </button>
          ))}
        </div>
        {!data ? (
          <p>Carregando…</p>
        ) : (
          <>
            {tab === "Equipamentos" && (
              <section className="p-5 rounded-xl bg-[#1a1d27] border border-gray-800 space-y-4">
                <Link className="text-blue-400" to={base + "/mikrotiks"}>Cadastrar e configurar equipamentos →</Link>
                {data.devices.map(d => <div key={d.id} className="border-t border-gray-800 pt-3"><strong>{d.nome}</strong><p className="text-sm text-gray-400">{d.ip} · Portal: {data.portals.find(p => p.id === d.portal_id)?.nome || "Não identificado"}</p></div>)}
                {!data.devices.length && <p className="text-gray-400">Nenhum equipamento cadastrado. Crie um portal primeiro e selecione-o ao cadastrar o equipamento.</p>}
              </section>
            )}
            {tab === "Portais" && (
              <>
                <button
                  className={buttonClass}
                  onClick={newPortal}
                  disabled={busy}
                >
                  + Criar portal
                </button>
                <div className="grid md:grid-cols-2 gap-4">
                  {data.portals.map((p) => (
                    <section
                      key={p.id}
                      className="p-5 rounded-xl bg-[#1a1d27] border border-gray-800"
                    >
                      <h2 className="text-lg font-semibold text-white">
                        {p.nome}
                      </h2>
                      <p className="text-sm text-gray-400 mt-1">
                        {p.managed
                          ? p.published_revision_id
                            ? "Publicado · edição em rascunho"
                            : "Rascunho"
                          : "Portal anterior · em funcionamento"}
                      </p>
                      <div className="flex flex-wrap gap-4 mt-5 text-sm">
                        <Link
                          className="text-blue-400"
                          to={base + "/portais/" + p.id + "/configurar"}
                        >
                          {p.managed
                            ? "Editar portal"
                            : "Configurar nova experiência"}
                        </Link>
                        {!p.managed && data.all_units && (
                          <Link to={base + "/portais/" + p.id + "/editor"}>
                            Editor anterior
                          </Link>
                        )}
                        <button
                          onClick={() =>
                            act(async () => {
                              const c = await workspace(
                                "/portals/" + p.id + "/clone",
                                {},
                              );
                              window.location.href =
                                base + "/portais/" + c.id + "/configurar";
                            })
                          }
                        >
                          Clonar
                        </button>
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}
            {categories[tab] && (
              <>
                <div className="flex gap-3">
                  <button className={buttonClass} onClick={download}>
                    Exportar CSV
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Até 1.000 registros recentes. Os acessos e as exportações são
                  auditados.
                </p>
                <div className="space-y-3">
                  {records.map((r) => (
                    <section
                      key={r.id}
                      className="p-4 border border-gray-800 rounded-xl bg-[#1a1d27]"
                    >
                      <div className="flex justify-between text-sm">
                        <strong>
                          {r.tipo || r.status || r.username || "Registro"} ·{" "}
                          {String(r.id).slice(0, 12)}
                        </strong>
                        <span>
                          {data.devices.find((d) => d.id === r.equipamento_id)?.nome || "Registro da empresa"}
                        </span>
                      </div>
                      {r.dados && (
                        <p className="mt-2 text-sm text-gray-300">
                          {Object.entries(
                            typeof r.dados === "string"
                              ? JSON.parse(r.dados)
                              : r.dados,
                          )
                            .map(([k, v]) => k + ": " + String(v))
                            .join(" · ")}
                        </p>
                      )}
                      <p className="text-sm text-gray-400 mt-2">
                        {r.mac || ""}{" "}
                        {r.ip_atribuido || r.ip || r.ip_publico || ""}{" "}
                        {r.valor != null
                          ? "R$ " + Number(r.valor).toFixed(2)
                          : ""}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(
                          r.criado_em || r.inicio_conexao || r.inicio,
                        ).toLocaleString()}
                      </p>
                      {tab === "Solicitações" &&
                        data.all_units &&
                        r.status === "pendente" && (
                          <button
                            className="text-blue-400 text-sm mt-2"
                            onClick={() =>
                              act(async () => {
                                const resposta = prompt("Resposta ao titular");
                                if (resposta === null) return;
                                await workspace(
                                  "/requests/" + r.id,
                                  {
                                    status: "concluida",
                                    resposta,
                                    execute: confirm(
                                      "Executar a solicitação? Exclusões respeitam a retenção configurada.",
                                    ),
                                  },
                                  "PUT",
                                );
                                setRecords(
                                  await workspace("/records/requests"),
                                );
                              })
                            }
                          >
                            Tratar solicitação
                          </button>
                        )}
                      {tab === "Registros" && data.all_units && (
                        <button
                          className="text-blue-400 text-sm mt-2"
                          onClick={() =>
                            act(async () => {
                              const until = prompt(
                                "Preservar até (AAAA-MM-DD)",
                              );
                              if (until)
                                await workspace(
                                  "/logs/" + r.id + "/hold",
                                  { until },
                                  "PUT",
                                );
                            })
                          }
                        >
                          Preservar registro
                        </button>
                      )}
                    </section>
                  ))}
                  {!records.length && (
                    <p className="text-gray-400">Nenhum registro disponível.</p>
                  )}
                </div>
              </>
            )}
            {tab === "Privacidade" && privacy && (
              <form
                className="p-5 bg-[#1a1d27] rounded-xl space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  act(() => workspace("/privacy", privacy, "PUT"));
                }}
              >
                <h2 className="text-xl font-semibold">Retenção e pendências</h2>
                {pending.map((p) => (
                  <p key={p} className="text-amber-300 text-sm">
                    • {p}
                  </p>
                ))}
                <p className="text-sm text-gray-400">
                  Defina os prazos conforme o enquadramento da operação. Campos
                  em branco preservam os registros até a definição da política.
                </p>
                {[
                  ["classification", "Enquadramento da operação"],
                  ["basis", "Fundamento da retenção"],
                ].map(([k, label]) => (
                  <label key={k} className="block text-sm">
                    {label}
                    <input
                      required
                      className={inputClass}
                      value={privacy[k] || ""}
                      onChange={(e) =>
                        setPrivacy({ ...privacy, [k]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    ["connection_days", "Conexões"],
                    ["visitor_days", "Cadastros"],
                    ["audit_days", "Auditoria"],
                    ["nat_days", "Registros NAT"],
                  ].map(([k, label]) => (
                    <label key={k} className="text-sm">
                      {label} · dias
                      <input
                        type="number"
                        min="1"
                        className={inputClass}
                        value={privacy[k] ?? ""}
                        onChange={(e) =>
                          setPrivacy({
                            ...privacy,
                            [k]: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <button className={buttonClass} disabled={busy}>
                  Salvar política
                </button>
              </form>
            )}
          </>
        )}
        {paymentUnit && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <form
              className="bg-[#1a1d27] p-6 rounded-xl max-w-lg w-full space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  await workspace(
                    "/units/" + paymentUnit.id + "/payment-config",
                    payment,
                    "PUT",
                  );
                  setPaymentUnit(null);
                });
              }}
            >
              <h2 className="text-xl">Recebimentos · {paymentUnit.nome}</h2>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={payment.override}
                  onChange={(e) =>
                    setPayment({ ...payment, override: e.target.checked })
                  }
                />
                Usar conta própria nesta unidade
              </label>
              {payment.override ? (
                ["access_token", "public_key", "email_pagador"].map((k) => (
                  <label key={k} className="block text-sm">
                    {
                      {
                        access_token:
                          "Token de acesso (deixe vazio para manter)",
                        public_key: "Chave pública",
                        email_pagador: "Email de cobrança",
                      }[k]
                    }
                    <input
                      type={k === "access_token" ? "password" : "text"}
                      className={inputClass}
                      value={payment[k] || ""}
                      onChange={(e) =>
                        setPayment({ ...payment, [k]: e.target.value })
                      }
                    />
                  </label>
                ))
              ) : (
                <p className="text-gray-400">
                  Os pagamentos usarão a configuração da empresa.
                </p>
              )}
              <div className="flex gap-3">
                <button className={buttonClass} disabled={busy}>
                  Salvar
                </button>
                <button type="button" onClick={() => setPaymentUnit(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
