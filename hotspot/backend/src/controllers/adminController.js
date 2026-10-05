const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");

const listarAdmins = async (req, res) => {
  if (req.baseUrl === '/api/global-admins') return res.json(await Admin.findAll(null));
  if (!req.empresa_id) return res.status(400).json({ message: 'Selecione uma empresa.' });
  const admins = await Admin.findAll(req.empresa_id);
  res.json(admins);
};

const criarAdmin = async (req, res) => {
  const { senha, nome, role } = req.body;
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  if (!email || !senha) {
    return res.status(400).json({ message: "Email e senha são obrigatórios" });
  }

  // Apenas owner e super_admin podem criar admins
  const allowedRole = role || 'operator';
  if (!['operator', 'manager', 'owner', 'super_admin'].includes(allowedRole)) return res.status(400).json({ message: 'Perfil inválido.' });
  if (!['super_admin', 'owner'].includes(req.user.role)) return res.status(403).json({ message: 'Sem permissão para cadastrar usuários.' });
  if (allowedRole === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ message: "Apenas super admin pode criar super admins" });
  }

  try {
    const global = req.baseUrl === '/api/global-admins';
    const empresaId = allowedRole === 'super_admin' ? null : global ? Number(req.body.empresa_id) : req.empresa_id;
    if (allowedRole !== 'super_admin') {
      if (!empresaId) return res.status(400).json({ message: 'Selecione a empresa do usuário.' });
      const db = require('../../db');
      const [[empresa]] = await db.execute('SELECT id FROM empresas WHERE id = ? AND ativo = 1', [empresaId]);
      if (!empresa) return res.status(400).json({ message: 'Empresa inválida ou inativa.' });
    }
    const hash = await bcrypt.hash(senha, 10);
    await Admin.create(email, hash, empresaId, allowedRole, nome || null);
    res.status(201).json({ message: "Administrador criado com sucesso" });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Este email já está cadastrado.' });
    console.error("Erro ao criar admin:", err);
    res.status(500).json({ message: "Erro interno ao criar administrador" });
  }
};

const atualizarAdmin = async (req, res) => {
  const { id } = req.params;
  const { email, senha, nome } = req.body;

  if (!email) return res.status(400).json({ message: "Email é obrigatório" });
  if (!await canManage(req, id)) return res.status(403).json({ message: 'Sem permissão para alterar este usuário.' });

  await Admin.update(id, email, nome || null);

  if (senha) {
    const hash = await bcrypt.hash(senha, 10);
    await Admin.updatePassword(id, hash);
  }

  res.json({ message: "Administrador atualizado com sucesso" });
};

const deletarAdmin = async (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.user.id) return res.status(400).json({ message: 'Você não pode excluir seu próprio usuário.' });
  if (!await canManage(req, id)) return res.status(403).json({ message: 'Sem permissão para excluir este usuário.' });
  await Admin.remove(id);
  res.json({ message: "Administrador removido com sucesso" });
};

async function canManage(req, id) {
  const admin = await Admin.findById(id);
  if (!admin) return false;
  if (req.user.role === 'super_admin') return true;
  return req.user.role === 'owner' && admin.role !== 'super_admin' && admin.empresa_id === req.empresa_id;
}

module.exports = {
  listarAdmins,
  criarAdmin,
  atualizarAdmin,
  deletarAdmin,
};
