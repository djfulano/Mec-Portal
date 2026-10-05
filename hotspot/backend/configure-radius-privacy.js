// Apply only the additive Mec Portal policy and redact passwords in SQL auth logs.
const fs = require("fs"),
  path = require("path"),
  { spawnSync } = require("child_process");
const base = process.env.MEC_RADIUS_CONFIG_DIR || "/etc/freeradius/3.0";
const checkOnly = !!process.env.MEC_RADIUS_CONFIG_DIR;
const backup = process.argv[2];
if (!backup || !fs.existsSync(backup))
  throw new Error("Informe diretório de backup existente.");
const files = [
  path.join(base, "mods-config/sql/main/mysql/queries.conf"),
  path.join(base, "sites-available/default"),
  path.join(base, "policy.d/mec_portal"),
];
const originals = files.map((file) =>
  fs.existsSync(file) ? fs.readFileSync(file) : null,
);
for (let i = 0; i < files.length; i++)
  if (originals[i])
    fs.writeFileSync(path.join(backup, "radius-" + i + ".conf"), originals[i], {
      mode: 0o600,
    });
try {
  if (!originals[0] || !originals[1])
    throw new Error("Configuração RADIUS ausente.");
  fs.writeFileSync(
    files[0],
    originals[0]
      .toString()
      .replaceAll("%{%{User-Password}:-%{Chap-Password}}", ""),
  );
  const marker = "        mec_portal";
  let site = originals[1].toString();
  if (!site.includes("mec_portal")) {
    const pos = site.indexOf("authorize {");
    if (pos < 0) throw new Error("Seção authorize não encontrada.");
    const rest = site.slice(pos);
    const match = rest.match(/(^[ \t]*-?sql[ \t]*$)/m);
    if (!match) throw new Error("SQL não encontrado em authorize.");
    const at = pos + match.index + match[0].length;
    site = site.slice(0, at) + "\n" + marker + site.slice(at);
  }
  fs.writeFileSync(files[1], site);
  fs.writeFileSync(
    files[2],
    `mec_portal {
 if ("%{sql:SELECT COUNT(*) FROM mikrotiks m JOIN portais p ON p.id=m.portal_id WHERE m.ip='%{NAS-IP-Address}' AND p.managed=1}" != "0") {
  if ("%{sql:SELECT COUNT(*) FROM access_grants g JOIN mikrotiks m ON m.id=g.equipamento_id WHERE g.username='%{SQL-User-Name}' AND m.ip='%{NAS-IP-Address}' AND g.expires_at>NOW()}" != "1") {
   reject
  }
 }
}\n`,
  );
  const check = spawnSync("freeradius", ["-d", base, "-C"], {
    stdio: "pipe",
    timeout: 20000,
  });
  if (check.status !== 0) {
    const detail = String(check.stderr || "")
      .split("\n")
      .filter((l) => !/(password|secret|token|key)/i.test(l))
      .slice(-8)
      .join("\n");
    throw new Error(
      "Validação RADIUS falhou; configuração anterior restaurada. " + detail,
    );
  }
  if (checkOnly) {
    console.log("Configuração RADIUS validada em cópia isolada.");
    process.exit(0);
  }
  const restart = spawnSync("systemctl", ["restart", "freeradius"], {
    stdio: "pipe",
    timeout: 20000,
  });
  if (restart.status !== 0)
    throw new Error(
      "Reinício RADIUS falhou; configuração anterior restaurada.",
    );
  console.log("RADIUS: política de portais e proteção de senhas aplicadas.");
} catch (e) {
  for (let i = 0; i < files.length; i++) {
    if (originals[i]) fs.writeFileSync(files[i], originals[i]);
    else if (fs.existsSync(files[i])) fs.unlinkSync(files[i]);
  }
  if (!checkOnly)
    spawnSync("systemctl", ["restart", "freeradius"], {
      stdio: "pipe",
      timeout: 20000,
    });
  console.error(e.message);
  process.exitCode = 1;
}
