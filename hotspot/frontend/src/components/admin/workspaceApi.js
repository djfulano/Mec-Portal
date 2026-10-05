export async function workspace(path, body, method) {
  const response = await fetch("/api/workspace" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      Authorization: "Bearer " + localStorage.getItem("admin_token"),
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.message || data.error || "Não foi possível concluir a ação.",
    );
  return data;
}
export const inputClass =
  "w-full bg-[#0f111a] border border-gray-700 rounded-lg px-3 py-2 text-gray-100";
export const buttonClass =
  "bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 text-white disabled:opacity-50";
