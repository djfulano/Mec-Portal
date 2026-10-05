import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import {
  workspace,
  inputClass,
  buttonClass,
} from "../../components/admin/workspaceApi";
const tabs = [
  "Aparência",
  "Cadastro",
  "Autenticação",
  "Acesso e planos",
  "Privacidade",
  "Equipamentos",
];
export default function PortalDesigner() {
  const { empresaSlug, portalId } = useParams(),
    base = "/admin/" + empresaSlug;
  const [portal, setPortal] = useState(null),
    [c, setC] = useState(null),
    [data, setData] = useState(null),
    [tab, setTab] = useState(tabs[0]),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false);
  useEffect(() => {
    Promise.all([workspace("/portals/" + portalId), workspace("/overview")])
      .then(([p, d]) => {
        setPortal(p);
        setC(p.draft);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [portalId]);
  const set = (group, key, value) =>
    setC((old) => ({ ...old, [group]: { ...old[group], [key]: value } }));
  const action = async (fn) => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    await workspace("/portals/" + portalId + "/draft", { config: c }, "PUT");
    setStatus("Rascunho salvo. O portal publicado continua em funcionamento.");
  };
  const upload = async (kind, file) =>
    action(async () => {
      if (!file) return;
      await save();
      const form = new FormData();
      form.append("image", file);
      const r = await fetch(
        "/api/workspace/portals/" + portalId + "/assets/" + kind,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + localStorage.getItem("admin_token"),
          },
          body: form,
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      set("appearance", kind === "logo" ? "logo_url" : "image_url", d.url);
      setStatus(
        "Imagem adicionada ao rascunho. Publique para exibir no Wi-Fi.",
      );
    });
  const text = (group, key, label, type = "text") => (
    <label className="block text-sm space-y-1" key={key}>
      <span>{label}</span>
      {type === "textarea" ? (
        <textarea
          rows="5"
          className={inputClass}
          value={c[group][key] || ""}
          onChange={(e) => set(group, key, e.target.value)}
        />
      ) : (
        <input
          type={type}
          className={inputClass}
          value={c[group][key] ?? ""}
          onChange={(e) =>
            set(
              group,
              key,
              type === "number" ? Number(e.target.value) : e.target.value,
            )
          }
        />
      )}
    </label>
  );
  const toggle = (group, key, label) => (
    <label
      key={key}
      className="flex gap-3 items-center p-3 border border-gray-700 rounded-lg"
    >
      <input
        type="checkbox"
        checked={!!c[group][key]}
        onChange={(e) => set(group, key, e.target.checked)}
      />
      {label}
    </label>
  );
  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        <Link to={base + "/portais"} className="text-blue-400">
          ← Portais da empresa
        </Link>
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {portal?.nome || "Configurar portal"}
            </h1>
            <p className="text-sm text-gray-400">
              Edite, visualize e publique quando estiver pronto.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={buttonClass}
              disabled={busy || !c}
              onClick={() => action(save)}
            >
              Salvar rascunho
            </button>
            <button
              className="px-4 py-2 border border-gray-700 rounded-lg"
              onClick={() => setPreview(true)}
              disabled={!c}
            >
              Visualizar
            </button>
            <button
              className="px-4 py-2 bg-green-700 rounded-lg text-white"
              disabled={busy || !c}
              onClick={() =>
                action(async () => {
                  await save();
                  await workspace("/portals/" + portalId + "/publish", {});
                  setStatus("Publicado nos equipamentos vinculados.");
                  setPortal(await workspace("/portals/" + portalId));
                })
              }
            >
              Publicar
            </button>
            <button
              className="px-3 py-2 border border-gray-700 rounded-lg"
              disabled={busy || !c}
              onClick={() =>
                action(async () => {
                  await save();
                  const r = await workspace(
                    "/portals/" + portalId + "/clone",
                    {},
                  );
                  window.location.href =
                    base + "/portais/" + r.id + "/configurar";
                })
              }
            >
              Clonar
            </button>
          </div>
        </div>
        {error && (
          <p className="p-3 bg-red-950/50 text-red-200 rounded-lg" role="alert">
            {error}
          </p>
        )}
        {status && <p className="text-green-300">{status}</p>}
        {portal && !portal.managed && (
          <p className="p-3 bg-amber-950/40 text-amber-200 text-sm rounded-lg">
            O portal anterior permanece em uso até a primeira publicação desta
            nova configuração. Revise os campos e as regras antes de publicar.
          </p>
        )}
        {c && data && (
          <>
            <div className="flex flex-wrap gap-2">
              {tabs.map((t) => (
                <button
                  key={t}
                  className={
                    "px-4 py-2 rounded-lg " +
                    (t === tab ? "bg-blue-600 text-white" : "bg-[#1a1d27]")
                  }
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <section className="bg-[#1a1d27] border border-gray-800 p-6 rounded-xl space-y-4">
              {tab === "Aparência" && (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    {text("appearance", "title", "Título")}
                    {text("appearance", "subtitle", "Mensagem de boas-vindas")}
                    {text("appearance", "logo_url", "Endereço do logo")}
                    {text(
                      "appearance",
                      "image_url",
                      "Endereço da imagem de destaque",
                    )}
                    {text("appearance", "color", "Cor dos botões", "color")}
                    {text("appearance", "background", "Cor de fundo", "color")}
                    <label className="text-sm">
                      Enviar logo
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={busy}
                        className="block mt-2"
                        onChange={(e) => upload("logo", e.target.files[0])}
                      />
                    </label>
                    <label className="text-sm">
                      Enviar imagem de destaque
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={busy}
                        className="block mt-2"
                        onChange={(e) => upload("image", e.target.files[0])}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-400">
                    PNG, JPG ou WebP de até 2 MB. Também é possível usar
                    endereços HTTPS.
                  </p>
                </>
              )}
              {tab === "Cadastro" && (
                <>
                  <p className="text-sm text-gray-400">
                    Escolha quais dados solicitar. A ordem abaixo será a ordem
                    do formulário.
                  </p>
                  {c.fields.map((f, i) => (
                    <div
                      key={i}
                      className="p-4 border border-gray-700 rounded-lg space-y-3"
                    >
                      <div className="grid md:grid-cols-3 gap-3">
                        <input
                          aria-label="Identificador do campo"
                          className={inputClass}
                          value={f.key}
                          onChange={(e) =>
                            setC({
                              ...c,
                              fields: c.fields.map((x, j) =>
                                j === i ? { ...x, key: e.target.value } : x,
                              ),
                            })
                          }
                        />
                        <input
                          aria-label="Nome do campo"
                          className={inputClass}
                          value={f.label}
                          onChange={(e) =>
                            setC({
                              ...c,
                              fields: c.fields.map((x, j) =>
                                j === i ? { ...x, label: e.target.value } : x,
                              ),
                            })
                          }
                        />
                        <select
                          className={inputClass}
                          value={f.type}
                          onChange={(e) =>
                            setC({
                              ...c,
                              fields: c.fields.map((x, j) =>
                                j === i ? { ...x, type: e.target.value } : x,
                              ),
                            })
                          }
                        >
                          {[
                            ["text", "Texto"],
                            ["email", "Email"],
                            ["tel", "Telefone"],
                            ["date", "Data"],
                            ["select", "Lista de opções"],
                            ["checkbox", "Caixa de seleção"],
                          ].map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </div>
                      {f.type === "select" && (
                        <input
                          className={inputClass}
                          placeholder="Opções separadas por vírgula"
                          value={(f.options || []).join(",")}
                          onChange={(e) =>
                            setC({
                              ...c,
                              fields: c.fields.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      options: e.target.value
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                    }
                                  : x,
                              ),
                            })
                          }
                        />
                      )}
                      <div className="flex gap-4 text-sm">
                        <label>
                          <input
                            type="checkbox"
                            checked={!!f.required}
                            onChange={(e) =>
                              setC({
                                ...c,
                                fields: c.fields.map((x, j) =>
                                  j === i
                                    ? { ...x, required: e.target.checked }
                                    : x,
                                ),
                              })
                            }
                          />{" "}
                          Obrigatório
                        </label>
                        <button
                          disabled={!i}
                          onClick={() => {
                            const fs = [...c.fields];
                            [fs[i - 1], fs[i]] = [fs[i], fs[i - 1]];
                            setC({ ...c, fields: fs });
                          }}
                        >
                          ↑ Subir
                        </button>
                        <button
                          disabled={i === c.fields.length - 1}
                          onClick={() => {
                            const fs = [...c.fields];
                            [fs[i + 1], fs[i]] = [fs[i], fs[i + 1]];
                            setC({ ...c, fields: fs });
                          }}
                        >
                          ↓ Descer
                        </button>
                        <button
                          className="text-red-400"
                          onClick={() =>
                            setC({
                              ...c,
                              fields: c.fields.filter((_, j) => j !== i),
                            })
                          }
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    className={buttonClass}
                    onClick={() =>
                      setC({
                        ...c,
                        fields: [
                          ...c.fields,
                          {
                            key: "campo_" + Date.now(),
                            label: "Nova pergunta",
                            type: "text",
                            required: false,
                          },
                        ],
                      })
                    }
                  >
                    + Adicionar campo
                  </button>
                </>
              )}
              {tab === "Autenticação" && (
                <>
                  {toggle("auth", "form", "Cadastro com formulário")}
                  {toggle(
                    "auth",
                    "whatsapp",
                    "Cadastro com código de verificação por WhatsApp",
                  )}
                  {toggle("auth", "password", "Usuário e senha existentes")}
                  <p className="text-sm text-gray-400">
                    O formulário coleta os dados informados. O código verifica a
                    posse do telefone. Para exigir telefone verificado, habilite
                    apenas WhatsApp.
                  </p>
                </>
              )}
              {tab === "Acesso e planos" && (
                <>
                  <label className="block text-sm">
                    Tipo de acesso
                    <select
                      className={inputClass}
                      value={c.access.mode}
                      onChange={(e) => set("access", "mode", e.target.value)}
                    >
                      <option value="free">Gratuito</option>
                      <option value="paid">Pago</option>
                      <option value="both">Gratuito e pago</option>
                    </select>
                  </label>
                  <div className="grid md:grid-cols-3 gap-4">
                    {[
                      ["minutes", "Duração gratuita · minutos"],
                      ["down", "Download · Mbps"],
                      ["up", "Upload · Mbps"],
                      ["simultaneous", "Conexões simultâneas"],
                      ["reconnect_minutes", "Intervalo de reconexão · minutos"],
                    ].map(([k, l]) => text("access", k, l, "number"))}
                  </div>
                  {c.access.mode !== "free" && (
                    <div className="space-y-3">
                      <h3>Planos disponíveis neste portal</h3>
                      {data.plans.map((p) => (
                        <label key={p.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={c.access.plan_ids.includes(p.id)}
                            onChange={(e) =>
                              set(
                                "access",
                                "plan_ids",
                                e.target.checked
                                  ? [...c.access.plan_ids, p.id]
                                  : c.access.plan_ids.filter(
                                      (id) => id !== p.id,
                                    ),
                              )
                            }
                          />
                          {p.nome} · R$ {(Number(p.valor) / 100).toFixed(2)}
                        </label>
                      ))}
                      <p className="text-xs text-gray-400">
                        Recebimento pela conta da unidade, quando configurada,
                        ou pela conta da empresa. O novo fluxo utiliza PIX.
                      </p>
                    </div>
                  )}
                </>
              )}
              {tab === "Privacidade" && (
                <>
                  {text("privacy", "terms", "Termos de uso", "textarea")}
                  {text(
                    "privacy",
                    "policy",
                    "Política de privacidade",
                    "textarea",
                  )}
                  {text("privacy", "purpose", "Finalidade do cadastro")}
                  {text(
                    "privacy",
                    "marketing_text",
                    "Texto do consentimento opcional para marketing",
                  )}
                  {text("privacy", "contact", "Contato para privacidade")}
                  <p className="text-sm text-gray-400">
                    A autorização de marketing será separada e opcional. O
                    aceite registra a versão publicada dos textos.
                  </p>
                </>
              )}
              {tab === "Equipamentos" && (
                <>
                  <p className="text-sm text-gray-400">Cada equipamento pertence a um portal desta empresa. O cadastro define esse vínculo; a publicação atualiza a configuração para todos eles.</p>
                  <Link to={base + "/mikrotiks"} className="text-blue-400">Cadastrar ou configurar equipamentos →</Link>
                  {data.devices.filter(d => d.portal_id === Number(portalId)).map(d => (
                    <div key={d.id} className="p-3 border border-gray-700 rounded-lg">{d.nome} · {d.ip}</div>
                  ))}
                  {!data.devices.some(d => d.portal_id === Number(portalId)) && <p className="text-gray-400">Nenhum equipamento vinculado. Cadastre um equipamento e selecione este portal.</p>}
                </>
              )}
            </section>
            <p className="text-sm text-gray-500">
              {portal.versions.length
                ? `Versões publicadas: ${portal.versions.map((v) => v.numero).join(", ")}`
                : "Nenhuma versão publicada."}
            </p>
          </>
        )}
        {preview && c && (
          <div className="fixed inset-0 bg-black/80 z-50 p-4 flex flex-col items-center justify-center">
            <button
              className="text-white mb-3"
              onClick={() => setPreview(false)}
            >
              Fechar prévia ×
            </button>
            <div
              style={{ background: c.appearance.background }}
              className="w-full max-w-sm rounded-2xl p-6 max-h-[80vh] overflow-auto text-white"
            >
              {c.appearance.logo_url && (
                <img
                  src={c.appearance.logo_url}
                  alt="Logo"
                  className="h-36 w-full object-contain mb-5"
                />
              )}
              {c.appearance.image_url && (
                <img
                  src={c.appearance.image_url}
                  alt="Destaque"
                  className="w-full rounded-lg mb-4"
                />
              )}
              <h2 className="text-2xl font-bold">{c.appearance.title}</h2>
              <p className="mb-5 text-sm opacity-75">{c.appearance.subtitle}</p>
              {c.fields.map((f) => (
                <label key={f.key} className="block text-sm mb-3">
                  {f.label}
                  {f.required ? " *" : ""}
                  <input disabled className={inputClass} />
                </label>
              ))}
              <p className="text-sm mb-4">
                □ Aceito os termos de uso
                <br />□ {c.privacy.marketing_text}
              </p>
              <button
                disabled
                style={{ background: c.appearance.color }}
                className="w-full py-3 rounded-lg"
              >
                Conectar à internet
              </button>
              <p className="text-xs opacity-50 mt-3">
                Prévia · nenhum dado será enviado
              </p>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
