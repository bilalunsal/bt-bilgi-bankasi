// musteri-ekle.js — Musteri olustur ve talep-kapisi linkini uret (token YALNIZCA burada gorunur).
// Kullanim:  node sunucu/musteri-ekle.js "Musteri Adi" [eposta] [--host https://destek.firmaniz.com]
import { veritabaniAc, musteriEkle } from "./db.js";

const argv = process.argv.slice(2);
let host = "http://localhost:8795";
const kalan = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--host") { host = argv[++i] || host; }
  else kalan.push(argv[i]);
}
const ad = kalan[0];
const eposta = kalan[1] || null;

if (!ad) {
  console.error('Kullanim: node sunucu/musteri-ekle.js "Musteri Adi" [eposta] [--host https://destek.firmaniz.com]');
  process.exit(1);
}

const db = veritabaniAc();
const { id, token } = musteriEkle(db, { ad, eposta });
const link = `${host.replace(/\/$/, "")}/t/${token}`;

console.log("\n✅ Musteri olusturuldu");
console.log(`   #${id}  ${ad}${eposta ? "  <" + eposta + ">" : ""}`);
console.log("\n🔗 Talep kapisi linki (musteriye BU linki verin):\n");
console.log("   " + link);
console.log("\n⚠️  Bu token bir daha GORUNMEZ. Kaybederseniz 'token-yenile' ile yenileyin.");
console.log("    Yayina alirken --host ile gercek alan adinizi verin (Cloudflare Tunnel / domain).\n");
