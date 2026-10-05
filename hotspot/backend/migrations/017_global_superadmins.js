require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const db = require('../db');
(async () => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("DELETE ae FROM admin_empresas ae JOIN admins a ON a.id = ae.admin_id WHERE a.role = 'super_admin'");
    await conn.execute("UPDATE admins SET empresa_id = NULL WHERE role = 'super_admin'");
    await conn.commit();
    console.log('Superadmins globais: vínculos com empresas removidos.');
  } catch (err) { await conn.rollback(); console.error(err.message); process.exitCode = 1; }
  finally { conn.release(); await db.end(); }
})();
