const db = require("../../db");
const { verificarLeadExistente } = require("../utils/leadUtils");
const { notificarLiberacao } = require("../services/whatsappNotify");

// Captura de lead sem liberar internet
exports.capturaPassiva = async (req, res) => {
  try {
    const { nome, email, telefone, cpf, mac, ip, mikrotik_id } = req.body;

    if (!telefone && !email) {
      return res.status(400).json({ message: "Telefone ou email são obrigatórios" });
    }

    let empresaId = null;
    if (mikrotik_id) {
      const [[mtk]] = await db.execute("SELECT empresa_id FROM mikrotiks WHERE id = ?", [mikrotik_id]);
      empresaId = mtk?.empresa_id || null;
    }

    // Verificar lead duplicado por CPF
    if (cpf) {
      const existing = await verificarLeadExistente(cpf, empresaId);
      if (existing) {
        return res.status(409).json({ message: "Este CPF já está cadastrado em nosso sistema.", duplicado: true });
      }
    }

    const cpfLimpo = cpf ? cpf.replace(/\D/g, "") : null;

    await db.execute(
      `INSERT INTO leads (empresa_id, nome, email, telefone, cpf, mac, ip, origem, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'portal_passivo', 'novo')`,
      [empresaId, nome || null, email || null, telefone || null, cpfLimpo, mac || null, ip || null]
    );

    // Buscar config de redirect do portal lead_passivo desta empresa
    let redirectUrl = null;
    let redirectDelay = 3;
    if (empresaId) {
      const [[portal]] = await db.execute(
        "SELECT configuracoes FROM portais WHERE tipo = 'lead_passivo' AND empresa_id = ? LIMIT 1",
        [empresaId]
      );
      if (portal?.configuracoes) {
        try {
          const cfg = JSON.parse(portal.configuracoes);
          if (cfg.redirect_portal_url) {
            redirectUrl = cfg.redirect_portal_url;
            redirectDelay = cfg.redirect_delay || 3;
          }
        } catch (e) {}
      }
    }

    // Notificacao WhatsApp (lead passivo nao libera RADIUS, mas pode mandar mensagem)
    let portalIdPassivo = null;
    if (empresaId) {
      try {
        const [[portalP]] = await db.execute(
          "SELECT id FROM portais WHERE tipo = 'lead_passivo' AND empresa_id = ? LIMIT 1",
          [empresaId]
        );
        portalIdPassivo = portalP?.id || null;
      } catch (_) {}
    }

    notificarLiberacao({
      empresa_id: empresaId,
      portal_id: portalIdPassivo,
      mikrotik_id: mikrotik_id || null,
      telefone: telefone || null,
      cpf: cpfLimpo || null,
      mac: mac || null,
      contexto_tipo: "lead_passivo",
      vars: {
        nome: nome || null,
        cpf: cpfLimpo || "",
      },
    }).catch(err => console.warn("[capturaPassiva] notificarLiberacao falhou:", err.message));

    return res.json({
      success: true,
      message: "Lead cadastrado com sucesso!",
      redirect_url: redirectUrl,
      redirect_delay: redirectDelay,
    });
  } catch (err) {
    console.error("Erro Captura Passiva Lead:", err);
    return res.status(500).json({ message: "Erro interno ao processar cadastro de Lead" });
  }
};


// Login público para portal Lead (cria RADIUS + retorna gateway)
exports.leadLogin = async (req, res) => {
  try {
    const { nome, email, telefone, cpf, mac, ip, mikrotik_id } = req.body;

    if (!mac || !ip) {
      return res.status(400).json({ message: "MAC e IP são obrigatórios" });
    }

    // Resolver empresa_id via mikrotik_id
    let empresaId = null;
    if (mikrotik_id) {
      const [[mtk]] = await db.execute("SELECT empresa_id FROM mikrotiks WHERE id = ?", [mikrotik_id]);
      empresaId = mtk?.empresa_id || null;
    }

    // Username: usar telefone limpo, ou email, ou MAC
    const telLimpo = telefone ? telefone.replace(/\D/g, '') : null;
    const username = telLimpo || email || mac;
    const senha = username;

    // Busca plano Lead da empresa
    let planoQuery = `
      SELECT p.id, p.duracao_minutos, p.velocidade_down, p.velocidade_up, p.mikrotik_id, p.shared_users, m.end_hotspot
      FROM planos p
      JOIN mikrotiks m ON p.mikrotik_id = m.id
      WHERE LOWER(p.nome) = 'lead'`;
    const planoParams = [];

    if (empresaId) {
      planoQuery += ` AND p.empresa_id = ?`;
      planoParams.push(empresaId);
    }

    planoQuery += ` LIMIT 1`;
    const [[plano]] = await db.query(planoQuery, planoParams);

    if (!plano) {
      return res.status(404).json({ message: "Plano Lead não configurado. Crie um plano com nome 'Lead'." });
    }

    // Verificar lead duplicado por CPF
    if (cpf) {
      const existing = await verificarLeadExistente(cpf, empresaId);
      if (existing) {
        return res.status(409).json({ message: "Este CPF já está cadastrado em nosso sistema.", duplicado: true });
      }
    }

    // Salvar lead
    try {
      await db.execute(
        `INSERT INTO leads (empresa_id, nome, email, telefone, cpf, mac, ip, origem, lgpd_aceite, lgpd_aceite_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'portal_lead', 1, NOW())`,
        [empresaId, nome || null, email || null, telefone || null, cpf || null, mac || null, ip || null]
      );
    } catch (leadErr) {
      console.warn("Aviso: erro ao inserir lead:", leadErr.message);
    }

    // Remove autenticações antigas
    await db.query("DELETE FROM radcheck WHERE username = ?", [username]);
    await db.query("DELETE FROM radreply WHERE username = ?", [username]);
    await db.query("DELETE FROM radusergroup WHERE username = ?", [username]);
    await db.query(`DELETE FROM radacct WHERE username = ? AND acctstarttime >= CURDATE()`, [username]);

    const rateLimit = `${plano.velocidade_up}M/${plano.velocidade_down}M`;
    const tempoSegundos = plano.duracao_minutos * 60;
    const sharedUsers = plano.shared_users || 1;

    await db.query(
      `INSERT INTO radcheck (username, attribute, op, value)
       VALUES (?, 'Cleartext-Password', ':=', ?),
              (?, 'Max-Daily-Session', ':=', ?),
              (?, 'Simultaneous-Use', ':=', ?)`,
      [username, senha, username, String(tempoSegundos), username, String(sharedUsers)]
    );

    await db.query(
      `INSERT INTO radreply (username, attribute, op, value)
       VALUES (?, 'Mikrotik-Rate-Limit', ':=', ?),
              (?, 'Session-Timeout', ':=', ?)`,
      [username, rateLimit, username, tempoSegundos]
    );

    await db.query(
      "INSERT INTO radusergroup (username, groupname) VALUES (?, ?)",
      [username, plano.id]
    );

    await db.query(
      `INSERT INTO radius_users (empresa_id, username, plano_id, nas_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE plano_id = VALUES(plano_id), nas_id = VALUES(nas_id), empresa_id = VALUES(empresa_id)`,
      [empresaId, username, plano.id, plano.mikrotik_id]
    );

    const gateway = plano.end_hotspot || ip;
    const loginUrl = gateway ? `http://${gateway}/login?username=${username}&password=${senha}` : "";

    // Resolver portal_id Lead da empresa para notificacao WhatsApp
    let portalId = null;
    if (empresaId) {
      try {
        const [[portalLead]] = await db.execute(
          "SELECT id FROM portais WHERE tipo = 'lead' AND empresa_id = ? LIMIT 1",
          [empresaId]
        );
        portalId = portalLead?.id || null;
      } catch (_) {}
    }

    notificarLiberacao({
      empresa_id: empresaId,
      portal_id: portalId,
      mikrotik_id: plano.mikrotik_id,
      telefone: telefone || null,
      cpf: cpf ? cpf.replace(/\D/g, "") : null,
      mac,
      contexto_tipo: "lead",
      vars: {
        nome: nome || null,
        username,
        password: senha,
        plano: "Lead",
        duracao: plano.duracao_minutos,
        velocidade: `${plano.velocidade_down}M/${plano.velocidade_up}M`,
        login_url: loginUrl,
        cpf: cpf ? cpf.replace(/\D/g, "") : "",
      },
    }).catch(err => console.warn("[leadLogin] notificarLiberacao falhou:", err.message));

    return res.json({ success: true, gateway, username, password: senha });
  } catch (err) {
    console.error("Erro Lead Login:", err);
    return res.status(500).json({ message: "Erro interno ao processar login Lead" });
  }
};

exports.listarLeads = async (req, res) => {
  try {
    const { status, q } = req.query;
    let query = "SELECT * FROM leads WHERE empresa_id = ?";
    const params = [req.empresa_id];

    if (status && status !== "todos") {
      query += " AND status = ?";
      params.push(status);
    }

    if (q) {
      query += " AND (nome LIKE ? OR email LIKE ? OR cpf LIKE ?)";
      const search = `%${q}%`;
      params.push(search, search, search);
    }

    query += " ORDER BY criado_em DESC";

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar leads:", err);
    res.status(500).json({ message: "Erro ao listar leads" });
  }
};

exports.criarLead = async (req, res) => {
  try {
    const { nome, email, telefone, cpf, mac, ip, status, origem, observacoes, lgpd_aceite } = req.body;

    const [result] = await db.execute(
      `INSERT INTO leads (empresa_id, nome, email, telefone, cpf, mac, ip, status, origem, observacoes, lgpd_aceite)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.empresa_id,
        nome || null,
        email || null,
        telefone || null,
        cpf || null,
        mac || null,
        ip || null,
        status || "novo",
        origem || "manual",
        observacoes || null,
        lgpd_aceite ? 1 : 0
      ]
    );

    res.status(201).json({ id: result.insertId, message: "Lead criado com sucesso" });
  } catch (err) {
    console.error("Erro ao criar lead:", err);
    res.status(500).json({ message: "Erro ao criar lead" });
  }
};

exports.atualizarLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, telefone, cpf, status, observacoes } = req.body;

    const fields = [];
    const params = [];

    if (nome !== undefined) { fields.push("nome = ?"); params.push(nome); }
    if (email !== undefined) { fields.push("email = ?"); params.push(email); }
    if (telefone !== undefined) { fields.push("telefone = ?"); params.push(telefone); }
    if (cpf !== undefined) { fields.push("cpf = ?"); params.push(cpf); }
    if (status !== undefined) { fields.push("status = ?"); params.push(status); }
    if (observacoes !== undefined) { fields.push("observacoes = ?"); params.push(observacoes); }

    if (fields.length === 0) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    params.push(id, req.empresa_id);

    const [result] = await db.execute(
      `UPDATE leads SET ${fields.join(", ")} WHERE id = ? AND empresa_id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Lead não encontrado" });
    }

    res.json({ message: "Lead atualizado com sucesso" });
  } catch (err) {
    console.error("Erro ao atualizar lead:", err);
    res.status(500).json({ message: "Erro ao atualizar lead" });
  }
};

exports.deletarLead = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute(
      "DELETE FROM leads WHERE id = ? AND empresa_id = ?",
      [id, req.empresa_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Lead não encontrado" });
    }

    res.json({ message: "Lead deletado com sucesso" });
  } catch (err) {
    console.error("Erro ao deletar lead:", err);
    res.status(500).json({ message: "Erro ao deletar lead" });
  }
};

exports.exportarLeadsCSV = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT nome, email, telefone, cpf, mac, ip, status, origem, observacoes, lgpd_aceite, criado_em FROM leads WHERE empresa_id = ? ORDER BY criado_em DESC",
      [req.empresa_id]
    );

    const header = "Nome,Email,Telefone,CPF,MAC,IP,Status,Origem,Observacoes,LGPD Aceite,Criado Em\n";
    const csvRows = rows.map(r => {
      return [
        `"${(r.nome || '').replace(/"/g, '""')}"`,
        `"${(r.email || '').replace(/"/g, '""')}"`,
        `"${(r.telefone || '').replace(/"/g, '""')}"`,
        `"${(r.cpf || '').replace(/"/g, '""')}"`,
        `"${(r.mac || '').replace(/"/g, '""')}"`,
        `"${(r.ip || '').replace(/"/g, '""')}"`,
        `"${r.status}"`,
        `"${r.origem}"`,
        `"${(r.observacoes || '').replace(/"/g, '""')}"`,
        r.lgpd_aceite ? "Sim" : "Não",
        `"${r.criado_em ? new Date(r.criado_em).toLocaleString('pt-BR') : ''}"`
      ].join(",");
    }).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
    res.send("\uFEFF" + header + csvRows);
  } catch (err) {
    console.error("Erro ao exportar leads:", err);
    res.status(500).json({ message: "Erro ao exportar leads" });
  }
};

// Cadastro de cliente para portal Planos (pré-pagamento)
exports.cadastroCliente = async (req, res) => {
  try {
    const { nome, email, telefone, cpf, mac, ip, mikrotik_id } = req.body;

    if (!nome || !email || !telefone || !cpf) {
      return res.status(400).json({ message: "Nome, email, telefone e CPF são obrigatórios" });
    }

    let empresaId = null;
    if (mikrotik_id) {
      const [[mtk]] = await db.execute("SELECT empresa_id FROM mikrotiks WHERE id = ?", [mikrotik_id]);
      empresaId = mtk?.empresa_id || null;
    }

    // Verificar CPF duplicado
    const existing = await verificarLeadExistente(cpf, empresaId);
    if (existing) {
      const cpfLimpo = cpf.replace(/\D/g, "");

      // Atualiza os dados do lead existente com os novos valores do formulario.
      // Sem isso, o sistema sempre usaria o telefone/nome/email do PRIMEIRO cadastro
      // do CPF, mesmo o usuario tendo informado dados novos agora.
      // Preserva isolamento multi-tenant filtrando por empresa_id.
      try {
        await db.execute(
          `UPDATE leads SET
             nome = COALESCE(?, nome),
             email = COALESCE(?, email),
             telefone = COALESCE(?, telefone),
             mac = COALESCE(?, mac),
             ip = COALESCE(?, ip)
           WHERE id = ?${empresaId ? " AND empresa_id = ?" : ""}`,
          empresaId
            ? [nome || null, email || null, telefone || null, mac || null, ip || null, existing.id, empresaId]
            : [nome || null, email || null, telefone || null, mac || null, ip || null, existing.id]
        );
      } catch (updErr) {
        console.warn("Aviso: falha ao atualizar lead existente:", updErr.message);
      }

      // Verificar se tem plano ativo no RADIUS
      try {
        const [radcheckRows] = await db.query(
          "SELECT attribute, value FROM radcheck WHERE username = ?", [cpfLimpo]
        );

        if (radcheckRows.length > 0) {
          const maxSessionRow = radcheckRows.find(r => r.attribute === "Max-Daily-Session");
          const passwordRow = radcheckRows.find(r => r.attribute === "Cleartext-Password");
          const maxSession = maxSessionRow ? parseInt(maxSessionRow.value) : 0;
          const password = passwordRow ? passwordRow.value : cpfLimpo;

          // Somar tempo usado hoje
          const [[acctResult]] = await db.query(
            `SELECT COALESCE(SUM(acctsessiontime), 0) as usado
             FROM radacct
             WHERE username = ? AND DATE(acctstarttime) = CURDATE()`, [cpfLimpo]
          );
          const tempoUsado = acctResult.usado || 0;

          if (maxSession > 0 && tempoUsado < maxSession) {
            // Buscar gateway do MikroTik
            let gateway = null;
            if (empresaId) {
              const [[mk]] = await db.query(
                "SELECT end_hotspot, ip FROM mikrotiks WHERE empresa_id = ? LIMIT 1", [empresaId]
              );
              gateway = mk?.end_hotspot || mk?.ip || null;
            }

            return res.json({
              id: existing.id, nome: existing.nome, email: existing.email,
              existente: true, planoAtivo: true,
              gateway, username: cpfLimpo, password,
              tempoRestante: maxSession - tempoUsado
            });
          }
        }
      } catch (radErr) {
        console.error("Erro ao verificar RADIUS:", radErr.message);
      }

      // Sem plano ativo — segue para planos
      return res.json({ id: existing.id, nome: existing.nome, email: existing.email, existente: true, planoAtivo: false });
    }

    const cpfLimpo = cpf.replace(/\D/g, "");

    const [result] = await db.execute(
      `INSERT INTO leads (empresa_id, nome, email, telefone, cpf, mac, ip, origem, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'portal_planos', 'novo')`,
      [empresaId, nome, email, telefone, cpfLimpo, mac || null, ip || null]
    );

    res.json({ id: result.insertId, nome, email, existente: false });
  } catch (err) {
    console.error("Erro ao cadastrar cliente:", err);
    res.status(500).json({ message: "Erro interno ao processar cadastro" });
  }
};
