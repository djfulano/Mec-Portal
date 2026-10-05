const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");

const listarAdmins = async (req, res) => {
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
  if (!req.empresa_id) return res.status(400).json({ message: 'Selecione uma empresa antes de criar o administrador.' });
  if (allowedRole === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ message: "Apenas super admin pode criar super admins" });
  }

  try {
    const hash = await bcrypt.hash(senha, 10);
    await Admin.create(email, hash, req.empresa_id, allowedRole, nome || null);
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

  await Admin.update(id, email, nome || null);

  if (senha) {
    const hash = await bcrypt.hash(senha, 10);
    await Admin.updatePassword(id, hash);
  }

  res.json({ message: "Administrador atualizado com sucesso" });
};

const deletarAdmin = async (req, res) => {
  const { id } = req.params;
  await Admin.remove(id);
  res.json({ message: "Administrador removido com sucesso" });
};

module.exports = {
  listarAdmins,
  criarAdmin,
  atualizarAdmin,
  deletarAdmin,
};
