const { fail } = require("./unitAccess");
const defaults = () => ({
  appearance: {
    title: "Wi-Fi da empresa",
    subtitle: "Conecte-se à internet",
    logo_url: "",
    background: "#0f111a",
    color: "#2563eb",
    image_url: "",
  },
  fields: [
    { key: "nome", label: "Nome", type: "text", required: true },
    { key: "telefone", label: "Telefone", type: "tel", required: true },
    { key: "email", label: "Email", type: "email", required: false },
  ],
  auth: { form: true, whatsapp: false, password: false },
  access: {
    mode: "free",
    minutes: 60,
    down: 10,
    up: 5,
    simultaneous: 1,
    reconnect_minutes: 0,
    plan_ids: [],
  },
  privacy: {
    terms: "",
    policy: "",
    purpose: "Fornecer acesso à internet.",
    marketing_text: "Desejo receber ofertas e novidades.",
    contact: "",
  },
  equipment_ids: [],
  unit_ids: [],
});
function json(value, fallback = {}) {
  if (value == null) return fallback;
  return typeof value === "string" ? JSON.parse(value) : value;
}
function validate(input, publish = false) {
  if (!input || typeof input !== "object")
    throw fail(400, "Configuração inválida.");
  const d = defaults(),
    c = {
      ...d,
      ...input,
      appearance: { ...d.appearance, ...input.appearance },
      auth: { ...d.auth, ...input.auth },
      access: { ...d.access, ...input.access },
      privacy: { ...d.privacy, ...input.privacy },
    };
  if (!c.fields || !Array.isArray(c.fields) || c.fields.length > 30)
    throw fail(400, "Informe até 30 campos.");
  const keys = new Set();
  for (const f of c.fields) {
    if (
      !/^[a-z][a-z0-9_]{0,39}$/.test(f.key) ||
      keys.has(f.key) ||
      !f.label ||
      !["text", "email", "tel", "date", "select", "checkbox"].includes(f.type)
    )
      throw fail(400, "Campos inválidos ou repetidos.");
    keys.add(f.key);
    if (f.type === "select" && (!Array.isArray(f.options) || !f.options.length))
      throw fail(400, "Informe opções do campo.");
  }
  if (!Object.values(c.auth).some((v) => v === true))
    throw fail(400, "Selecione uma forma de autenticação.");
  if (
    c.auth.whatsapp &&
    !c.fields.some((f) => f.key === "telefone" && f.required)
  )
    throw fail(400, "WhatsApp exige o campo telefone obrigatório.");
  if (!["free", "paid", "both"].includes(c.access.mode))
    throw fail(400, "Modo de acesso inválido.");
  for (const [key, min, max] of [
    ["minutes", 1, 43200],
    ["down", 1, 10000],
    ["up", 1, 10000],
    ["simultaneous", 1, 20],
    ["reconnect_minutes", 0, 43200],
  ]) {
    const n = Number(c.access[key]);
    if (!Number.isFinite(n) || n < min || n > max || !Number.isInteger(n))
      throw fail(400, "Regra de acesso inválida: " + key);
    c.access[key] = n;
  }
  for (const name of ["unit_ids", "equipment_ids"]) {
    if (!Array.isArray(c[name])) throw fail(400, "Vínculos inválidos.");
    c[name] = [...new Set(c[name].map(Number))];
    if (c[name].some((n) => !Number.isSafeInteger(n) || n < 1))
      throw fail(400, "Vínculo inválido.");
  }
  c.access.plan_ids = [...new Set((c.access.plan_ids || []).map(Number))];
  if (
    publish &&
    (!c.privacy.terms.trim() ||
      !c.privacy.policy.trim() ||
      !c.privacy.contact.trim() ||
      !c.privacy.purpose.trim())
  )
    throw fail(
      400,
      "Preencha termos, política, finalidade e contato de privacidade antes de publicar.",
    );
  if (publish && c.access.mode !== "free" && !c.access.plan_ids.length)
    throw fail(400, "Selecione planos pagos.");
  for (const k of ["logo_url", "image_url"]) {
    const value = c.appearance[k];
    if (
      value &&
      !/^https:\/\//i.test(value) &&
      !/^\/api\/empresas\/logos\//.test(value) &&
      !/^\/uploads\/logos\//.test(value)
    )
      throw fail(400, "Use endereço HTTPS ou imagem enviada ao sistema.");
  }
  for (const k of ["color", "background"])
    if (!/^#[0-9a-f]{6}$/i.test(c.appearance[k]))
      throw fail(400, "Cor inválida.");
  return c;
}
function fromLegacy(p) {
  const c = defaults(),
    old = json(p.configuracoes, {});
  c.appearance = {
    ...c.appearance,
    title: old.titulo || p.nome,
    subtitle: old.subtitulo || c.appearance.subtitle,
    logo_url: p.logo_url || old.logo_url || "",
    color: p.cor_primaria || old.cor_botao || c.appearance.color,
    background: p.cor_fundo || old.cor_fundo_1 || c.appearance.background,
  };
  const fields = json(p.campos_cadastro, null);
  if (
    Array.isArray(fields) &&
    fields.every((f) => f?.key && f?.label && f?.type)
  )
    c.fields = fields;
  c.auth = {
    form: p.tipo !== "login",
    whatsapp: false,
    password: p.tipo === "login",
  };
  c.legacy = true;
  return c;
}
module.exports = { defaults, json, validate, fromLegacy };
