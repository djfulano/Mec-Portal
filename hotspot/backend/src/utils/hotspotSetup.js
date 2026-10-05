const systemUrl = require('./systemUrl');
const { RouterOSAPI } = require("node-routeros");

/**
 * Configura hotspot completo no MikroTik via API com streaming de steps.
 * Cada step é enviado em tempo real via callback onStep(step).
 *
 * Etapas:
 * 1. IP na interface
 * 2. Pool de IPs
 * 3. DHCP server + network
 * 4. Hotspot profile (com RADIUS)
 * 5. Hotspot server
 * 6. RADIUS client
 * 7. Walled garden
 * 8. Masquerade (NAT)
 * 9. Login page (download via /tool/fetch)
 */
async function configurarHotspot(mikrotik, portal, systemDomain, config = {}, empresa = {}, onStep = null) {
  const conn = new RouterOSAPI({
    host: mikrotik.ip,
    user: mikrotik.usuario,
    password: mikrotik.senha,
    port: mikrotik.porta || 8728,
    keepalive: false,
    timeout: 30000,
  });

  const steps = [];
  const ifName = config.interface || "ether2";
  const localAddress = config.localAddress || "10.5.50.1/24";
  const poolName = config.poolName || "hs-pool";
  const poolRange = config.poolRange || "10.5.50.2-10.5.50.254";
  const dnsName = config.dnsName || "";
  const radiusServerIp = config.radiusServerIp || "10.8.0.1";
  const radiusSecret = config.radiusSecret || mikrotik.senha;

  const gateway = localAddress.split("/")[0];
  const mask = localAddress.split("/")[1] || "24";
  const ipParts = gateway.split(".");
  const network = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.0/${mask}`;

  const PRINT_TIMEOUT = 3000;
  const WRITE_TIMEOUT = 10000;

  const safePrint = async (path) => {
    return Promise.race([
      conn.write(path).then(r => Array.isArray(r) ? r : []).catch(e => {
        if (e.errno === "UNKNOWNREPLY" || (e.message && e.message.includes("!empty"))) return [];
        throw e;
      }),
      new Promise(resolve => setTimeout(() => resolve([]), PRINT_TIMEOUT))
    ]);
  };

  const safeWrite = async (path, args) => {
    return Promise.race([
      conn.write(path, args).catch(e => {
        if (e.errno === "UNKNOWNREPLY") return "ok";
        if (e.message && e.message.includes("already")) return "exists";
        throw e;
      }),
      new Promise(resolve => setTimeout(() => resolve("timeout"), WRITE_TIMEOUT))
    ]);
  };

  const addStep = (name, status, message) => {
    const step = { step: name, status, message, timestamp: new Date().toISOString() };
    steps.push(step);
    console.log(`[hotspot] ${status}: ${message}`);
    if (onStep) onStep(step);
  };

  try {
    await conn.connect();
    addStep("conexao", "ok", `Conectado a ${mikrotik.ip}`);

    // === 1. IP na interface ===
    try {
      const addresses = await safePrint("/ip/address/print");
      const hasAddr = addresses && addresses.find(a => a.interface === ifName);
      if (!hasAddr) {
        await safeWrite("/ip/address/add", [`=address=${localAddress}`, `=interface=${ifName}`]);
        addStep("ip", "ok", `IP ${localAddress} atribuido a ${ifName}`);
      } else {
        addStep("ip", "ok", `${ifName} ja tem IP: ${hasAddr.address}`);
      }
    } catch (e) {
      addStep("ip", "aviso", e.message);
    }

    // === 2. Pool ===
    try {
      const pools = await safePrint("/ip/pool/print");
      const exists = pools && pools.find(p => p.name === poolName);
      if (!exists) {
        await safeWrite("/ip/pool/add", [`=name=${poolName}`, `=ranges=${poolRange}`]);
        addStep("pool", "ok", `Pool ${poolName} criado (${poolRange})`);
      } else {
        addStep("pool", "ok", `Pool ${poolName} existe`);
      }
    } catch (e) {
      addStep("pool", "aviso", e.message);
    }

    // === 3. DHCP Server + Network ===
    try {
      const nets = await safePrint("/ip/dhcp-server/network/print");
      const netExists = nets && nets.find(n => n.address === network);
      if (!netExists) {
        await safeWrite("/ip/dhcp-server/network/add", [
          `=address=${network}`,
          `=gateway=${gateway}`,
          `=dns-server=8.8.8.8`,
        ]);
      }

      const dhcps = await safePrint("/ip/dhcp-server/print");
      const dhcpExists = dhcps && dhcps.find(d => d.interface === ifName);
      if (!dhcpExists) {
        await safeWrite("/ip/dhcp-server/add", [
          `=name=dhcp-hotspot`,
          `=interface=${ifName}`,
          `=address-pool=${poolName}`,
          `=disabled=no`,
        ]);
        addStep("dhcp", "ok", `DHCP server criado em ${ifName}`);
      } else {
        addStep("dhcp", "ok", `DHCP ja existe em ${ifName}`);
      }
    } catch (e) {
      addStep("dhcp", "aviso", e.message);
    }

    // === 4. Hotspot Profile ===
    try {
      const profiles = await safePrint("/ip/hotspot/profile/print");
      const prof = profiles && profiles.find(p => p.name === "hsprof-hotspot");
      const profArgs = [
        "=login-by=http-chap,http-pap",
        "=use-radius=yes",
        "=radius-accounting=yes",
        "=html-directory=hotspot",
        ...(dnsName ? [`=dns-name=${dnsName}`] : []),
      ];

      if (prof) {
        await safeWrite("/ip/hotspot/profile/set", [`=.id=${prof[".id"]}`, ...profArgs]);
        addStep("profile", "ok", "Profile atualizado (RADIUS habilitado)");
      } else {
        await safeWrite("/ip/hotspot/profile/add", ["=name=hsprof-hotspot", ...profArgs]);
        addStep("profile", "ok", "Profile hsprof-hotspot criado");
      }
    } catch (e) {
      addStep("profile", "aviso", e.message);
    }

    // === 5. Hotspot Server ===
    try {
      const servers = await safePrint("/ip/hotspot/print");
      const hs = servers && servers.find(s => s.name === "hotspot1");
      if (hs) {
        await safeWrite("/ip/hotspot/set", [
          `=.id=${hs[".id"]}`,
          `=interface=${ifName}`,
          `=address-pool=${poolName}`,
          "=profile=hsprof-hotspot",
          "=disabled=no",
        ]);
        addStep("hotspot", "ok", "Hotspot server atualizado");
      } else {
        await safeWrite("/ip/hotspot/add", [
          "=name=hotspot1",
          `=interface=${ifName}`,
          `=address-pool=${poolName}`,
          "=profile=hsprof-hotspot",
          "=disabled=no",
        ]);
        addStep("hotspot", "ok", "Hotspot server criado");
      }
    } catch (e) {
      addStep("hotspot", "aviso", e.message);
    }

    // === 6. RADIUS Client ===
    try {
      const radiusList = await safePrint("/radius/print");
      const existing = radiusList && radiusList.find(r => r.service && r.service.includes("hotspot"));
      const radiusArgs = [
        `=address=${radiusServerIp}`,
        `=secret=${radiusSecret}`,
        "=service=hotspot",
        "=authentication-port=1812",
        "=accounting-port=1813",
      ];

      if (existing) {
        await safeWrite("/radius/set", [`=.id=${existing[".id"]}`, ...radiusArgs]);
        addStep("radius", "ok", `RADIUS atualizado (${radiusServerIp})`);
      } else {
        await safeWrite("/radius/add", radiusArgs);
        addStep("radius", "ok", `RADIUS criado (${radiusServerIp})`);
      }

      await safeWrite("/radius/incoming/set", ["=accept=yes", "=port=3799"]);
    } catch (e) {
      addStep("radius", "aviso", e.message);
    }

    // === 7. Walled Garden ===
    if (systemDomain) {
      try {
        const wg = await safePrint("/ip/hotspot/walled-garden/print");
        const exists = wg && wg.find(w => w["dst-host"] && w["dst-host"].includes(systemDomain));
        if (!exists) {
          await safeWrite("/ip/hotspot/walled-garden/add", [
            `=dst-host=*${systemDomain}*`,
            "=action=allow",
          ]);
          addStep("walled_garden", "ok", `Dominio liberado: ${systemDomain}`);
        } else {
          addStep("walled_garden", "ok", `Walled garden ja tem ${systemDomain}`);
        }
        // Dominios do Mercado Pago SDK (necessario para pagamento com cartao)
        // www.mercadopago.com hospeda o security.js (device fingerprint anti-fraude).
        // Sem ele o window.MP_DEVICE_SESSION_ID nao popula e o MP rejeita cartao como high_risk.
        const mpDomains = ["www.mercadopago.com", "sdk.mercadopago.com", "api.mercadopago.com", "http2.mlstatic.com", "secure-fields.mercadopago.com", "api-static.mercadopago.com", "api.mercadolibre.com"];
        for (const domain of mpDomains) {
          const mpExists = wg && wg.find(w => w["dst-host"] && w["dst-host"].includes(domain));
          if (!mpExists) {
            await safeWrite("/ip/hotspot/walled-garden/add", [
              `=dst-host=*${domain}*`,
              "=action=allow",
            ]);
          }
        }
        addStep("walled_garden_mp", "ok", "Dominios Mercado Pago SDK liberados");
      } catch (e) {
        addStep("walled_garden", "aviso", e.message);
      }
    }

    // === 8. Masquerade (NAT) ===
    try {
      const natRules = await safePrint("/ip/firewall/nat/print");
      const hasMasquerade = natRules && natRules.find(r =>
        r.chain === "srcnat" && r.action === "masquerade" && r["src-address"] === network
      );
      if (!hasMasquerade) {
        await safeWrite("/ip/firewall/nat/add", [
          "=chain=srcnat",
          `=src-address=${network}`,
          "=action=masquerade",
          `=comment=hotspot-masquerade`,
        ]);
        addStep("masquerade", "ok", `NAT masquerade criado para ${network}`);
      } else {
        addStep("masquerade", "ok", `Masquerade ja existe para ${network}`);
      }
    } catch (e) {
      addStep("masquerade", "aviso", e.message);
    }

    // === 9. Login Page (download via /tool/fetch) ===
    try {
      const empresaId = empresa.id || mikrotik.empresa_id || '';
      const empresaSlug = empresa.slug || 'default';
      const fetchUrl = `${systemUrl(systemDomain)}/api/hotspot-login/${mikrotik.id}`;

      let ok = false;

      try {
        const r = await safeWrite("/tool/fetch", [
          `=url=${fetchUrl}`,
          "=dst-path=hotspot/login.html",
          `=mode=${new URL(systemUrl(systemDomain)).protocol.slice(0, -1)}`,
          "=check-certificate=no",
        ]);
        if (r !== "timeout") {
          addStep("login_page", "ok", "login.html baixado (HTTPS)");
          ok = true;
        }
      } catch (e) { /* tenta HTTP */ }

      if (!ok) {
        try {
          const r = await safeWrite("/tool/fetch", [
            `=url=http://${systemDomain}/api/hotspot-login/${mikrotik.id}`,
            "=dst-path=hotspot/login.html",
            "=mode=http",
          ]);
          if (r !== "timeout") {
            addStep("login_page", "ok", "login.html baixado (HTTP)");
            ok = true;
          }
        } catch (e) { /* fallback manual */ }
      }

      if (!ok) {
        const fullUrl = `${systemUrl(systemDomain)}/hotspot/redirect/${mikrotik.id}?mac=$(mac)&ip=$(ip)&mikrotik_id=${mikrotik.id}&empresa_id=${empresaId}&empresa=${empresaSlug}`;
        addStep("login_page", "aviso",
          `Nao conseguiu baixar automaticamente. Substitua hotspot/login.html manualmente com redirect para: ${fullUrl}`
        );
      }
    } catch (e) {
      addStep("login_page", "aviso", e.message);
    }

    try { await conn.close(); } catch (e) {}
    addStep("finalizado", "ok", "Configuracao concluida!");

    const hasErrors = steps.some(s => s.status === "erro");
    return { success: !hasErrors, steps, log: steps.map(s => `[${s.status}] ${s.message}`) };
  } catch (err) {
    addStep("fatal", "erro", err.message);
    try { await conn.close(); } catch (e) {}
    return { success: false, steps, log: steps.map(s => `[${s.status}] ${s.message}`), error: err.message };
  }
}

module.exports = { configurarHotspot };
