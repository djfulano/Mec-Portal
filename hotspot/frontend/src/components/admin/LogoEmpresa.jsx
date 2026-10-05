import { useEffect, useState } from 'react';

export default function LogoEmpresa() {
  const [empresa, setEmpresa] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('admin_token');
  useEffect(() => {
    fetch('/api/empresas/branding', { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.message); setEmpresa(data); })
      .catch(err => setMessage(err.message || 'Não foi possível carregar a empresa.'));
  }, [token]);

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMessage('Selecione uma imagem de até 2 MB.'); return; }
    const form = new FormData(); form.append('logo', file);
    setSaving(true); setMessage('');
    try {
      const res = await fetch('/api/empresas/branding/logo', { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setEmpresa(prev => ({ ...prev, logo_url: data.logo_url }));
      window.dispatchEvent(new Event('empresa-logo-updated'));
      setMessage('Logo salvo. Ele já aparece no login e no menu da empresa.');
    } catch (err) { setMessage(err.message || 'Não foi possível enviar a imagem.'); }
    finally { setSaving(false); }
  }
  return <section className="bg-[#1a1d27] border border-gray-800 rounded-xl p-6 space-y-4">
    <h2 className="text-lg font-semibold text-white">Logo da empresa</h2>
    <p className="text-sm text-gray-400">Envie uma imagem PNG, JPG, GIF ou WebP de até 2 MB para usar no login e no menu lateral.</p>
    {empresa?.logo_url && <img src={empresa.logo_url} alt={`Logo de ${empresa.nome}`} className="h-24 max-w-full object-contain rounded" />}
    <label className={`inline-block px-4 py-2 bg-blue-600 text-white rounded-lg ${saving || !empresa ? 'opacity-50' : 'cursor-pointer hover:bg-blue-700'}`}>
      {saving ? 'Enviando…' : empresa?.logo_url ? 'Substituir logo' : 'Selecionar logo'}
      <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" disabled={saving || !empresa} onChange={upload} />
    </label>
    {message && <p role="status" className="text-sm text-gray-300">{message}</p>}
    {empresa && <p className="text-sm text-gray-400"><a href={`/?empresa=${encodeURIComponent(empresa.slug)}`} target="_blank" rel="noreferrer" className="text-blue-400 underline">Abrir login desta empresa</a></p>}
  </section>;
}
