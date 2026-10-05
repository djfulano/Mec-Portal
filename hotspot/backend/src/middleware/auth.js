const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization
  // Fallback: aceitar token via query param (ex: preview de portal em nova aba)
  const token = authHeader
    ? authHeader.split(' ')[1]
    : req.query.token || null;

  if (!token) return res.status(401).json({ error: 'Token não fornecido' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (decoded.kind || !Number.isSafeInteger(Number(decoded.id)) || Number(decoded.id) < 1 || !['super_admin','owner','manager','operator'].includes(decoded.role)) {
      return res.status(401).json({ error: 'Token administrativo inválido' });
    }
    decoded.id = Number(decoded.id);
    req.user = decoded
    next()
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido' })
  }
}
