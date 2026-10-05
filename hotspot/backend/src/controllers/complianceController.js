// src/controllers/complianceController.js
const db = require("../../db");

exports.buscarLogs = async (req, res) => {
  try {
    const {
      cpf,
      mac,
      ip,
      data_inicio,
      data_fim,
      username,
      page = 1,
      per_page = 50,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(per_page, 10) || 50));
    const offset = (pageNum - 1) * perPage;

    const where = ["empresa_id = ?"];
    const params = [req.empresa_id];

    if (cpf) {
      where.push("cpf = ?");
      params.push(cpf);
    }
    if (mac) {
      where.push("mac LIKE ?");
      params.push(`%${mac}%`);
    }
    if (ip) {
      where.push("ip_atribuido = ?");
      params.push(ip);
    }
    if (username) {
      where.push("username LIKE ?");
      params.push(`%${username}%`);
    }
    if (data_inicio) {
      where.push("inicio_conexao >= ?");
      params.push(data_inicio);
    }
    if (data_fim) {
      where.push("fim_conexao <= ?");
      params.push(data_fim);
    }

    const whereClause = `WHERE ${where.join(" AND ")}`;

    // Count total
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM connection_logs ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Fetch page
    const [rows] = await db.query(
      `SELECT
        username, cpf, mac, ip_atribuido, nas_ip,
        inicio_conexao, fim_conexao, duracao_segundos,
        bytes_entrada, bytes_saida, motivo_desconexao, auth_result
      FROM connection_logs
      ${whereClause}
      ORDER BY inicio_conexao DESC
      LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    res.json({
      data: rows,
      total,
      page: pageNum,
      per_page: perPage,
    });
  } catch (err) {
    console.error("Erro ao buscar logs de compliance:", err);
    res.status(500).json({ message: "Erro ao buscar logs de compliance." });
  }
};

exports.exportarCSV = async (req, res) => {
  try {
    const { cpf, mac, ip, data_inicio, data_fim, username } = req.query;

    const where = ["empresa_id = ?"];
    const params = [req.empresa_id];

    if (cpf) {
      where.push("cpf = ?");
      params.push(cpf);
    }
    if (mac) {
      where.push("mac LIKE ?");
      params.push(`%${mac}%`);
    }
    if (ip) {
      where.push("ip_atribuido = ?");
      params.push(ip);
    }
    if (username) {
      where.push("username LIKE ?");
      params.push(`%${username}%`);
    }
    if (data_inicio) {
      where.push("inicio_conexao >= ?");
      params.push(data_inicio);
    }
    if (data_fim) {
      where.push("fim_conexao <= ?");
      params.push(data_fim);
    }

    const whereClause = `WHERE ${where.join(" AND ")}`;

    const [rows] = await db.query(
      `SELECT
        username, cpf, mac, ip_atribuido, nas_ip,
        inicio_conexao, fim_conexao, duracao_segundos,
        bytes_entrada, bytes_saida, motivo_desconexao
      FROM connection_logs
      ${whereClause}
      ORDER BY inicio_conexao DESC
      LIMIT 50000`,
      params
    );

    // Build CSV
    const header = "Username,CPF,MAC,IP,NAS,Inicio,Fim,Duracao,Bytes Entrada,Bytes Saida,Motivo Desconexao";
    const csvRows = rows.map((r) => {
      const inicio = r.inicio_conexao ? new Date(r.inicio_conexao).toISOString().replace("T", " ").slice(0, 19) : "";
      const fim = r.fim_conexao ? new Date(r.fim_conexao).toISOString().replace("T", " ").slice(0, 19) : "";
      const duracao = formatDuracao(r.duracao_segundos || 0);
      return [
        r.username || "",
        r.cpf || "",
        r.mac || "",
        r.ip_atribuido || "",
        r.nas_ip || "",
        inicio,
        fim,
        duracao,
        r.bytes_entrada || 0,
        r.bytes_saida || 0,
        r.motivo_desconexao || "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });

    const csv = [header, ...csvRows].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=compliance_logs.csv");
    res.send(csv);
  } catch (err) {
    console.error("Erro ao exportar CSV de compliance:", err);
    res.status(500).json({ message: "Erro ao exportar CSV." });
  }
};

function formatDuracao(segundos) {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return `${h}h ${m}m`;
}
