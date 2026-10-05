require("dotenv").config({
  path: require("path").join(__dirname, "..", "..", ".env"),
  quiet: true,
});
const db = require("../../db");
async function syncConnectionLogs() {
  const c = await db.getConnection();
  try {
    const [[marker]] = await c.query(
      "SELECT last_synced_radacctid FROM connection_logs_sync ORDER BY id LIMIT 1",
    );
    const last = Number(marker?.last_synced_radacctid) || 0;
    const [rows] = await c.query(
      `SELECT ra.*,m.empresa_id,m.id equipamento_id,g.unidade_id granted_unit,g.revision_id
   FROM radacct ra JOIN mikrotiks m ON m.ip COLLATE utf8mb4_unicode_ci=ra.nasipaddress COLLATE utf8mb4_unicode_ci
   LEFT JOIN access_grants g ON g.username COLLATE utf8mb4_unicode_ci=ra.username COLLATE utf8mb4_unicode_ci AND g.empresa_id=m.empresa_id
   WHERE ra.radacctid>? OR EXISTS(SELECT 1 FROM connection_logs l WHERE l.radacct_id=ra.radacctid AND l.fim_conexao IS NULL)
   ORDER BY (ra.radacctid>?) DESC,ra.radacctid LIMIT 5000`,
      [last, last],
    );
    for (const r of rows) {
      await c.query(
        `INSERT INTO connection_logs(empresa_id,username,mac,ip_atribuido,nas_ip,inicio_conexao,fim_conexao,bytes_entrada,bytes_saida,duracao_segundos,motivo_desconexao,auth_result,unidade_id,equipamento_id,revision_id,radacct_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE fim_conexao=VALUES(fim_conexao),bytes_entrada=VALUES(bytes_entrada),bytes_saida=VALUES(bytes_saida),duracao_segundos=VALUES(duracao_segundos),motivo_desconexao=VALUES(motivo_desconexao)`,
        [
          r.empresa_id,
          r.username,
          r.callingstationid || "",
          r.framedipaddress || "",
          r.nasipaddress || "",
          r.acctstarttime,
          r.acctstoptime || null,
          r.acctinputoctets || 0,
          r.acctoutputoctets || 0,
          r.acctsessiontime || 0,
          r.acctterminatecause || null,
          r.acctauthentic || null,
          r.granted_unit || null,
          r.equipamento_id,
          r.revision_id || null,
          r.radacctid,
        ],
      );
    }
    if (rows.length) {
      const max = Math.max(last, ...rows.map((r) => Number(r.radacctid)));
      if (marker)
        await c.query(
          "UPDATE connection_logs_sync SET last_synced_radacctid=?,synced_at=NOW()",
          [max],
        );
      else
        await c.query(
          "INSERT INTO connection_logs_sync(last_synced_radacctid) VALUES (?)",
          [max],
        );
    }
    return { synced: rows.length };
  } finally {
    c.release();
  }
}
module.exports = syncConnectionLogs;
if (require.main === module)
  syncConnectionLogs()
    .then((r) => console.log(r))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(() => db.end());
