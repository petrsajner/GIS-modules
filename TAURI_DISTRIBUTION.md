# GIS — Distribuce jako desktop aplikace (Tauri)
*Zpracováno 5. 4. 2026 — podklad pro budoucí migraci*

---

## Proč Tauri

GIS proxy (Cloudflare Worker) existuje **výhradně pro CORS bypass** — žádný jiný důvod.
Provideri blokující přímé browser volání: xAI, Luma, Magnific, Topaz, Replicate.
Provideri s přímým přístupem (bez proxy): Google/Gemini, fal.ai.

Tauri zabalí HTML/JS do nativního `.exe`/`.app`/`.deb`. HTTP požadavky jdou přes
nativní Rust vrstvu → CORS neexistuje → proxy Worker se stává zbytečným.
Každý uživatel volá API se svým klíčem, žádná sdílená infrastruktura.

---

## Cross-platform

| Platforma | Výstup | Velikost |
|-----------|--------|----------|
| Windows | `.exe` nebo `.msi` | ~8 MB |
| macOS | `.dmg` nebo `.app` | ~8 MB |
| Linux | `.deb` / `.rpm` / `.AppImage` | ~8 MB |

Každý build musí být zkompilován na cílové platformě.
Řešení: **GitHub Actions CI/CD** — paralelní build na třech runnerech po každém `git push`.

---

## Vývojový workflow — beze změny

```
Vývoj:   edituj moduly → node build.js → otevři HTML v Chrome   (stejné jako dnes)
Release: cargo tauri build → .exe / .dmg / .deb
```

Testování probíhá stále v Chrome na `file://`. Tauri se spouští jen pro finální build.

---

## Co funguje v Tauri identicky

- Všechny `fetch()` volání, async/await, Promise chains
- Timeouty (AbortController), polling loops
- IndexedDB, localStorage
- SSE streaming (Gemini)

## CORS konfigurace — klíčová část `tauri.conf.json`

```json
"security": {
  "dangerousDisableAssetCspModification": true
},
"allowlist": {
  "http": {
    "all": true,
    "request": true,
    "scope": ["https://**"]
  }
}
```

S tímto nastavením jdou `fetch()` přes nativní Rust HTTP klient — žádný CORS.

---

## Plán migrace

### Fáze 1 — Tauri setup (jednorázové, ~1 session)
- Instalace Rust + Tauri CLI
- `tauri.conf.json` konfigurace
- Upravit `build.js` aby generoval strukturu kterou Tauri čte
- GitHub Actions workflow pro CI/CD builds

### Fáze 2 — odstranění proxy závislosti (~1–2 sessions)
- `proxy.js` refaktoring — přímé API volání místo CF Worker volání
- `setup.js` — proxy URL pole schovat/odstranit
- Test každého providera přímým voláním: xAI, Luma, Magnific, Topaz, Replicate

---

## Potenciální problémy při ladění

| Oblast | Riziko | Poznámka |
|--------|--------|----------|
| CSP (Content Security Policy) | ⚠️ střední | Tauri má vlastní CSP, může blokovat inline skripty → úprava `template.html` |
| Velké base64 payloady | ⚠️ nízké | Magnific, Topaz — ověřit timeout chování v Tauri HTTP klientu |
| Luma video polling | ⚠️ nízké | Dlouhé čekání, ověřit že se polling neruší |
| fal.ai, Google | ✅ bez rizika | CORS OK i v browseru, chování identické |

**Největší neznámá: CSP** — tam může být nejvíce drobného ladění.

---

## Celkový odhad

**3–4 sessions** než je první funkční `.exe`. Pak průběžné ladění edge cases.
Překlop je relativně přímočarý — GIS HTML/JS kód se mění minimálně,
hlavní změna je `proxy.js` (přímé API volání) a Tauri konfigurace.

---

## Kdy překlápět

Až bude GIS ve verzi která nebude potřebovat další zásadní úpravy funkcí.
Do té doby: vývoj probíhá standardně jako HTML soubor v Chrome.

---

## Alternativy (pro referenci, zamítnuty)

| Varianta | Důvod zamítnutí |
|----------|-----------------|
| Electron | ~120 MB installer, horší bezpečnost |
| Chrome Extension | Vázáno na Chrome, Web Store review |
| Bundled local proxy binary | Uživatel musí spustit dvě věci |
| CF Worker "deploy your own" | Vyžaduje CF účet, technické znalosti |
