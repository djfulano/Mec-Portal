const router = require("express").Router();
const db = require("../../db");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const S = require("../services/captiveService");
const P = require("../services/portalPolicy");
const payments = require("../services/captivePayments");
const { fail } = require("../services/unitAccess");
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    console.error("[captive]", e.message);
    res
      .status(e.status || 500)
      .json({
        message: e.status
          ? e.message
          : "Não foi possível processar a solicitação.",
      });
  }
};
router.get(
  "/devices/:id",
  wrap(async (req, res) => {
    const ctx = await S.context(req.params.id);
    const [plans] = await db.query(
      "SELECT id,nome,valor,duracao_minutos,velocidade_down,velocidade_up FROM planos WHERE empresa_id=?",
      [ctx.device.empresa_id],
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({
      config: ctx.config,
      revision: ctx.revision.numero,
      revision_id: ctx.revision.id,
      company: ctx.device.empresa_nome,
      plans: plans.filter((p) => ctx.config.access.plan_ids.includes(p.id)),
    });
  }),
);
router.get(
  "/devices/:id/visitor",
  wrap(async (req, res) => {
    const v = visitor(req),
      ctx = await S.context(req.params.id);
    if (
      v.empresa_id !== ctx.device.empresa_id ||
      (!ctx.device.cadastro_compartilhado &&
        v.unidade_id !== ctx.device.unidade_id)
    )
      throw fail(403, "Cadastro separado nesta unidade.");
    const [[r]] = await db.query(
      "SELECT dados FROM visitantes WHERE id=? AND empresa_id=?",
      [v.visitor_id, v.empresa_id],
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({ dados: P.json(r?.dados) });
  }),
);
router.post(
  "/devices/:id/access",
  wrap(async (req, res) => {
    res.json(await S.access(await S.context(req.params.id), req.body));
  }),
);
router.post(
  "/devices/:id/otp",
  wrap(async (req, res) => {
    const ctx = await S.context(req.params.id);
    if (!ctx.config.auth.whatsapp) throw fail(403, "Método não habilitado.");
    const { mac } = S.client(req.body),
      telefone = String(req.body.telefone || "").replace(/\D/g, "");
    if (!/^\d{10,13}$/.test(telefone)) throw fail(400, "Telefone inválido.");
    const origin = S.hash(req.ip);
    const c = await db.getConnection();
    let id, code;
    try {
      await c.beginTransaction();
      await c.query("SELECT id FROM empresas WHERE id=? FOR UPDATE", [
        ctx.device.empresa_id,
      ]);
      const [[count]] = await c.query(
        "SELECT SUM(o.telefone=?) total,SUM(o.origem_hash=?) origem,MAX(CASE WHEN o.telefone=? THEN o.criado_em ELSE NULL END) ultimo FROM captive_otp o JOIN mikrotiks m ON m.id=o.equipamento_id WHERE m.empresa_id=? AND o.criado_em>DATE_SUB(NOW(),INTERVAL 15 MINUTE)",
        [telefone, origin, telefone, ctx.device.empresa_id],
      );
      if (
        count.total >= 3 ||
        count.origem >= 150 ||
        (count.ultimo && Date.now() - new Date(count.ultimo).getTime() < 60000)
      )
        throw fail(429, "Aguarde antes de solicitar outro código.");
      id = crypto.randomUUID();
      code = String(crypto.randomInt(100000, 1000000));
      await c.query(
        "INSERT INTO captive_otp(id,equipamento_id,telefone,codigo_hash,mac,origem_hash,expires_at) VALUES (?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 5 MINUTE))",
        [id, ctx.device.id, telefone, S.hash(id + code), mac, origin],
      );
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
    try {
      const delivered =
        await require("../controllers/whatsappController").enviarMensagemDireta(
          telefone,
          "Seu código de acesso Mec Portal: " +
            code +
            ". Válido por 5 minutos.",
          ctx.device.empresa_id,
        );
      if (!delivered) throw new Error("WhatsApp indisponível");
    } catch (e) {
      await db.query("UPDATE captive_otp SET usado=1 WHERE id=?", [id]);
      throw fail(
        503,
        "Não foi possível enviar o código. Tente outro método disponível.",
      );
    }
    res.json({ challenge_id: id, expires_in: 300 });
  }),
);
router.post(
  "/devices/:id/otp/verify",
  wrap(async (req, res) => {
    const { mac } = S.client(req.body);
    const c = await db.getConnection();
    let valid = false;
    try {
      await c.beginTransaction();
      const [[o]] = await c.query(
        "SELECT * FROM captive_otp WHERE id=? AND equipamento_id=? AND mac=? FOR UPDATE",
        [req.body.challenge_id || "", req.params.id, mac],
      );
      if (
        !o ||
        o.usado ||
        o.tentativas >= 5 ||
        new Date(o.expires_at).getTime() < Date.now()
      )
        throw fail(401, "Código inválido ou expirado.");
      valid =
        typeof req.body.code === "string" &&
        S.hash(o.id + req.body.code) === o.codigo_hash;
      await c.query(
        "UPDATE captive_otp SET tentativas=tentativas+1,verificado=? WHERE id=?",
        [valid ? 1 : 0, o.id],
      );
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
    if (!valid) throw fail(401, "Código inválido.");
    res.json({ verified: true });
  }),
);
router.post(
  "/devices/:id/payment",
  wrap(async (req, res) => {
    res
      .status(201)
      .json(await payments.create(await S.context(req.params.id), req.body));
  }),
);
router.get(
  "/payments/:id",
  wrap(async (req, res) => {
    let token;
    try {
      token = jwt.verify(
        (req.headers.authorization || "").replace(/^Bearer /, ""),
        process.env.JWT_SECRET,
      );
    } catch (e) {
      throw fail(401, "Pedido não autorizado.");
    }
    if (token.kind !== "payment" || token.id !== req.params.id)
      throw fail(403, "Pedido não autorizado.");
    res.json(await payments.refresh(token.id));
  }),
);
// Notifications trigger server-to-server verification, never trust event data as payment approval.
router.post(
  "/payments/webhook/:id",
  wrap(async (req, res) => {
    await payments.refresh(req.params.id, true);
    res.json({ ok: true });
  }),
);
function visitor(req) {
  let v;
  try {
    v = jwt.verify(
      (req.headers.authorization || "").replace(/^Bearer /, ""),
      process.env.JWT_SECRET,
    );
  } catch (e) {
    throw fail(401, "Identificação expirada. Conecte-se novamente.");
  }
  if (v.kind !== "visitor") throw fail(403, "Identificação inválida.");
  return v;
}
router.get(
  "/privacy/me",
  wrap(async (req, res) => {
    const v = visitor(req);
    const [[record]] = await db.query(
      "SELECT dados FROM visitantes WHERE id=? AND empresa_id=?",
      [v.visitor_id, v.empresa_id],
    );
    const [requests] = await db.query(
      "SELECT id,tipo,status,resposta,criado_em FROM privacy_requests WHERE visitante_id=? AND empresa_id=?",
      [v.visitor_id, v.empresa_id],
    );
    res.json({ dados: P.json(record?.dados), requests });
  }),
);
router.post(
  "/privacy/requests",
  wrap(async (req, res) => {
    const v = visitor(req);
    if (
      !["consulta", "correcao", "exclusao", "revogar_marketing"].includes(
        req.body.tipo,
      )
    )
      throw fail(400, "Solicitação inválida.");
    if (
      req.body.tipo === "correcao" &&
      (!req.body.dados ||
        typeof req.body.dados !== "object" ||
        JSON.stringify(req.body.dados).length > 30000)
    )
      throw fail(400, "Dados inválidos.");
    await db.query(
      "INSERT INTO privacy_requests(empresa_id,unidade_id,visitante_id,tipo,dados) VALUES (?,?,?,?,?)",
      [
        v.empresa_id,
        v.unidade_id,
        v.visitor_id,
        req.body.tipo,
        JSON.stringify(req.body.dados || {}),
      ],
    );
    if (req.body.tipo === "revogar_marketing")
      await db.query(
        "UPDATE visitor_consents SET marketing=0 WHERE visitante_id=? AND empresa_id=?",
        [v.visitor_id, v.empresa_id],
      );
    res.status(201).json({ ok: true });
  }),
);
router.post(
  "/collectors/:id/nat",
  wrap(async (req, res) => {
    const [[d]] = await db.query(
      "SELECT id,empresa_id,unidade_id,collector_hash FROM mikrotiks WHERE id=?",
      [req.params.id],
    );
    const key = (req.headers.authorization || "").replace(/^Bearer /, "");
    if (
      !d?.collector_hash ||
      crypto.createHash("sha256").update(key).digest("hex") !== d.collector_hash
    )
      throw fail(401, "Coletor não autorizado.");
    const rows = req.body.records;
    if (!Array.isArray(rows) || rows.length > 500)
      throw fail(400, "Envie até 500 registros.");
    const net = require("net");
    for (const r of rows)
      if (
        !net.isIP(r.ip_privado || "") ||
        !net.isIP(r.ip_publico || "") ||
        !Number.isInteger(r.porta_publica) ||
        r.porta_publica < 1 ||
        r.porta_publica > 65535 ||
        !["tcp", "udp"].includes(r.protocolo) ||
        !Number.isFinite(Date.parse(r.inicio)) ||
        (r.fim && !Number.isFinite(Date.parse(r.fim)))
      )
        throw fail(400, "Registro NAT inválido.");
    const c = await db.getConnection();
    try {
      await c.beginTransaction();
      for (const r of rows)
        await c.query(
          "INSERT INTO nat_records(empresa_id,unidade_id,equipamento_id,ip_privado,porta_privada,ip_publico,porta_publica,protocolo,inicio,fim) VALUES (?,?,?,?,?,?,?,?,?,?)",
          [
            d.empresa_id,
            d.unidade_id,
            d.id,
            r.ip_privado,
            r.porta_privada || null,
            r.ip_publico,
            r.porta_publica,
            r.protocolo,
            new Date(r.inicio),
            r.fim ? new Date(r.fim) : null,
          ],
        );
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
    res.json({ received: rows.length });
  }),
);
module.exports = router;
