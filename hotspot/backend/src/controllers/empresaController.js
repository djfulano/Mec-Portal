const db = require("../../db");
const { DEFAULT_WHATSAPP_TEMPLATE, DEFAULT_PORTAL_PLANOS_CONFIG } = require("../constants/whatsappDefaults");

function gerarSlug(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

exports.listarEmpresas = async (req, res) => {
  try {
    const [empresas] = await db.query(`
      SELECT e.*,
        (SELECT COUNT(*) FROM admins WHERE empresa_id = e.id) AS total_admins,
        (SELECT COUNT(*) FROM mikrotiks WHERE empresa_id = e.id) AS total_mikrotiks,
        (SELECT COUNT(*) FROM planos WHERE empresa_id = e.id) AS total_planos
      FROM empresas e
      ORDER BY e.criado_em DESC
    `);
    res.json(empresas);
  } catch (err) {
    console.error("Erro ao listar empresas:", err);
    res.status(500).json({ message: "Erro ao listar empresas" });
  }
};

exports.criarEmpresa = async (req, res) => {
  try {
    const { nome, cnpj, email, telefone } = req.body;
    if (!nome || !email) {
      return res.status(400).json({ message: "Nome e email são obrigatórios" });
    }

    let slug = gerarSlug(nome);

    // Garantir slug único
    const [[existing]] = await db.execute('SELECT id FROM empresas WHERE slug = ?', [slug]);
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const [result] = await db.execute(
      `INSERT INTO empresas (nome, slug, cnpj, email, telefone) VALUES (?, ?, ?, ?, ?)`,
      [nome, slug, cnpj || null, email, telefone || null]
    );

    const empresaId = result.insertId;

    // Auto-criar portais padrao para a nova empresa.
    // O portal 'planos' ja vem com configuracoes padrao (PIX + Cartao ativos +
    // trial de 5min habilitado). Os outros 4 nao usam essas configuracoes.
    // Todos vem com template WhatsApp preenchido pra disparar ao liberar acesso.
    const planosConfigJson = JSON.stringify(DEFAULT_PORTAL_PLANOS_CONFIG);
    await db.execute(
      `INSERT INTO portais (empresa_id, nome, slug, tipo, url_redirect, ativo, whatsapp_template, configuracoes) VALUES
       (?, 'LGPD - Coleta de Dados', 'lgpd', 'lgpd', '/cadastro', 1, ?, NULL),
       (?, 'Planos - Pagamento', 'planos', 'planos', '/planos-cliente', 1, ?, ?),
       (?, 'Cadastro de LEAD', 'lead', 'lead', '/lead', 1, ?, NULL),
       (?, 'Cadastro de LEAD (Sem Internet)', 'lead-passivo', 'lead_passivo', '/lead-passivo', 1, ?, NULL),
       (?, 'Acesso Wi-Fi', 'login', 'login', '/login-hotspot', 1, ?, NULL)`,
      [
        empresaId, DEFAULT_WHATSAPP_TEMPLATE,
        empresaId, DEFAULT_WHATSAPP_TEMPLATE, planosConfigJson,
        empresaId, DEFAULT_WHATSAPP_TEMPLATE,
        empresaId, DEFAULT_WHATSAPP_TEMPLATE,
        empresaId, DEFAULT_WHATSAPP_TEMPLATE,
      ]
    );

    res.status(201).json({ id: empresaId, nome, slug, email });
  } catch (err) {
    console.error("Erro ao criar empresa:", err);
    res.status(500).json({ message: "Erro ao criar empresa" });
  }
};

exports.atualizarEmpresa = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, cnpj, email, telefone, logo_url, ativo } = req.body;

    await db.execute(
      `UPDATE empresas SET nome = ?, cnpj = ?, email = ?, telefone = ?, logo_url = ?, ativo = ? WHERE id = ?`,
      [nome, cnpj || null, email, telefone || null, logo_url || null, ativo !== undefined ? ativo : 1, id]
    );

    res.json({ message: "Empresa atualizada" });
  } catch (err) {
    console.error("Erro ao atualizar empresa:", err);
    res.status(500).json({ message: "Erro ao atualizar empresa" });
  }
};

exports.deletarEmpresa = async (req, res) => {
  try {
    const { id } = req.params;

    // Não permitir deletar empresa padrão
    const [[empresa]] = await db.execute('SELECT slug FROM empresas WHERE id = ?', [id]);
    if (empresa && empresa.slug === 'default') {
      return res.status(400).json({ message: "Não é possível deletar a empresa padrão" });
    }

    await db.execute('DELETE FROM empresas WHERE id = ?', [id]);
    res.json({ message: "Empresa deletada" });
  } catch (err) {
    console.error("Erro ao deletar empresa:", err);
    res.status(500).json({ message: "Erro ao deletar empresa" });
  }
};

exports.obterEmpresa = async (req, res) => {
  try {
    const { id } = req.params;
    const [[empresa]] = await db.execute('SELECT * FROM empresas WHERE id = ?', [id]);
    if (!empresa) {
      return res.status(404).json({ message: "Empresa não encontrada" });
    }
    res.json(empresa);
  } catch (err) {
    console.error("Erro ao obter empresa:", err);
    res.status(500).json({ message: "Erro ao obter empresa" });
  }
};

exports.listarAdminsEmpresa = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT a.id, a.email, a.nome, a.role AS role_global, ae.role AS role_empresa, ae.criado_em
       FROM admin_empresas ae
       JOIN admins a ON ae.admin_id = a.id
       WHERE ae.empresa_id = ?
       ORDER BY a.nome`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar admins da empresa:", err);
    res.status(500).json({ message: "Erro ao listar admins" });
  }
};

exports.vincularAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_id, role } = req.body;

    if (!admin_id) return res.status(400).json({ message: "admin_id obrigatório" });

    await db.execute(
      `INSERT INTO admin_empresas (admin_id, empresa_id, role) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [admin_id, id, role || 'operator']
    );

    res.json({ message: "Admin vinculado com sucesso" });
  } catch (err) {
    console.error("Erro ao vincular admin:", err);
    res.status(500).json({ message: "Erro ao vincular admin" });
  }
};

exports.desvincularAdmin = async (req, res) => {
  try {
    const { id, adminId } = req.params;

    const [result] = await db.execute(
      'DELETE FROM admin_empresas WHERE admin_id = ? AND empresa_id = ?',
      [adminId, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Vínculo não encontrado" });
    }

    res.json({ message: "Admin desvinculado" });
  } catch (err) {
    console.error("Erro ao desvincular admin:", err);
    res.status(500).json({ message: "Erro ao desvincular admin" });
  }
};

exports.listarTodosAdmins = async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, email, nome, role FROM admins ORDER BY nome'
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar admins:", err);
    res.status(500).json({ message: "Erro ao listar admins" });
  }
};

