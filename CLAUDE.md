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
- Skill di `.opencode/skills/` milik OpenCode dan tidak dimuat oleh Claude Code.

## Grilling

Selama discovery: satu pertanyaan utama per giliran, dengan konteks teknis, rekomendasi, dan trade-off.
Setiap keputusan yang disepakati langsung dicatat ke dokumen terkait (PRD, ADR, IMPLEMENTATION_PLAN, DEPLOYMENT).

## Server & keamanan

- Claude tidak membutuhkan dan tidak boleh meminta akses login ke aaPanel/SSH. Deploy dijalankan pemilik proyek mengikuti `docs/DEPLOYMENT.md`.
- Jangan membuka, menyimpan, atau mengutip URL panel yang berisi jalur rahasia/token.
