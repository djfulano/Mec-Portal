require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const db = require('../db');
(async () => {
  try {
    const [result] = await db.execute(`
      INSERT INTO admin_empresas (admin_id, empresa_id, role)
      SELECT a.id, a.empresa_id, a.role
      FROM admins a JOIN empresas e ON e.id = a.empresa_id AND e.ativo = 1
      WHERE a.role IN ('operator', 'manager', 'owner')
      AND NOT EXISTS (SELECT 1 FROM admin_empresas ae WHERE ae.admin_id = a.id)
    `);
    console.log(`Vínculos de administradores corrigidos: ${result.affectedRows}`);
  } catch (err) { console.error(err.message); process.exitCode = 1; }
  finally { await db.end(); }
})();
