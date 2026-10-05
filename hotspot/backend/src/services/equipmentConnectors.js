const connectors = {
  mikrotik: {
    name: "MikroTik RouterOS",
    capabilities: {
      captive: true,
      radius: true,
      accounting: true,
      rate_limit: true,
      session_timeout: true,
      nat_collection: "external",
    },
    login(device, username, password) {
      const gateway = device.end_hotspot || device.ip;
      if (!gateway || /\s/.test(gateway)) throw new Error("Gateway inválido.");
      const url = new URL(
        /^https?:\/\//i.test(gateway) ? gateway : "http://" + gateway,
      );
      if (url.username || url.password || url.search || url.hash)
        throw new Error("Gateway inválido.");
      return { action: url.origin + "/login", username, password };
    },
  },
};
function connector(device) {
  const c = connectors[device.fabricante || "mikrotik"];
  if (!c) throw new Error("Equipamento ainda não homologado.");
  return c;
}
module.exports = { connectors, connector };
