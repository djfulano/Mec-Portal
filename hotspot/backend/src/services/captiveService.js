const db = require("../../db");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const net = require("net");
const { fail } = require("./unitAccess");
const P = require("./portalPolicy");
const { connector } = require("./equipmentConnectors");
const hash = (v) =>
  crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(String(v))
    .digest("hex");
async function context(id) {
  const [[d]] = await db.query(
    "SELECT m.*,e.cadastro_compartilhado,e.nome empresa_nome,u.ativo unidade_ativa FROM mikrotiks m JOIN empresas e ON e.id=m.empresa_id AND e.ativo=1 JOIN unidades u ON u.id=m.unidade_id AND u.empresa_id=m.empresa_id WHERE m.id=?",
    [id],
  );
  if (!d || !d.unidade_ativa) throw fail(404, "Equipamento indisponível.");
  const [[p]] = await db.query(
    "SELECT * FROM portais WHERE id=? AND empresa_id=? AND managed=1",
    [d.portal_id, d.empresa_id],
  );
  if (!p?.published_revision_id) throw fail(404, "Portal ainda não publicado.");
  const [[r]] = await db.query(
    "SELECT * FROM portal_revisions WHERE id=? AND portal_id=?",
    [p.published_revision_id, p.id],
  );
  if (!r) throw fail(404, "Versão não encontrada.");
  return { device: d, portal: p, revision: r, config: P.json(r.config) };
}
function client(body) {
  const mac = String(body.mac || "")
    .replaceAll("-", ":")
    .toUpperCase();
  if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac) || !net.isIP(body.ip || ""))
    throw fail(400, "MAC ou IP do equipamento cliente inválido.");
  return { mac, ip: body.ip };
}
async function identity(ctx, body) {
  if (Number(body.revision_id) !== ctx.revision.id)
    throw fail(
      409,
      "O portal foi atualizado. Recarregue a página antes de continuar.",
    );
  const { mac } = client(body);
  let method = body.method || "form";
  if (
    !["form", "whatsapp", "password"].includes(method) ||
    !ctx.config.auth[method]
  )
    throw fail(403, "Método não habilitado neste portal.");
  if (method === "whatsapp") {
    const [[otp]] = await db.query(
      "SELECT * FROM captive_otp WHERE id=? AND equipamento_id=? AND mac=?",
      [body.challenge_id || "", ctx.device.id, mac],
    );
    if (
      !otp ||
      !otp.verificado ||
      otp.usado ||
      new Date(otp.expires_at).getTime() < Date.now()
    )
      throw fail(401, "Código não validado ou expirado.");
    if (String(body.dados?.telefone || "").replace(/\D/g, "") !== otp.telefone)
      throw fail(400, "Telefone diferente do número verificado.");
  }
  if (method === "password") {
    const [[user]] = await db.query(
      "SELECT ru.username,rc.value FROM radius_users ru JOIN radcheck rc ON rc.username=ru.username AND rc.attribute='Cleartext-Password' WHERE ru.username=? AND ru.empresa_id=?",
      [body.username || "", ctx.device.empresa_id],
    );
    if (
      !user ||
      typeof body.password !== "string" ||
      !crypto.timingSafeEqual(
        Buffer.from(hash(body.password)),
        Buffer.from(hash(user.value)),
      )
    )
      throw fail(401, "Usuário ou senha inválidos.");
    return { key: "password:" + user.username, method };
  }
  // Form access collects data but does not claim verification of the supplied contact.
  // An unverified MAC/contact must never recover another visitor's private profile.
  if (method === 'form' && body.visitor_token) {
    let saved;
    try { saved=jwt.verify(body.visitor_token,process.env.JWT_SECRET); } catch { saved=null; }
    const scope=ctx.device.empresa_id+':'+(ctx.device.cadastro_compartilhado?'company':'unit:'+ctx.device.unidade_id);
    if(saved?.kind==='visitor' && saved.empresa_id===ctx.device.empresa_id){
      const [[known]]=await db.query('SELECT identidade_hash FROM visitantes WHERE id=? AND empresa_id=? AND escopo=?',[saved.visitor_id,ctx.device.empresa_id,scope]);
      if(known)return {identity_hash:known.identidade_hash,method};
    }
  }
  const data = body.dados || {};
  return {
    key:
      method === "whatsapp"
        ? "phone:" + String(data.telefone).replace(/\D/g, "")
        : "browser:" + crypto.randomUUID(),
    method,
  };
}
function fields(config, input) {
  const out = {};
  for (const f of config.fields) {
    const v = input?.[f.key];
    if (
      f.required &&
      (v == null || v === "" || (f.type === "checkbox" && v !== true))
    )
      throw fail(400, "Preencha " + f.label + ".");
    if (v == null || v === "") continue;
    if (f.type === "checkbox") {
      out[f.key] = v === true;
      continue;
    }
    if (typeof v !== "string" || v.length > 1000)
      throw fail(400, "Campo inválido: " + f.label);
    if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      throw fail(400, "Email inválido.");
    if (f.type === "select" && !f.options.includes(v))
      throw fail(400, "Opção inválida.");
    if (f.key === "cpf") {
      const n = v.replace(/\D/g, "");
      if (!/^\d{11}$/.test(n) || /^(\d)\1+$/.test(n))
        throw fail(400, "CPF inválido.");
      for (let j = 9; j <= 10; j++) {
        let sum = 0;
        for (let i = 0; i < j; i++) sum += Number(n[i]) * (j + 1 - i);
        if (((sum * 10) % 11) % 10 !== Number(n[j]))
          throw fail(400, "CPF inválido.");
      }
    }
    out[f.key] = v.trim();
  }
  return out;
}
function visitorToken(id, ctx) {
  return jwt.sign(
    {
      kind: "visitor",
      visitor_id: id,
      empresa_id: ctx.device.empresa_id,
      unidade_id: ctx.device.unidade_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
}
async function register(ctx, body, c = db) {
  const who = await identity(ctx, body);
  const identityHash=who.identity_hash||hash(who.key);
  if (body.accept_terms !== true)
    throw fail(400, "É necessário aceitar os termos de uso.");
  const data = fields(ctx.config, body.dados),
    scope =
      ctx.device.empresa_id +
      ":" +
      (ctx.device.cadastro_compartilhado
        ? "company"
        : "unit:" + ctx.device.unidade_id);
  await c.query(
    "INSERT INTO visitantes(empresa_id,unidade_id,escopo,identidade_hash,dados) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE dados=JSON_MERGE_PATCH(dados,VALUES(dados)),atualizado_em=NOW()",
    [
      ctx.device.empresa_id,
      ctx.device.unidade_id,
      scope,
      identityHash,
      JSON.stringify(data),
    ],
  );
  const [[v]] = await c.query(
    "SELECT id FROM visitantes WHERE escopo=? AND identidade_hash=?",
    [scope, identityHash],
  );
  await c.query(
    "INSERT INTO visitor_consents(visitante_id,empresa_id,unidade_id,portal_id,revision_id,finalidade,marketing,termos,politica,ip,origem) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [
      v.id,
      ctx.device.empresa_id,
      ctx.device.unidade_id,
      ctx.portal.id,
      ctx.revision.id,
      ctx.config.privacy.purpose,
      body.marketing === true ? 1 : 0,
      ctx.config.privacy.terms,
      ctx.config.privacy.policy,
      body.ip,
      who.method,
    ],
  );
  if (who.method === "whatsapp") {
    const [r] = await c.query(
      "UPDATE captive_otp SET usado=1 WHERE id=? AND usado=0",
      [body.challenge_id],
    );
    if (!r.affectedRows) throw fail(401, "Código já utilizado.");
  }
  return v.id;
}
function radiusDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ][d.getMonth()] +
    " " +
    pad(d.getDate()) +
    " " +
    d.getFullYear() +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes()) +
    ":" +
    pad(d.getSeconds())
  );
}
async function grant(ctx, visitorId, body, policy, connection = db) {
  const device = ctx.device,
    { mac, ip } = client(body);
  const id = crypto.randomUUID(),
    username = "mec_" + id.replaceAll("-", ""),
    password = crypto.randomBytes(24).toString("hex");
  const end = new Date(Date.now() + Number(policy.minutes) * 60000);
  await connection.query(
    "INSERT INTO access_grants(id,empresa_id,unidade_id,equipamento_id,portal_id,revision_id,visitante_id,username,password,mac,ip,policy,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      id,
      device.empresa_id,
      device.unidade_id,
      device.id,
      ctx.portal.id,
      ctx.revision.id,
      visitorId,
      username,
      password,
      mac,
      ip,
      JSON.stringify(policy),
      end,
    ],
  );
  for (const [attr, val] of [
    ["Cleartext-Password", password],
    ["Simultaneous-Use", String(policy.simultaneous)],
    ["NAS-IP-Address", device.ip],
    ["Calling-Station-Id", mac],
    ["Expiration", radiusDate(end)],
  ])
    await connection.query(
      "INSERT INTO radcheck(username,attribute,op,value) VALUES (?,?,?,?)",
      [
        username,
        attr,
        attr === "NAS-IP-Address" || attr === "Calling-Station-Id"
          ? "=="
          : ":=",
        val,
      ],
    );
  for (const [attr, val] of [
    ["Session-Timeout", String(policy.minutes * 60)],
    ["Mikrotik-Rate-Limit", policy.up + "M/" + policy.down + "M"],
  ])
    await connection.query(
      "INSERT INTO radreply(username,attribute,op,value) VALUES (?,?,':=',?)",
      [username, attr, val],
    );
  return {
    id,
    ...connector(device).login(device, username, password),
    expires_at: end,
    visitor_token: visitorToken(visitorId, ctx),
  };
}
async function access(ctx, body) {
  if (ctx.config.access.mode === "paid")
    throw fail(403, "Selecione um plano pago.");
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    const { mac } = client(body);
    // Serializes requests for a device, preventing simultaneous form requests bypassing cooldown.
    await c.query("SELECT id FROM mikrotiks WHERE id=? FOR UPDATE", [
      ctx.device.id,
    ]);
    const [[last]] = await c.query(
      "SELECT criado_em FROM access_grants WHERE empresa_id=? AND portal_id=? AND mac=? ORDER BY criado_em DESC LIMIT 1",
      [ctx.device.empresa_id, ctx.portal.id, mac],
    );
    if (
      last &&
      Date.now() - new Date(last.criado_em).getTime() <
        ctx.config.access.reconnect_minutes * 60000
    )
      throw fail(429, "Aguarde o intervalo de reconexão.");
    const visitor = await register(ctx, body, c),
      result = await grant(ctx, visitor, body, ctx.config.access, c);
    await c.commit();
    return result;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
module.exports = {
  context,
  client,
  identity,
  register,
  grant,
  access,
  hash,
  visitorToken,
  fields,
};
