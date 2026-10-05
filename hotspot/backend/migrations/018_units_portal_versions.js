require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});
const db = require("../db");
async function migrate() {
  const c = await db.getConnection();
  try {
    const tables = [
      `CREATE TABLE IF NOT EXISTS unidades (id INT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, nome VARCHAR(160) NOT NULL, endereco VARCHAR(500), ativo TINYINT NOT NULL DEFAULT 1, mp_config JSON, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(empresa_id), FOREIGN KEY(empresa_id) REFERENCES empresas(id) ON DELETE CASCADE)`,
      `CREATE TABLE IF NOT EXISTS admin_unidades (admin_id INT NOT NULL, unidade_id INT NOT NULL, PRIMARY KEY(admin_id,unidade_id), FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE CASCADE, FOREIGN KEY(unidade_id) REFERENCES unidades(id) ON DELETE CASCADE)`,
      `CREATE TABLE IF NOT EXISTS portal_revisions (id INT AUTO_INCREMENT PRIMARY KEY, portal_id INT NOT NULL, numero INT NOT NULL, config JSON NOT NULL, publicado_por INT, publicado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(portal_id,numero), FOREIGN KEY(portal_id) REFERENCES portais(id) ON DELETE CASCADE)`,
      `CREATE TABLE IF NOT EXISTS portal_unidades (portal_id INT NOT NULL, unidade_id INT NOT NULL, PRIMARY KEY(portal_id,unidade_id), FOREIGN KEY(portal_id) REFERENCES portais(id) ON DELETE CASCADE, FOREIGN KEY(unidade_id) REFERENCES unidades(id) ON DELETE CASCADE)`,
      `CREATE TABLE IF NOT EXISTS visitantes (id INT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, unidade_id INT, escopo VARCHAR(80) NOT NULL, identidade_hash CHAR(64) NOT NULL, dados JSON NOT NULL, atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(escopo,identidade_hash), INDEX(empresa_id,unidade_id), FOREIGN KEY(empresa_id) REFERENCES empresas(id) ON DELETE CASCADE)`,
      `CREATE TABLE IF NOT EXISTS visitor_consents (id BIGINT AUTO_INCREMENT PRIMARY KEY, visitante_id INT NOT NULL, empresa_id INT NOT NULL, unidade_id INT NOT NULL, portal_id INT NOT NULL, revision_id INT NOT NULL, finalidade VARCHAR(255) NOT NULL, marketing TINYINT NOT NULL DEFAULT 0, termos TEXT NOT NULL, politica TEXT NOT NULL, ip VARCHAR(45), origem VARCHAR(100), criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(empresa_id,unidade_id), FOREIGN KEY(visitante_id) REFERENCES visitantes(id) ON DELETE CASCADE)`,
      `CREATE TABLE IF NOT EXISTS captive_otp (id CHAR(36) PRIMARY KEY, equipamento_id INT NOT NULL, telefone VARCHAR(20) NOT NULL, codigo_hash CHAR(64) NOT NULL, mac VARCHAR(50) NOT NULL, origem_hash CHAR(64) NOT NULL, tentativas INT NOT NULL DEFAULT 0, verificado TINYINT NOT NULL DEFAULT 0, usado TINYINT NOT NULL DEFAULT 0, expires_at DATETIME NOT NULL, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(telefone,criado_em), INDEX(origem_hash,criado_em))`,
      `CREATE TABLE IF NOT EXISTS access_grants (id CHAR(36) PRIMARY KEY, empresa_id INT NOT NULL, unidade_id INT NOT NULL, equipamento_id INT NOT NULL, portal_id INT NOT NULL, revision_id INT NOT NULL, visitante_id INT, username VARCHAR(64) NOT NULL UNIQUE, password VARCHAR(128) NOT NULL, mac VARCHAR(50) NOT NULL, ip VARCHAR(45) NOT NULL, policy JSON NOT NULL, expires_at DATETIME NOT NULL, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(empresa_id,unidade_id))`,
      `CREATE TABLE IF NOT EXISTS captive_payments (id CHAR(36) PRIMARY KEY, empresa_id INT NOT NULL, unidade_id INT NOT NULL, equipamento_id INT NOT NULL, portal_id INT NOT NULL, revision_id INT NOT NULL, visitante_id INT NOT NULL, plano_id INT NOT NULL, valor DECIMAL(10,2) NOT NULL, policy JSON NOT NULL, mac VARCHAR(50) NOT NULL, ip VARCHAR(45) NOT NULL, mp_config JSON NOT NULL, provider_id VARCHAR(80), status VARCHAR(30) NOT NULL DEFAULT 'pending', qr_code TEXT, qr_image LONGTEXT, grant_id CHAR(36), criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(empresa_id,unidade_id))`,
      `CREATE TABLE IF NOT EXISTS privacy_requests (id INT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, unidade_id INT NOT NULL, visitante_id INT NOT NULL, tipo VARCHAR(30) NOT NULL, dados JSON, status VARCHAR(30) NOT NULL DEFAULT 'pendente', resposta TEXT, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(empresa_id,unidade_id))`,
      `CREATE TABLE IF NOT EXISTS privacy_settings (empresa_id INT PRIMARY KEY, config JSON NOT NULL, FOREIGN KEY(empresa_id) REFERENCES empresas(id) ON DELETE CASCADE)`,
      `CREATE TABLE IF NOT EXISTS access_audit (id BIGINT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, admin_id INT, acao VARCHAR(100) NOT NULL, recurso VARCHAR(100), criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(empresa_id))`,
      `CREATE TABLE IF NOT EXISTS nat_records (id BIGINT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, unidade_id INT NOT NULL, equipamento_id INT NOT NULL, ip_privado VARCHAR(45) NOT NULL, porta_privada INT, ip_publico VARCHAR(45) NOT NULL, porta_publica INT NOT NULL, protocolo VARCHAR(10) NOT NULL, inicio DATETIME NOT NULL, fim DATETIME, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(empresa_id,unidade_id,inicio))`,
    ];
    for (const sql of tables)
      await c.query(sql + " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    async function column(table, name, type) {
      const [r] = await c.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [name]);
      if (!r.length)
        await c.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    }
    await column(
      "empresas",
      "cadastro_compartilhado",
      "TINYINT NOT NULL DEFAULT 1",
    );
    await column("grupos_permissao", "empresa_id", "INT NULL");
    await column("mikrotiks", "unidade_id", "INT NULL");
    await column(
      "mikrotiks",
      "fabricante",
      "VARCHAR(40) NOT NULL DEFAULT 'mikrotik'",
    );
    await column("mikrotiks", "collector_hash", "CHAR(64) NULL");
    await column("portais", "draft_config", "JSON NULL");
    await column("portais", "published_revision_id", "INT NULL");
    await column("portais", "created_by", "INT NULL");
    await column("portais", "managed", "TINYINT NOT NULL DEFAULT 0");
    await column("portais", "draft_updated_at", "TIMESTAMP NULL");
    await column("connection_logs", "unidade_id", "INT NULL");
    await column("connection_logs", "equipamento_id", "INT NULL");
    await column("connection_logs", "revision_id", "INT NULL");
    await column("connection_logs", "radacct_id", "BIGINT NULL");
    await column("connection_logs", "hold_until", "DATETIME NULL");
    await column("pagamentos", "unidade_id", "INT NULL");
    await column("pagamentos", "equipamento_id", "INT NULL");
    await column("pagamentos", "revision_id", "INT NULL");
    await column("nat_records", "hold_until", "DATETIME NULL");
    const [indexes] = await c.query(
      "SHOW INDEX FROM connection_logs WHERE Key_name='idx_radacct_unique'",
    );
    if (!indexes.length)
      await c.query(
        "ALTER TABLE connection_logs ADD UNIQUE INDEX idx_radacct_unique(radacct_id)",
      );
    await c.query(
      `INSERT INTO unidades(empresa_id,nome) SELECT e.id,'Unidade principal' FROM empresas e WHERE NOT EXISTS(SELECT 1 FROM unidades u WHERE u.empresa_id=e.id)`,
    );
    await c.query(
      `UPDATE mikrotiks m SET unidade_id=(SELECT MIN(u.id) FROM unidades u WHERE u.empresa_id=m.empresa_id) WHERE unidade_id IS NULL`,
    );
    await c.query(
      `INSERT IGNORE INTO admin_unidades(admin_id,unidade_id) SELECT a.id,u.id FROM admins a JOIN unidades u ON u.empresa_id=a.empresa_id WHERE a.role NOT IN ('super_admin','owner')`,
    );
    await c.query(
      `INSERT IGNORE INTO portal_unidades(portal_id,unidade_id) SELECT m.portal_id,m.unidade_id FROM mikrotiks m JOIN portais p ON p.id=m.portal_id AND p.empresa_id=m.empresa_id WHERE m.portal_id IS NOT NULL`,
    );
    const [portals] = await c.query(
      "SELECT * FROM portais WHERE published_revision_id IS NULL",
    );
    for (const p of portals) {
      const config = { legacy: true, legacy_portal: p };
      const [r] = await c.query(
        "INSERT IGNORE INTO portal_revisions(portal_id,numero,config) VALUES (?,1,?)",
        [p.id, JSON.stringify(config)],
      );
      const [[revision]] = await c.query(
        "SELECT id FROM portal_revisions WHERE portal_id=? AND numero=1",
        [p.id],
      );
      await c.query("UPDATE portais SET published_revision_id=? WHERE id=?", [
        revision.id,
        p.id,
      ]);
    }
    console.log(
      "Unidades, permissões e versões migradas; histórico preservado.",
    );
    await c.query("UPDATE radpostauth SET pass='' WHERE pass<>''");
  } finally {
    c.release();
    await db.end();
  }
}
migrate().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
