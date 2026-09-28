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
  apiKey: "AIzaSyBzfdQIwDAJtTBbFClGGRo0yv2FpeydxwI",
  authDomain: "notdefteri-e092d.firebaseapp.com",
  projectId: "notdefteri-e092d",
  storageBucket: "notdefteri-e092d.firebasestorage.app",
  messagingSenderId: "950737618605",
  appId: "1:950737618605:web:390e9d7b83f715779f2824",
  measurementId: "G-M8LPZ9WGDK"
};

firebase.initializeApp(firebaseConfig);
