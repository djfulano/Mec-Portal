const db = require("../../db");
const axios = require("axios");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const S = require("./captiveService");
const P = require("./portalPolicy");
const { fail } = require("./unitAccess");
async function config(ctx) {
  const [[unit]] = await db.query("SELECT mp_config FROM unidades WHERE id=?", [
    ctx.device.unidade_id,
  ]);
  if (unit.mp_config) return P.json(unit.mp_config);
  const [[company]] = await db.query(
    "SELECT config_json FROM empresa_configs WHERE empresa_id=? AND config_type='mercadopago' AND ativo=1",
    [ctx.device.empresa_id],
  );
  if (company) return P.json(company.config_json);
  const legacy = await require("../models/ConfigMercadoPago").getConfig(
    ctx.device.empresa_id,
  );
  return legacy || {};
}
async function create(ctx, body) {
  if (
    !["paid", "both"].includes(ctx.config.access.mode) ||
    !ctx.config.access.plan_ids.includes(Number(body.plan_id))
  )
    throw fail(400, "Plano não disponível neste portal.");
  const [[plan]] = await db.query(
    "SELECT * FROM planos WHERE id=? AND empresa_id=?",
    [body.plan_id, ctx.device.empresa_id],
  );
  if (!plan || Number(plan.valor) <= 0) throw fail(400, "Plano inválido.");
  const mp = await config(ctx);
  if (!mp.access_token)
    throw fail(503, "Pagamento indisponível nesta unidade.");
  const id = crypto.randomUUID(),
    policy = {
      ...ctx.config.access,
      minutes: Number(plan.duracao_minutos),
      down: Number(plan.velocidade_down),
      up: Number(plan.velocidade_up),
      simultaneous: Number(plan.shared_users) || 1,
    };
  const device = S.client(body);
  const c = await db.getConnection();
  let visitor;
  try {
    await c.beginTransaction();
    visitor = await S.register(ctx, body, c);
    await c.query(
      "INSERT INTO captive_payments(id,empresa_id,unidade_id,equipamento_id,portal_id,revision_id,visitante_id,plano_id,valor,policy,mac,ip,mp_config) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        ctx.device.empresa_id,
        ctx.device.unidade_id,
        ctx.device.id,
        ctx.portal.id,
        ctx.revision.id,
        visitor,
        plan.id,
        Number(plan.valor) / 100,
        JSON.stringify(policy),
        device.mac,
        device.ip,
        JSON.stringify(mp),
      ],
    );
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
  const email = body.dados?.email || mp.email_pagador;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw fail(400, "Informe email para pagamento.");
  const base =
    process.env.SYSTEM_PUBLIC_URL ||
    require("../utils/systemUrl")(process.env.SYSTEM_DOMAIN);
  try {
    const r = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: Number(plan.valor) / 100,
        description: plan.nome,
        payment_method_id: "pix",
        payer: { email },
        external_reference: id,
        ...(base.startsWith("https://")
          ? { notification_url: base + "/api/captive/payments/webhook/" + id }
          : {}),
      },
      {
        headers: {
          Authorization: "Bearer " + mp.access_token,
          "X-Idempotency-Key": id,
        },
        timeout: 15000,
      },
    );
    await db.query(
      "UPDATE captive_payments SET provider_id=?,status=?,qr_code=?,qr_image=? WHERE id=?",
      [
        String(r.data.id),
        r.data.status || "pending",
        r.data.point_of_interaction?.transaction_data?.qr_code || null,
        r.data.point_of_interaction?.transaction_data?.qr_code_base64 || null,
        id,
      ],
    );
    return {
      id,
      payment_token: jwt.sign({ kind: "payment", id }, process.env.JWT_SECRET, {
        expiresIn: "24h",
      }),
      visitor_token: S.visitorToken(visitor, ctx),
    };
  } catch (e) {
    await db.query("UPDATE captive_payments SET status='error' WHERE id=?", [
      id,
    ]);
    throw fail(502, "Não foi possível gerar o PIX. Tente novamente.");
  }
}
async function refresh(id, notify = false) {
  const [[payment]] = await db.query(
    "SELECT * FROM captive_payments WHERE id=?",
    [id],
  );
  if (!payment) throw fail(404, "Pagamento não encontrado.");
  if (!payment.provider_id) return { status: payment.status };
  if (payment.grant_id) {
    const [[g]] = await db.query(
      "SELECT expires_at FROM access_grants WHERE id=?",
      [payment.grant_id],
    );
    if (!g || new Date(g.expires_at).getTime() < Date.now())
      return { status: "expired" };
  }
  const mp = P.json(payment.mp_config);
  const r = await axios.get(
    "https://api.mercadopago.com/v1/payments/" +
      encodeURIComponent(payment.provider_id),
    { headers: { Authorization: "Bearer " + mp.access_token }, timeout: 10000 },
  );
  if (
    r.data.external_reference !== id ||
    Number(r.data.transaction_amount) !== Number(payment.valor) ||
    r.data.currency_id !== "BRL"
  )
    throw fail(409, "Pagamento não corresponde ao pedido.");
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    const [[p]] = await c.query(
      "SELECT * FROM captive_payments WHERE id=? FOR UPDATE",
      [id],
    );
    await c.query("UPDATE captive_payments SET status=? WHERE id=?", [
      r.data.status,
      id,
    ]);
    let result;
    if (r.data.status === "approved") {
      if (!p.grant_id) {
        const [[device]] = await c.query(
          "SELECT * FROM mikrotiks WHERE id=? AND empresa_id=? AND unidade_id=?",
          [p.equipamento_id, p.empresa_id, p.unidade_id],
        );
        if (!device)
          throw fail(409, "Equipamento foi movido; revise o pagamento.");
        const ctx = {
          device,
          portal: { id: p.portal_id },
          revision: { id: p.revision_id },
        };
        result = await S.grant(
          ctx,
          p.visitante_id,
          { mac: p.mac, ip: p.ip },
          P.json(p.policy),
          c,
        );
        await c.query("UPDATE captive_payments SET grant_id=? WHERE id=?", [
          result.id,
          p.id,
        ]);
      } else {
        const [[g]] = await c.query("SELECT * FROM access_grants WHERE id=?", [
          p.grant_id,
        ]);
        const [[d]] = await c.query("SELECT * FROM mikrotiks WHERE id=?", [
          p.equipamento_id,
        ]);
        result = {
          id: g.id,
          ...require("./equipmentConnectors")
            .connector(d)
            .login(d, g.username, g.password),
        };
      }
    }
    await c.commit();
    return {
      status: r.data.status,
      qr_code: payment.qr_code,
      qr_image: payment.qr_image,
      ...(!notify && result ? { access: result } : {}),
    };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
module.exports = { create, refresh, config };
