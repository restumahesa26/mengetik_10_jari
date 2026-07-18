# Product Requirements Document (PRD): KetikFokus

**Nama Proyek:** KetikFokus
**Tujuan:** Menyediakan platform latihan mengetik 10 jari yang bersih, sederhana, dengan umpan balik visual real-time dan analitik performa yang sangat mendetail untuk mempercepat proses belajar.

## Antarmuka & Pengalaman Pengguna (UI/UX)
- **Desain Minimalis:** Layar hanya menampilkan elemen yang dibutuhkan (teks, waktu, dan hasil). Elemen navigasi akan memudar (fade out) saat pengguna mulai mengetik agar bebas distraksi.
- **Tipografi:** Wajib menggunakan font monospace (seperti Roboto Mono atau Fira Code) agar lebar setiap karakter sama, memudahkan pelacakan mata.
- **Palet Warna:** Warna dasar yang lembut (misalnya latar belakang dark mode abu-abu tua atau light mode putih gading). Warna teks abu-abu redup (belum diketik), putih/hitam pekat (benar), dan merah terang (salah).

## Daftar Fitur Utama
1. **Pengaturan Sesi (Pre-typing):**
   - **Pilihan Waktu:** 15 detik, 30 detik, 60 detik, 120 detik.
   - **Pilihan Bahasa:** Indonesia, Inggris, dan opsi "Kumpulan Kata Sulit" atau "Kode Pemrograman".
2. **Mesin Pengetikan (Typing Engine):**
   - Validasi tingkat huruf (karakter demi karakter), bukan per kata.
   - Highlight kursor yang selalu mengikuti huruf yang sedang aktif.
   - Jika salah ketik, huruf berubah menjadi merah. Pengguna bisa memilih menekan `Backspace` untuk memperbaiki, atau lanjut mengetik (huruf salah tetap terekam).
3. **Statistik Pasca-Sesi (Post-typing Analytics):**
   - **WPM (Words Per Minute):** Kecepatan pengetikan standar.
   - **Raw WPM:** Kecepatan pengetikan kotor (tanpa memperhitungkan kesalahan).
   - **Akurasi (%):** Persentase ketepatan huruf.
   - **Karakter:** Rincian jumlah karakter (Benar / Salah / Ekstra / Dilewati).
   - **Konsistensi:** Mengukur ritme kecepatan pengetikan dari awal hingga akhir.
   - **Peta Panas Tombol (Key Heatmap):** Menampilkan huruf/tombol mana yang paling sering salah diketik, sangat berguna untuk evaluasi posisi jari mana yang masih lemah dalam teknik 10 jari.