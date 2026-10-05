const express = require("express");
const multer = require("multer");
const path = require("path");
const { getConfig, saveConfig } = require("../models/EfiConfig");
const router = express.Router();

const upload = multer({ dest: "certificados/" });

router.get("/", async (req, res) => {
  const config = await getConfig(req.empresa_id);
  res.json(config || {});
});

router.post("/", upload.single("certificado"), async (req, res) => {
  try {
    const { client_id, client_secret, chave_pix, ambiente } = req.body;
    const certificado_nome = req.file?.filename;
    await saveConfig({ client_id, client_secret, chave_pix, ambiente, certificado_nome }, req.empresa_id);
    res.json({ message: "Configuração salva com sucesso." });
  } catch (err) {
    console.error("Erro ao salvar config da Efí:", err);
    res.status(500).json({ message: "Erro ao salvar configuração." });
  }
});

module.exports = router;
