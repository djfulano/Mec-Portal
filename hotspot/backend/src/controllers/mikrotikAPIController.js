const db = require("../../db");
const { RouterOSAPI } = require("node-routeros");
const axios = require("axios");
const { notificarLiberacao } = require("../services/whatsappNotify");

async function obterInformacoes(req, res) {
  const { id } = req.params;

  try {
    const [[mikrotik]] = await db.execute("SELECT * FROM mikrotiks WHERE id = ? AND empresa_id = ?", [id, req.empresa_id]);
    if (!mikrotik) return res.status(404).json({ message: "Mikrotik não encontrado" });

    const conn = new RouterOSAPI({
      host: mikrotik.ip,
      user: mikrotik.usuario,
      password: mikrotik.senha,
      port: mikrotik.porta || 8728,
      keepalive: false,
      timeout: 5000,
    });

    await conn.connect();

    const [resource] = await conn.write("/system/resource/print");
    await conn.close();

    return res.json({
      modelo: resource["board-name"] || "Desconhecido",
      versao: resource.version || "N/A",
      uptime: resource.uptime || "N/A",
      cpu: resource["cpu"] || "N/A",
    });
  } catch (err) {
    console.error("Erro ao obter informações do Mikrotik:", err.message);
    return res.status(500).json({ message: "Falha na conexão com o Mikrotik" });
  }
}

/**
 * Libera usuário no RADIUS com todos os atributos.
 * @param {Object} params
 * @param {string} params.mac - MAC address
 * @param {string} params.ip - IP address
 * @param {string} params.plano - Nome do plano
 * @param {number} [params.empresa_id] - ID da empresa (obrigatório para multi-tenant)
 * @param {number} [params.shared_users] - Limite de sessões simultâneas
 */
async function liberarUsuario({ mac, ip, plano, empresa_id, cpf, telefone, cliente_id, portal_id, contexto_tipo, referencia_id }) {
  try {
    // Username/senha: CPF (se tiver) ou MAC. Nao bloqueia por falta de CPF
    // (portais de Leads e Leads sem internet podem nao ter CPF).
    const cpfNumeros = cpf ? String(cpf).replace(/\D/g, "") : null;
    const username = cpfNumeros || mac;
    const senha = cpfNumeros || mac;

    // Consulta plano FILTRANDO POR EMPRESA
    let planoQuery = "SELECT * FROM planos WHERE nome = ?";
    const planoParams = [plano];
    if (empresa_id) {
      planoQuery += " AND empresa_id = ?";
      planoParams.push(empresa_id);
    }
    planoQuery += " LIMIT 1";

    const [planos] = await db.query(planoQuery, planoParams);
    const p = planos[0];
    if (!p) throw new Error(`Plano '${plano}' não encontrado${empresa_id ? ` para empresa ${empresa_id}` : ''}`);

    const rateLimit = `${p.velocidade_up}M/${p.velocidade_down}M`;
    const tempoSegundos = p.duracao_minutos * 60;
    const sharedUsers = p.shared_users || 1;

    // Remove entradas antigas do RADIUS
    await db.query("DELETE FROM radcheck WHERE username = ?", [username]);
    await db.query("DELETE FROM radreply WHERE username = ?", [username]);
    await db.query("DELETE FROM radusergroup WHERE username = ?", [username]);

    // Limpa sessões atuais do dia (reinicia contador do dailycounter)
    await db.query(
      `DELETE FROM radacct WHERE username = ? AND acctstarttime >= CURDATE()`,
      [username]
    );

    // Insere autenticação com limite diário e sessões simultâneas
    const checkValues = [
      [username, 'Cleartext-Password', ':=', senha],
      [username, 'Max-Daily-Session', ':=', String(tempoSegundos)],
      [username, 'Simultaneous-Use', ':=', String(sharedUsers)],
    ];
    await db.query(
      `INSERT INTO radcheck (username, attribute, op, value) VALUES
       (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)`,
      checkValues.flat()
    );

    // Insere perfil de banda e timeout
    await db.query(
      `INSERT INTO radreply (username, attribute, op, value) VALUES
        (?, 'Mikrotik-Rate-Limit', ':=', ?),
        (?, 'Session-Timeout', ':=', ?)`,
      [username, rateLimit, username, String(tempoSegundos)]
    );

    // Associa a grupo/plano
    await db.query(
      "INSERT INTO radusergroup (username, groupname) VALUES (?, ?)",
      [username, String(p.id)]
    );

    // Atualiza ou insere vínculo com EMPRESA_ID
    const empresaIdFinal = empresa_id || p.empresa_id;
    await db.query(`
      INSERT INTO radius_users (empresa_id, username, plano_id, nas_id)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE plano_id = VALUES(plano_id), nas_id = VALUES(nas_id), empresa_id = VALUES(empresa_id)
    `, [empresaIdFinal, username, p.id, p.mikrotik_id]);

    // Monta URL de auto-login do hotspot
    const [mkInfo] = await db.query(
      "SELECT end_hotspot, ip FROM mikrotiks WHERE id = ? LIMIT 1",
      [p.mikrotik_id]
    );
    const gateway = mkInfo[0]?.end_hotspot || mkInfo[0]?.ip || null;
    const loginUrl = gateway ? `http://${gateway}/login?username=${username}&password=${username}` : "";

    // Dispara notificacao WhatsApp via service centralizado.
    // NUNCA bloqueia a liberacao: erros sao logados em whatsapp_logs.
    notificarLiberacao({
      empresa_id: empresaIdFinal,
      portal_id: portal_id || null,
      mikrotik_id: p.mikrotik_id,
      telefone: telefone || null,
      cliente_id: cliente_id || null,
      cpf: cpfNumeros || null,
      mac: mac || null,
      contexto_tipo: contexto_tipo || "liberacao",
      referencia_id: referencia_id || null,
      vars: {
        username,
        password: senha,
        plano: p.nome,
        duracao: p.duracao_minutos,
        velocidade: `${p.velocidade_down}M/${p.velocidade_up}M`,
        login_url: loginUrl,
        cpf: cpfNumeros || "",
      },
    }).catch(err => console.warn("[liberarUsuario] notificarLiberacao falhou:", err.message));

    console.log(`Usuario ${username} liberado com plano ${plano} (empresa: ${empresaIdFinal})`);
  } catch (error) {
    console.error("Erro ao liberar usuario:", error.message);
    throw error;
  }
}

/**
 * Remove usuário do MikroTik E limpa RADIUS.
 */
async function removerUsuarioPorMac(mac, limparRadius = true) {
  if (!mac || typeof mac !== 'string') {
    console.error("MAC address invalido ou nao fornecido");
    return { success: false, message: "MAC address invalido" };
  }

  let conn;
  let resultados = {
    user: { removed: false },
    active: { removed: false },
    host: { removed: false },
    radius: { removed: false }
  };

  try {
    // Busca a MikroTik associada ao MAC
    const [[mikrotik]] = await db.query(`
      SELECT m.* FROM mikrotiks m
      JOIN pagamentos p ON p.mac = ?
      JOIN planos pl ON pl.id = p.plano_id AND pl.mikrotik_id = m.id
      LIMIT 1
    `, [mac]);

    if (!mikrotik) {
      console.error("Mikrotik nao encontrada para o MAC:", mac);
      // Mesmo sem MikroTik, limpa RADIUS se solicitado
      if (limparRadius) {
        await limparUsuarioRadius(mac);
        resultados.radius = { removed: true };
      }
      return { success: true, message: "RADIUS limpo (MikroTik nao encontrada)", results: resultados };
    }

    conn = new RouterOSAPI({
      host: mikrotik.ip,
      user: mikrotik.usuario,
      password: mikrotik.senha,
      port: mikrotik.porta || 8728,
      keepalive: false,
      timeout: 15000,
    });

    try {
      await conn.connect();
    } catch (connectError) {
      console.error("Falha na conexao com o MikroTik:", connectError.message);
      // MikroTik inacessivel, limpa RADIUS mesmo assim
      if (limparRadius) {
        await limparUsuarioRadius(mac);
        resultados.radius = { removed: true };
      }
      return {
        success: true,
        message: "RADIUS limpo (MikroTik inacessivel)",
        results: resultados
      };
    }

    const processarRemocao = async (caminho) => {
      try {
        const [user] = await conn.write(`${caminho}/print`, [`?mac-address=${mac}`]);
        if (!user || user === '!done' || user === '!empty' || !user['.id']) {
          return { removed: false, message: "Nao encontrado" };
        }
        await conn.write(`${caminho}/remove`, [`=.id=${user['.id']}`]);
        return { removed: true };
      } catch (err) {
        if (err.message.includes('UNKNOWNREPLY') || err.message.includes('!empty') || err.message.includes('no such item')) {
          return { removed: false, message: "Ja removido" };
        }
        return { removed: false, error: err.message };
      }
    };

    resultados.user = await processarRemocao("/ip/hotspot/user");
    resultados.active = await processarRemocao("/ip/hotspot/active");
    resultados.host = await processarRemocao("/ip/hotspot/host");

    // Limpar RADIUS (radcheck, radreply, radusergroup)
    if (limparRadius) {
      await limparUsuarioRadius(mac);
      resultados.radius = { removed: true };
    }

    const sucessoGlobal = Object.values(resultados).some(r => r.removed);
    return {
      success: sucessoGlobal,
      message: sucessoGlobal ? "Operacao concluida" : "Falha na remocao",
      results: resultados
    };
  } catch (err) {
    console.error("Erro geral:", err.message);
    return {
      success: false,
      message: "Erro durante o processo",
      error: err.message,
      results: resultados
    };
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) {}
    }
  }
}

/**
 * Limpa um usuário de todas as tabelas RADIUS.
 * Busca username pelo MAC (CPF ou MAC direto).
 */
async function limparUsuarioRadius(mac) {
  try {
    // Busca username: pode ser CPF ou MAC
    const [checks] = await db.query(
      `SELECT DISTINCT rc.username FROM radcheck rc
       JOIN radacct ra ON ra.username = rc.username
       WHERE ra.callingstationid = ?
       UNION
       SELECT username FROM radcheck WHERE username = ?`,
      [mac, mac]
    );

    for (const { username } of checks) {
      await db.query("DELETE FROM radcheck WHERE username = ?", [username]);
      await db.query("DELETE FROM radreply WHERE username = ?", [username]);
      await db.query("DELETE FROM radusergroup WHERE username = ?", [username]);
      await db.query("DELETE FROM radius_users WHERE username = ?", [username]);
    }
  } catch (err) {
    console.warn("Aviso: erro ao limpar RADIUS por MAC:", err.message);
  }
}

module.exports = { obterInformacoes, liberarUsuario, removerUsuarioPorMac };
