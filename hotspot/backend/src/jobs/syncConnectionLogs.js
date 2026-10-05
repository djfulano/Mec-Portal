/**
 * Sync job: radacct -> connection_logs
 * Transfers completed RADIUS sessions into the Marco Civil compliance table.
 *
 * Usage:
 *   node src/jobs/syncConnectionLogs.js
 *
 * Or import and call syncConnectionLogs() from a cron scheduler.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const db = require('../../db');

async function syncConnectionLogs() {
  const conn = await db.getConnection();

  try {
    // 1. Get last synced radacctid
    const [syncRow] = await conn.execute(
      'SELECT last_synced_radacctid FROM connection_logs_sync ORDER BY id DESC LIMIT 1'
    );
    const lastId = syncRow.length > 0 ? syncRow[0].last_synced_radacctid : 0;

    console.log(`[syncConnectionLogs] Buscando sessoes com radacctid > ${lastId}...`);

    // 2. Fetch completed sessions from radacct, joined with radius_users and leads
    const [rows] = await conn.execute(
      `SELECT
        ra.radacctid,
        m.empresa_id,
        ra.username,
        ll.cpf,
        ra.callingstationid AS mac,
        ra.framedipaddress AS ip_atribuido,
        ra.nasipaddress AS nas_ip,
        ra.acctstarttime AS inicio_conexao,
        ra.acctstoptime AS fim_conexao,
        ra.acctinputoctets AS bytes_entrada,
        ra.acctoutputoctets AS bytes_saida,
        ra.acctsessiontime AS duracao_segundos,
        ra.acctterminatecause AS motivo_desconexao,
        ra.acctauthentic AS auth_result
      FROM radacct ra
      INNER JOIN mikrotiks m ON m.ip COLLATE utf8mb4_unicode_ci = ra.nasipaddress COLLATE utf8mb4_unicode_ci
      LEFT JOIN (
         SELECT mac, empresa_id, MAX(cpf) as cpf
         FROM leads
         GROUP BY mac, empresa_id
      ) ll ON ll.mac COLLATE utf8mb4_unicode_ci = ra.callingstationid COLLATE utf8mb4_unicode_ci AND ll.empresa_id = m.empresa_id
      WHERE ra.radacctid > ? AND ra.acctstoptime IS NOT NULL
      ORDER BY ra.radacctid ASC
      LIMIT 5000`,
      [lastId]
    );

    if (rows.length === 0) {
      console.log('[syncConnectionLogs] Nenhuma sessao nova para sincronizar.');
      return { synced: 0 };
    }

    console.log(`[syncConnectionLogs] Encontradas ${rows.length} sessoes para sincronizar.`);

    // 3. Insert into connection_logs in batches
    let maxRadacctId = lastId;

    for (const row of rows) {
      await conn.execute(
        `INSERT INTO connection_logs
          (empresa_id, username, cpf, mac, ip_atribuido, nas_ip, inicio_conexao, fim_conexao,
           bytes_entrada, bytes_saida, duracao_segundos, motivo_desconexao, auth_result)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.empresa_id,
          row.username,
          row.cpf || null,
          row.mac || '',
          row.ip_atribuido || '',
          row.nas_ip || '',
          row.inicio_conexao,
          row.fim_conexao,
          row.bytes_entrada || 0,
          row.bytes_saida || 0,
          row.duracao_segundos || 0,
          row.motivo_desconexao || null,
          row.auth_result || null
        ]
      );

      if (row.radacctid > maxRadacctId) {
        maxRadacctId = row.radacctid;
      }
    }

    // 4. Update sync tracking
    await conn.execute(
      'UPDATE connection_logs_sync SET last_synced_radacctid = ?, synced_at = NOW() ORDER BY id DESC LIMIT 1',
      [maxRadacctId]
    );

    console.log(`[syncConnectionLogs] Sincronizadas ${rows.length} sessoes. Ultimo radacctid: ${maxRadacctId}`);
    return { synced: rows.length, lastRadacctId: maxRadacctId };
  } catch (err) {
    console.error('[syncConnectionLogs] Erro:', err);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = syncConnectionLogs;

// Run directly
if (require.main === module) {
  syncConnectionLogs()
    .then((result) => {
      console.log('[syncConnectionLogs] Concluido:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[syncConnectionLogs] Falha:', err);
      process.exit(1);
    });
}
