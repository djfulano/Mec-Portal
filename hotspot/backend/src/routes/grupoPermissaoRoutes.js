const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const {
  listarGrupos,
  obterGrupo,
  criarGrupo,
  atualizarGrupo,
  deletarGrupo,
  listarAdminsGrupo,
  vincularAdmin,
  desvincularAdmin,
  obterPermissoesAdmin,
  listarModulos,
} = require("../controllers/grupoPermissaoController");
const { listarTodosAdmins } = require("../controllers/empresaController");

// Todas requerem super_admin ou owner
router.use(auth, authorize("super_admin", "owner"));
router.use(async (req, res, next) => {
  if (req.user.role === "super_admin") return next();
  try {
    const db = require("../../db");
    const match = req.path.match(/^\/(\d+)/);
    if (match) {
      const [[g]] = await db.query(
        "SELECT id FROM grupos_permissao WHERE id=? AND empresa_id=?",
        [match[1], req.user.empresa_id],
      );
      if (!g)
        return res.status(403).json({ message: "Grupo fora da empresa." });
    }
    const id =
      req.body?.admin_id ||
      req.path.match(/\/(?:admin|desvincular-admin)\/(\d+)/)?.[1];
    if (id) {
      const [[a]] = await db.query(
        "SELECT id FROM admins WHERE id=? AND empresa_id=? AND role<>'super_admin'",
        [id, req.user.empresa_id],
      );
      if (!a)
        return res.status(403).json({ message: "Usuário fora da empresa." });
    }
    next();
  } catch (e) {
    res.status(500).json({ message: "Erro ao verificar permissões." });
  }
});

router.get("/modulos", listarModulos);
router.get("/", listarGrupos);
router.post("/", criarGrupo);
router.get("/admins/todos", listarTodosAdmins);
router.get("/admin/:adminId/permissoes", obterPermissoesAdmin);
router.get("/:id", obterGrupo);
router.put("/:id", atualizarGrupo);
router.delete("/:id", deletarGrupo);
router.get("/:id/admins", listarAdminsGrupo);
router.post("/:id/vincular-admin", vincularAdmin);
router.delete("/:id/desvincular-admin/:adminId", desvincularAdmin);

module.exports = router;
