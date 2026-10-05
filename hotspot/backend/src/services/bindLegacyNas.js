const db = require("../../db");
module.exports = async (username, deviceId, companyId) => {
  const [[device]] = await db.query(
    "SELECT ip FROM mikrotiks WHERE id=? AND empresa_id=?",
    [deviceId, companyId],
  );
  if (!device) throw new Error("Equipamento não pertence à empresa.");
  await db.query(
    "DELETE FROM radcheck WHERE username=? AND attribute='NAS-IP-Address'",
    [username],
  );
  await db.query(
    "INSERT INTO radcheck(username,attribute,op,value) VALUES (?,'NAS-IP-Address','==',?)",
    [username, device.ip],
  );
};
