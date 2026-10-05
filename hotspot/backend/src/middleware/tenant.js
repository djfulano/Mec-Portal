module.exports = async (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  if (user.role === "super_admin") {
    // Super admin: usa header x-empresa-id, ou empresa_id do JWT (set via switchEmpresa)
    const empresaId =
      req.headers["x-empresa-id"] || req.query.empresa_id || user.empresa_id;
    req.empresa_id = empresaId ? parseInt(empresaId, 10) : null;
  } else {
    req.empresa_id = user.empresa_id;
  }

  if (!req.empresa_id && user.role !== "super_admin") {
    return res.status(403).json({ error: "Empresa não identificada" });
  }

  try {
    // Unit users use scoped workspace APIs; legacy company-wide APIs are owner-only.
    const access = require("../services/unitAccess");
    req.unitScope = await access.scope(req);
    if (
      !req.unitScope.all &&
      req.baseUrl !== "/api/workspace" &&
      !(
        req.baseUrl === "/api/empresas" &&
        req.path === "/branding" &&
        req.method === "GET"
      )
    ) {
      return res
        .status(403)
        .json({
          error:
            "Use o painel de unidades para acessar os recursos autorizados.",
        });
    }
    next();
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ error: err.status ? err.message : "Erro ao verificar acesso." });
  }
};
