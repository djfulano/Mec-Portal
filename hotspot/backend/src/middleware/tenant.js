module.exports = (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Não autenticado' });

  if (user.role === 'super_admin') {
    // Super admin: usa header x-empresa-id, ou empresa_id do JWT (set via switchEmpresa)
    const empresaId = req.headers['x-empresa-id'] || req.query.empresa_id || user.empresa_id;
    req.empresa_id = empresaId ? parseInt(empresaId, 10) : null;
  } else {
    req.empresa_id = user.empresa_id;
  }

  if (!req.empresa_id && user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Empresa não identificada' });
  }

  next();
};
