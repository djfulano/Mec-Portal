// Run against an isolated, migrated database. Never point this test at production.
const assert = require("node:assert/strict");
const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const A = require("../src/services/unitAccess");
const P = require("../src/services/portalPolicy");
const S = require("../src/services/captiveService");
const axios = require("axios");
if (!/^mec_validation_/.test(process.env.DB_NAME || ""))
  throw new Error("A database with the mec_validation_ prefix is required.");
const app = express();
app.use(express.json());
app.use(
  "/api/workspace",
  require("../src/middleware/auth"),
  require("../src/middleware/tenant"),
  require("../src/routes/workspaceRoutes"),
);
app.use("/api/captive", require("../src/routes/captiveRoutes"));
app.use(
  "/api/leads",
  require("../src/middleware/auth"),
  require("../src/middleware/tenant"),
  (req, res) => res.json({ unexpected: true }),
);
app.use(
  "/api/lead-portal",
  require("../src/middleware/legacyCaptiveGuard"),
  (req, res) => res.json({ unexpected: true }),
);
let server, base;
async function request(path, token, body, method) {
  const r = await fetch(base + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: r.status, data };
}
async function ok(path, token, body, method) {
  const r = await request(path, token, body, method);
  assert(r.status < 300, `${path}: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
}
const messages = [];
(async () => {
  try {
    server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    base = "http://127.0.0.1:" + server.address().port;
    const companies = [],
      owners = [],
      units = [],
      devices = [];
    const password = crypto.randomBytes(24).toString("hex");
    for (let i = 0; i < 2; i++) {
      const [co] = await db.query(
        "INSERT INTO empresas(nome,slug,email) VALUES (?,?,?)",
        ["Empresa " + i, "test-" + crypto.randomUUID(), "test@example.invalid"],
      );
      companies.push(co.insertId);
      const [ad] = await db.query(
        "INSERT INTO admins(empresa_id,email,password,role) VALUES (?,?,?,'owner')",
        [
          co.insertId,
          "owner" + i + "@example.invalid",
          await require("bcryptjs").hash(password, 10),
        ],
      );
      await db.query(
        "INSERT INTO admin_empresas(admin_id,empresa_id,role) VALUES (?,?,'owner')",
        [ad.insertId, co.insertId],
      );
      owners.push(
        jwt.sign(
          { id: ad.insertId, empresa_id: co.insertId, role: "owner" },
          process.env.JWT_SECRET,
        ),
      );
      const us = [];
      for (let j = 0; j < 2; j++) {
        const u = await ok("/api/workspace/units", owners[i], {
          nome: "Unidade " + j,
        });
        us.push(u.id);
        const [d] = await db.query(
          "INSERT INTO mikrotiks(empresa_id,unidade_id,nome,ip,usuario,senha,porta,end_hotspot) VALUES (?,?,?,?,?,?,8728,?)",
          [
            co.insertId,
            u.id,
            "Equipamento " + j,
            `198.18.${i}.${j + 1}`,
            "test",
            password,
            "10.5.50.1",
          ],
        );
        devices.push({ id: d.insertId, unit: u.id, company: co.insertId });
      }
      units.push(us);
    }
    const [restricted] = await db.query(
      "INSERT INTO admins(empresa_id,email,password,role) VALUES (?,?,?,'operator')",
      [companies[0], "restricted@example.invalid", password],
    );
    await db.query(
      "INSERT INTO admin_empresas(admin_id,empresa_id,role) VALUES (?,?,'operator')",
      [restricted.insertId, companies[0]],
    );
    const rt = jwt.sign(
      { id: restricted.insertId, empresa_id: companies[0], role: "operator" },
      process.env.JWT_SECRET,
    );
    await ok(
      "/api/workspace/users/" + restricted.insertId + "/units",
      owners[0],
      { unit_ids: [units[0][0]] },
      "PUT",
    );
    const own = await ok("/api/workspace/overview", rt);
    assert.equal(own.units.length, 1);
    assert.equal(own.devices.length, 1);
    assert.equal((await request("/api/leads", rt)).status, 403);
    assert.equal(
      (await request("/api/workspace/units", rt, { nome: "Bloqueada" })).status,
      403,
    );
    const p = await ok("/api/workspace/portals", owners[0], {
      nome: "Wi-Fi Mercado",
    });
    const c = P.defaults();
    c.unit_ids = units[0];
    c.equipment_ids = devices
      .filter((d) => d.company === companies[0])
      .map((d) => d.id);
    c.privacy = {
      terms: "Termos v1",
      policy: "Política v1",
      purpose: "Acesso à internet",
      marketing_text: "Novidades",
      contact: "privacy@example.invalid",
    };
    await ok(
      "/api/workspace/portals/" + p.id + "/draft",
      owners[0],
      { config: c },
      "PUT",
    );
    assert.equal(
      (await request("/api/workspace/portals/" + p.id, owners[1])).status,
      404,
    );
    assert.equal(
      (await request("/api/workspace/portals/" + p.id, rt)).status,
      403,
    );
    const rev = await ok(
      "/api/workspace/portals/" + p.id + "/publish",
      owners[0],
      {},
    );
    const publicConfig = await ok("/api/captive/devices/" + devices[0].id);
    assert.equal(publicConfig.revision_id, rev.revision_id);
    c.appearance.title = "Novo rascunho";
    await ok(
      "/api/workspace/portals/" + p.id + "/draft",
      owners[0],
      { config: c },
      "PUT",
    );
    assert.notEqual(
      (await ok("/api/captive/devices/" + devices[0].id)).config.appearance
        .title,
      c.appearance.title,
    );
    const clone = await ok(
      "/api/workspace/portals/" + p.id + "/clone",
      owners[0],
      {},
    );
    const cloned = await ok("/api/workspace/portals/" + clone.id, owners[0]);
    assert.equal(cloned.published_revision_id, null);
    assert.deepEqual(cloned.draft.equipment_ids, []);
    assert.deepEqual(cloned.draft.unit_ids, []);
    const body = {
      revision_id: rev.revision_id,
      mac: "02:00:00:00:00:01",
      ip: "10.5.50.20",
      dados: {
        nome: "Visitante",
        telefone: "11999999999",
        email: "visitor@example.invalid",
      },
      method: "form",
      accept_terms: true,
      marketing: false,
    };
    const g = await ok(
      "/api/captive/devices/" + devices[0].id + "/access",
      null,
      body,
    );
    assert.notEqual(g.password, body.dados.telefone);
    assert.equal(g.password.length, 48);
    body.visitor_token=g.visitor_token;
    assert.equal((await request('/api/workspace/overview',g.visitor_token)).status,401);
    const [[consent]] = await db.query(
      "SELECT marketing,revision_id FROM visitor_consents ORDER BY id DESC LIMIT 1",
    );
    assert.equal(consent.marketing, 0);
    assert.equal(consent.revision_id, rev.revision_id);
    const recovered = await ok(
      "/api/captive/devices/" + devices[1].id + "/visitor",
      g.visitor_token,
    );
    assert.equal(recovered.dados.nome, "Visitante");
    await ok("/api/captive/devices/" + devices[1].id + "/access", null, body);
    const [[count]] = await db.query(
      "SELECT COUNT(*) total FROM visitantes WHERE empresa_id=?",
      [companies[0]],
    );
    assert.equal(count.total, 1);
    await ok(
      "/api/workspace/company",
      owners[0],
      { cadastro_compartilhado: false },
      "PUT",
    );
    assert.equal(
      (
        await request(
          "/api/captive/devices/" + devices[1].id + "/visitor",
          g.visitor_token,
        )
      ).status,
      403,
    );
    await ok("/api/captive/devices/" + devices[1].id + "/access", null, body);
    const [[separate]] = await db.query(
      "SELECT COUNT(*) total FROM visitantes WHERE empresa_id=?",
      [companies[0]],
    );
    assert.equal(separate.total, 2);
    assert.equal(
      (
        await request(
          "/api/captive/devices/" + devices[0].id + "/access",
          null,
          { ...body, accept_terms: false },
        )
      ).status,
      400,
    );
    const bad = {
      ...c,
      fields: [
        ...c.fields,
        { key: "pergunta", label: "Pergunta", type: "text", required: true },
      ],
    };
    await ok(
      "/api/workspace/portals/" + p.id + "/draft",
      owners[0],
      { config: bad },
      "PUT",
    );
    const rev2 = await ok(
      "/api/workspace/portals/" + p.id + "/publish",
      owners[0],
      {},
    );
    assert.equal(
      (
        await request(
          "/api/captive/devices/" + devices[0].id + "/access",
          null,
          body,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await request(
          "/api/captive/devices/" + devices[0].id + "/access",
          null,
          { ...body, revision_id: rev2.revision_id },
        )
      ).status,
      400,
    );
    const [[oldGrant]] = await db.query(
      "SELECT policy,revision_id FROM access_grants WHERE id=?",
      [g.id],
    );
    assert.equal(oldGrant.revision_id, rev.revision_id);
    assert.equal(
      (
        await request("/api/lead-portal/login", null, {
          mikrotik_id: devices[0].id,
        })
      ).status,
      409,
    );
    const req = await ok("/api/captive/privacy/requests", g.visitor_token, {
      tipo: "revogar_marketing",
    });
    assert(req.ok);
    assert.equal(
      (await ok("/api/captive/privacy/me", g.visitor_token)).requests.length,
      1,
    );
    // OTP success/failure and single-use verification use a stub transport, never send real messages.
    const whatsapp = require("../src/controllers/whatsappController");
    const oldSend = whatsapp.enviarMensagemDireta,
      oldConfig = whatsapp.getEvolutionConfig;
    let received;
    whatsapp.getEvolutionConfig = async () => ({
      apiKey: "test",
      apiUrl: "https://example.invalid",
      instanceName: "test",
    });
    whatsapp.enviarMensagemDireta = async (t, m) => {
      received = m.match(/\b\d{6}\b/)[0];
      return { ok: true };
    };
    const wc = P.defaults();
    wc.auth = { form: false, whatsapp: true, password: false };
    wc.unit_ids = [units[0][0]];
    wc.equipment_ids = [devices[0].id];
    wc.privacy = c.privacy;
    const wp = await ok("/api/workspace/portals", owners[0], {
      nome: "WhatsApp",
    });
    await ok(
      "/api/workspace/portals/" + wp.id + "/draft",
      owners[0],
      { config: wc },
      "PUT",
    );
    const wr = await ok(
      "/api/workspace/portals/" + wp.id + "/publish",
      owners[0],
      {},
    );
    const otp = await ok(
      "/api/captive/devices/" + devices[0].id + "/otp",
      null,
      { ...body, telefone: body.dados.telefone },
    );
    assert.equal(
      (
        await request("/api/captive/devices/" + devices[0].id + "/otp", null, {
          ...body,
          telefone: body.dados.telefone,
        })
      ).status,
      429,
    );
    assert.equal(
      (
        await request(
          "/api/captive/devices/" + devices[0].id + "/otp/verify",
          null,
          { ...body, challenge_id: otp.challenge_id, code: "000000" },
        )
      ).status,
      401,
    );
    await ok("/api/captive/devices/" + devices[0].id + "/otp/verify", null, {
      ...body,
      challenge_id: otp.challenge_id,
      code: received,
    });
    const wb = {
      ...body,
      revision_id: wr.revision_id,
      method: "whatsapp",
      challenge_id: otp.challenge_id,
    };
    await ok("/api/captive/devices/" + devices[0].id + "/access", null, wb);
    assert.equal(
      (
        await request(
          "/api/captive/devices/" + devices[0].id + "/access",
          null,
          wb,
        )
      ).status,
      401,
    );
    const expired = crypto.randomUUID();
    await db.query(
      "INSERT INTO captive_otp(id,equipamento_id,telefone,codigo_hash,mac,origem_hash,expires_at) VALUES (?,?,?,?,?,?,DATE_SUB(NOW(),INTERVAL 1 MINUTE))",
      [
        expired,
        devices[0].id,
        "11999999998",
        S.hash(expired + "123456"),
        body.mac,
        S.hash("test"),
      ],
    );
    assert.equal(
      (
        await request(
          "/api/captive/devices/" + devices[0].id + "/otp/verify",
          null,
          { ...body, challenge_id: expired, code: "123456" },
        )
      ).status,
      401,
    );
    await db.query(
      "UPDATE captive_otp SET criado_em=DATE_SUB(NOW(),INTERVAL 2 MINUTE) WHERE id=?",
      [otp.challenge_id],
    );
    whatsapp.enviarMensagemDireta = async () => {
      throw new Error("falha simulada");
    };
    assert.equal(
      (
        await request("/api/captive/devices/" + devices[0].id + "/otp", null, {
          ...body,
          telefone: "11988888888",
        })
      ).status,
      503,
    );
    whatsapp.enviarMensagemDireta = oldSend;
    whatsapp.getEvolutionConfig = oldConfig;
    // New PIX amount and idempotent approval are verified using a fake provider response.
    const [plan] = await db.query(
      "INSERT INTO planos(empresa_id,mikrotik_id,nome,valor,duracao_minutos,velocidade_down,velocidade_up) VALUES (?,?,?,?,?,?,?)",
      [companies[0], devices[0].id, "Pago", 1500, 120, 20, 10],
    );
    const pc = {
      ...wc,
      auth: { form: true, whatsapp: false, password: false },
      access: { ...wc.access, mode: "paid", plan_ids: [plan.insertId] },
    };
    await ok(
      "/api/workspace/portals/" + wp.id + "/draft",
      owners[0],
      { config: pc },
      "PUT",
    );
    const pr = await ok(
      "/api/workspace/portals/" + wp.id + "/publish",
      owners[0],
      {},
    );
    await ok(
      "/api/workspace/units/" + units[0][0] + "/payment-config",
      owners[0],
      { override: true, access_token: "fake-token", public_key: "fake-key" },
      "PUT",
    );
    const oldPost = axios.post,
      oldGet = axios.get;
    let reference,
      status = "pending";
    axios.post = async (url, input) => {
      assert.equal(input.transaction_amount, 15);
      reference = input.external_reference;
      return {
        data: {
          id: "provider-test",
          status,
          point_of_interaction: { transaction_data: { qr_code: "fake-qr" } },
        },
      };
    };
    axios.get = async () => ({
      data: {
        external_reference: reference,
        transaction_amount: 15,
        currency_id: "BRL",
        status,
      },
    });
    const payment = await ok(
      "/api/captive/devices/" + devices[0].id + "/payment",
      null,
      { ...body, revision_id: pr.revision_id, plan_id: plan.insertId },
    );
    let result = await ok(
      "/api/captive/payments/" + payment.id,
      payment.payment_token,
    );
    assert(!result.access);
    status = "approved";
    result = await ok(
      "/api/captive/payments/" + payment.id,
      payment.payment_token,
    );
    assert(result.access);
    const result2 = await ok(
      "/api/captive/payments/" + payment.id,
      payment.payment_token,
    );
    assert.equal(result2.access.id, result.access.id);
    assert.equal(
      (await request("/api/captive/payments/" + payment.id, g.visitor_token))
        .status,
      403,
    );
    axios.post = oldPost;
    axios.get = oldGet;
    // Accounting updates keep the same log and the grant's original unit/version.
    const [ra] = await db.query(
      "INSERT INTO radacct(acctsessionid,acctuniqueid,username,nasipaddress,acctstarttime,callingstationid,framedipaddress) VALUES (?,?,?,?,NOW(),?,?)",
      [
        crypto.randomUUID(),
        crypto.randomBytes(16).toString("hex"),
        g.username,
        "198.18.0.1",
        body.mac,
        body.ip,
      ],
    );
    await require("../src/jobs/syncConnectionLogs")();
    await db.query(
      "UPDATE radacct SET acctstoptime=NOW(),acctsessiontime=30 WHERE radacctid=?",
      [ra.insertId],
    );
    await require("../src/jobs/syncConnectionLogs")();
    const [[log]] = await db.query(
      "SELECT COUNT(*) total,MAX(unidade_id) unidade_id,MAX(revision_id) revision_id,MAX(duracao_segundos) duration FROM connection_logs WHERE radacct_id=?",
      [ra.insertId],
    );
    assert.equal(log.total, 1);
    assert.equal(log.unidade_id, units[0][0]);
    assert.equal(log.revision_id, rev.revision_id);
    assert.equal(log.duration, 30);
    const rows = await ok("/api/workspace/records/logs", rt);
    assert(rows.every((r) => r.unidade_id === units[0][0]));
    assert.equal(
      (await ok("/api/workspace/records/logs", owners[1])).length,
      0,
    );
    assert.equal(
      (await request("/api/workspace/records/logs?unit_id=" + units[0][1], rt))
        .status,
      403,
    );
    const exportCsv = await request(
      "/api/workspace/records/logs?export=csv",
      rt,
    );
    assert.equal(exportCsv.status, 200);
    assert(exportCsv.data.includes("username"));
    const key = await ok(
      "/api/workspace/devices/" + devices[0].id + "/collector-key",
      owners[0],
      {},
    );
    const nat = {
      ip_privado: body.ip,
      porta_privada: 54000,
      ip_publico: "203.0.113.20",
      porta_publica: 60000,
      protocolo: "tcp",
      inicio: new Date().toISOString(),
    };
    assert.equal(
      (
        await request(
          "/api/captive/collectors/" + devices[0].id + "/nat",
          "incorrect",
          { records: [nat] },
        )
      ).status,
      401,
    );
    await ok("/api/captive/collectors/" + devices[0].id + "/nat", key.key, {
      records: [nat],
    });
    assert.equal((await ok("/api/workspace/records/nat", owners[1])).length, 0);
    const [[logRecord]] = await db.query(
      "SELECT id FROM connection_logs WHERE radacct_id=?",
      [ra.insertId],
    );
    await db.query(
      "UPDATE connection_logs SET fim_conexao=DATE_SUB(NOW(),INTERVAL 5 DAY) WHERE id=?",
      [logRecord.id],
    );
    await ok(
      "/api/workspace/logs/" + logRecord.id + "/hold",
      owners[0],
      { until: new Date(Date.now() + 86400000).toISOString() },
      "PUT",
    );
    await ok(
      "/api/workspace/privacy",
      owners[0],
      {
        classification: "Validação",
        basis: "Política de teste",
        connection_days: 1,
        visitor_days: null,
        nat_days: null,
        audit_days: null,
      },
      "PUT",
    );
    await require("../src/jobs/privacyRetention")();
    const [[held]] = await db.query(
      "SELECT COUNT(*) total FROM connection_logs WHERE id=?",
      [logRecord.id],
    );
    assert.equal(held.total, 1);
    const [[audits]] = await db.query(
      "SELECT COUNT(*) total FROM access_audit",
    );
    assert(audits.total > 0);
    console.log(
      "OK: duas empresas, unidades, permissões, publicação, clonagem, cadastro compartilhado/separado, privacidade, OTP, PIX idempotente e histórico RADIUS.",
    );
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await db.end();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
