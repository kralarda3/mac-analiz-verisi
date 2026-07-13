#!/usr/bin/env python3
"""
Maç Analiz Masası - Otomatik Veri Çekme Scripti
=================================================

Bu script football-data.org'un ÜCRETSİZ API'sinden gerçek maç verisi çeker
ve fixtures.json dosyasına yazar. GitHub Actions ile günlük/haftalık
otomatik çalıştırılabilir (aşağıdaki .github/workflows/update.yml dosyasına bak).

KURULUM:
1. https://www.football-data.org/client/register adresinden ücretsiz hesap aç
   (ücretsiz katman: dakikada 10 istek, günde yeterli kota, ana ligler dahil)
2. Sana verilen API anahtarını FOOTBALL_DATA_API_KEY ortam değişkenine koy
3. pip install requests --break-system-packages
4. python mac-verisi-cek.py

ÇIKTI: fixtures.json dosyası, aşağıdaki formatta:
{
  "updated_at": "...",
  "matches": [
    {"home": "...", "away": "...", "date_iso": "...", "competition": "...",
     "home_odds_implied": null}  // API bu ücretsiz katmanda oran vermez
  ]
}
"""

import os
import json
import requests
from datetime import datetime, timedelta

API_KEY = os.environ.get("FOOTBALL_DATA_API_KEY", "")
BASE_URL = "https://api.football-data.org/v4"

# Takip etmek istediğin ligler (football-data.org kodları)
# PL=Premier Lig, PD=La Liga, SA=Serie A, BL1=Bundesliga, FL1=Ligue1,
# CL=Şampiyonlar Ligi, WC=Dünya Kupası
COMPETITIONS = ["PL", "PD", "SA", "BL1", "FL1", "CL"]


def fetch_matches_for_competition(comp_code, date_from, date_to):
    """Belirli bir lig için tarih aralığındaki maçları çeker."""
    url = f"{BASE_URL}/competitions/{comp_code}/matches"
    headers = {"X-Auth-Token": API_KEY}
    params = {"dateFrom": date_from, "dateTo": date_to}
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=15)
        if resp.status_code == 200:
            return resp.json().get("matches", [])
        else:
            print(f"[UYARI] {comp_code} için istek başarısız: {resp.status_code} {resp.text[:200]}")
            return []
    except Exception as e:
        print(f"[HATA] {comp_code} çekilemedi: {e}")
        return []


def main():
    if not API_KEY:
        print("HATA: FOOTBALL_DATA_API_KEY ortam değişkeni ayarlanmamış.")
        print("Şu şekilde çalıştır: FOOTBALL_DATA_API_KEY=senin_anahtarin python mac-verisi-cek.py")
        return

    today = datetime.utcnow().date()
    date_from = today.isoformat()
    date_to = (today + timedelta(days=7)).isoformat()

    all_matches = []
    for comp in COMPETITIONS:
        print(f"Çekiliyor: {comp} ({date_from} - {date_to})")
        matches = fetch_matches_for_competition(comp, date_from, date_to)
        for m in matches:
            if m.get("status") not in ("SCHEDULED", "TIMED"):
                continue
            all_matches.append({
                "id": f"{comp}-{m['id']}",
                "competition": m.get("competition", {}).get("name", comp),
                "home": m.get("homeTeam", {}).get("name", "?"),
                "away": m.get("awayTeam", {}).get("name", "?"),
                "date_iso": m.get("utcDate"),
                # Ücretsiz katmanda oran verilmiyor; kendi Poisson modelin
                # için hücum/savunma gücünü ayrıca standings endpoint'inden
                # türetmen gerekir (bu script'te dahil değil, genişletilebilir).
            })

    output = {
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "match_count": len(all_matches),
        "matches": all_matches,
    }

    with open("fixtures.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Tamamlandı: {len(all_matches)} maç fixtures.json dosyasına yazıldı.")


if __name__ == "__main__":
    main()
