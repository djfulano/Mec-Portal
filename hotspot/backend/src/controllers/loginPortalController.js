const db = require("../../db");

exports.login = async (req, res) => {
  const { username, password, mikrotik_id } = req.body;

  if (!username || !password || !mikrotik_id) {
    return res.status(400).json({ message: "Usuário, senha ou mikrotik não informados" });
  }

  try {
    // Busca a senha do usuário na tabela radcheck
    const [[user]] = await db.execute(
      "SELECT value FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'",
      [username]
    );

    if (!user) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }

    if (user.value !== password) {
      return res.status(401).json({ message: "Senha incorreta" });
    }

    // Limpa sessões travadas recentes para permitir novo login (Simultaneous-Use blocker)
    await db.query(`DELETE FROM radacct WHERE username = ? AND acctstarttime >= CURDATE()`, [username]);

    // Pega o domínio do gateway (Mikrotik) para redirecionamento
    const [[mk]] = await db.query(
      "SELECT ip, end_hotspot FROM mikrotiks WHERE id = ?",
      [mikrotik_id]
    );

    if (!mk || !mk.ip) {
      return res.status(404).json({ message: "Gateway não encontrado" });
    }

    const gateway = mk.end_hotspot || mk.ip;

    res.json({ message: "Autenticado com sucesso", gateway, username });

  } catch (err) {
    console.error("Erro no login-portal:", err);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
