// db.test.mjs — SQLite + FTS5 temelini dogrular (bellek-ici DB). Bilal kurali: para/veri hesabi -> once test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  veritabaniAc, kayitEkle, kayitGetir, kayitGuncelle, kayitSil, ara, aramaIfadesi, alanTanimlari,
  uyarilar, musteriEkle, musteriBulToken, musteriTokenYenile, musteriDurum, talepEkle,
  kullaniciBulKadi, kullaniciEkle, parolaDogru, parolaDegistir, kullaniciDurum,
  girisDene, oturumKullanici, oturumKapat,
  zimmetAta, zimmetIade, zimmetAktif, zimmetGecmisi, personelZimmetleri,
  ayarGetir, ayarKur, ayarlariGetir, ayarlariKaydet,
} from "../sunucu/db.js";
import { epostaHazir, epostaGonder } from "../sunucu/eposta.js";

function yeniDb() { return veritabaniAc(":memory:"); }

test("sema + tohum: alan tanimlari yuklendi", () => {
  const db = yeniDb();
  const hepsi = alanTanimlari(db);
  assert.ok(hepsi.length > 20, "onemli sayida alan tohumlanmali");
  const donanim = alanTanimlari(db, "donanim");
  assert.ok(donanim.find(a => a.kod === "seri_no"), "donanimda seri_no alani olmali");
  assert.equal(donanim.find(a => a.kod === "kategori").zorunlu, true);
});

test("kayit ekle + getir: veri ve etiketler round-trip", () => {
  const db = yeniDb();
  const id = kayitEkle(db, {
    tip: "donanim",
    baslik: "Dell Latitude 5540 — Muhasebe",
    durum: "Zimmetli",
    atanan: "Ayse Yilmaz",
    konum: "Merkez / 3. Kat",
    veri: { kategori: "Dizustu", marka: "Dell", model: "Latitude 5540", seri_no: "ABC123XYZ", ram: "16GB" },
    etiketler: ["muhasebe", "garanti-devam"],
  });
  const k = kayitGetir(db, id);
  assert.equal(k.baslik, "Dell Latitude 5540 — Muhasebe");
  assert.equal(k.veri.seri_no, "ABC123XYZ");
  assert.deepEqual(k.etiketler.sort(), ["garanti-devam", "muhasebe"]);
});

test("FTS: herhangi bir kelimeyle arama (baslik, ozel alan, seri no)", () => {
  const db = yeniDb();
  kayitEkle(db, { tip: "donanim", baslik: "Dell Latitude 5540", veri: { seri_no: "ABC123XYZ", marka: "Dell" } });
  kayitEkle(db, { tip: "donanim", baslik: "HP EliteBook 840", veri: { seri_no: "HP999", marka: "HP" } });
  kayitEkle(db, { tip: "lisans", baslik: "Microsoft 365 E3", veri: { lisans_anahtari: "XXXX-YYYY" } });

  assert.equal(ara(db, { q: "latitude" }).length, 1, "baslik kelimesi");
  assert.equal(ara(db, { q: "ABC123XYZ" }).length, 1, "seri no tam");
  assert.equal(ara(db, { q: "abc123" }).length, 1, "prefix eslesme");
  assert.equal(ara(db, { q: "dell 5540" }).length, 1, "iki kelime AND");
  assert.equal(ara(db, { q: "microsoft" }).length, 1, "farkli tipte kelime");
  assert.equal(ara(db, { q: "yokboyle" }).length, 0, "eslesmeyen");
});

test("FTS: etiket ve yorum icerigi de aranabilir olmali (guncelleme sonrasi)", () => {
  const db = yeniDb();
  const id = kayitEkle(db, { tip: "donanim", baslik: "Sunucu-01", etiketler: ["kritik", "yedekli"] });
  assert.equal(ara(db, { q: "kritik" }).length, 1, "etiket aranabilir");
  // etiket degisince FTS guncellenmeli
  kayitGuncelle(db, id, { etiketler: ["arsiv"] });
  assert.equal(ara(db, { q: "kritik" }).length, 0, "eski etiket artik eslesmemeli");
  assert.equal(ara(db, { q: "arsiv" }).length, 1, "yeni etiket eslesmeli");
});

test("FTS: Turkce buyuk/kucuk harf ve aksan duyarsizligi", () => {
  const db = yeniDb();
  kayitEkle(db, { tip: "bilgi", baslik: "VPN Baglanti Sorunu Cozumu", veri: { icerik: "Kullanici sifresini sifirla" } });
  assert.equal(ara(db, { q: "vpn" }).length, 1, "kucuk harf");
  assert.equal(ara(db, { q: "SORUN" }).length, 1, "buyuk harf");
  assert.equal(ara(db, { q: "kullanici" }).length, 1, "icerik alani");
});

test("suzgec: tip ve durum ile daraltma", () => {
  const db = yeniDb();
  kayitEkle(db, { tip: "donanim", baslik: "Yazici A", durum: "Aktif", veri: { marka: "Canon" } });
  kayitEkle(db, { tip: "donanim", baslik: "Yazici B", durum: "Arizali", veri: { marka: "Canon" } });
  kayitEkle(db, { tip: "lisans", baslik: "Canon yazilim", durum: "Aktif" });
  assert.equal(ara(db, { q: "canon", tip: "donanim" }).length, 2);
  assert.equal(ara(db, { q: "canon", tip: "donanim", durum: "Arizali" }).length, 1);
  assert.equal(ara(db, { tip: "donanim" }).length, 2, "sorgusuz tip suzgeci");
});

test("sil: kayit ve FTS satiri birlikte gider", () => {
  const db = yeniDb();
  const id = kayitEkle(db, { tip: "donanim", baslik: "Silinecek Cihaz" });
  assert.equal(ara(db, { q: "silinecek" }).length, 1);
  assert.ok(kayitSil(db, id));
  assert.equal(ara(db, { q: "silinecek" }).length, 0, "FTS satiri da silinmeli");
  assert.equal(kayitGetir(db, id), null);
});

test("migrasyon: yeniden acilista katalog upsert edilir, veri ve elle alan korunur", () => {
  const yol = join(tmpdir(), `bilgi-mig-test-${process.pid}.sqlite`);
  for (const e of [yol, yol + "-wal", yol + "-shm"]) if (existsSync(e)) rmSync(e);
  try {
    const db1 = veritabaniAc(yol);
    const kid = kayitEkle(db1, { tip: "donanim", baslik: "Kalici Cihaz", veri: { seri_no: "MIG1" } });
    // (a) katalog etiketini boz  (b) katalogda olmayan elle alan ekle
    db1.exec("UPDATE alan_tanim SET etiket='BOZUK' WHERE tip='donanim' AND kod='seri_no'");
    db1.exec("INSERT INTO alan_tanim (tip,kod,etiket,veri_tipi,zorunlu,sira) VALUES ('donanim','ozel_kod','Ozel Kod','metin',0,900)");
    db1.close();

    const db2 = veritabaniAc(yol); // yeniden acilis → senkron calisir
    const donanim = alanTanimlari(db2, "donanim");
    assert.equal(donanim.find(a => a.kod === "seri_no").etiket, "Seri No", "katalog etiketi geri gelmeli");
    assert.ok(donanim.find(a => a.kod === "ozel_kod"), "elle eklenmis alan SILINMEMELI");
    assert.equal(kayitGetir(db2, kid).veri.seri_no, "MIG1", "kayit verisi korunmali");
    db2.close();
  } finally {
    for (const e of [yol, yol + "-wal", yol + "-shm"]) if (existsSync(e)) rmSync(e);
  }
});

test("uyarilar: bitis tarihlerine gore yakin/gecti siniflandirma", () => {
  const db = yeniDb();
  const bugun = "2026-07-09";
  kayitEkle(db, { tip: "lisans",   baslik: "M365",       veri: { bitis: "2026-07-19" } });        // +10 gun → yakin
  kayitEkle(db, { tip: "sozlesme", baslik: "Bakim",      veri: { bitis: "2026-07-04" } });        // -5 gun → gecti
  kayitEkle(db, { tip: "donanim",  baslik: "Sunucu",     veri: { garanti_bitis: "2027-01-01" } }); // uzak → haric
  kayitEkle(db, { tip: "donanim",  baslik: "Tarihsiz",   veri: { marka: "Dell" } });               // tarih yok → haric
  const u = uyarilar(db, { gun: 45, bugun });
  assert.equal(u.yakin.length, 1, "yakin: 1");
  assert.equal(u.yakin[0].baslik, "M365");
  assert.equal(u.yakin[0].kalanGun, 10);
  assert.equal(u.gecmis.length, 1, "gecmis: 1");
  assert.equal(u.gecmis[0].baslik, "Bakim");
  assert.equal(u.gecmis[0].kalanGun, -5);
});

test("uyarilar: alan adi ve SSL bitisleri de takip edilir", () => {
  const db = yeniDb();
  const bugun = "2026-07-09";
  kayitEkle(db, { tip: "alan_adi", baslik: "semak.com.tr", veri: { kayit_yeri: "Natro", bitis: "2026-07-29" } }); // +20 → yakin
  kayitEkle(db, { tip: "ssl",      baslik: "*.semak.com.tr", veri: { saglayici: "Let's Encrypt", bitis: "2026-07-01" } }); // -8 → gecti
  kayitEkle(db, { tip: "alan_adi", baslik: "uzak.com", veri: { kayit_yeri: "GoDaddy", bitis: "2027-06-01" } }); // uzak → haric
  const u = uyarilar(db, { gun: 45, bugun });
  const yakinBasliklar = u.yakin.map(x => x.baslik);
  const gecmisBasliklar = u.gecmis.map(x => x.baslik);
  assert.ok(yakinBasliklar.includes("semak.com.tr"), "alan adi yaklasan bitis uyarisi");
  assert.ok(gecmisBasliklar.includes("*.semak.com.tr"), "gecmis SSL bitis uyarisi");
  assert.equal(u.yakin.find(x => x.baslik === "semak.com.tr").kategori, "Alan Adı");
  assert.equal(u.gecmis.find(x => x.baslik === "*.semak.com.tr").kategori, "SSL");
  assert.ok(!yakinBasliklar.includes("uzak.com") && !gecmisBasliklar.includes("uzak.com"), "uzak tarih haric");
});

test("ayarlar: K/V yaz-oku, ayarlariKaydet undefined'i atlar (parola korunur)", () => {
  const db = yeniDb();
  assert.equal(ayarGetir(db, "smtp_host", "yok"), "yok", "tanimsiz anahtar varsayilani doner");
  ayarKur(db, "smtp_host", "smtp.office365.com");
  ayarKur(db, "smtp_parola", "gizli123");
  assert.equal(ayarGetir(db, "smtp_host"), "smtp.office365.com");
  // undefined atlanmali → parola korunur; string alanlar guncellenir
  ayarlariKaydet(db, { smtp_host: "smtp.yeni.com", smtp_parola: undefined, smtp_kullanici: "admin@semak.com.tr" });
  assert.equal(ayarGetir(db, "smtp_host"), "smtp.yeni.com", "host guncellendi");
  assert.equal(ayarGetir(db, "smtp_parola"), "gizli123", "undefined parola korundu");
  assert.equal(ayarGetir(db, "smtp_kullanici"), "admin@semak.com.tr");
  const hepsi = ayarlariGetir(db);
  assert.equal(hepsi.smtp_kullanici, "admin@semak.com.tr");
});

test("eposta: yapilandirilmamis iken gonderim SESSIZCE atlanir (ana akis kirilmaz)", async () => {
  const db = yeniDb();
  assert.equal(epostaHazir(db), false, "bos DB'de SMTP hazir degil");
  const r = await epostaGonder(db, { kime: "x@y.com", konu: "test", metin: "gövde" });
  assert.equal(r.ok, false);
  assert.equal(r.atlandi, true, "yapilandirilmamis → atlandi, exception yok");
});

test("musteri token: uretim, dogrulama, yenileme, pasiflestirme", () => {
  const db = yeniDb();
  const { id, token } = musteriEkle(db, { ad: "ABC Ltd", eposta: "bilgi@abc.com" });
  assert.ok(token && token.length >= 20, "token uretilmeli");
  // token duz metin SAKLANMAMALI (sadece hash)
  const ham = db.prepare("SELECT token_hash FROM musteriler WHERE id = ?").get(id).token_hash;
  assert.notEqual(ham, token, "duz token saklanmamali");
  // dogrulama
  assert.equal(musteriBulToken(db, token)?.id, id, "gecerli token musteriyi bulmali");
  assert.equal(musteriBulToken(db, "yanlis-token"), null, "gecersiz token null");
  // yenileme → eski token gecersiz
  const yeni = musteriTokenYenile(db, id);
  assert.equal(musteriBulToken(db, token), null, "eski token artik gecersiz");
  assert.equal(musteriBulToken(db, yeni)?.id, id, "yeni token gecerli");
  // pasiflestirme → token gecerli olsa da giris yok
  musteriDurum(db, id, false);
  assert.equal(musteriBulToken(db, yeni), null, "pasif musteri giremez");
});

test("talep kapisi: intake talebi olusturur, musteriye sahiplenir, aranabilir", () => {
  const db = yeniDb();
  const { id: mid } = musteriEkle(db, { ad: "XYZ Sanayi" });
  const tid = talepEkle(db, {
    musteri_id: mid, musteri: "XYZ Sanayi",
    konu: "Yazici baglanmiyor", kategori: "Ariza",
    aciklama: "Muhasebedeki HP yazici aga baglanmiyor", ilgili_cihaz: "HP LaserJet",
  });
  const t = kayitGetir(db, tid);
  assert.equal(t.tip, "talep");
  assert.equal(t.durum, "Yeni", "yeni talep 'Yeni' durumunda");
  assert.equal(t.veri.musteri_id, mid, "musteriye sahiplenmeli");
  assert.equal(t.veri.kaynak, "intake");
  // personel tarafi arayabilmeli
  assert.equal(ara(db, { q: "yazici", tip: "talep" }).length, 1, "talep aranabilir");
  assert.equal(ara(db, { q: "XYZ" }).length, 1, "musteri adiyla bulunur");
});

test("talep tipi katalogda tanimli", () => {
  const db = yeniDb();
  const alan = alanTanimlari(db, "talep");
  assert.ok(alan.find(a => a.kod === "aciklama"), "talep.aciklama alani olmali");
});

test("auth: varsayilan admin/admin olusur, parola hash'li saklanir", () => {
  const db = yeniDb();
  const admin = kullaniciBulKadi(db, "admin");
  assert.ok(admin, "admin kullanicisi tohumlanmali");
  assert.equal(admin.rol, "admin");
  assert.equal(admin.sifre_yenile, 1, "ilk giriste sifre degistirme istenmeli");
  assert.notEqual(admin.parola, "admin", "duz parola saklanmamali");
  assert.ok(admin.parola.includes(":"), "salt:hash formati");
  assert.ok(parolaDogru("admin", admin.parola), "admin parolasi dogrulanmali");
  assert.ok(!parolaDogru("yanlis", admin.parola), "yanlis parola reddedilmeli");
});

test("auth: giris → oturum → dogrulama → cikis", () => {
  const db = yeniDb();
  assert.equal(girisDene(db, "admin", "yanlis"), null, "yanlis parola giris yok");
  const s = girisDene(db, "admin", "admin");
  assert.ok(s && s.token, "dogru parola oturum acar");
  assert.equal(oturumKullanici(db, s.token)?.kadi, "admin", "token kullaniciyi cozer");
  oturumKapat(db, s.token);
  assert.equal(oturumKullanici(db, s.token), null, "cikis sonrasi token gecersiz");
});

test("auth: kullanici ekleme, parola degistirme, pasiflestirme", () => {
  const db = yeniDb();
  const id = kullaniciEkle(db, { kadi: "Ayse", ad: "Ayse Y", parola: "gizli123", rol: "personel" });
  assert.ok(girisDene(db, "ayse", "gizli123"), "kadi kucuk-harfe normalize, giris olur");
  assert.throws(() => kullaniciEkle(db, { kadi: "ayse", parola: "x" }), /zaten var/);
  parolaDegistir(db, id, "yeniSifre1");
  assert.equal(girisDene(db, "ayse", "gizli123"), null, "eski parola gecersiz");
  assert.ok(girisDene(db, "ayse", "yeniSifre1"), "yeni parola gecerli");
  kullaniciDurum(db, id, false);
  assert.equal(girisDene(db, "ayse", "yeniSifre1"), null, "pasif kullanici giremez");
});

test("zimmet: ata → yeniden ata (change mgmt) → iade, tarihce + ters sorgu", () => {
  const db = yeniDb();
  const ayse = kayitEkle(db, { tip: "personel", baslik: "Ayse Yilmaz", veri: { departman: "Muhasebe" } });
  const mehmet = kayitEkle(db, { tip: "personel", baslik: "Mehmet Kaya" });
  const pc1 = kayitEkle(db, { tip: "donanim", baslik: "Dell Latitude 5540", veri: { seri_no: "PC1" } });
  const lisans = kayitEkle(db, { tip: "lisans", baslik: "Office 365 E3" });
  const sw = kayitEkle(db, { tip: "donanim", baslik: "Cisco Switch", veri: { kategori: "Ag Cihazi" } });

  // 1) PC1 -> Ayse
  zimmetAta(db, { kayitId: pc1, personelId: ayse, atayan: "admin" });
  assert.equal(zimmetAktif(db, pc1)?.personel_ad, "Ayse Yilmaz");
  assert.equal(kayitGetir(db, pc1).atanan, "Ayse Yilmaz", "atanan alani senkron");
  assert.equal(personelZimmetleri(db, ayse).aktif.length, 1, "Ayse'de 1 aktif varlik");

  // 2) PC1 -> Mehmet (yeniden zimmet: change management)
  zimmetAta(db, { kayitId: pc1, personelId: mehmet, atayan: "admin" });
  assert.equal(zimmetAktif(db, pc1)?.personel_ad, "Mehmet Kaya");
  assert.equal(personelZimmetleri(db, ayse).aktif.length, 0, "Ayse artik PC1 tutmuyor");
  assert.equal(personelZimmetleri(db, ayse).gecmis.length, 1, "Ayse gecmisinde PC1");
  assert.equal(personelZimmetleri(db, mehmet).aktif.length, 1, "Mehmet'te PC1 aktif");
  assert.equal(zimmetGecmisi(db, pc1).length, 2, "PC1 icin 2 zimmet donemi (tam tarihce)");

  // 3) Ayse'ye lisans da zimmetle → birden fazla varlik ters sorguda
  zimmetAta(db, { kayitId: lisans, personelId: ayse, atayan: "admin" });
  assert.equal(personelZimmetleri(db, ayse).aktif.length, 1);
  assert.equal(personelZimmetleri(db, ayse).aktif[0].varlik_tip, "lisans");

  // 4) iade → zimmetsiz kalir, tarihce durur
  assert.ok(zimmetIade(db, { kayitId: pc1, atayan: "admin" }));
  assert.equal(zimmetAktif(db, pc1), null, "iade sonrasi aktif zimmet yok");
  assert.equal(kayitGetir(db, pc1).atanan, null, "atanan temizlendi");
  assert.equal(zimmetGecmisi(db, pc1).length, 2, "tarihce korunuyor");
  assert.equal(personelZimmetleri(db, mehmet).aktif.length, 0);

  // 5) zorunlu degil: switch kimseye zimmetli degil
  assert.equal(zimmetAktif(db, sw), null, "switch zimmetsiz olabilir");
});

test("zimmet: personel olmayana atanamaz", () => {
  const db = yeniDb();
  const pc = kayitEkle(db, { tip: "donanim", baslik: "PC" });
  const baskaPc = kayitEkle(db, { tip: "donanim", baslik: "Baska PC" });
  assert.throws(() => zimmetAta(db, { kayitId: pc, personelId: baskaPc }), /personel karti olmali/);
});

test("aramaIfadesi: ozel karakterler temizlenir (sozdizim guvenli)", () => {
  assert.equal(aramaIfadesi("dell 5540"), '"dell"* "5540"*');
  assert.equal(aramaIfadesi('  a"b(c)  '), '"abc"*');
  assert.equal(aramaIfadesi(""), null);
  assert.equal(aramaIfadesi("   "), null);
});
