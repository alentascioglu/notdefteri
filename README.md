# Not Defteri – Kurulum Rehberi

Dosyalar: `index.html`, `style.css`, `app.js`, `firebase-config.js`

Bu site sadece HTML/CSS/JS'ten oluşur, sunucu kodu yoktur. Veriler Google Firebase (Firestore) veritabanında saklanır. Bu yüzden aynı dosyalar hem GitHub Pages'te hem de ileride paylaşımlı hostingte hiçbir değişiklik yapmadan çalışır.

**Önemli:** `index.html` dosyasını çift tıklayıp doğrudan açarsanız Firebase giriş yapmayabilir. Siteyi GitHub Pages'e (veya bir hostinge) yükleyip `https://...` adresinden açın. Bilgisayarınızda denemek isterseniz o klasörde `python -m http.server 8000` çalıştırıp `http://localhost:8000` adresini açın.

---

## 1) Firebase projesi oluşturma (yaklaşık 10 dk, ücretsiz)

1. https://console.firebase.google.com adresine Google hesabınızla girin.
2. **Proje ekle** → bir ad verin (örn. `not-defteri`) → Google Analytics'i kapatabilirsiniz → **Oluştur**.
3. Sol menü **Derleme (Build) → Firestore Database → Veritabanı oluştur**. Konum olarak `eur3` (Avrupa) seçin, **Üretim modunda başlat** deyin.
4. Sol menü **Derleme → Authentication → Başlayın → Oturum açma yöntemi → E-posta/Şifre** seçeneğini **Etkinleştir** → Kaydet.
5. Authentication → **Kullanıcılar → Kullanıcı ekle**: kendi e-postanızı ve bir şifre girin. Siteye bu bilgilerle gireceksiniz.
6. Authentication → **Ayarlar → Kullanıcı işlemleri**: "Oluşturmayı etkinleştir (kaydolma)" seçeneğini **kapatın**. Böylece kimse kendi kendine hesap açamaz.

## 2) Güvenlik kuralları (çok önemli)

Firestore Database → **Kurallar** sekmesine aşağıdakini yapıştırıp **Yayınla** deyin. `ogretmen@ornek.com` yerine 5. adımda eklediğiniz e-postayı yazın:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null
        && request.auth.token.email == 'ogretmen@ornek.com';
    }
  }
}
```

Bu kural olmadan veya yanlış yazılırsa uygulama "Veriler yüklenemedi" hatası verir ya da (daha kötüsü) veriler herkese açık kalır.

## 3) Ayarları koda girme

1. Firebase Console → sol üstte ⚙️ **Proje ayarları → Genel** → aşağıda **Uygulamalarınız → Web (</>)** simgesi → bir ad verip kaydedin.
2. Size `firebaseConfig = { apiKey: ..., ... }` şeklinde bir blok gösterilecek.
3. Bu değerleri `firebase-config.js` dosyasındaki ilgili yerlere yapıştırın (dosyadaki `BURAYA_...` yazan yerleri değiştirin).

(`apiKey` gizli bir şifre değildir, sitede görünmesi normaldir. Güvenliği 2. adımdaki kurallar ve giriş sistemi sağlar.)

## 4) GitHub Pages'te yayınlama

1. https://github.com üzerinde yeni bir repo açın (örn. `not-defteri`).
2. **Add file → Upload files** ile 4 dosyayı (`index.html`, `style.css`, `app.js`, `firebase-config.js`) yükleyip **Commit** edin.
3. Repo → **Settings → Pages** → Source: **Deploy from a branch**, Branch: **main** / **(root)** → Save.
4. Birkaç dakika sonra site `https://KULLANICIADI.github.io/not-defteri/` adresinde açılır.
5. Firebase Console → **Authentication → Ayarlar → Yetkili alan adları** bölümüne `KULLANICIADI.github.io` adresini ekleyin.

> Not: Ücretsiz GitHub hesabında Pages için repo herkese açık (public) olmalıdır. Kodda gizli bilgi yoktur, öğrenci verileriniz Firebase'de ve giriş şifresi arkasındadır.

## 5) İleride paylaşımlı hostinge taşıma

1. Hostingin cPanel → **Dosya Yöneticisi** → `public_html` klasörüne (veya alt klasöre) aynı 4 dosyayı yükleyin.
2. Sitenizde SSL (https) etkin olsun.
3. Firebase Console → Authentication → Ayarlar → **Yetkili alan adları**'na yeni alan adınızı ekleyin.

Başka hiçbir şey değişmez, veriler aynı kalır.

---

## Sık karşılaşılan sorunlar

| Belirti | Neden / Çözüm |
|---|---|
| Sonsuz "Yükleniyor..." | Dosyalardan biri eksik veya adı farklı. 4 dosya aynı klasörde olmalı. |
| "Firebase başlatılamadı" | `firebase-config.js` içindeki `BURAYA_...` değerleri değiştirilmemiş. |
| Giriş yapılıyor ama "Veriler yüklenemedi" | Firestore kuralları yayınlanmamış veya kuraldaki e-posta yanlış. |
| "E-posta veya şifre hatalı (auth/unauthorized-domain)" | Alan adı Yetkili alan adları listesine eklenmemiş. |
| Sayfa güncellenmiyor | Tarayıcıda Ctrl+F5 ile yenileyin. |
