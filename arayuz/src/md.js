// md.js — kucuk, GUVENLI markdown → HTML. Ic (girisli) kullanim; yine de once HTML kacisi,
// sonra sadece kontrollu desenler + URL beyaz liste (javascript:/data: engellenir).
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const guvenliUrl = (u) => {
  const t = String(u).trim();
  if (/^(https?:)?\/\//i.test(t)) return t;   // http(s)://
  if (/^\/(?!\/)/.test(t)) return t;          // /api/ek/... koke goreli
  if (/^(mailto:|tel:)/i.test(t)) return t;
  return "#";                                  // javascript:, data: vb. engellendi
};

function satirIci(s) {
  // s ZATEN HTML-escaped
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => `<img src="${guvenliUrl(u)}" alt="${a}" style="max-width:100%;border-radius:8px;margin:6px 0"/>`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${guvenliUrl(u)}" target="_blank" rel="noreferrer">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  s = s.replace(/`([^`]+)`/g, "<code style='background:#0B0F18;padding:1px 5px;border-radius:4px'>$1</code>");
  return s;
}

export function md(text) {
  if (!text) return "";
  const satirlar = esc(String(text)).split(/\r?\n/);
  const html = [];
  let liste = null, kod = false, kodBuf = [];
  const listeKapat = () => { if (liste) { html.push(`</${liste}>`); liste = null; } };

  for (const ham of satirlar) {
    if (/^```/.test(ham.trim())) {
      if (kod) { html.push(`<pre style="background:#0B0F18;padding:10px;border-radius:8px;overflow:auto"><code>${kodBuf.join("\n")}</code></pre>`); kod = false; kodBuf = []; }
      else { listeKapat(); kod = true; }
      continue;
    }
    if (kod) { kodBuf.push(ham); continue; }
    const l = ham.trim();
    if (l === "") { listeKapat(); continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { listeKapat(); const n = m[1].length; html.push(`<h${n} style="margin:.7em 0 .3em;font-weight:800">${satirIci(m[2])}</h${n}>`); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(l)) { listeKapat(); html.push('<hr style="border:none;border-top:1px solid #26314B;margin:.8em 0"/>'); continue; }
    if ((m = l.match(/^>\s?(.*)$/))) { listeKapat(); html.push(`<blockquote style="border-left:3px solid #324061;margin:.4em 0;padding:.2em .8em;color:#9AA7BD">${satirIci(m[1])}</blockquote>`); continue; }
    if ((m = l.match(/^(\d+)[.)]\s+(.*)$/))) { if (liste !== "ol") { listeKapat(); liste = "ol"; html.push('<ol style="margin:.3em 0 .3em 1.3em">'); } html.push(`<li style="margin:.15em 0">${satirIci(m[2])}</li>`); continue; }
    if ((m = l.match(/^[-*]\s+(.*)$/))) { if (liste !== "ul") { listeKapat(); liste = "ul"; html.push('<ul style="margin:.3em 0 .3em 1.3em">'); } html.push(`<li style="margin:.15em 0">${satirIci(m[1])}</li>`); continue; }
    listeKapat(); html.push(`<p style="margin:.4em 0">${satirIci(l)}</p>`);
  }
  if (kod) html.push(`<pre style="background:#0B0F18;padding:10px;border-radius:8px;overflow:auto"><code>${kodBuf.join("\n")}</code></pre>`);
  listeKapat();
  return html.join("\n");
}
