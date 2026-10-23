# CLAUDE.md — Instruksi Operasional Claude Code

@AGENTS.md

Seluruh aturan di `AGENTS.md` berlaku penuh. Bagian di bawah ini hanya tambahan khusus Claude Code.

## Instruksi yang TIDAK berlaku untuk proyek ini

`C:\Users\User\Desktop\CLAUDE.md` (folder induk) milik proyek lain — migrasi CMS PHP/Bootstrap/MySQL.
Claude Code ikut memuatnya karena posisinya di folder induk, tetapi **isinya tidak berlaku di sini**.
Bila bertentangan, yang berlaku adalah `AGENTS.md` dan dokumen di `docs/` proyek ini.
(Rekomendasi tertunda: pindahkan repo ini keluar dari `Desktop\`, atau pindahkan file tersebut ke folder proyeknya.)

## Skills

- Hanya klaim skill yang benar-benar terpasang dan dijalankan di sesi tersebut.
- `grill-with-docs` dan `domain-modeling` (paket `mattpocock/skills`) **belum terpasang** per 14 Oktober 2026.
  Instalasi: `claude plugin install mattpocock-skills@claude-plugins-official`, lalu mulai sesi baru.
  Bila dipasang, glossary tetap di `docs/GLOSSARY.md` dan ADR di `docs/adr/` — jangan buat duplikat.
- Skill pendukung yang relevan bila tersedia: `senior-architect`, `tech-stack-evaluator`, `senior-frontend`,
  `senior-security`, `design:design-system`, `design:accessibility-review`, `design:ux-copy`,
  `security-review`, `code-review`.
- `ui-ux-pro-max` (pihak ketiga, MIT) **terpasang lokal** di `.claude/skills/ui-ux-pro-max/` per 23 Oktober 2026 setelah
  audit ([ADR-0013](docs/adr/0013-skill-ui-ux-pro-max-dan-pedoman-dashboard.md)); **tidak di-commit** (dikecualikan lewat
  `.git/info/exclude`). Panggil skrip dengan jalur langsung. Hasilnya saran; identitas UNINUS dan aturan proyek tetap utama.
- Skill di `.opencode/skills/` milik OpenCode dan tidak dimuat oleh Claude Code.

## Grilling

Selama discovery: satu pertanyaan utama per giliran, dengan konteks teknis, rekomendasi, dan trade-off.
Setiap keputusan yang disepakati langsung dicatat ke dokumen terkait (PRD, ADR, IMPLEMENTATION_PLAN, DEPLOYMENT).

## Server & keamanan

Berlaku [ADR-0010](docs/adr/0010-deploy-oleh-claude-dengan-batasan.md) (merevisi D4):

- Claude boleh menjalankan runbook `docs/DEPLOYMENT.md` lewat **alias SSH yang sudah disiapkan pemilik proyek**. Panel aaPanel boleh dioperasikan sesuai ADR-0010 (D36), hanya lewat sesi yang di-login pemilik proyek sendiri. Jangan meminta, menerima, atau menyimpan kunci privat, password, atau URL panel.
- Staging: jalankan mandiri dan laporkan. **Produksi: tunggu "go" eksplisit** untuk tag/commit tertentu.
- Tidak boleh di server: menyentuh proyek lain (mis. PKKMB), menghapus di luar folder aplikasi, `curl | sh`, mengubah DNS/firewall/akun/pengaturan global panel. SSL, situs, dan database proyek ini boleh lewat panel (ADR-0010 D36).
- Catat setiap perintah pengubah di `~/deploy-wisuda.log` dan laporkan hasilnya apa adanya.
- Jangan membuka, menyimpan, atau mengutip URL panel yang berisi jalur rahasia/token.

## Akun dan kata sandi aplikasi

Berlaku [ADR-0008](docs/adr/0008-akun-peran-dan-autentikasi.md) (D44): **pemilik proyek yang mengatur** akun, peran, kata sandi, dan kebijakan sandi. Ikuti instruksinya; sampaikan risiko sekali lalu catat keputusannya, jangan menolak karena kebijakan sandi. Tetap: sandi tidak ditulis di repo/kode/log/audit/argumen perintah, berkas yang memuatnya berizin 600 dan dihapus setelah dipakai, dan pemasangan ke produksi tetap menunggu "go" eksplisit (ADR-0010).
