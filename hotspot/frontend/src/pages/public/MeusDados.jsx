import { useEffect, useState } from "react";
import Copyright from "../../components/Copyright";
export default function MeusDados() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [values, setValues] = useState({});
  const call = async (path, body) => {
    const r = await fetch("/api/captive/privacy/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + sessionStorage.getItem("mec_visitor"),
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message);
    return d;
  };
  const load = () =>
    call("me")
      .then((d) => {
        setData(d);
        setValues(d.dados);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const request = async (tipo) => {
    try {
      await call("requests", {
        tipo,
        ...(tipo === "correcao" ? { dados: values } : {}),
      });
      setStatus("Solicitação registrada. Acompanhe a resposta abaixo.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="min-h-screen bg-[#0f111a] text-white p-6">
      <main className="max-w-lg mx-auto space-y-5">
        <h1 className="text-2xl font-bold">Meus dados</h1>
        {error && <p className="text-red-300">{error}</p>}
        {status && <p className="text-green-300">{status}</p>}
        {data && (
          <>
            <div className="space-y-3">
              {Object.entries(values).map(([k, v]) => (
                <label className="block text-sm" key={k}>
                  {k}
                  <input
                    className="block bg-[#1a1d27] p-3 rounded-lg w-full"
                    value={String(v)}
                    onChange={(e) =>
                      setValues({ ...values, [k]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                ["correcao", "Solicitar correção"],
                ["exclusao", "Solicitar exclusão"],
                ["revogar_marketing", "Revogar marketing"],
              ].map(([tipo, label]) => (
                <button
                  key={tipo}
                  className="bg-blue-600 p-3 rounded-lg"
                  onClick={() => request(tipo)}
                >
                  {label}
                </button>
              ))}
            </div>
            <h2 className="font-semibold">Solicitações</h2>
            {data.requests.map((r) => (
              <p key={r.id} className="text-sm border-b border-gray-700 py-3">
                {r.tipo} · {r.status}
                <br />
                {r.resposta}
              </p>
            ))}
          </>
        )}
      </main>
      <Copyright />
    </div>
  );
}
