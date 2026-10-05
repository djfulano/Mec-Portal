const systemUrl = require("../utils/systemUrl");
const express = require("express");
const router = express.Router();
const db = require("../../db");
const { testarConexao } = require("../utils/mikrotikClient");
const { obterInformacoes } = require("../controllers/mikrotikAPIController");
const { exec } = require("child_process");

// FreeRADIUS só lê NAS clients na inicialização, precisamos recarregar após mudanças
function reloadFreeRADIUS() {
  exec("systemctl restart freeradius", (err) => {
    if (err) console.error("⚠️ Erro ao reiniciar FreeRADIUS:", err.message);
    else console.log("✅ FreeRADIUS recarregado com novos NAS clients.");
  });
}
console.log("DEBUG obterInformacoes:", typeof obterInformacoes);
router.use(async (req, res, next) => {
  try {
    if ((req.method === "POST" && req.path === "/") || req.method === "PUT") {
      const access = require("../services/unitAccess");
      if (!req.body.unidade_id) {
        const [u] = await db.query(
          "SELECT id FROM unidades WHERE empresa_id=? AND ativo=1 ORDER BY id",
          [req.empresa_id],
        );
        if (u.length !== 1)
          return res
            .status(400)
            .json({ message: "Selecione a unidade do equipamento." });
        req.body.unidade_id = u[0].id;
      }
      const unit = await access.unit(req, Number(req.body.unidade_id));
      if (!unit.ativo)
        return res.status(400).json({ message: "Unidade inativa." });
      if (req.body.portal_id) {
        const [[p]] = await db.query(
          "SELECT id,managed FROM portais WHERE id=? AND empresa_id=?",
          [req.body.portal_id, req.empresa_id],
        );
        if (!p)
          return res.status(400).json({ message: "Portal fora da empresa." });
        if (p.managed) {
          const [[d]] = await db.query(
            "SELECT portal_id FROM mikrotiks WHERE id=? AND empresa_id=?",
            [req.path.slice(1), req.empresa_id],
          );
          if (d?.portal_id !== p.id)
            return res
              .status(400)
              .json({ message: "Vincule este portal pelo editor e publique." });
        }
      }
    }
    next();
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
});

// Criar Mikrotik
// Criar Mikrotik
router.post("/", async (req, res) => {
  const { nome, ip, usuario, senha, porta, end_hotspot, portal_id } = req.body;

  if (!nome || !ip || !usuario || !senha || !porta) {
    console.log("⚠️ Campos obrigatórios faltando:", req.body);
    return res.status(400).json({ message: "Campos obrigatórios faltando." });
  }

  try {
    // Verificar se já existe Mikrotik com esse IP
    const [existente] = await db.query(
      "SELECT id FROM mikrotiks WHERE ip = ? AND empresa_id = ?",
      [ip, req.empresa_id],
    );
    if (existente.length > 0) {
      return res
        .status(400)
        .json({ message: "Já existe um Mikrotik com este IP." });
    }

    // Verificar se já existe NAS com esse IP
    const [nasExiste] = await db.query("SELECT id FROM nas WHERE nasname = ?", [
      ip,
    ]);
    if (nasExiste.length > 0) {
      return res.status(400).json({ message: "Já existe um NAS com este IP." });
    }

    // Inserir Mikrotik com empresa_id
    await db.execute(
      "INSERT INTO mikrotiks (empresa_id, nome, ip, usuario, senha, porta, end_hotspot, portal_id, unidade_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        req.empresa_id,
        nome,
        ip,
        usuario,
        senha,
        porta,
        end_hotspot || null,
        portal_id || null,
        req.body.unidade_id,
      ],
    );

    // Inserir NAS com empresa_id
    await db.execute(
      "INSERT INTO nas (empresa_id, nasname, shortname, type, secret, description) VALUES (?, ?, ?, 'other', ?, 'RADIUS Client')",
      [req.empresa_id, ip, nome, senha],
    );

    console.log("✅ Mikrotik e NAS cadastrados com sucesso.");
    reloadFreeRADIUS();
    res.status(201).json({ message: "Mikrotik cadastrado com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao salvar Mikrotik ou NAS:", err);
    res.status(500).json({ message: "Erro interno ao salvar Mikrotik." });
  }
});

router.get("/", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
      SELECT m.*, p.nome as portal_nome, p.tipo as portal_tipo
      FROM mikrotiks m LEFT JOIN portais p ON m.portal_id = p.id
      WHERE m.empresa_id = ?
      ORDER BY m.id DESC
    `,
      [req.empresa_id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar Mikrotiks." });
  }
});

// Atualizar Mikrotik
// Atualizar Mikrotik
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, ip, usuario, senha, porta, end_hotspot, portal_id } = req.body;

  try {
    // Atualiza mikrotiks incluindo end_hotspot
    await db.execute(
      "UPDATE mikrotiks SET nome = ?, ip = ?, usuario = ?, senha = ?, porta = ?, end_hotspot = ?, portal_id = ?, unidade_id = ? WHERE id = ? AND empresa_id = ?",
      [
        nome,
        ip,
        usuario,
        senha,
        porta,
        end_hotspot || null,
        portal_id || null,
        req.body.unidade_id,
        id,
        req.empresa_id,
      ],
    );

    // Atualiza nas com base no IP atual
    await db.execute(
      "UPDATE nas SET nasname = ?, shortname = ?, secret = ? WHERE nasname = ?",
      [ip, nome, senha, ip],
    );

    reloadFreeRADIUS();
    res.json({ message: "Atualizado com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao atualizar Mikrotik/NAS:", err);
    res.status(500).json({ message: "Erro ao atualizar Mikrotik." });
  }
});

// Deletar Mikrotik
// Deletar Mikrotik e correspondente na tabela NAS
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Buscar IP do Mikrotik
    const [[mikrotik]] = await db.execute(
      "SELECT ip FROM mikrotiks WHERE id = ? AND empresa_id = ?",
      [id, req.empresa_id],
    );
    if (!mikrotik)
      return res.status(404).json({ message: "Mikrotik não encontrado." });

    const ip = mikrotik.ip.trim();

    // Deletar Mikrotik
    await db.execute("DELETE FROM mikrotiks WHERE id = ? AND empresa_id = ?", [
      id,
      req.empresa_id,
    ]);

    // Verificar se existe NAS com esse IP antes de tentar remover
    const [nas] = await db.execute("SELECT id FROM nas WHERE nasname = ?", [
      ip,
    ]);
    if (nas.length > 0) {
      await db.execute("DELETE FROM nas WHERE nasname = ?", [ip]);
      console.log(`✅ NAS com IP ${ip} removido.`);
    } else {
      console.warn(`⚠️ Nenhum NAS encontrado com IP ${ip}`);
    }

    reloadFreeRADIUS();
    res.json({ message: "Removido com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao deletar Mikrotik/NAS:", err);
    res.status(500).json({ message: "Erro ao deletar Mikrotik." });
  }
});

router.post("/:id/testar", async (req, res) => {
  const { id } = req.params;
  try {
    const [[mikrotik]] = await db.execute(
      "SELECT * FROM mikrotiks WHERE id = ? AND empresa_id = ?",
      [id, req.empresa_id],
    );
    if (!mikrotik)
      return res.status(404).json({ message: "Mikrotik não encontrado" });

    const resultado = await testarConexao(mikrotik);

    if (resultado.sucesso) {
      res.json({ status: "online", message: "Conexão bem-sucedida" });
    } else {
      res.status(400).json({ status: "offline", message: resultado.erro });
    }
  } catch (err) {
    console.error("Erro ao testar Mikrotik:", err);
    res.status(500).json({ message: "Erro interno ao testar Mikrotik" });
  }
});

router.post("/:id/info", obterInformacoes);

// Escanear Mikrotik para obter interfaces, pools e IPs
router.post("/:id/scan", async (req, res) => {
  const { id } = req.params;
  try {
    const [[mikrotik]] = await db.execute(
      "SELECT * FROM mikrotiks WHERE id = ? AND empresa_id = ?",
      [id, req.empresa_id],
    );
    if (!mikrotik)
      return res.status(404).json({ message: "Mikrotik não encontrado" });

    const { RouterOSAPI } = require("node-routeros");
    const conn = new RouterOSAPI({
      host: mikrotik.ip,
      user: mikrotik.usuario,
      password: mikrotik.senha,
      port: mikrotik.porta || 8728,
      keepalive: false,
      timeout: 10000,
    });

    await conn.connect();

    // node-routeros !empty bug: Promise never resolves on empty lists
    // Use Promise.race with timeout to handle this
    const timedQuery = (path, timeoutMs = 3000) => {
      return Promise.race([
        conn
          .write(path)
          .then((r) => (Array.isArray(r) ? r : []))
          .catch(() => []),
        new Promise((resolve) => setTimeout(() => resolve([]), timeoutMs)),
      ]);
    };

    const result = {
      interfaces: [],
      pools: [],
      addresses: [],
      hotspots: [],
      profiles: [],
      radius: [],
    };

    // Interfaces e addresses sempre existem
    const interfaces = await timedQuery("/interface/print");
    result.interfaces = interfaces.map((i) => ({
      name: i.name,
      type: i.type,
      disabled: i.disabled,
    }));

    const addresses = await timedQuery("/ip/address/print");
    result.addresses = addresses.map((a) => ({
      address: a.address,
      interface: a.interface,
      network: a.network,
    }));

    // Pools, hotspot, profiles, radius podem estar vazios (!empty)
    const pools = await timedQuery("/ip/pool/print");
    result.pools = pools.map((p) => ({ name: p.name, ranges: p.ranges }));

    const hotspots = await timedQuery("/ip/hotspot/print");
    result.hotspots = hotspots.map((h) => ({
      name: h.name,
      interface: h.interface,
      profile: h.profile,
    }));

    const profiles = await timedQuery("/ip/hotspot/profile/print");
    result.profiles = profiles.map((p) => ({ name: p.name }));

    const radiusList = await timedQuery("/radius/print");
    result.radius = radiusList.map((r) => ({
      address: r.address,
      service: r.service,
    }));

    try {
      await conn.close();
    } catch (e) {}

    res.json(result);
  } catch (err) {
    console.error("Erro ao escanear Mikrotik:", err.message);
    res.status(500).json({ message: "Erro ao escanear: " + err.message });
  }
});

// Enviar configuração completa de Hotspot para o Mikrotik (SSE - streaming de steps)
router.post("/:id/enviar-hotspot", async (req, res) => {
  const { id } = req.params;
  const config = req.body;

  // Configurar SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Desabilitar buffering do Nginx
  });

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const [[mikrotik]] = await db.execute(
      "SELECT * FROM mikrotiks WHERE id = ? AND empresa_id = ?",
      [id, req.empresa_id],
    );
    if (!mikrotik) {
      sendEvent({ type: "error", message: "Mikrotik não encontrado" });
      res.end();
      return;
    }

    let portal = null;
    if (mikrotik.portal_id) {
      const [[p]] = await db.execute("SELECT * FROM portais WHERE id = ?", [
        mikrotik.portal_id,
      ]);
      portal = p;
    }

    const [[empresa]] = await db.execute(
      "SELECT id, slug FROM empresas WHERE id = ?",
      [req.empresa_id],
    );

    const systemDomain =
      req.headers.host?.replace(/:\d+$/, "") || process.env.SYSTEM_DOMAIN;
    const { configurarHotspot } = require("../utils/hotspotSetup");

    // Callback chamado a cada step - envia em tempo real via SSE
    const onStep = (step) => {
      sendEvent({ type: "step", ...step });
    };

    const result = await configurarHotspot(
      mikrotik,
      portal,
      systemDomain.replace(/:\d+$/, ""),
      config,
      empresa || {},
      onStep,
    );

    // Atualizar end_hotspot
    // IMPORTANTE: priorizar dnsName (DNS Name do Server Profile do hotspot) sobre o IP.
    // O MikroTik usa esse DNS Name como destino dos redirects HTTP do captive portal.
    // Quando salvamos o IP cru aqui, o cliente as vezes nao consegue logar (problema
    // de redirect HTTPS sem cert valido para o IP). Usando o DNS Name, o redirect
    // bate em algo que tem cert e roteamento certo.
    const localAddr = config.localAddress || "10.5.50.1/24";
    const gatewayIp = localAddr.split("/")[0];
    const endHotspot = (config.dnsName && config.dnsName.trim()) || gatewayIp;
    await db.execute(
      "UPDATE mikrotiks SET end_hotspot = ? WHERE id = ? AND empresa_id = ?",
      [endHotspot, id, req.empresa_id],
    );

    // Evento final
    sendEvent({
      type: "done",
      success: result.success,
      end_hotspot: endHotspot,
    });
  } catch (err) {
    console.error("Erro ao enviar hotspot:", err);
    sendEvent({ type: "error", message: "Erro interno: " + err.message });
  }

  res.end();
});

// Enviar apenas login.html para o Mikrotik (sem reconfigurar hotspot)
router.post("/:id/enviar-login", async (req, res) => {
  const { id } = req.params;
  try {
    const [[mikrotik]] = await db.execute(
      "SELECT * FROM mikrotiks WHERE id = ? AND empresa_id = ?",
      [id, req.empresa_id],
    );
    if (!mikrotik)
      return res.status(404).json({ message: "Mikrotik não encontrado" });

    const { RouterOSAPI } = require("node-routeros");
    const conn = new RouterOSAPI({
      host: mikrotik.ip,
      user: mikrotik.usuario,
      password: mikrotik.senha,
      port: mikrotik.porta || 8728,
      keepalive: false,
      timeout: 20000,
    });

    await conn.connect();

    const systemDomain =
      req.headers.host?.replace(/:\d+$/, "") || process.env.SYSTEM_DOMAIN;
    const fetchUrl = `${systemUrl(systemDomain)}/api/hotspot-login/${mikrotik.id}`;

    const safeWrite = (path, args) => {
      return Promise.race([
        conn.write(path, args).catch((e) => e.message),
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 20000)),
      ]);
    };

    let ok = false;
    let mensagem = "";

    // Tentar HTTPS
    try {
      const r = await safeWrite("/tool/fetch", [
        `=url=${fetchUrl}`,
        "=dst-path=hotspot/login.html",
        `=mode=${new URL(systemUrl(systemDomain)).protocol.slice(0, -1)}`,
        "=check-certificate=no",
      ]);
      if (r !== "timeout") {
        ok = true;
        mensagem = "login.html enviado com sucesso (HTTPS)";
      }
    } catch (e) {
      /* tenta HTTP */
    }

    // Fallback HTTP
    if (!ok) {
      try {
        const r = await safeWrite("/tool/fetch", [
          `=url=http://${systemDomain}/api/hotspot-login/${mikrotik.id}`,
          "=dst-path=hotspot/login.html",
          "=mode=http",
        ]);
        if (r !== "timeout") {
          ok = true;
          mensagem = "login.html enviado com sucesso (HTTP)";
        }
      } catch (e) {
        /* fallback manual */
      }
    }

    try {
      await conn.close();
    } catch (e) {}

    if (ok) {
      res.json({ success: true, message: mensagem });
    } else {
      const [[empresa]] = await db.execute(
        "SELECT id, slug FROM empresas WHERE id = ?",
        [req.empresa_id],
      );
      const empresaId = empresa?.id || mikrotik.empresa_id || "";
      const empresaSlug = empresa?.slug || "default";
      const fallbackUrl = `${systemUrl(systemDomain)}/hotspot/redirect/${mikrotik.id}?mac=$(mac)&ip=$(ip)&mikrotik_id=${mikrotik.id}&empresa_id=${empresaId}&empresa=${empresaSlug}`;
      res.status(207).json({
        success: false,
        message: `Não conseguiu baixar automaticamente. Configure manualmente o redirect para: ${fallbackUrl}`,
      });
    }
  } catch (err) {
    console.error("Erro ao enviar login.html:", err.message);
    res.status(500).json({ message: "Erro ao conectar: " + err.message });
  }
});

// Enviar status.html para o Mikrotik (sem reconfigurar hotspot)
router.post("/:id/enviar-status", async (req, res) => {
  const { id } = req.params;
  try {
    const [[mikrotik]] = await db.execute(
      "SELECT * FROM mikrotiks WHERE id = ? AND empresa_id = ?",
      [id, req.empresa_id],
    );
    if (!mikrotik)
      return res.status(404).json({ message: "Mikrotik não encontrado" });

    const { RouterOSAPI } = require("node-routeros");
    const conn = new RouterOSAPI({
      host: mikrotik.ip,
      user: mikrotik.usuario,
      password: mikrotik.senha,
      port: mikrotik.porta || 8728,
      keepalive: false,
      timeout: 20000,
    });

    await conn.connect();

    const systemDomain =
      req.headers.host?.replace(/:\d+$/, "") || process.env.SYSTEM_DOMAIN;
    const fetchUrl = `${systemUrl(systemDomain)}/api/hotspot-status/${mikrotik.id}`;

    const safeWrite = (path, args) => {
      return Promise.race([
        conn.write(path, args).catch((e) => e.message),
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 20000)),
      ]);
    };

    let ok = false;
    let mensagem = "";

    // Tentar HTTPS
    try {
      const r = await safeWrite("/tool/fetch", [
        `=url=${fetchUrl}`,
        "=dst-path=hotspot/status.html",
        `=mode=${new URL(systemUrl(systemDomain)).protocol.slice(0, -1)}`,
        "=check-certificate=no",
      ]);
      if (r !== "timeout") {
        ok = true;
        mensagem = "status.html enviado com sucesso (HTTPS)";
      }
    } catch (e) {
      /* tenta HTTP */
    }

    // Fallback HTTP
    if (!ok) {
      try {
        const r = await safeWrite("/tool/fetch", [
          `=url=http://${systemDomain}/api/hotspot-status/${mikrotik.id}`,
          "=dst-path=hotspot/status.html",
          "=mode=http",
        ]);
        if (r !== "timeout") {
          ok = true;
          mensagem = "status.html enviado com sucesso (HTTP)";
        }
      } catch (e) {
        /* fallback */
      }
    }

    try {
      await conn.close();
    } catch (e) {}

    if (ok) {
      res.json({ success: true, message: mensagem });
    } else {
      res.status(207).json({
        success: false,
        message:
          "Não conseguiu enviar status.html automaticamente. Baixe manualmente de: " +
          fetchUrl,
      });
    }
  } catch (err) {
    console.error("Erro ao enviar status.html:", err.message);
    res.status(500).json({ message: "Erro ao conectar: " + err.message });
  }
});

module.exports = router;
