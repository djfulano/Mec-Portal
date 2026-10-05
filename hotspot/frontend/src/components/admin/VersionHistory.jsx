import { useRef } from "react";
import releases from "../../releases.json";

export default function VersionHistory() {
  const dialog = useRef(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current.showModal()}
        className="mb-3 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
        title="Ver histórico de versões"
        aria-haspopup="dialog"
      >
        Versão {releases[0].version} · Histórico
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="version-history-title"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-xl max-h-[80vh] overflow-y-auto rounded-xl border border-gray-700 bg-[#1a1d27] p-6 text-gray-300 backdrop:bg-black/70"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="version-history-title" className="text-lg font-semibold text-white">
            Histórico de versões
          </h2>
          <button type="button" onClick={() => dialog.current.close()} className="rounded-lg px-3 py-2 text-sm hover:bg-gray-800 cursor-pointer">
            Fechar
          </button>
        </div>
        <div className="space-y-6">
          {releases.map((release, index) => (
            <section key={release.version} className="border-t border-gray-700 pt-4">
              <h3 className="font-semibold text-white">
                {release.version} — {release.title}
                {index === 0 && <span className="ml-2 text-xs text-emerald-400">Atual</span>}
              </h3>
              <time dateTime={release.date} className="mt-1 block text-xs text-gray-400">
                {release.date.split("-").reverse().join("/")}
              </time>
              <ul className="mt-3 list-disc pl-5 space-y-2 text-sm">
                {release.changes.map((change) => <li key={change}>{change}</li>)}
              </ul>
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
}
