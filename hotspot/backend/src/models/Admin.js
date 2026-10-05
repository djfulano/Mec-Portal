const db = require('../../db');

const findByEmail = async (email) => {
  const [rows] = await db.execute(
    `SELECT a.*, e.slug AS empresa_slug, e.nome AS empresa_nome
     FROM admins a
     LEFT JOIN empresas e ON a.empresa_id = e.id
     WHERE a.email = ?`,
    [email]
  );
  return rows[0];
};

const findAll = async (empresa_id) => {
  if (!empresa_id) {
    const [rows] = await db.execute('SELECT id, email, nome, role, empresa_id, created_at FROM admins ORDER BY id DESC');
    return rows;
  }
  const [rows] = await db.execute(
    'SELECT id, email, nome, role, empresa_id, created_at FROM admins WHERE empresa_id = ? ORDER BY id DESC',
    [empresa_id]
  );
  return rows;
};

const findById = async (id) => {
  const [rows] = await db.execute('SELECT id, email, nome, role, empresa_id FROM admins WHERE id = ?', [id]);
  return rows[0];
};

const create = async (email, passwordHash, empresa_id, role = 'operator', nome = null) => {
  await db.execute(
    'INSERT INTO admins (empresa_id, email, password, nome, role) VALUES (?, ?, ?, ?, ?)',
    [empresa_id, email, passwordHash, nome, role]
  );
};

const update = async (id, email, nome = null) => {
  await db.execute('UPDATE admins SET email = ?, nome = ? WHERE id = ?', [email, nome, id]);
};

const updatePassword = async (id, passwordHash) => {
  await db.execute("UPDATE admins SET password = ? WHERE id = ?", [passwordHash, id]);
};

const remove = async (id) => {
  await db.execute('DELETE FROM admins WHERE id = ?', [id]);
};

const getEmpresas = async (adminId, role) => {
  if (role === 'super_admin') {
    const [rows] = await db.execute(
      `SELECT id, nome, slug, cnpj, email, logo_url, 'owner' AS role
       FROM empresas
       WHERE ativo = 1
       ORDER BY nome`
    );
    return rows;
  }

  const [rows] = await db.execute(
    `SELECT e.id, e.nome, e.slug, e.cnpj, e.email, e.logo_url, ae.role
     FROM admin_empresas ae
     JOIN empresas e ON ae.empresa_id = e.id
     WHERE ae.admin_id = ? AND e.ativo = 1
     ORDER BY e.nome`,
    [adminId]
  );
  return rows;
};

module.exports = {
  findByEmail,
  findAll,
  findById,
  create,
  update,
  remove,
  updatePassword,
  getEmpresas,
};
