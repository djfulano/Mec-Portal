const db = require("../../db");
module.exports = async (req, res, next) => {
  try {
    const id = req.body?.mikrotik_id || req.query?.mikrotik_id;
    let portal;
    if (id) {
      const [[r]] = await db.query(
        "SELECT p.managed FROM mikrotiks m JOIN portais p ON p.id=m.portal_id WHERE m.id=?",
        [id],
      );
      portal = r;
    }
    if (req.body?.plano_id) {
      const [[r]] = await db.query(
        "SELECT p.managed FROM planos pl JOIN mikrotiks m ON m.id=pl.mikrotik_id JOIN portais p ON p.id=m.portal_id WHERE pl.id=?",
        [req.body.plano_id],
      );
      if (r?.managed) portal = r;
    }
    if (portal?.managed && req.method === "POST")
      return res
        .status(409)
        .json({
          message:
            "Este equipamento utiliza o novo portal. Acesse pela página Wi-Fi publicada.",
        });
    next();
  } catch (e) {
    res.status(500).json({ message: "Não foi possível verificar o portal." });
  }
};
