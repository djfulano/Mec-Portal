const db = require("../../db");
const { json } = require("../services/portalPolicy");
async function retention() {
  const [companies] = await db.query("SELECT * FROM privacy_settings");
  for (const company of companies) {
    const c = json(company.config);
    if (!c.classification || !c.basis) continue;
    const now = new Date();
    for (const [key, table, column] of [
      ["connection_days", "connection_logs", "fim_conexao"],
      ["nat_days", "nat_records", "fim"],
      ["audit_days", "access_audit", "criado_em"],
    ]) {
      const days = Number(c[key]);
      if (!Number.isInteger(days) || days < 1) continue;
      const cutoff = new Date(now.getTime() - days * 86400000);
      await db.query(
        `DELETE FROM ${table} WHERE empresa_id=? AND ${column} IS NOT NULL AND ${column}<?${table === "access_audit" ? "" : " AND (hold_until IS NULL OR hold_until<NOW())"}`,
        [company.empresa_id, cutoff],
      );
      if (table === "connection_logs")
        await db.query(
          `DELETE ra FROM radacct ra JOIN mikrotiks m ON m.ip COLLATE utf8mb4_unicode_ci=ra.nasipaddress COLLATE utf8mb4_unicode_ci WHERE m.empresa_id=? AND ra.acctstoptime<? AND NOT EXISTS(SELECT 1 FROM connection_logs l WHERE l.radacct_id=ra.radacctid AND l.hold_until>NOW())`,
          [company.empresa_id, cutoff],
        );
    }
    if (
      Number.isInteger(Number(c.visitor_days)) &&
      Number(c.visitor_days) > 0
    ) {
      const cutoff = new Date(
        now.getTime() - Number(c.visitor_days) * 86400000,
      );
      await db.query(
        `UPDATE visitantes v SET v.dados=JSON_OBJECT(),v.identidade_hash=SHA2(CONCAT(UUID(),v.id),256) WHERE v.empresa_id=? AND v.atualizado_em<? AND JSON_LENGTH(v.dados)>0 AND NOT EXISTS(SELECT 1 FROM access_grants g JOIN connection_logs l ON l.username COLLATE utf8mb4_unicode_ci=g.username COLLATE utf8mb4_unicode_ci WHERE g.visitante_id=v.id AND l.hold_until>NOW()) AND NOT EXISTS(SELECT 1 FROM privacy_requests r WHERE r.visitante_id=v.id AND r.status='pendente')`,
        [company.empresa_id, cutoff],
      );
      await db.query(
        "DELETE vc FROM visitor_consents vc JOIN visitantes v ON v.id=vc.visitante_id WHERE v.empresa_id=? AND JSON_LENGTH(v.dados)=0",
        [company.empresa_id],
      );
    }
  }
  await db.query(
    "DELETE FROM captive_otp WHERE expires_at<DATE_SUB(NOW(),INTERVAL 1 DAY)",
  );
  await db.query(
    "DELETE rc FROM radcheck rc JOIN access_grants g ON g.username COLLATE utf8mb4_unicode_ci=rc.username COLLATE utf8mb4_unicode_ci WHERE g.expires_at<NOW()",
  );
  await db.query(
    "DELETE rr FROM radreply rr JOIN access_grants g ON g.username COLLATE utf8mb4_unicode_ci=rr.username COLLATE utf8mb4_unicode_ci WHERE g.expires_at<NOW()",
  );
  await db.query(
    "UPDATE access_grants SET password='' WHERE expires_at<NOW() AND password<>''",
  );
}
module.exports = retention;
