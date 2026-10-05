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
const tenant = require('../middleware/tenant');
const checkPermissao = require('../middleware/checkPermissao');
const crypto = require('crypto');

// Multer para upload de logo
const uploadsDir = path.join(__dirname, '../../uploads/logos');
const fs = require('fs');
// Garantir que os diretórios existam
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
function receiveLogo(req, res, next) {
  upload.single('logo')(req, res, err => {
    if (err) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'O logo deve ter no máximo 2 MB.' : 'Não foi possível receber a imagem.' });
    next();
  });
}
async function saveLogo(req, res) {
  let filePath;
  try {
    if (!req.file) return res.status(400).json({ message: 'Selecione uma imagem.' });
    const id = req.empresa_id || Number(req.params.id);
    const [[empresa]] = await db.execute('SELECT id FROM empresas WHERE id = ?', [id]);
    if (!empresa) return res.status(404).json({ message: 'Empresa não encontrada.' });
    const b = req.file.buffer;
    let ext;
    if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ext = 'png';
    else if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) ext = 'jpg';
    else if (b.length >= 6 && /GIF8[79]a/.test(b.subarray(0,6).toString())) ext = 'gif';
    else if (b.length >= 12 && b.subarray(0,4).toString() === 'RIFF' && b.subarray(8,12).toString() === 'WEBP') ext = 'webp';
    if (!ext) return res.status(400).json({ message: 'Use uma imagem PNG, JPG, GIF ou WebP.' });
    const filename = `empresa-${id}-${crypto.randomUUID()}.${ext}`;
    filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, b, { mode: 0o644 });
    const logoUrl = `/api/empresas/logos/${filename}`;
    await db.execute('UPDATE empresas SET logo_url = ? WHERE id = ?', [logoUrl, id]);
    res.json({ logo_url: logoUrl });
  } catch (err) {
    if (filePath) fs.rmSync(filePath, { force: true });
    console.error('Erro ao salvar logo:', err.message);
    res.status(500).json({ message: 'Não foi possível salvar o logo.' });
  }
}
router.use('/logos', express.static(uploadsDir, { maxAge: '7d', dotfiles: 'deny', setHeaders: res => res.setHeader('X-Content-Type-Options', 'nosniff') }));
// Apenas informações visuais são públicas para a tela anterior ao login.
router.get('/public/:slug', async (req, res) => {
  try {
    const [[empresa]] = await db.execute('SELECT nome, slug, logo_url FROM empresas WHERE slug = ? AND ativo = 1', [req.params.slug]);
    res.setHeader('Cache-Control', 'no-store');
    if (!empresa) return res.status(404).json({ message: 'Empresa não encontrada.' });
    res.json(empresa);
  } catch (err) { res.status(500).json({ message: 'Não foi possível carregar o logo.' }); }
});
router.get('/branding', auth, tenant, checkPermissao('configuracoes'), async (req, res) => {
  try {
    const [[empresa]] = await db.execute('SELECT id, nome, slug, logo_url FROM empresas WHERE id = ?', [req.empresa_id]);
    if (!empresa) return res.status(404).json({ message: 'Empresa não encontrada.' });
    res.json(empresa);
  } catch (err) { res.status(500).json({ message: 'Não foi possível carregar a empresa.' }); }
});
router.put('/branding/logo', auth, tenant, checkPermissao('configuracoes'), receiveLogo, saveLogo);

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
router.post("/:id/logo", receiveLogo, saveLogo);

// Vinculação admin <-> empresa
router.get("/:id/admins", listarAdminsEmpresa);
router.post("/:id/vincular-admin", vincularAdmin);
router.delete("/:id/desvincular-admin/:adminId", desvincularAdmin);

module.exports = router;
