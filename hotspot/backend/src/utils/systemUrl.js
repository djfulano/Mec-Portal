// SYSTEM_URL includes the protocol and port for local installations.
function systemUrl(host) {
  return (process.env.SYSTEM_URL || `https://${process.env.SYSTEM_DOMAIN || host}`).replace(/\/$/, '');
}
module.exports = systemUrl;
