const db = require("../../db");

/**
 * Verifica se já existe um lead com o CPF informado para a empresa.
 * @param {string} cpf - CPF (pode ter máscara)
 * @param {number|null} empresaId
 * @returns {Object|null} lead existente ou null
 */
async function verificarLeadExistente(cpf, empresaId) {
  if (!cpf) return null;
  const cpfLimpo = cpf.replace(/\D/g, "");
  if (cpfLimpo.length < 11) return null;

  let query = "SELECT id, nome, email, telefone, cpf, origem, criado_em FROM leads WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ?";
  const params = [cpfLimpo];

  if (empresaId) {
    query += " AND empresa_id = ?";
    params.push(empresaId);
  }

  query += " ORDER BY criado_em DESC LIMIT 1";
  const [[existing]] = await db.execute(query, params);
  return existing || null;
}

module.exports = { verificarLeadExistente };
