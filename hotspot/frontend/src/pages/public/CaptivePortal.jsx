import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import Copyright from "../../components/Copyright";
export default function CaptivePortal() {
  const { equipmentId } = useParams(),
    [query] = useSearchParams();
  const [data, setData] = useState(null),
    [values, setValues] = useState({}),
    [method, setMethod] = useState("form"),
    [terms, setTerms] = useState(false),
    [marketing, setMarketing] = useState(false),
    [credentials, setCredentials] = useState({}),
    [challenge, setChallenge] = useState(""),
    [code, setCode] = useState(""),
    [verified, setVerified] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [payment, setPayment] = useState(null),
    [paymentStatus, setPaymentStatus] = useState(null),
    [plan, setPlan] = useState(""),
    [document, setDocument] = useState("");
  const call = async (path, body, token) => {
    const r = await fetch("/api/captive" + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || "Erro ao conectar.");
    return d;
  };
  useEffect(() => {
    call("/devices/" + equipmentId)
      .then(async (d) => {
        setData(d);
        setMethod(
          d.config.auth.form
            ? "form"
            : d.config.auth.whatsapp
              ? "whatsapp"
              : "password",
        );
        const saved = sessionStorage.getItem("mec_visitor");
        if (saved) {
          try {
            const v = await call(
              "/devices/" + equipmentId + "/visitor",
              null,
              saved,
            );
            setValues(v.dados || {});
          } catch {
            /* Cadastro só é reutilizado mediante identificação válida. */
          }
        }
      })
      .catch((e) => setError(e.message));
  }, [equipmentId]);
  const connect = (access) => {
    if (access.visitor_token)
      sessionStorage.setItem("mec_visitor", access.visitor_token);
    const form = window.document.createElement("form");
    form.method = "POST";
    form.action = access.action;
    for (const [name, value] of Object.entries({
      username: access.username,
      password: access.password,
    })) {
      const input = window.document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.append(input);
    }
    window.document.body.append(form);
    form.submit();
  };
  useEffect(() => {
    if (!payment) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const d = await call(
          "/payments/" + payment.id,
          null,
          payment.payment_token,
        );
        if (cancelled) return;
        setPaymentStatus(d);
        if (d.access) {
          setPayment(null);
          connect(d.access);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    };
    refresh();
    const timer = setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [payment]);
  const act = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const client = { mac: query.get("mac") || "", ip: query.get("ip") || "" };
  const submit = (e) => {
    e.preventDefault();
    act(async () => {
      const body = {
        ...client,
        revision_id: data.revision_id,
        visitor_token: sessionStorage.getItem('mec_visitor') || undefined,
        dados: values,
        method,
        accept_terms: terms,
        marketing,
        ...credentials,
        challenge_id: challenge,
      };
      if (plan) {
        const d = await call("/devices/" + equipmentId + "/payment", {
          ...body,
          plan_id: Number(plan),
        });
        sessionStorage.setItem("mec_visitor", d.visitor_token);
        setPayment(d);
      } else connect(await call("/devices/" + equipmentId + "/access", body));
    });
  };
  const config = data?.config,
    box =
      "w-full bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-white";
  return (
    <div
      style={{ background: config?.appearance.background || "#0f111a" }}
      className="min-h-screen px-4 py-8 flex flex-col items-center text-white"
    >
      <main className="w-full max-w-md rounded-2xl bg-white/5 border border-white/10 p-6 shadow-xl">
        {error && (
          <p
            role="alert"
            className="mb-4 p-3 bg-red-950 text-red-200 rounded-lg"
          >
            {error}
          </p>
        )}
        {!data ? (
          <p>Carregando portal…</p>
        ) : (
          <>
            {config.appearance.logo_url && (
              <img
                className="w-full h-44 object-contain mb-6"
                src={config.appearance.logo_url}
                alt={"Logo de " + data.company}
              />
            )}
            <h1 className="text-2xl font-bold text-center">
              {config.appearance.title}
            </h1>
            <p className="text-center text-sm text-white/70 mt-2 mb-6">
              {config.appearance.subtitle}
            </p>
            {config.appearance.image_url && (
              <img
                className="rounded-lg mb-5 w-full"
                src={config.appearance.image_url}
                alt="Destaque"
              />
            )}
            {payment ? (
              <section className="space-y-4 text-center">
                <h2 className="font-semibold">Pague para conectar</h2>
                {paymentStatus?.qr_image && (
                  <img
                    className="mx-auto w-56"
                    src={"data:image/png;base64," + paymentStatus.qr_image}
                    alt="QR Code PIX"
                  />
                )}
                {paymentStatus?.qr_code && (
                  <>
                    <textarea
                      readOnly
                      className={box}
                      value={paymentStatus.qr_code}
                    />
                    <button
                      className="underline"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(paymentStatus.qr_code)
                          .catch(() =>
                            setError("Copie o código na caixa acima."),
                          )
                      }
                    >
                      Copiar PIX
                    </button>
                  </>
                )}
                <p className="text-sm">
                  {paymentStatus?.status === "approved"
                    ? "Pagamento aprovado. Conectando…"
                    : paymentStatus?.status === "rejected"
                      ? "Pagamento recusado."
                      : "Aguardando confirmação do pagamento."}
                </p>
                <p className="text-xs text-white/60">
                  O acesso será liberado após a confirmação.
                </p>
              </section>
            ) : (
              <form className="space-y-4" onSubmit={submit}>
                <div className="flex flex-wrap gap-2">
                  {Object.entries({
                    form: "Cadastro",
                    whatsapp: "Código WhatsApp",
                    password: "Usuário e senha",
                  })
                    .filter(([k]) => config.auth[k])
                    .map(([k, label]) => (
                      <button
                        type="button"
                        key={k}
                        onClick={() => setMethod(k)}
                        className={
                          "px-3 py-2 text-sm rounded-lg " +
                          (method === k ? "bg-white/20" : "bg-white/5")
                        }
                      >
                        {label}
                      </button>
                    ))}
                </div>
                {method === "password" && (
                  <>
                    <label className="block text-sm">
                      Usuário
                      <input
                        autoComplete="username"
                        required
                        className={box}
                        value={credentials.username || ""}
                        onChange={(e) =>
                          setCredentials({
                            ...credentials,
                            username: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="block text-sm">
                      Senha
                      <input
                        autoComplete="current-password"
                        type="password"
                        required
                        className={box}
                        value={credentials.password || ""}
                        onChange={(e) =>
                          setCredentials({
                            ...credentials,
                            password: e.target.value,
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {config.fields.map((f) => (
                  <label key={f.key} className="block text-sm">
                    {f.label}
                    {f.required ? " *" : ""}
                    {f.type === "checkbox" ? (
                      <input
                        className="ml-3"
                        type="checkbox"
                        required={f.required}
                        checked={values[f.key] === true}
                        onChange={(e) =>
                          setValues({ ...values, [f.key]: e.target.checked })
                        }
                      />
                    ) : f.type === "select" ? (
                      <select
                        className={box}
                        required={f.required}
                        value={values[f.key] || ""}
                        onChange={(e) =>
                          setValues({ ...values, [f.key]: e.target.value })
                        }
                      >
                        <option className="text-black" value="">
                          Selecione
                        </option>
                        {f.options.map((o) => (
                          <option className="text-black" key={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className={box}
                        type={f.type}
                        required={f.required}
                        value={values[f.key] || ""}
                        onChange={(e) => {
                          setValues({ ...values, [f.key]: e.target.value });
                          if (f.key === "telefone") {
                            setVerified(false);
                            setChallenge("");
                          }
                        }}
                      />
                    )}
                  </label>
                ))}
                {method === "whatsapp" && (
                  <div className="space-y-3 p-3 rounded-lg bg-white/5">
                    <button
                      type="button"
                      disabled={busy}
                      className="underline text-sm"
                      onClick={() =>
                        act(async () => {
                          const d = await call(
                            "/devices/" + equipmentId + "/otp",
                            { ...client, telefone: values.telefone },
                          );
                          setChallenge(d.challenge_id);
                          setVerified(false);
                        })
                      }
                    >
                      {challenge
                        ? "Reenviar código"
                        : "Enviar código para meu WhatsApp"}
                    </button>
                    {challenge && (
                      <>
                        <input
                          inputMode="numeric"
                          maxLength="6"
                          className={box}
                          value={code}
                          placeholder="Código recebido"
                          onChange={(e) => setCode(e.target.value)}
                        />
                        <button
                          type="button"
                          disabled={busy || verified}
                          className="underline text-sm"
                          onClick={() =>
                            act(async () => {
                              await call(
                                "/devices/" + equipmentId + "/otp/verify",
                                { ...client, challenge_id: challenge, code },
                              );
                              setVerified(true);
                            })
                          }
                        >
                          {verified
                            ? "Telefone verificado ✓"
                            : "Validar código"}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {config.access.mode !== "free" && (
                  <label className="block text-sm">
                    Escolha o acesso
                    <select
                      className={box}
                      required={config.access.mode === "paid"}
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                    >
                      {config.access.mode === "both" ? (
                        <option className="text-black" value="">
                          Gratuito · {config.access.minutes} minutos
                        </option>
                      ) : (
                        <option className="text-black" value="">
                          Selecione um plano
                        </option>
                      )}
                      {data.plans.map((p) => (
                        <option className="text-black" key={p.id} value={p.id}>
                          {p.nome} · R$ {(Number(p.valor) / 100).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex gap-3 text-sm">
                  <input
                    type="checkbox"
                    required
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                  />
                  <span>
                    Aceito os{" "}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => setDocument("terms")}
                    >
                      termos de uso
                    </button>{" "}
                    e li a{" "}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => setDocument("policy")}
                    >
                      política de privacidade
                    </button>
                    .
                  </span>
                </label>
                <label className="flex gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                  />
                  {config.privacy.marketing_text} (opcional)
                </label>
                <button
                  style={{ background: config.appearance.color }}
                  className="w-full py-3 rounded-lg font-semibold disabled:opacity-50"
                  disabled={busy || (method === "whatsapp" && !verified)}
                >
                  {busy
                    ? "Aguarde…"
                    : plan
                      ? "Gerar PIX e conectar"
                      : "Conectar à internet"}
                </button>
                <p className="text-xs text-white/60">
                  {config.privacy.purpose}
                </p>
              </form>
            )}
            <div className="mt-6 text-xs text-center text-white/60">
              <p>Privacidade: {config.privacy.contact}</p>
              <Link className="underline" to="/meus-dados">
                Consultar meus dados e solicitações
              </Link>
            </div>
          </>
        )}
      </main>
      <Copyright />
      {document && (
        <div className="fixed inset-0 bg-black/80 p-4 flex items-center justify-center">
          <section className="bg-[#1a1d27] p-6 rounded-xl w-full max-w-lg max-h-[85vh] overflow-auto">
            <h2 className="text-xl font-semibold mb-4">
              {document === "terms"
                ? "Termos de uso"
                : "Política de privacidade"}
            </h2>
            <p className="whitespace-pre-wrap text-sm">
              {config.privacy[document]}
            </p>
            <button className="mt-5 underline" onClick={() => setDocument("")}>
              Fechar
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
