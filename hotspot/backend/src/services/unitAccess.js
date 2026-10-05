const db = require("../../db");
const fail = (status, message) => Object.assign(new Error(message), { status });
async function scope(req) {
  if (!req.empresa_id) throw fail(400, "Selecione uma empresa.");
  const [[admin]] = await db.query("SELECT role FROM admins WHERE id=?", [
    req.user.id,
  ]);
  if (!admin) throw fail(401, "Usuário não encontrado.");
  const [[link]] = await db.query(
    "SELECT role FROM admin_empresas WHERE admin_id=? AND empresa_id=?",
    [req.user.id, req.empresa_id],
  );
  const owner = admin.role === "super_admin" || link?.role === "owner";
  if (!owner && !link) throw fail(403, "Sem acesso à empresa.");
  const [units] = await db.query(
    "SELECT id FROM unidades WHERE empresa_id=?",
    [req.empresa_id],
  );
  return { all: true, owner, ids: units.map((u) => u.id) };
}
async function middleware(req, res, next) {
  try {
    req.unitScope = await scope(req);
    next();
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
}
function requireOwner(req) {
  if (!req.unitScope.owner)
    throw fail(403, "Esta configuração exige administrador da empresa.");
}
async function unit(req, id) {
  const [[u]] = await db.query(
    "SELECT id,empresa_id,nome,ativo FROM unidades WHERE id=? AND empresa_id=?",
    [id, req.empresa_id],
  );
  if (!u || (!req.unitScope.all && !req.unitScope.ids.includes(u.id)))
    throw fail(403, "Sem acesso à unidade.");
  return u;
}
async function portal(req, id) {
  const [[p]] = await db.query(
    "SELECT * FROM portais WHERE id=? AND empresa_id=?",
    [id, req.empresa_id],
  );
  if (!p) throw fail(404, "Portal não encontrado.");
  if (!req.unitScope.all) {
    const [links] = await db.query(
      "SELECT unidade_id FROM portal_unidades WHERE portal_id=?",
      [id],
    );
    const [devices] = await db.query(
      "SELECT unidade_id FROM mikrotiks WHERE portal_id=?",
      [id],
    );
    const ids = [...links, ...devices].map((x) => x.unidade_id);
    if (
      !ids.length
        ? p.created_by !== req.user.id
        : ids.some((x) => !req.unitScope.ids.includes(x))
    )
      throw fail(403, "Portal compartilhado fora das suas unidades.");
  }
  return p;
}
const filter = (req, column) =>
  req.unitScope.all
    ? { sql: "", params: [] }
    : {
        sql: ` AND ${column} IN (${req.unitScope.ids.map(() => "?").join(",") || "NULL"})`,
        params: req.unitScope.ids,
      };
async function audit(req, action, resource = "") {
  await db.query(
    "INSERT INTO access_audit(empresa_id,admin_id,acao,recurso) VALUES (?,?,?,?)",
    [req.empresa_id, req.user.id, action, String(resource)],
  );
}
module.exports = {
  fail,
  scope,
  middleware,
  requireOwner,
  unit,
  portal,
  filter,
  audit,
};
