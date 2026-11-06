LOKAS — KURULUM VE YAYINLAMA
============================

Bu klasör LOKAS oyun sitesinin kaynak kodudur.
- Tek Oyunculu: Tarayıcıda doğrudan çalışır.
- Çevrim içi Raund: Tüm oyuncular aynı sunucuya bağlanır; rauntlar ortak başlar ve sopanın dönüşü sunucuda senkronize edilir.

BİLGİSAYARINDA ÇALIŞTIRMA
1) Node.js 18 veya daha yenisini kur.
2) Bu klasörü bilgisayarına çıkar.
3) Bu klasörün içinde terminal aç.
4) Şu komutları sırayla çalıştır:

   npm install
   npm start

5) Tarayıcıda http://localhost:3000 adresini aç.

ÇEVRİM İÇİ OYNANMASI / GERÇEK WEB SİTESİ
- Herkesin birlikte oynayabilmesi için bu Node.js sunucusunun internete açık bir sunucuda çalışması gerekir.
- Bu klasörü Node.js destekleyen bir hosting servisine yükle ve başlatma komutu olarak `npm start` kullan.
- Hosting servisinin verdiği HTTPS adresinden siteye girilebilir.
- `lokas.com` adresinin açılması için ayrıca alan adını (domain) satın almak, DNS kayıtlarını hosting servisine yönlendirmek ve hosting üzerinde özel domaini tanımlamak gerekir.
- Google'da arama yapınca görünmesi otomatik değildir. Site yayınlandıktan sonra Google Search Console üzerinden alan adını doğrulayıp site haritası göndermek gerekir. Google'ın dizine eklemesi zaman alabilir.

ÖNEMLİ
Bu paket hazır kaynak kodudur; internete yüklenmiş bir site veya satın alınmış lokas.com alan adı değildir. Alan adı, hosting hesabı ve yayınlama işlemleri site sahibinin hesabından yapılmalıdır.


GÜNCELLEME: DAİRESEL ARENA VE TAM BOY SOPA
------------------------------------------
Bu sürümde:
- Siyah sopa dairenin tam çapı boyunca uzanır.
- Çevrim içi oyuncular sunucu tarafından dairenin içinde tutulur.
- Tek oyunculu modda da oyuncu dairenin dışına çıkamaz.
- Oyuncular dairenin içindeki dış halkaya yakın noktalarda doğar.

MEVCUT RENDER SİTESİNİ GÜNCELLEME
1) GitHub'daki LOKAS deposunu aç.
2) Projede `package.json` dosyasının bulunduğu klasöre gir.
3) `server.js` dosyasını bu paketteki yeni `server.js` ile değiştir.
4) `public` klasörüne girip `game.js` dosyasını bu paketteki yeni `public/game.js` ile değiştir.
5) Her dosyayı kaydederken GitHub'da **Commit changes** seç.
6) Render otomatik dağıtım açıksa yeni sürümü kendisi yayınlar. Değilse Render panelinde **Manual Deploy → Deploy latest commit** seç.
7) Siteyi açıp Ctrl+F5 ile yenile. Telefonda sayfayı kapatıp yeniden aç.

Not: `server.js` ve `public/game.js` aynı uygulamanın dosyalarıdır; ikisini de güncelle. Sadece birini değiştirmek çevrim içi ve tek oyunculu modların farklı davranmasına neden olabilir.
