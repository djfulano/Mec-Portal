import Copyright from '../../components/Copyright'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(null)
  const [empresa, setEmpresa] = useState(null)
  const [params] = useSearchParams()
  const empresaSlug = params.get('empresa') || 'default'
  useEffect(() => {
    const controller = new AbortController()
    setEmpresa(null)
    fetch(`/api/empresas/public/${encodeURIComponent(empresaSlug)}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null).then(setEmpresa).catch(() => {})
    return () => controller.abort()
  }, [empresaSlug])

  const handleLogin = async (e) => {
    e.preventDefault()

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha, empresa_slug: params.get('empresa') || undefined })
      })

      const data = await res.json()

      if (res.ok) {
        login(data.token, data.user, data.empresas, data.permissoes)
        const slug = data.user?.empresa_slug || 'default'
        navigate(data.user?.role === 'super_admin' ? '/super' : `/admin/${slug}`)
      } else {
        setErro(data.message || data.error || 'Erro ao fazer login')
      }
    } catch (err) {
      setErro('Erro de conexão com o servidor')
    }
  }

  return (
    <div className="flex items-center justify-center flex-col min-h-screen bg-[#0f111a]">
      <form onSubmit={handleLogin} className="bg-[#1a1d27] border border-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-sm">
        <div className="mb-6 text-center">
          {empresa?.logo_url && <img src={empresa.logo_url} alt={`Logo de ${empresa.nome}`} className="max-h-28 max-w-full object-contain mx-auto mb-4" onError={() => setEmpresa(prev => ({ ...prev, logo_url: null }))} />}
          <h2 className="text-2xl font-bold text-white">Mec Portal</h2>

        </div>
        {erro && <p className="text-red-400 text-sm mb-4">{erro}</p>}

        <div className="mb-4">
          <label className="block text-gray-400 mb-2 text-sm">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#0d1117] border border-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-400 mb-2 text-sm">Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full bg-[#0d1117] border border-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-500 transition-colors duration-200 cursor-pointer font-medium"
        >
          Entrar
        </button>

      </form>
      <Copyright />
    </div>
  )
}
