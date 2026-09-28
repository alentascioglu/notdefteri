// ============================================================
// FIREBASE YAPILANDIRMASI
// ============================================================
// Asagidaki degerleri KENDI Firebase projenizden almaniz gerekiyor.
// Nasil alacaginizi README.md dosyasindaki adimlarda anlatiyoruz.
//
// Firebase Console > Proje Ayarlari > Genel > "Web uygulamasi ekle"
// adimindan sonra size boyle bir obje gosterilecek, aynen buraya
// yapistirin.
// ============================================================

const firebaseConfig = {
  apiKey: "BURAYA_KENDI_API_KEY_DEGERINIZ",
  authDomain: "BURAYA_KENDI_PROJENIZ.firebaseapp.com",
  projectId: "BURAYA_KENDI_PROJE_ID_DEGERINIZ",
  storageBucket: "BURAYA_KENDI_PROJENIZ.appspot.com",
  messagingSenderId: "BURAYA_KENDI_SENDER_ID_DEGERINIZ",
  appId: "BURAYA_KENDI_APP_ID_DEGERINIZ",
};

firebase.initializeApp(firebaseConfig);
