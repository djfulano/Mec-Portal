const db = require("../../db");
const { verificarLeadExistente } = require("../utils/leadUtils");
const { notificarLiberacao } = require("../services/whatsappNotify");

exports.lgpdLogin = async (req, res) => {
  try {
    const { cpf, aceite, mac, ip, email, nome, telefone, mikrotik_id } = req.body;

    if (aceite === undefined || !mac || !ip) {
      return res.status(400).json({ message: "Dados obrigatórios faltando" });
    }

    // Resolver empresa_id via mikrotik_id (endpoint público)
    let empresaId = null;
    if (mikrotik_id) {
      const [[mtk]] = await db.execute("SELECT empresa_id FROM mikrotiks WHERE id = ?", [mikrotik_id]);
      empresaId = mtk?.empresa_id || null;
    }

    const aceiteInt = aceite ? 1 : 0;
    // Limpar caracteres especiais do CPF para usar como username RADIUS
    const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : null;
    const username = cpfLimpo || mac;
    const senha = cpfLimpo || mac;

    // Busca plano LGPD da empresa ANTES de inserir registros
    let planoQuery = `
      SELECT p.id, p.duracao_minutos, p.velocidade_down, p.velocidade_up, p.mikrotik_id, p.shared_users, m.end_hotspot
      FROM planos p
      JOIN mikrotiks m ON p.mikrotik_id = m.id
      WHERE p.nome = 'LGPD'`;
    const planoParams = [];

    if (empresaId) {
      planoQuery += ` AND p.empresa_id = ?`;
      planoParams.push(empresaId);
    }

    planoQuery += ` LIMIT 1`;
    const [[plano]] = await db.query(planoQuery, planoParams);

    if (!plano) {
      return res.status(404).json({ message: "Plano LGPD não configurado" });
    }

    // Verificar lead duplicado por CPF
    if (cpf) {
      const existing = await verificarLeadExistente(cpfLimpo, empresaId);
      if (existing) {
        return res.status(409).json({ message: "Este CPF já está cadastrado em nosso sistema.", duplicado: true });
      }
    }

    // Salvar na tabela unificada leads (origem = 'lgpd')
    await db.execute(
      `INSERT INTO leads (empresa_id, nome, email, telefone, cpf, mac, ip, origem, lgpd_aceite, lgpd_aceite_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'lgpd', ?, NOW())`,
      [empresaId, nome || null, email || null, telefone || null, cpf || null, mac, ip, aceiteInt]
    );

    // Remove autenticações antigas
    await db.query("DELETE FROM radcheck WHERE username = ?", [username]);
    await db.query("DELETE FROM radreply WHERE username = ?", [username]);
    await db.query("DELETE FROM radusergroup WHERE username = ?", [username]);

    // Limpa sessões do dia
    await db.query(
      `DELETE FROM radacct WHERE username = ? AND acctstarttime >= CURDATE()`,
      [username]
    );

    const rateLimit = `${plano.velocidade_up}M/${plano.velocidade_down}M`;
    const tempoSegundos = plano.duracao_minutos * 60;

    // Cria autenticação no RADIUS (senha + limite diário + sessões simultâneas)
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

    // Resolver portal_id LGPD da empresa para notificacao WhatsApp
    let portalId = null;
    if (empresaId) {
      try {
        const [[portalLgpd]] = await db.execute(
          "SELECT id FROM portais WHERE tipo = 'lgpd' AND empresa_id = ? LIMIT 1",
          [empresaId]
        );
        portalId = portalLgpd?.id || null;
      } catch (_) {}
    }

    notificarLiberacao({
      empresa_id: empresaId,
      portal_id: portalId,
      mikrotik_id: plano.mikrotik_id,
      telefone: telefone || null,
      cpf: cpfLimpo || null,
      mac,
      contexto_tipo: "lgpd",
      vars: {
        nome: nome || null,
        username,
        password: senha,
        plano: "LGPD",
        duracao: plano.duracao_minutos,
        velocidade: `${plano.velocidade_down}M/${plano.velocidade_up}M`,
        login_url: loginUrl,
        cpf: cpfLimpo || "",
      },
    }).catch(err => console.warn("[lgpdLogin] notificarLiberacao falhou:", err.message));

    return res.json({ success: true, gateway, username, password: senha });
  } catch (err) {
    console.error("Erro LGPD Login:", err);
    return res.status(500).json({ message: "Erro interno ao processar login LGPD" });
  }
};

exports.getAllLgpd = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, cpf, email, nome, telefone, mac, ip, lgpd_aceite as aceite, criado_em FROM leads WHERE empresa_id = ? AND origem = 'lgpd' ORDER BY criado_em DESC",
      [req.empresa_id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar cadastros LGPD:", err);
    res.status(500).json({ message: "Erro ao buscar dados LGPD" });
  }
};

exports.lgpdCadastro = async (req, res) => {
  try {
    const { cpf, aceite, mac, ip, nome, telefone, email, mikrotik_id } = req.body;

    if (!cpf || aceite === undefined) {
      return res.status(400).json({ message: "CPF e aceite são obrigatórios" });
    }

    let empresaId = null;
    if (mikrotik_id) {
      const [[mtk]] = await db.execute("SELECT empresa_id FROM mikrotiks WHERE id = ?", [mikrotik_id]);
      empresaId = mtk?.empresa_id || null;
    }

    const aceiteInt = aceite ? 1 : 0;

    // Verificar lead duplicado por CPF
    if (cpf) {
      const cpfCheck = cpf.replace(/\D/g, "");
      const existing = await verificarLeadExistente(cpfCheck, empresaId);
      if (existing) {
        return res.status(409).json({ message: "Este CPF já está cadastrado em nosso sistema.", duplicado: true });
      }
    }

    await db.execute(
      `INSERT INTO leads (empresa_id, nome, email, telefone, cpf, mac, ip, origem, lgpd_aceite, lgpd_aceite_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'lgpd', ?, NOW())`,
      [empresaId, nome || null, email || null, telefone || null, cpf, mac || null, ip || null, aceiteInt]
    );

    res.json({ success: true, message: "Cadastro LGPD realizado com sucesso" });
  } catch (err) {
    console.error("Erro ao cadastrar LGPD:", err);
    res.status(500).json({ message: "Erro interno ao cadastrar LGPD" });
  }
};
