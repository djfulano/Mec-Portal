const router = require("express").Router();
const db = require("../../db");
const crypto = require("crypto");
const A = require("../services/unitAccess");
const P = require("../services/portalPolicy");
const { connectors } = require("../services/equipmentConnectors");
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    console.error("[workspace]", e.message);
    res
      .status(e.status || 500)
      .json({
        message: e.status ? e.message : "Erro ao processar solicitação.",
      });
  }
};
router.use(A.middleware);
router.use((req, res, next) => {
  const path = req.path;
  if (path === "/overview") return next();
  if (path === "/units" || /^\/units\/\d+$/.test(path) || /^\/users\/\d+\/units$/.test(path) || /^\/devices\/\d+\/unit$/.test(path)) return res.status(410).json({message:"Unidades não fazem parte desta organização. Use empresa, portal e equipamento."});
  const module = path.startsWith("/portals")
    ? "portais"
    : path.startsWith("/records/logs") ||
        path.startsWith("/records/nat") ||
        path.startsWith("/logs")
      ? "compliance"
      : path.startsWith("/records/visitors") ||
          path.startsWith("/records/requests")
        ? "leads"
        : path.startsWith("/records/sessions")
          ? "sessoes"
          : path.startsWith("/records/payments")
            ? "pagamentos"
            : path.startsWith("/users")
              ? "usuarios"
              : path === "/overview"
                ? "dashboard"
                : "configuracoes";
  return require("../middleware/checkPermissao")(module)(req, res, next);
});
router.get(
  "/overview",
  wrap(async (req, res) => {
    const f = A.filter(req, "u.id");
    const [units] = await db.query(
      "SELECT u.id,u.nome,u.endereco,u.ativo,(SELECT COUNT(*) FROM mikrotiks m WHERE m.unidade_id=u.id) equipamentos FROM unidades u WHERE u.empresa_id=?" +
        f.sql,
      [req.empresa_id, ...f.params],
    );
    const ef = A.filter(req, "m.unidade_id");
    const [devices] = await db.query(
      "SELECT m.id,m.nome,m.unidade_id,m.portal_id,m.fabricante,m.ip,m.end_hotspot FROM mikrotiks m WHERE m.empresa_id=?" +
        ef.sql,
      [req.empresa_id, ...ef.params],
    );
    const [all] = await db.query("SELECT id FROM portais WHERE empresa_id=?", [
      req.empresa_id,
    ]);
    const portals = [];
    for (const x of all) {
      try {
        const p = await A.portal(req, x.id);
        portals.push({
          id: p.id,
          nome: p.nome,
          slug: p.slug,
          tipo: p.tipo,
          managed: p.managed,
          published_revision_id: p.published_revision_id,
          draft_updated_at: p.draft_updated_at,
        });
      } catch (e) {
        if (e.status !== 403) throw e;
      }
    }
    const [[company]] = await db.query(
      "SELECT nome,cadastro_compartilhado FROM empresas WHERE id=?",
      [req.empresa_id],
    );
    const [plans] = await db.query(
      "SELECT id,nome,valor,duracao_minutos,velocidade_down,velocidade_up,shared_users FROM planos WHERE empresa_id=?",
      [req.empresa_id],
    );
    res.json({
      units,
      devices,
      portals,
      plans,
      all_units: req.unitScope.owner,
      operator: "MEC Solution",
      company_name: company.nome,
      cadastro_compartilhado: !!company.cadastro_compartilhado,
      connectors,
    });
  }),
);
router.post(
  "/units",
  wrap(async (req, res) => {
    A.requireOwner(req);
    if (!req.body.nome?.trim()) throw A.fail(400, "Informe o nome da unidade.");
    const [r] = await db.query(
      "INSERT INTO unidades(empresa_id,nome,endereco) VALUES (?,?,?)",
      [req.empresa_id, req.body.nome.trim(), req.body.endereco || null],
    );
    await A.audit(req, "unidade.criar", r.insertId);
    res.status(201).json({ id: r.insertId });
  }),
);
router.put(
  "/units/:id",
  wrap(async (req, res) => {
    A.requireOwner(req);
    await A.unit(req, req.params.id);
    if (!req.body.nome?.trim()) throw A.fail(400, "Informe o nome.");
    await db.query(
      "UPDATE unidades SET nome=?,endereco=?,ativo=? WHERE id=? AND empresa_id=?",
      [
        req.body.nome.trim(),
        req.body.endereco || null,
        req.body.ativo === false ? 0 : 1,
        req.params.id,
        req.empresa_id,
      ],
    );
    await A.audit(req, "unidade.editar", req.params.id);
    res.json({ ok: true });
  }),
);
router.get(
  "/users",
  wrap(async (req, res) => {
    A.requireOwner(req);
    const [users] = await db.query(
      "SELECT DISTINCT a.id,a.email,a.nome,a.role FROM admins a JOIN admin_empresas ae ON ae.admin_id=a.id WHERE ae.empresa_id=? AND a.role<>'super_admin'",
      [req.empresa_id],
    );
    const [links] = await db.query(
      "SELECT au.* FROM admin_unidades au JOIN unidades u ON u.id=au.unidade_id WHERE u.empresa_id=?",
      [req.empresa_id],
    );
    res.json(
      users.map((u) => ({
        ...u,
        unit_ids: links
          .filter((l) => l.admin_id === u.id)
          .map((l) => l.unidade_id),
      })),
    );
  }),
);
router.put(
  "/users/:id/units",
  wrap(async (req, res) => {
    A.requireOwner(req);
    const [[admin]] = await db.query(
      "SELECT a.id FROM admins a JOIN admin_empresas ae ON ae.admin_id=a.id WHERE a.id=? AND ae.empresa_id=? AND a.role NOT IN ('super_admin','owner')",
      [req.params.id, req.empresa_id],
    );
    if (!admin) throw A.fail(400, "Selecione usuário padrão da empresa.");
    const ids = [...new Set((req.body.unit_ids || []).map(Number))];
    for (const id of ids) await A.unit(req, id);
    const c = await db.getConnection();
    try {
      await c.beginTransaction();
      await c.query(
        "DELETE au FROM admin_unidades au JOIN unidades u ON u.id=au.unidade_id WHERE au.admin_id=? AND u.empresa_id=?",
        [admin.id, req.empresa_id],
      );
      for (const id of ids)
        await c.query("INSERT INTO admin_unidades VALUES (?,?)", [
          admin.id,
          id,
        ]);
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
    await A.audit(req, "usuario.unidades", admin.id);
    res.json({ ok: true });
  }),
);
router.put(
  "/company",
  wrap(async (req, res) => {
    A.requireOwner(req);
    if (typeof req.body.cadastro_compartilhado !== "boolean")
      throw A.fail(400, "Informe a opção de compartilhamento.");
    await db.query("UPDATE empresas SET cadastro_compartilhado=? WHERE id=?", [
      req.body.cadastro_compartilhado ? 1 : 0,
      req.empresa_id,
    ]);
    await A.audit(req, "empresa.cadastro");
    res.json({ ok: true });
  }),
);
router.put(
  "/devices/:id/unit",
  wrap(async (req, res) => {
    A.requireOwner(req);
    const u = await A.unit(req, Number(req.body.unidade_id));
    const [[device]] = await db.query(
      "SELECT id,portal_id FROM mikrotiks WHERE id=? AND empresa_id=?",
      [req.params.id, req.empresa_id],
    );
    if (!device) throw A.fail(404, "Equipamento não encontrado.");
    await db.query(
      "UPDATE mikrotiks SET unidade_id=? WHERE id=? AND empresa_id=?",
      [u.id, device.id, req.empresa_id],
    );
    if (device.portal_id)
      await db.query("INSERT IGNORE INTO portal_unidades VALUES (?,?)", [
        device.portal_id,
        u.id,
      ]);
    await A.audit(req, "equipamento.unidade", device.id);
    res.json({ ok: true });
  }),
);
router.post(
  "/devices/:id/collector-key",
  wrap(async (req, res) => {
    A.requireOwner(req);
    const [[device]] = await db.query(
      "SELECT id FROM mikrotiks WHERE id=? AND empresa_id=?",
      [req.params.id, req.empresa_id],
    );
    if (!device) throw A.fail(404, "Equipamento não encontrado.");
    const key = crypto.randomBytes(32).toString("hex");
    await db.query("UPDATE mikrotiks SET collector_hash=? WHERE id=?", [
      crypto.createHash("sha256").update(key).digest("hex"),
      device.id,
    ]);
    await A.audit(req, "coletor.chave", device.id);
    res.json({ key });
  }),
);
router.get(
  "/units/:id/payment-config",
  wrap(async (req, res) => {
    A.requireOwner(req);
    await A.unit(req, req.params.id);
    const [[u]] = await db.query("SELECT mp_config FROM unidades WHERE id=?", [
      req.params.id,
    ]);
    const c = P.json(u.mp_config, null);
    res.json({
      override: !!c,
      configured: !!c?.access_token,
      public_key: c?.public_key || "",
      email_pagador: c?.email_pagador || "",
    });
  }),
);
router.put(
  "/units/:id/payment-config",
  wrap(async (req, res) => {
    A.requireOwner(req);
    await A.unit(req, req.params.id);
    const [[u]] = await db.query("SELECT mp_config FROM unidades WHERE id=?", [
      req.params.id,
    ]);
    const old = P.json(u.mp_config, {});
    let config = null;
    if (req.body.override) {
      config = {
        access_token: req.body.access_token || old.access_token,
        public_key: req.body.public_key || old.public_key,
        email_pagador: req.body.email_pagador || old.email_pagador,
      };
      if (!config.access_token)
        throw A.fail(400, "Informe token Mercado Pago.");
    }
    await db.query("UPDATE unidades SET mp_config=? WHERE id=?", [
      config ? JSON.stringify(config) : null,
      req.params.id,
    ]);
    await A.audit(req, "pagamento.configurar", req.params.id);
    res.json({ ok: true });
  }),
);
router.get(
  "/portals/:id",
  wrap(async (req, res) => {
    const p = await A.portal(req, req.params.id);
    const [versions] = await db.query(
      "SELECT id,numero,publicado_em FROM portal_revisions WHERE portal_id=? ORDER BY numero DESC LIMIT 20",
      [p.id],
    );
    const [links] = await db.query(
      "SELECT unidade_id FROM portal_unidades WHERE portal_id=?",
      [p.id],
    );
    const c = P.json(p.draft_config, P.fromLegacy(p));
    res.json({
      id: p.id,
      nome: p.nome,
      slug: p.slug,
      managed: p.managed,
      draft: c,
      versions,
      published_revision_id: p.published_revision_id,
      unit_ids: links.map((l) => l.unidade_id),
    });
  }),
);
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});
router.post(
  "/portals/:id/assets/:kind",
  (req, res, next) =>
    upload.single("image")(req, res, (e) =>
      e
        ? res.status(400).json({ message: "Selecione uma imagem de até 2 MB." })
        : next(),
    ),
  wrap(async (req, res) => {
    const p = await A.portal(req, req.params.id);
    if (!["logo", "image"].includes(req.params.kind) || !req.file)
      throw A.fail(400, "Imagem inválida.");
    const b = req.file.buffer;
    let ext;
    if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
      ext = "png";
    else if (b[0] === 255 && b[1] === 216 && b[2] === 255) ext = "jpg";
    else if (
      b.subarray(0, 4).toString() === "RIFF" &&
      b.subarray(8, 12).toString() === "WEBP"
    )
      ext = "webp";
    if (!ext) throw A.fail(400, "Use PNG, JPG ou WebP.");
    const fs = require("fs"),
      path = require("path"),
      dir = path.join(__dirname, "../../uploads/logos");
    fs.mkdirSync(dir, { recursive: true });
    const name = "portal-" + p.id + "-" + crypto.randomUUID() + "." + ext;
    fs.writeFileSync(path.join(dir, name), b);
    const url = "/api/empresas/logos/" + name;
    const config = P.json(p.draft_config, P.defaults());
    config.appearance[req.params.kind === "logo" ? "logo_url" : "image_url"] =
      url;
    await db.query(
      "UPDATE portais SET draft_config=?,draft_updated_at=NOW() WHERE id=?",
      [JSON.stringify(config), p.id],
    );
    await A.audit(req, "portal.imagem", p.id);
    res.json({ url });
  }),
);
router.post(
  "/portals",
  wrap(async (req, res) => {
    const nome = req.body.nome?.trim();
    if (!nome) throw A.fail(400, "Informe nome.");
    const slug = "portal-" + crypto.randomBytes(8).toString("hex");
    const c = P.defaults();
    c.appearance.title = nome;
    const [r] = await db.query(
      "INSERT INTO portais(empresa_id,nome,slug,tipo,managed,created_by,draft_config,draft_updated_at) VALUES (?,?,?,'custom',1,?,?,NOW())",
      [req.empresa_id, nome, slug, req.user.id, JSON.stringify(c)],
    );
    await A.audit(req, "portal.criar", r.insertId);
    res.status(201).json({ id: r.insertId });
  }),
);
async function normalizeEquipment(req, portalId, config, query = db) {
  const [units] = await query.query('SELECT id FROM unidades WHERE empresa_id=? ORDER BY id',[req.empresa_id]);
  const [devices] = await query.query('SELECT id FROM mikrotiks WHERE empresa_id=? AND portal_id=?',[req.empresa_id,portalId]);
  config.unit_ids = units.map(u=>u.id);
  config.equipment_ids = devices.map(d=>d.id);
}
async function validateLinks(req, c, query = db) {
  for (const id of c.unit_ids) {
    const u = await A.unit(req, id);
    if (!u.ativo) throw A.fail(400, "Unidade inativa.");
  }
  for (const id of c.equipment_ids) {
    const [[d]] = await query.query(
      "SELECT * FROM mikrotiks WHERE id=? AND empresa_id=?",
      [id, req.empresa_id],
    );
    if (!d || !c.unit_ids.includes(d.unidade_id))
      throw A.fail(400, "Equipamento fora das unidades selecionadas.");
    await A.unit(req, d.unidade_id);
    if (!connectors[d.fabricante])
      throw A.fail(400, "Fabricante não homologado.");
  }
  for (const id of c.access.plan_ids) {
    const [[p]] = await query.query(
      "SELECT id FROM planos WHERE id=? AND empresa_id=?",
      [id, req.empresa_id],
    );
    if (!p) throw A.fail(400, "Plano fora da empresa.");
  }
}
router.put(
  "/portals/:id/draft",
  wrap(async (req, res) => {
    const p = await A.portal(req, req.params.id),
      c = P.validate(req.body.config);
    await normalizeEquipment(req, p.id, c);
    await validateLinks(req, c);
    const tx = await db.getConnection();
    try {
      await tx.beginTransaction();
      await tx.query(
        "UPDATE portais SET draft_config=?,draft_updated_at=NOW() WHERE id=?",
        [JSON.stringify(c), p.id],
      );
      // Draft scopes are unioned with live bindings so an editor cannot hide a shared portal.
      await tx.query("DELETE FROM portal_unidades WHERE portal_id=?", [p.id]);
      const [live] = await tx.query(
        "SELECT DISTINCT unidade_id FROM mikrotiks WHERE portal_id=?",
        [p.id],
      );
      for (const id of new Set([
        ...c.unit_ids,
        ...live.map((d) => d.unidade_id),
      ]))
        await tx.query("INSERT IGNORE INTO portal_unidades VALUES (?,?)", [
          p.id,
          id,
        ]);
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    } finally {
      tx.release();
    }
    await A.audit(req, "portal.rascunho", p.id);
    res.json({ ok: true });
  }),
);
router.post(
  "/portals/:id/clone",
  wrap(async (req, res) => {
    const p = await A.portal(req, req.params.id);
    let c = P.json(p.draft_config, P.fromLegacy(p));
    c = { ...c, equipment_ids: [], unit_ids: [] };
    delete c.legacy;
    const nome = req.body.nome?.trim() || p.nome + " (cópia)";
    const [r] = await db.query(
      "INSERT INTO portais(empresa_id,nome,slug,tipo,managed,created_by,draft_config,draft_updated_at) VALUES (?,?,?,'custom',1,?,?,NOW())",
      [
        req.empresa_id,
        nome,
        "portal-" + crypto.randomBytes(8).toString("hex"),
        req.user.id,
        JSON.stringify(c),
      ],
    );
    await A.audit(req, "portal.clonar", p.id);
    res.status(201).json({ id: r.insertId });
  }),
);
router.post(
  "/portals/:id/publish",
  wrap(async (req, res) => {
    const initial = await A.portal(req, req.params.id);
    const tx = await db.getConnection();
    try {
      await tx.beginTransaction();
      const [[p]] = await tx.query(
        "SELECT * FROM portais WHERE id=? FOR UPDATE",
        [initial.id],
      );
      const c = P.validate(P.json(p.draft_config), true);
      delete c.legacy;
      await normalizeEquipment(req, p.id, c, tx);
      await validateLinks(req, c, tx);
      if (c.auth.whatsapp) {
        const {
          getEvolutionConfig,
        } = require("../controllers/whatsappController");
        const evo = await getEvolutionConfig(req.empresa_id);
        if (!evo.apiKey)
          throw A.fail(
            400,
            "Configure o WhatsApp da empresa antes de publicar este método.",
          );
      }
      for (const id of c.equipment_ids) {
        const [[d]] = await tx.query(
          "SELECT portal_id FROM mikrotiks WHERE id=? FOR UPDATE",
          [id],
        );
        if (d.portal_id && d.portal_id !== p.id)
          await A.portal(req, d.portal_id);
      }
      const [[num]] = await tx.query(
        "SELECT COALESCE(MAX(numero),0)+1 numero FROM portal_revisions WHERE portal_id=?",
        [p.id],
      );
      const [r] = await tx.query(
        "INSERT INTO portal_revisions(portal_id,numero,config,publicado_por) VALUES (?,?,?,?)",
        [p.id, num.numero, JSON.stringify(c), req.user.id],
      );
      await tx.query("DELETE FROM portal_unidades WHERE portal_id=?", [p.id]);
      for (const id of c.unit_ids)
        await tx.query("INSERT INTO portal_unidades VALUES (?,?)", [p.id, id]);
      await tx.query(
        "UPDATE portais SET managed=1,published_revision_id=? WHERE id=?",
        [r.insertId, p.id],
      );
      await tx.commit();
      await A.audit(req, "portal.publicar", p.id);
      res.json({ revision_id: r.insertId, numero: num.numero });
    } catch (e) {
      await tx.rollback();
      throw e;
    } finally {
      tx.release();
    }
  }),
);
router.get(
  "/records/:category",
  wrap(async (req, res) => {
    const tables = {
      visitors: ["visitantes", "unidade_id"],
      sessions: ["access_grants", "unidade_id"],
      logs: ["connection_logs", "unidade_id"],
      payments: ["captive_payments", "unidade_id"],
      requests: ["privacy_requests", "unidade_id"],
      nat: ["nat_records", "unidade_id"],
    };
    const entry = tables[req.params.category];
    if (!entry) throw A.fail(404, "Categoria inválida.");
    let f = A.filter(req, entry[1]),
      extra = req.query.unit_id ? " AND unidade_id=?" : "";
    if (req.query.unit_id) await A.unit(req, Number(req.query.unit_id));
    if (req.params.category === "visitors") {
      if (!req.unitScope.all)
        f = {
          sql: ` AND EXISTS(SELECT 1 FROM visitor_consents vc WHERE vc.visitante_id=visitantes.id AND vc.unidade_id IN (${req.unitScope.ids.map(() => "?").join(",") || "NULL"}))`,
          params: req.unitScope.ids,
        };
      if (req.query.unit_id)
        extra =
          " AND EXISTS(SELECT 1 FROM visitor_consents vc WHERE vc.visitante_id=visitantes.id AND vc.unidade_id=?)";
    }
    const safe = {
      visitors: "id,empresa_id,unidade_id,dados,criado_em,atualizado_em",
      sessions:
        "id,unidade_id,equipamento_id,portal_id,revision_id,mac,ip,policy,expires_at,criado_em",
      logs: "id,unidade_id,equipamento_id,revision_id,username,mac,ip_atribuido,nas_ip,inicio_conexao,fim_conexao,duracao_segundos,hold_until",
      payments: "id,unidade_id,equipamento_id,portal_id,valor,status,criado_em",
      requests:
        "id,unidade_id,visitante_id,tipo,dados,status,resposta,criado_em",
      nat: "id,unidade_id,equipamento_id,ip_privado,porta_privada,ip_publico,porta_publica,protocolo,inicio,fim",
    };
    const [rows] = await db.query(
      `SELECT ${safe[req.params.category]} FROM ${entry[0]} WHERE empresa_id=?${f.sql}${extra} ORDER BY id DESC LIMIT 1000`,
      [
        req.empresa_id,
        ...f.params,
        ...(req.query.unit_id ? [req.query.unit_id] : []),
      ],
    );
    await A.audit(
      req,
      req.query.export ? "dados.exportar" : "dados.consultar",
      req.params.category,
    );
    if (!req.unitScope.all)
      for (const row of rows)
        if (row.unidade_id && !req.unitScope.ids.includes(row.unidade_id))
          row.unidade_id = null;
    if (req.query.export === "csv") {
      const escape = (v) =>
        '"' +
        String(typeof v === "object" ? JSON.stringify(v) : (v ?? ""))
          .replaceAll('"', '""')
          .replace(/^[=+@-]/, " $&") +
        '"';
      const keys = rows.length ? Object.keys(rows[0]) : ["id"];
      res
        .type("text/csv")
        .attachment(req.params.category + ".csv")
        .send(
          "\uFEFF" +
            [
              keys.map(escape).join(","),
              ...rows.map((r) => keys.map((k) => escape(r[k])).join(",")),
            ].join("\r\n"),
        );
    } else res.json(rows);
  }),
);
router.get(
  "/privacy",
  wrap(async (req, res) => {
    A.requireOwner(req);
    const [[r]] = await db.query(
      "SELECT config FROM privacy_settings WHERE empresa_id=?",
      [req.empresa_id],
    );
    const c = P.json(r?.config, {
      connection_days: null,
      visitor_days: null,
      audit_days: null,
      nat_days: null,
      classification: "",
      basis: "",
    });
    const [[nat]] = await db.query(
      "SELECT COUNT(*) total FROM nat_records WHERE empresa_id=?",
      [req.empresa_id],
    );
    res.json({
      config: c,
      pending: [
        ...(!c.classification || !c.basis
          ? ["Definir enquadramento e fundamento da retenção"]
          : []),
        ...(!c.connection_days
          ? ["Definir prazo de guarda dos registros de conexão"]
          : []),
        ...(!nat.total
          ? ["Coleta e correlação de IP público e portas ainda não demonstrada"]
          : []),
      ],
    });
  }),
);
router.put(
  "/privacy",
  wrap(async (req, res) => {
    A.requireOwner(req);
    const c = req.body;
    for (const k of [
      "connection_days",
      "visitor_days",
      "audit_days",
      "nat_days",
    ])
      if (
        c[k] != null &&
        (!Number.isInteger(Number(c[k])) ||
          Number(c[k]) < 1 ||
          Number(c[k]) > 36500)
      )
        throw A.fail(400, "Prazo inválido.");
    if (!c.classification?.trim() || !c.basis?.trim())
      throw A.fail(400, "Informe enquadramento e fundamento.");
    await db.query(
      "INSERT INTO privacy_settings VALUES (?,?) ON DUPLICATE KEY UPDATE config=VALUES(config)",
      [req.empresa_id, JSON.stringify(c)],
    );
    await A.audit(req, "privacidade.configurar");
    res.json({ ok: true });
  }),
);
router.put(
  "/logs/:id/hold",
  wrap(async (req, res) => {
    A.requireOwner(req);
    const [[log]] = await db.query(
      "SELECT id FROM connection_logs WHERE id=? AND empresa_id=?",
      [req.params.id, req.empresa_id],
    );
    if (!log) throw A.fail(404, "Registro não encontrado.");
    if (!req.body.until || !Number.isFinite(Date.parse(req.body.until)))
      throw A.fail(400, "Informe prazo de preservação.");
    await db.query("UPDATE connection_logs SET hold_until=? WHERE id=?", [
      new Date(req.body.until),
      log.id,
    ]);
    await A.audit(req, "registro.preservar", log.id);
    res.json({ ok: true });
  }),
);
router.put(
  "/requests/:id",
  wrap(async (req, res) => {
    A.requireOwner(req);
    const [[r]] = await db.query(
      "SELECT * FROM privacy_requests WHERE id=? AND empresa_id=?",
      [req.params.id, req.empresa_id],
    );
    if (!r) throw A.fail(404, "Solicitação não encontrada.");
    if (!["pendente", "concluida", "indeferida"].includes(req.body.status))
      throw A.fail(400, "Status inválido.");
    if (req.body.execute) {
      if (r.tipo === "correcao")
        await db.query(
          "UPDATE visitantes SET dados=? WHERE id=? AND empresa_id=?",
          [JSON.stringify(P.json(r.dados, {})), r.visitante_id, req.empresa_id],
        );
      else if (r.tipo === "exclusao") {
        const [[retention]] = await db.query(
          "SELECT config FROM privacy_settings WHERE empresa_id=?",
          [req.empresa_id],
        );
        const config = P.json(retention?.config, {});
        if (!config.visitor_days)
          throw A.fail(400, "Defina retenção antes de executar exclusão.");
        const [[held]]=await db.query('SELECT COUNT(*) total FROM access_grants g JOIN connection_logs l ON l.username COLLATE utf8mb4_unicode_ci=g.username COLLATE utf8mb4_unicode_ci WHERE g.visitante_id=? AND l.hold_until>NOW()',[r.visitante_id]);
        if(held.total)throw A.fail(409,'Cadastro vinculado a registro sob preservação excepcional.');
        const [[v]] = await db.query(
          "SELECT atualizado_em FROM visitantes WHERE id=?",
          [r.visitante_id],
        );
        if (
          Date.now() - new Date(v.atualizado_em).getTime() <
          Number(config.visitor_days) * 86400000
        )
          throw A.fail(
            409,
            "Cadastro dentro do prazo configurado de retenção; analise o fundamento da solicitação.",
          );
        await db.query(
          "UPDATE visitantes SET dados=JSON_OBJECT(),identidade_hash=? WHERE id=?",
          [crypto.randomBytes(32).toString("hex"), r.visitante_id],
        );
      } else if (r.tipo === "revogar_marketing")
        await db.query(
          "UPDATE visitor_consents SET marketing=0 WHERE visitante_id=?",
          [r.visitante_id],
        );
    }
    if (!["pendente", "concluida", "indeferida"].includes(req.body.status))
      throw A.fail(400, "Status inválido.");
    await db.query(
      "UPDATE privacy_requests SET status=?,resposta=? WHERE id=?",
      [req.body.status, req.body.resposta || null, r.id],
    );
    await A.audit(req, "titular.solicitacao", r.id);
    res.json({ ok: true });
  }),
);
module.exports = router;
