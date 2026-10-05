const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const multer = require("multer");
const path = require("path");
const {
  listarEmpresas,
  criarEmpresa,
  atualizarEmpresa,
  deletarEmpresa,
  obterEmpresa,
  listarAdminsEmpresa,
  vincularAdmin,
  desvincularAdmin,
  listarTodosAdmins
} = require("../controllers/empresaController");
const db = require("../../db");

// Multer para upload de logo
const uploadsDir = path.join(__dirname, '../../../frontend/dist/uploads/logos');
const publicUploadsDir = path.join(__dirname, '../../../frontend/public/uploads/logos');
const fs = require('fs');
// Garantir que os diretórios existam
[uploadsDir, publicUploadsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `empresa-${req.params.id}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (/^image\/(jpeg|png|gif|webp|svg\+xml)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Apenas imagens são permitidas'));
}});

// Rota com auth (não precisa ser super_admin): buscar empresa por slug (sidebar)
router.get("/by-slug/:slug", auth, async (req, res) => {
  try {
    const [[empresa]] = await db.execute('SELECT id, nome, slug, logo_url FROM empresas WHERE slug = ?', [req.params.slug]);
    if (!empresa) return res.status(404).json({ message: "Empresa não encontrada" });
    res.json(empresa);
  } catch (err) {
    res.status(500).json({ message: "Erro" });
  }
});

// Todas as rotas abaixo requerem super_admin
router.use(auth, authorize('super_admin'));

router.get("/", listarEmpresas);
router.post("/", criarEmpresa);
router.get("/admins/todos", listarTodosAdmins);
router.get("/:id", obterEmpresa);
router.put("/:id", atualizarEmpresa);
router.delete("/:id", deletarEmpresa);

// Upload de logo
router.post("/:id/logo", upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Nenhum arquivo enviado" });
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    // Copiar para public/ (persistência entre builds)
    fs.copyFileSync(req.file.path, path.join(publicUploadsDir, req.file.filename));
    await db.execute('UPDATE empresas SET logo_url = ? WHERE id = ?', [logoUrl, req.params.id]);
    res.json({ logo_url: logoUrl });
  } catch (err) {
    console.error('Erro upload logo:', err);
    res.status(500).json({ message: "Erro ao fazer upload" });
  }
});

// Vinculação admin <-> empresa
router.get("/:id/admins", listarAdminsEmpresa);
router.post("/:id/vincular-admin", vincularAdmin);
router.delete("/:id/desvincular-admin/:adminId", desvincularAdmin);

module.exports = router;
