// src/routes/complianceRoutes.js
const express = require("express");
const router = express.Router();
const { buscarLogs, exportarCSV } = require("../controllers/complianceController");

router.get("/", buscarLogs);
router.get("/export", exportarCSV);

module.exports = router;
