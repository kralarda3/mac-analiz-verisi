import React, { useState, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ---------- Poisson tahmin motoru ----------
function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function poissonPMF(k, lambda) {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}
const LEAGUE_AVG = 1.35;
const HOME_ADV = 1.15;
const MAX_GOALS = 7;

function computeMatch(home, away) {
  const homeExp = Math.max(
    0.15,
    ((home.attack * away.defense) / LEAGUE_AVG) * HOME_ADV * formFactor(home.form)
  );
  const awayExp = Math.max(
    0.15,
    ((away.attack * home.defense) / LEAGUE_AVG) * formFactor(away.form)
  );

  let p1 = 0, pX = 0, p2 = 0, over25 = 0, btts = 0;
  const grid = [];
  for (let h = 0; h <= MAX_GOALS; h++) {
    const row = [];
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = poissonPMF(h, homeExp) * poissonPMF(a, awayExp);
      row.push(p);
      if (h > a) p1 += p;
      else if (h === a) pX += p;
      else p2 += p;
      if (h + a > 2) over25 += p;
      if (h > 0 && a > 0) btts += p;
    }
    grid.push(row);
  }
  const norm = p1 + pX + p2;
  p1 = (p1 / norm) * 100;
  pX = (pX / norm) * 100;
  p2 = (p2 / norm) * 100;

  // İlk yarı: toplam golün ortalama ~%42'si ilk yarıda atılır (istatistiksel kabul)
  const FIRST_HALF_RATIO = 0.42;
  const h1Exp = homeExp * FIRST_HALF_RATIO;
  const a1Exp = awayExp * FIRST_HALF_RATIO;
  let ih1 = 0, ihX = 0, ih2 = 0, ihOver05 = 0, ihOver15 = 0;
  for (let h = 0; h <= 5; h++) {
    for (let a = 0; a <= 5; a++) {
      const p = poissonPMF(h, h1Exp) * poissonPMF(a, a1Exp);
      if (h > a) ih1 += p;
      else if (h === a) ihX += p;
      else ih2 += p;
      if (h + a > 0) ihOver05 += p;
      if (h + a > 1) ihOver15 += p;
    }
  }
  const ihNorm = ih1 + ihX + ih2;

  const scoreList = [];
  for (let hh = 0; hh <= 5; hh++) {
    for (let aa = 0; aa <= 5; aa++) {
      scoreList.push({ h: hh, a: aa, p: grid[hh][aa] * 100 });
    }
  }
  scoreList.sort((x, y) => y.p - x.p);
  const topScores = scoreList.slice(0, 5);

  return {
    homeExp,
    awayExp,
    p1, pX, p2,
    over25: over25 * 100,
    under25: 100 - over25 * 100,
    btts: btts * 100,
    doubleChance: { oneX: p1 + pX, oneTwo: p1 + p2, xTwo: pX + p2 },
    firstHalf: {
      h1: (ih1 / ihNorm) * 100,
      hX: (ihX / ihNorm) * 100,
      h2: (ih2 / ihNorm) * 100,
      over05: ihOver05 * 100,
      over15: ihOver15 * 100,
    },
    topScores,
  };
}
function formFactor(form) {
  // form: 0-10 puan -> hafif çarpan 0.85 - 1.15
  return 0.85 + (form / 10) * 0.3;
}

// ---------- Başlangıç verisi (2026 Dünya Kupası, gerçek sonuçlara dayalı yaklaşık güç puanları) ----------
const initialTeams = {
  FRA: { name: "Fransa", attack: 1.9, defense: 0.8, form: 8, flag: "🇫🇷" },
  ESP: { name: "İspanya", attack: 1.6, defense: 0.6, form: 8, flag: "🇪🇸" },
  ENG: { name: "İngiltere", attack: 2.3, defense: 1.4, form: 7, flag: "🏴" },
  ARG: { name: "Arjantin", attack: 2.9, defense: 1.4, form: 9, flag: "🇦🇷" },
  KUPS: { name: "Kuopion Palloseura", attack: 1.7, defense: 0.9, form: 7, flag: "🇫🇮" },
  VARD: { name: "Vardar Skopje", attack: 1.0, defense: 1.6, form: 4, flag: "🇲🇰" },
  LEVS: { name: "Levski Sofia", attack: 2.1, defense: 0.6, form: 8, flag: "🇧🇬" },
  BORA: { name: "Borac Banja Luka", attack: 0.8, defense: 1.9, form: 3, flag: "🇧🇦" },
  LARN: { name: "Larne FC", attack: 2.2, defense: 0.5, form: 8, flag: "🇬🇧" },
  TREF: { name: "Tre Fiori", attack: 0.6, defense: 2.1, form: 2, flag: "🇸🇲" },
  SHAM: { name: "Shamrock Rovers", attack: 1.9, defense: 0.7, form: 7, flag: "🇮🇪" },
  FLOR: { name: "Floriana FC", attack: 0.9, defense: 1.7, form: 4, flag: "🇲🇹" },
  MTL: { name: "CF Montreal", attack: 1.6, defense: 1.1, form: 6, flag: "⚽" },
  TOR: { name: "Toronto FC", attack: 1.1, defense: 1.4, form: 4, flag: "⚽" },
  CHI: { name: "Chicago Fire", attack: 1.3, defense: 1.3, form: 5, flag: "⚽" },
  VAN: { name: "Vancouver Whitecaps", attack: 1.7, defense: 1.0, form: 7, flag: "⚽" },
  STL: { name: "Saint Louis City", attack: 2.0, defense: 0.8, form: 8, flag: "⚽" },
  SKC: { name: "Sporting Kansas City", attack: 0.9, defense: 1.8, form: 3, flag: "⚽" },
  SEA: { name: "Seattle Sounders", attack: 1.9, defense: 0.8, form: 8, flag: "⚽" },
  POR2: { name: "Portland Timbers", attack: 0.9, defense: 1.7, form: 3, flag: "⚽" },
  NSH: { name: "Nashville SC", attack: 1.9, defense: 0.8, form: 8, flag: "⚽" },
  ATL: { name: "Atlanta United", attack: 0.8, defense: 1.8, form: 3, flag: "⚽" },
  LA: { name: "LA Galaxy", attack: 1.4, defense: 1.2, form: 6, flag: "⚽" },
  LAFC: { name: "LAFC", attack: 1.5, defense: 1.1, form: 6, flag: "⚽" },
};

const initialFixtures = [
  { id: "sf1", homeKey: "FRA", awayKey: "ESP", date: "14 Tem 22:00", round: "Dünya Kupası · Yarı Final", apiProb: { home: 40.9, draw: 29.3, away: 29.8 }, h2h: "Son 5 karşılaşmada dengeli; İspanya top hakimiyetinde önde, Fransa kontratakta etkili.", kickoffISO: "2026-07-14T19:00:00Z" },
  { id: "sf2", homeKey: "ENG", awayKey: "ARG", date: "15 Tem 22:00", round: "Dünya Kupası · Yarı Final", apiProb: { home: 36.9, draw: 31.5, away: 31.6 }, kickoffISO: "2026-07-15T19:00:00Z" },
  { id: "cl1", homeKey: "KUPS", awayKey: "VARD", date: "14 Tem 18:00", round: "Şampiyonlar Ligi Ön Eleme", apiProb: { home: 58.7, draw: 21.8, away: 19.5 }, kickoffISO: "2026-07-14T15:00:00Z" },
  { id: "cl2", homeKey: "LEVS", awayKey: "BORA", date: "14 Tem 20:30", round: "Şampiyonlar Ligi Ön Eleme", apiProb: { home: 73.7, draw: 18, away: 8.3 }, kickoffISO: "2026-07-14T17:30:00Z" },
  { id: "cl3", homeKey: "LARN", awayKey: "TREF", date: "14 Tem 22:00", round: "Şampiyonlar Ligi Ön Eleme", apiProb: { home: 83, draw: 11.8, away: 5.2 }, kickoffISO: "2026-07-14T19:00:00Z" },
  { id: "cl4", homeKey: "SHAM", awayKey: "FLOR", date: "14 Tem 22:00", round: "Şampiyonlar Ligi Ön Eleme", apiProb: { home: 73.3, draw: 17.1, away: 9.6 }, kickoffISO: "2026-07-14T19:00:00Z" },
  { id: "mls1", homeKey: "MTL", awayKey: "TOR", date: "17 Tem 02:30", round: "MLS", apiProb: { home: 48.3, draw: 25.3, away: 26.4 }, kickoffISO: "2026-07-16T23:30:00Z" },
  { id: "mls2", homeKey: "CHI", awayKey: "VAN", date: "17 Tem 03:30", round: "MLS", apiProb: { home: 33.2, draw: 25.2, away: 41.6 }, kickoffISO: "2026-07-17T00:30:00Z" },
  { id: "mls3", homeKey: "STL", awayKey: "SKC", date: "17 Tem 03:30", round: "MLS", apiProb: { home: 66.6, draw: 18.3, away: 15.1 }, kickoffISO: "2026-07-17T00:30:00Z" },
  { id: "mls4", homeKey: "SEA", awayKey: "POR2", date: "17 Tem 05:30", round: "MLS", apiProb: { home: 64.6, draw: 18.9, away: 16.5 }, kickoffISO: "2026-07-17T02:30:00Z" },
  { id: "mls5", homeKey: "NSH", awayKey: "ATL", date: "18 Tem 03:10", round: "MLS", apiProb: { home: 66.1, draw: 19.9, away: 14 }, kickoffISO: "2026-07-18T00:10:00Z" },
  { id: "mls6", homeKey: "LA", awayKey: "LAFC", date: "18 Tem 05:25", round: "MLS", apiProb: { home: 34.5, draw: 25.6, away: 39.9 }, kickoffISO: "2026-07-18T02:25:00Z" },
];

function ProbBar({ label, value, tone }) {
  return (
    <div className="probRow">
      <span className="probLabel">{label}</span>
      <div className="probTrack">
        <div
          className={`probFill tone-${tone}`}
          style={{ width: `${Math.max(2, value)}%` }}
        />
      </div>
      <span className="probValue">%{value.toFixed(1)}</span>
    </div>
  );
}

function FlipDigit({ pct, label, hot }) {
  return (
    <div className={`flipDigit ${hot ? "flipHot" : ""}`}>
      <div className="flipTop">{label}</div>
      <div className="flipNum">{pct.toFixed(0)}</div>
    </div>
  );
}

function CountdownTimer({ kickoffISO }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!kickoffISO) return null;
  const diff = new Date(kickoffISO).getTime() - now;
  if (diff <= 0) return <span className="countdownLive">🔴 Başladı / bitti</span>;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return (
    <span className="countdown">
      ⏱ {days > 0 ? `${days}g ` : ""}{String(hours).padStart(2, "0")}:{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </span>
  );
}

function MatchCard({ match, teams, onSave }) {
  const home = teams[match.homeKey];
  const away = teams[match.awayKey];
  const result = useMemo(() => computeMatch(home, away), [home, away]);
  const [open, setOpen] = useState(false);

  const best = Math.max(result.p1, result.pX, result.p2);
  const bestLabel = result.p1 === best ? "MS1" : result.pX === best ? "MS X" : "MS2";

  let valueTag = null;
  if (match.apiProb) {
    const diffs = [
      { label: "MS1", diff: result.p1 - match.apiProb.home },
      { label: "MS X", diff: result.pX - match.apiProb.draw },
      { label: "MS2", diff: result.p2 - match.apiProb.away },
    ];
    const top = diffs.reduce((a, b) => (b.diff > a.diff ? b : a));
    if (top.diff >= 8) valueTag = top;
  }

  return (
    <div className="ticket">
      <div className="ticketHead">
        <span className="round">{match.round}</span>
        <span className="date">{match.date}</span>
      </div>
      {match.kickoffISO && (
        <div className="countdownRow"><CountdownTimer kickoffISO={match.kickoffISO} /></div>
      )}

      {valueTag && (
        <div className="valueBadge">💡 Değer sinyali: {valueTag.label} — model, kaynak orana göre %{valueTag.diff.toFixed(1)} daha yüksek olasılık veriyor</div>
      )}

      <div className="teamsRow">
        <div className="teamBlock">
          <span className="flag">{home.flag}</span>
          <span className="teamName">{home.name}</span>
        </div>
        <span className="vs">VS</span>
        <div className="teamBlock right">
          <span className="teamName">{away.name}</span>
          <span className="flag">{away.flag}</span>
        </div>
      </div>

      <div className="flipRow">
        <FlipDigit pct={result.p1} label="MS 1" hot={result.p1 === best} />
        <FlipDigit pct={result.pX} label="MS X" hot={result.pX === best} />
        <FlipDigit pct={result.p2} label="MS 2" hot={result.p2 === best} />
      </div>

      <div className="expGoals">
        Beklenen skor:{" "}
        <b>
          {result.homeExp.toFixed(2)} – {result.awayExp.toFixed(2)}
        </b>
      </div>

      {match.h2h && (
        <div className="h2hNote">📋 H2H notu: {match.h2h}</div>
      )}
      {(home.injuryNote || away.injuryNote) && (
        <div className="h2hNote">
          {home.injuryNote && <div>🩹 {home.name}: {home.injuryNote}</div>}
          {away.injuryNote && <div>🩹 {away.name}: {away.injuryNote}</div>}
        </div>
      )}

      {match.apiProb && (
        <div className="compareRow">
          <span>Kaynak oran: MS1 %{match.apiProb.home.toFixed(1)} · X %{match.apiProb.draw.toFixed(1)} · MS2 %{match.apiProb.away.toFixed(1)}</span>
          <span>Model: MS1 %{result.p1.toFixed(1)} · X %{result.pX.toFixed(1)} · MS2 %{result.p2.toFixed(1)}</span>
        </div>
      )}

      <button className="toggleBtn" onClick={() => setOpen(!open)}>
        {open ? "Detayı gizle ▲" : "İstatistik detayı ▼"}
      </button>

      {open && (
        <div className="detail">
          <ProbBar label="2.5 ÜST" value={result.over25} tone="amber" />
          <ProbBar label="2.5 ALT" value={result.under25} tone="teal" />
          <ProbBar label="KG VAR" value={result.btts} tone="amber" />

          <div className="ratingTitle" style={{ marginTop: 12 }}>En olası 5 skor</div>
          <div className="scoreGrid">
            {result.topScores.map((s, i) => (
              <div className="scoreChip" key={i}>
                <b>{s.h}-{s.a}</b>
                <span>%{s.p.toFixed(1)}</span>
              </div>
            ))}
          </div>

          <div className="ratingGrid">
            <div>
              <div className="ratingTitle">{home.name}</div>
              <div>Hücum: {home.attack.toFixed(2)}</div>
              <div>Savunma: {home.defense.toFixed(2)}</div>
              <div>Form: {home.form}/10</div>
            </div>
            <div>
              <div className="ratingTitle">{away.name}</div>
              <div>Hücum: {away.attack.toFixed(2)}</div>
              <div>Savunma: {away.defense.toFixed(2)}</div>
              <div>Form: {away.form}/10</div>
            </div>
          </div>
          <button
            className="saveBtn"
            onClick={() =>
              onSave({
                id: `${match.id}-${Date.now()}`,
                label: `${home.name} - ${away.name}`,
                date: match.date,
                p1: result.p1,
                pX: result.pX,
                p2: result.p2,
                pick: bestLabel,
                pickProb: best,
                status: "pending",
                homeKey: match.homeKey,
                awayKey: match.awayKey,
                savedAt: new Date().toLocaleString("tr-TR"),
              })
            }
          >
            Kupona kaydet
          </button>

          <button
            className="toggleBtn"
            style={{ marginLeft: 12 }}
            onClick={() => {
              const text = `${home.name} - ${away.name}\n${match.date}\nMS1 %${result.p1.toFixed(1)} · X %${result.pX.toFixed(1)} · MS2 %${result.p2.toFixed(1)}\nModel önerisi: ${bestLabel}\nBeklenen skor: ${result.homeExp.toFixed(1)}-${result.awayExp.toFixed(1)}\n(Maç Analiz Masası ile hesaplandı, kesin sonuç garantisi değildir)`;
              if (navigator.clipboard) {
                navigator.clipboard.writeText(text).catch(() => {});
              }
            }}
          >
            📋 Kopyala / Paylaş
          </button>
        </div>
      )}
    </div>
  );
}

function AddMatchForm({ onAdd }) {
  const [homeName, setHomeName] = useState("");
  const [awayName, setAwayName] = useState("");
  const [homeAtk, setHomeAtk] = useState(1.5);
  const [homeDef, setHomeDef] = useState(1.2);
  const [awayAtk, setAwayAtk] = useState(1.5);
  const [awayDef, setAwayDef] = useState(1.2);
  const [homeForm, setHomeForm] = useState(6);
  const [awayForm, setAwayForm] = useState(6);
  const [homeInjury, setHomeInjury] = useState("");
  const [awayInjury, setAwayInjury] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!homeName.trim() || !awayName.trim()) return;
    const homeAtkFinal = homeInjury.trim() ? +homeAtk * 0.85 : +homeAtk;
    const awayAtkFinal = awayInjury.trim() ? +awayAtk * 0.85 : +awayAtk;
    onAdd({
      home: { name: homeName, attack: homeAtkFinal, defense: +homeDef, form: +homeForm, flag: "⚽", injuryNote: homeInjury.trim() || null },
      away: { name: awayName, attack: awayAtkFinal, defense: +awayDef, form: +awayForm, flag: "⚽", injuryNote: awayInjury.trim() || null },
    });
    setHomeName("");
    setAwayName("");
    setHomeInjury("");
    setAwayInjury("");
  };

  return (
    <form className="addForm" onSubmit={submit}>
      <div className="addGrid">
        <div className="addCol">
          <label>Ev sahibi takım</label>
          <input value={homeName} onChange={(e) => setHomeName(e.target.value)} placeholder="örn. Galatasaray" />
          <label>Hücum gücü (maç başı ort. gol) </label>
          <input type="number" step="0.1" min="0" max="4" value={homeAtk} onChange={(e) => setHomeAtk(e.target.value)} />
          <label>Savunma zaafı (maç başı ort. yenen gol)</label>
          <input type="number" step="0.1" min="0" max="4" value={homeDef} onChange={(e) => setHomeDef(e.target.value)} />
          <label>Form (0-10)</label>
          <input type="range" min="0" max="10" value={homeForm} onChange={(e) => setHomeForm(e.target.value)} />
          <label>Sakatlık/ceza notu (opsiyonel)</label>
          <input value={homeInjury} onChange={(e) => setHomeInjury(e.target.value)} placeholder="örn. 2 kilit oyuncu sakat" />
        </div>
        <div className="addCol">
          <label>Deplasman takımı</label>
          <input value={awayName} onChange={(e) => setAwayName(e.target.value)} placeholder="örn. Fenerbahçe" />
          <label>Hücum gücü (maç başı ort. gol)</label>
          <input type="number" step="0.1" min="0" max="4" value={awayAtk} onChange={(e) => setAwayAtk(e.target.value)} />
          <label>Savunma zaafı (maç başı ort. yenen gol)</label>
          <input type="number" step="0.1" min="0" max="4" value={awayDef} onChange={(e) => setAwayDef(e.target.value)} />
          <label>Form (0-10)</label>
          <input type="range" min="0" max="10" value={awayForm} onChange={(e) => setAwayForm(e.target.value)} />
          <label>Sakatlık/ceza notu (opsiyonel)</label>
          <input value={awayInjury} onChange={(e) => setAwayInjury(e.target.value)} placeholder="örn. Kaptan cezalı" />
        </div>
      </div>
      <button type="submit" className="addBtn">Maçı hesapla ve ekle</button>
    </form>
  );
}

function CameraAnalyzer({ onAdd }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // idle, streaming, captured, analyzing, done, error
  const [imageData, setImageData] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setPhase("streaming");
      // videoRef henüz DOM'a girmemiş olabilir, bir sonraki tick'te bağla
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 0);
    } catch (e) {
      setErrorMsg("Kameraya erişilemedi. Tarayıcı izinlerini kontrol et.");
      setPhase("error");
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setImageData(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
    setPhase("captured");
  };

  const retake = () => {
    setImageData(null);
    setResult(null);
    startCamera();
  };

  const analyze = async () => {
    setPhase("analyzing");
    setErrorMsg("");
    try {
      const base64 = imageData.split(",")[1];
      const prompt = `Bu görselde bir futbol maçına ait bilgiler olabilir (takım isimleri, bahis oranları, kadro, form/istatistik tablosu vb). Görseli incele ve SADECE aşağıdaki JSON formatında, başka hiçbir açıklama eklemeden, markdown olmadan yanıt ver:
{"home_team": string|null, "away_team": string|null, "odds_home": number|null, "odds_draw": number|null, "odds_away": number|null, "notes": string}
Bir bilgi görselde yoksa null bırak. notes alanına görselde dikkat çeken kısa istatistiksel gözlemleri (form, sakatlık, sıralama gibi) en fazla 2 cümlede yaz. Kesin sonuç tahmini yapma, sadece gördüğünü raporla.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).map((c) => c.text || "").join("\n");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
      setPhase("done");
    } catch (e) {
      setErrorMsg("Analiz başarısız oldu, görsel net değil olabilir. Tekrar dener misin?");
      setPhase("error");
    }
  };

  const impliedProbs = () => {
    if (!result) return null;
    const { odds_home, odds_draw, odds_away } = result;
    if (!odds_home || !odds_draw || !odds_away) return null;
    const invs = [1 / odds_home, 1 / odds_draw, 1 / odds_away];
    const sum = invs.reduce((a, b) => a + b, 0);
    return { home: (invs[0] / sum) * 100, draw: (invs[1] / sum) * 100, away: (invs[2] / sum) * 100 };
  };
  const implied = impliedProbs();

  const applyResult = () => {
    if (!result) return;
    onAdd({
      home: { name: result.home_team || "Ev Sahibi", attack: 1.35, defense: 1.2, form: 6, flag: "⚽" },
      away: { name: result.away_team || "Deplasman", attack: 1.35, defense: 1.2, form: 6, flag: "⚽" },
    });
  };

  return (
    <div className="cameraBox">
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {phase === "idle" && (
        <div className="camIdle">
          <div className="camIcon">📷</div>
          <p>Kuponu, oran panosunu ya da ekrandaki istatistik tablosunu fotoğrafla — takım isimlerini ve oranları okuyup modelin hesabıyla karşılaştırayım.</p>
          <button className="addBtn" onClick={startCamera}>Kamerayı Aç</button>
        </div>
      )}

      {phase === "streaming" && (
        <div className="camStream">
          <video ref={videoRef} className="camVideo" playsInline muted />
          <button className="addBtn" onClick={takePhoto}>Fotoğrafı Çek</button>
        </div>
      )}

      {phase === "captured" && (
        <div className="camPreview">
          <img src={imageData} alt="Çekilen fotoğraf" className="camImg" />
          <div className="camBtnRow">
            <button className="toggleBtn" onClick={retake}>Tekrar Çek</button>
            <button className="addBtn" onClick={analyze}>AI ile Oku</button>
          </div>
        </div>
      )}

      {phase === "analyzing" && (
        <div className="camIdle"><p>AI görseli okuyor…</p></div>
      )}

      {phase === "error" && (
        <div className="camIdle">
          <p style={{ color: "#C1443A" }}>{errorMsg}</p>
          <button className="addBtn" onClick={startCamera}>Tekrar Dene</button>
        </div>
      )}

      {phase === "done" && result && (
        <div className="camResult">
          <div className="ratingTitle">Görselden okunanlar</div>
          <div className="camReadout">
            <div>Ev sahibi: <b>{result.home_team || "okunamadı"}</b></div>
            <div>Deplasman: <b>{result.away_team || "okunamadı"}</b></div>
            {result.notes && <div className="camNotes">"{result.notes}"</div>}
          </div>

          {implied ? (
            <>
              <div className="ratingTitle" style={{ marginTop: 14 }}>Bahis oranı vs. model karşılaştırması</div>
              <ProbBar label="MS1" value={implied.home} tone="teal" />
              <ProbBar label="MS X" value={implied.draw} tone="teal" />
              <ProbBar label="MS2" value={implied.away} tone="teal" />
              <div className="camNotes">Yukarıdaki, panodaki oranların ima ettiği olasılık (teal). Maçı ekledikten sonra modelin kendi hesabıyla (amber) karşılaştırabilirsin — aradaki fark olası "değer" alanını gösterir, kesin sonuç değildir.</div>
            </>
          ) : (
            <div className="camNotes">Görselde net bir oran okunamadı — sadece takım isimleriyle ekleyeceğim, güç puanlarını "Özel Maç Ekle"den düzenleyebilirsin.</div>
          )}

          <div className="camBtnRow" style={{ marginTop: 14 }}>
            <button className="toggleBtn" onClick={retake}>Yeni Fotoğraf</button>
            <button className="addBtn" onClick={applyResult}>Maça Ekle</button>
          </div>
        </div>
      )}
    </div>
  );
}

function KombineHesap() {
  const [legs, setLegs] = useState([
    { id: 1, name: "", odd: "" },
    { id: 2, name: "", odd: "" },
  ]);

  const addLeg = () => setLegs((l) => [...l, { id: Date.now(), name: "", odd: "" }]);
  const removeLeg = (id) => setLegs((l) => (l.length > 1 ? l.filter((x) => x.id !== id) : l));
  const updateLeg = (id, field, val) =>
    setLegs((l) => l.map((x) => (x.id === id ? { ...x, [field]: val } : x)));

  const parsed = legs.map((l) => parseFloat(String(l.odd).replace(",", ".")));
  const valid = parsed.filter((p) => p > 1);
  const totalOdd = valid.length > 0 ? valid.reduce((a, b) => a * b, 1) : 0;
  const impliedProb = totalOdd > 0 ? (1 / totalOdd) * 100 : 0;

  const [stake, setStake] = useState("100");
  const stakeNum = parseFloat(String(stake).replace(",", ".")) || 0;
  const potentialWin = totalOdd * stakeNum;

  return (
    <div className="cameraBox">
      <div className="ratingTitle" style={{ marginBottom: 10 }}>Kombine Kupon Hesaplayıcı</div>
      {legs.map((leg, i) => (
        <div className="legRow" key={leg.id}>
          <span className="legNum">{i + 1}</span>
          <input
            className="legName"
            type="text"
            value={leg.name}
            onChange={(e) => updateLeg(leg.id, "name", e.target.value)}
            placeholder="Maç / seçim (örn. Galatasaray MS1)"
          />
          <input
            className="legOdd"
            type="text"
            inputMode="decimal"
            value={leg.odd}
            onChange={(e) => updateLeg(leg.id, "odd", e.target.value)}
            placeholder="Oran"
          />
          <button className="legDel" onClick={() => removeLeg(leg.id)}>✕</button>
        </div>
      ))}
      <button className="toggleBtn" style={{ marginTop: 8 }} onClick={addLeg}>+ Maç ekle</button>

      <div className="kombineResult">
        <div className="kombineBig">
          <span>Toplam Oran</span>
          <b>{totalOdd.toFixed(2)}</b>
        </div>
        <div className="kombineBig">
          <span>İma edilen olasılık</span>
          <b>%{impliedProb.toFixed(1)}</b>
        </div>
      </div>

      <div className="stakeRow">
        <label>Yatırılan tutar (₺)</label>
        <input type="text" inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)} />
        <div className="stakeWin">Olası kazanç: <b>{potentialWin.toFixed(2)} ₺</b></div>
      </div>

      <div className="camNotes">
        Kombine oranlar çarpılarak hesaplanır; her maç eklendiğinde tutma olasılığı düşer — {valid.length} maçlık bu kuponun matematiksel tutma ihtimali sadece %{impliedProb.toFixed(1)}. Bahisçi marjı her bacakta ayrı ayrı işlediği için gerçek şansın bundan da düşüktür.
      </div>
    </div>
  );
}

function BookmakerCompare() {
  const [rows, setRows] = useState([
    { id: 1, name: "", oddsHome: "", oddsDraw: "", oddsAway: "" },
    { id: 2, name: "", oddsHome: "", oddsDraw: "", oddsAway: "" },
  ]);
  const addRow = () => setRows((r) => [...r, { id: Date.now(), name: "", oddsHome: "", oddsDraw: "", oddsAway: "" }]);
  const removeRow = (id) => setRows((r) => (r.length > 1 ? r.filter((x) => x.id !== id) : r));
  const update = (id, field, val) => setRows((r) => r.map((x) => (x.id === id ? { ...x, [field]: val } : x)));

  const num = (v) => parseFloat(String(v).replace(",", "."));
  const bestHome = Math.max(...rows.map((r) => num(r.oddsHome)).filter((v) => v > 1), 0);
  const bestDraw = Math.max(...rows.map((r) => num(r.oddsDraw)).filter((v) => v > 1), 0);
  const bestAway = Math.max(...rows.map((r) => num(r.oddsAway)).filter((v) => v > 1), 0);

  return (
    <div className="cameraBox">
      <div className="ratingTitle" style={{ marginBottom: 10 }}>Bahisçi Oran Karşılaştırma</div>
      <div className="bookHeaderRow">
        <span>Bahisçi</span><span>MS1</span><span>X</span><span>MS2</span><span></span>
      </div>
      {rows.map((r) => (
        <div className="bookRow" key={r.id}>
          <input value={r.name} onChange={(e) => update(r.id, "name", e.target.value)} placeholder="isim" className="bookName" />
          <input value={r.oddsHome} onChange={(e) => update(r.id, "oddsHome", e.target.value)} inputMode="decimal" className={`bookOdd ${num(r.oddsHome) === bestHome && bestHome > 0 ? "bookBest" : ""}`} />
          <input value={r.oddsDraw} onChange={(e) => update(r.id, "oddsDraw", e.target.value)} inputMode="decimal" className={`bookOdd ${num(r.oddsDraw) === bestDraw && bestDraw > 0 ? "bookBest" : ""}`} />
          <input value={r.oddsAway} onChange={(e) => update(r.id, "oddsAway", e.target.value)} inputMode="decimal" className={`bookOdd ${num(r.oddsAway) === bestAway && bestAway > 0 ? "bookBest" : ""}`} />
          <button className="legDel" onClick={() => removeRow(r.id)}>✕</button>
        </div>
      ))}
      <button className="toggleBtn" style={{ marginTop: 8 }} onClick={addRow}>+ Bahisçi ekle</button>
      {bestHome > 0 && (
        <div className="camNotes" style={{ marginTop: 14 }}>
          En iyi oranlar yeşil ile işaretlendi — her sonuç için farklı bahisçide olabilir, "değer avcılığı" (line shopping) mantığı budur.
        </div>
      )}
    </div>
  );
}

function Favoriler({ favorites, onAdd, onRemove }) {
  const [text, setText] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };
  return (
    <div className="cameraBox">
      <div className="ratingTitle" style={{ marginBottom: 10 }}>İzleme Listesi</div>
      <form onSubmit={submit} className="favForm">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="örn. Cuma günü Beşiktaş derbisini takip et" className="legName" />
        <button type="submit" className="addBtn" style={{ width: "auto", padding: "10px 16px" }}>Ekle</button>
      </form>
      {favorites.length === 0 && <div className="empty">Henüz izleme listesine bir şey eklenmedi.</div>}
      {favorites.map((f) => (
        <div className="favItem" key={f.id}>
          <span>{f.text}</span>
          <button className="legDel" onClick={() => onRemove(f.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

function OranCevirici() {
  const [decimal, setDecimal] = useState("1.85");
  const d = parseFloat(String(decimal).replace(",", "."));
  const valid = d > 1;
  const fractionalStr = () => {
    if (!valid) return "-";
    const frac = d - 1;
    let bestNum = 1, bestDen = 1, bestErr = Infinity;
    for (let den = 1; den <= 20; den++) {
      const num = Math.round(frac * den);
      const err = Math.abs(frac - num / den);
      if (err < bestErr && num > 0) { bestErr = err; bestNum = num; bestDen = den; }
    }
    return `${bestNum}/${bestDen}`;
  };
  const american = valid ? (d >= 2 ? `+${Math.round((d - 1) * 100)}` : `${Math.round(-100 / (d - 1))}`) : "-";
  const implied = valid ? ((1 / d) * 100).toFixed(1) : "-";

  return (
    <div className="cameraBox">
      <div className="ratingTitle" style={{ marginBottom: 10 }}>Oran Formatı Çevirici</div>
      <label style={{ fontSize: 11, color: "#B9C9BE", fontFamily: "'IBM Plex Mono', monospace" }}>Decimal oranı gir (örn. 1.85)</label>
      <input type="text" inputMode="decimal" value={decimal} onChange={(e) => setDecimal(e.target.value)} className="legName" style={{ marginTop: 6, marginBottom: 16 }} />
      <div className="kombineResult">
        <div className="kombineBig"><span>Fractional</span><b>{fractionalStr()}</b></div>
        <div className="kombineBig"><span>Amerikan</span><b>{american}</b></div>
      </div>
      <div className="kombineBig" style={{ marginTop: 12 }}><span>İma edilen olasılık</span><b>%{implied}</b></div>
    </div>
  );
}

function TeamRanking({ teams }) {
  const rows = Object.entries(teams).map(([key, t]) => ({
    key,
    ...t,
    power: t.attack - t.defense + t.form / 10,
  })).sort((a, b) => b.power - a.power);

  return (
    <div className="cameraBox">
      <div className="ratingTitle" style={{ marginBottom: 10 }}>Takım Güç Sıralaması</div>
      <div className="rankHeaderRow">
        <span>#</span><span>Takım</span><span>Hücum</span><span>Savunma</span><span>Form</span><span>Güç</span>
      </div>
      {rows.map((r, i) => (
        <div className="rankRow" key={r.key}>
          <span className="rankNum">{i + 1}</span>
          <span className="rankName">{r.flag} {r.name}{r.injuryNote ? " 🩹" : ""}</span>
          <span>{r.attack.toFixed(2)}</span>
          <span>{r.defense.toFixed(2)}</span>
          <span>{r.form.toFixed(1)}</span>
          <span className="rankPower">{r.power.toFixed(2)}</span>
        </div>
      ))}
      <div className="camNotes" style={{ marginTop: 12 }}>
        Güç puanı = Hücum − Savunma + Form/10. Sadece karşılaştırma amaçlı basit bir özet, maç bazlı Poisson hesabının yerini tutmaz. 🩹 sakatlık/ceza notu olan takımları gösterir.
      </div>
    </div>
  );
}

function OddsPredictor({ onAdd }) {
  const [homeName, setHomeName] = useState("");
  const [awayName, setAwayName] = useState("");
  const [oddsHome, setOddsHome] = useState("");
  const [oddsDraw, setOddsDraw] = useState("");
  const [oddsAway, setOddsAway] = useState("");
  const [oddsOver, setOddsOver] = useState("");
  const [oddsUnder, setOddsUnder] = useState("");

  const h = parseFloat(String(oddsHome).replace(",", "."));
  const d = parseFloat(String(oddsDraw).replace(",", "."));
  const a = parseFloat(String(oddsAway).replace(",", "."));
  const validMain = h > 1 && d > 1 && a > 1;

  let calc = null;
  if (validMain) {
    const invs = [1 / h, 1 / d, 1 / a];
    const overround = invs.reduce((x, y) => x + y, 0);
    const margin = (overround - 1) * 100;
    const probs = invs.map((v) => (v / overround) * 100);
    const labels = ["MS1", "MS X", "MS2"];
    const maxIdx = probs.indexOf(Math.max(...probs));
    calc = {
      probs: { home: probs[0], draw: probs[1], away: probs[2] },
      margin,
      pick: labels[maxIdx],
      pickProb: probs[maxIdx],
    };
  }

  const ov = parseFloat(String(oddsOver).replace(",", "."));
  const un = parseFloat(String(oddsUnder).replace(",", "."));
  let ouCalc = null;
  if (ov > 1 && un > 1) {
    const invO = 1 / ov, invU = 1 / un;
    const sum = invO + invU;
    ouCalc = { over: (invO / sum) * 100, under: (invU / sum) * 100 };
  }

  const applyMatch = () => {
    if (!calc) return;
    onAdd({
      home: { name: homeName || "Ev Sahibi", attack: 1.2 + (calc.probs.home / 100) * 1.6, defense: 0.6 + (calc.probs.away / 100) * 1.2, form: 5, flag: "⚽" },
      away: { name: awayName || "Deplasman", attack: 1.2 + (calc.probs.away / 100) * 1.6, defense: 0.6 + (calc.probs.home / 100) * 1.2, form: 5, flag: "⚽" },
    });
  };

  return (
    <div className="cameraBox">
      <div className="ratingTitle" style={{ marginBottom: 10 }}>Oranları gir, tahmini gör</div>
      <div className="addGrid" style={{ marginBottom: 6 }}>
        <div className="addCol">
          <label>Ev sahibi adı (opsiyonel)</label>
          <input value={homeName} onChange={(e) => setHomeName(e.target.value)} placeholder="örn. Galatasaray" />
        </div>
        <div className="addCol">
          <label>Deplasman adı (opsiyonel)</label>
          <input value={awayName} onChange={(e) => setAwayName(e.target.value)} placeholder="örn. Fenerbahçe" />
        </div>
      </div>
      <div className="addGrid">
        <div className="addCol">
          <label>MS1 oranı</label>
          <input type="text" inputMode="decimal" value={oddsHome} onChange={(e) => setOddsHome(e.target.value)} placeholder="örn. 1.85" />
        </div>
        <div className="addCol">
          <label>MS X oranı</label>
          <input type="text" inputMode="decimal" value={oddsDraw} onChange={(e) => setOddsDraw(e.target.value)} placeholder="örn. 3.40" />
        </div>
      </div>
      <div className="addGrid">
        <div className="addCol">
          <label>MS2 oranı</label>
          <input type="text" inputMode="decimal" value={oddsAway} onChange={(e) => setOddsAway(e.target.value)} placeholder="örn. 4.20" />
        </div>
        <div className="addCol">
          <label>2.5 Üst / Alt (opsiyonel)</label>
          <input type="text" inputMode="decimal" value={oddsOver} onChange={(e) => setOddsOver(e.target.value)} placeholder="Üst örn. 1.90" />
          <input type="text" inputMode="decimal" value={oddsUnder} onChange={(e) => setOddsUnder(e.target.value)} placeholder="Alt örn. 1.95" style={{ marginTop: 6 }} />
        </div>
      </div>

      {calc && (
        <div className="detail" style={{ marginTop: 16 }}>
          <ProbBar label="MS1" value={calc.probs.home} tone="amber" />
          <ProbBar label="MS X" value={calc.probs.draw} tone="teal" />
          <ProbBar label="MS2" value={calc.probs.away} tone="amber" />

          <div className="camNotes" style={{ marginTop: 10 }}>
            Bahisçi marjı (vig): %{calc.margin.toFixed(1)} — oranlara dahil edilen kâr payı, gerçek olasılıklar yukarıdaki gibi bu pay ayıklanarak hesaplandı.
          </div>

          <div className="pickBanner">
            Model önerisi: <b>{calc.pick}</b> (%{calc.pickProb.toFixed(1)} olasılık)
          </div>

          {ouCalc && (
            <>
              <ProbBar label="2.5 ÜST" value={ouCalc.over} tone="amber" />
              <ProbBar label="2.5 ALT" value={ouCalc.under} tone="teal" />
            </>
          )}

          <button className="addBtn" style={{ marginTop: 12 }} onClick={applyMatch}>
            Bu Maçı Panele Ekle
          </button>
        </div>
      )}

      <div className="camNotes" style={{ marginTop: 14 }}>
        Bu hesap sadece bahisçinin fiyatladığı oranı matematiksel olarak yorumluyor (implied probability). Maçın gerçekte nasıl biteceğini garanti etmez — bahisçi de yanılabilir.
      </div>
    </div>
  );
}

export default function MacAnalizMasasi() {
  const [teams, setTeams] = useState(initialTeams);
  const [fixtures, setFixtures] = useState(initialFixtures);
  const [liveDataStatus, setLiveDataStatus] = useState("idle"); // idle, loading, ok, failed
  const [liveDataUrl, setLiveDataUrl] = useState("");
  const [tab, setTab] = useState("dunya-kupasi");
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("kupon-gecmisi", false);
        if (res && res.value) setHistory(JSON.parse(res.value));
      } catch (e) {
        // henüz kayıt yok
      }
      try {
        const res3 = await window.storage.get("favoriler-listesi", false);
        if (res3 && res3.value) setFavorites(JSON.parse(res3.value));
      } catch (e) {
        // henüz kayıt yok
      }
      try {
        const res2 = await window.storage.get("takim-formlari", false);
        if (res2 && res2.value) {
          const savedTeams = JSON.parse(res2.value);
          setTeams((t) => ({ ...t, ...savedTeams }));
        }
      } catch (e) {
        // henüz kayıt yok
      } finally {
        setStorageReady(true);
      }
    })();
  }, []);

  const addFavorite = async (text) => {
    const next = [{ id: Date.now(), text }, ...favorites];
    setFavorites(next);
    try {
      await window.storage.set("favoriler-listesi", JSON.stringify(next), false);
    } catch (e) {}
  };
  const removeFavorite = async (id) => {
    const next = favorites.filter((f) => f.id !== id);
    setFavorites(next);
    try {
      await window.storage.set("favoriler-listesi", JSON.stringify(next), false);
    } catch (e) {}
  };

  const saveToHistory = async (entry) => {
    const next = [entry, ...history].slice(0, 50);
    setHistory(next);
    try {
      await window.storage.set("kupon-gecmisi", JSON.stringify(next), false);
    } catch (e) {
      console.error("Kaydedilemedi", e);
    }
  };

  const markHistory = async (id, status) => {
    const entry = history.find((h) => h.id === id);
    const next = history.map((h) => (h.id === id ? { ...h, status } : h));
    setHistory(next);
    try {
      await window.storage.set("kupon-gecmisi", JSON.stringify(next), false);
    } catch (e) {
      console.error("Güncellenemedi", e);
    }

    // Otomatik form öğrenmesi: sonuç işaretlendiğinde ilgili takımların formunu hafifçe güncelle
    if (entry && entry.homeKey && entry.awayKey && (status === "won" || status === "lost")) {
      const pickedHome = entry.pick === "MS1";
      const pickedAway = entry.pick === "MS2";
      if (pickedHome || pickedAway) {
        const homeDelta = status === "won" ? (pickedHome ? 0.3 : -0.15) : (pickedHome ? -0.3 : 0.15);
        const awayDelta = status === "won" ? (pickedAway ? 0.3 : -0.15) : (pickedAway ? -0.3 : 0.15);
        setTeams((t) => {
          const nt = { ...t };
          if (nt[entry.homeKey]) {
            nt[entry.homeKey] = { ...nt[entry.homeKey], form: Math.max(0, Math.min(10, nt[entry.homeKey].form + homeDelta)) };
          }
          if (nt[entry.awayKey]) {
            nt[entry.awayKey] = { ...nt[entry.awayKey], form: Math.max(0, Math.min(10, nt[entry.awayKey].form + awayDelta)) };
          }
          window.storage.set("takim-formlari", JSON.stringify(nt), false).catch(() => {});
          return nt;
        });
      }
    }
  };

  const clearHistory = async () => {
    setHistory([]);
    try {
      await window.storage.set("kupon-gecmisi", JSON.stringify([]), false);
    } catch (e) {}
  };

  const syncLiveData = async () => {
    if (!liveDataUrl.trim()) return;
    setLiveDataStatus("loading");
    try {
      const res = await fetch(liveDataUrl.trim());
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const matches = data.matches || [];
      setTeams((t) => {
        const nt = { ...t };
        matches.forEach((m) => {
          const hKey = `LIVE_H_${m.id}`;
          const aKey = `LIVE_A_${m.id}`;
          nt[hKey] = { name: m.home, attack: 1.35, defense: 1.2, form: 6, flag: "⚽" };
          nt[aKey] = { name: m.away, attack: 1.35, defense: 1.2, form: 6, flag: "⚽" };
        });
        return nt;
      });
      setFixtures((f) => {
        const existingIds = new Set(f.map((x) => x.id));
        const newOnes = matches
          .filter((m) => !existingIds.has(`live-${m.id}`))
          .map((m) => ({
            id: `live-${m.id}`,
            homeKey: `LIVE_H_${m.id}`,
            awayKey: `LIVE_A_${m.id}`,
            date: new Date(m.date_iso).toLocaleString("tr-TR"),
            round: m.competition || "Canlı Veri",
            kickoffISO: m.date_iso,
          }));
        return [...newOnes, ...f];
      });
      setLiveDataStatus("ok");
    } catch (e) {
      console.error("Canlı veri çekilemedi", e);
      setLiveDataStatus("failed");
    }
  };

  const addCustomMatch = ({ home, away }) => {
    const hKey = `H${Date.now()}`;
    const aKey = `A${Date.now()}`;
    setTeams((t) => ({ ...t, [hKey]: home, [aKey]: away }));
    setFixtures((f) => [
      { id: `custom-${Date.now()}`, homeKey: hKey, awayKey: aKey, date: "Özel maç", round: "Kendi Analizim" },
      ...f,
    ]);
    setTab("ozel");
  };

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');

        * { box-sizing: border-box; }
        .app {
          min-height: 100vh;
          background: radial-gradient(circle at 20% -10%, #164a35 0%, #0E2F22 45%, #0a2318 100%);
          color: #F3F1E7;
          font-family: 'Inter', sans-serif;
          padding: 0 0 60px 0;
        }
        .header {
          padding: 28px 20px 20px;
          border-bottom: 3px dashed rgba(243,241,231,0.25);
          position: relative;
        }
        .headerTitle {
          font-family: 'Oswald', sans-serif;
          font-weight: 700;
          font-size: 28px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #F3F1E7;
        }
        .headerTitle span { color: #E8A33D; }
        .headerSub {
          font-size: 13px;
          color: #B9C9BE;
          margin-top: 4px;
        }
        .punchRow {
          position: absolute;
          bottom: -13px;
          left: 0; right: 0;
          display: flex;
          justify-content: space-between;
          padding: 0 8px;
        }
        .punch {
          width: 20px; height: 20px;
          border-radius: 50%;
          background: #0a2318;
          border: 2px solid rgba(243,241,231,0.15);
        }
        .tabs {
          display: flex;
          gap: 8px;
          padding: 24px 20px 0;
          flex-wrap: wrap;
        }
        .tabBtn {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 10px 16px;
          border-radius: 4px;
          background: rgba(243,241,231,0.06);
          border: 1px solid rgba(243,241,231,0.15);
          color: #B9C9BE;
          cursor: pointer;
        }
        .tabBtn.active {
          background: #E8A33D;
          color: #0E2F22;
          border-color: #E8A33D;
          font-weight: 600;
        }
        .content {
          padding: 20px;
          max-width: 640px;
          margin: 0 auto;
        }
        .ticket {
          background: #123A2A;
          border: 1px solid rgba(243,241,231,0.12);
          border-radius: 10px;
          padding: 18px;
          margin-bottom: 18px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.25);
        }
        .ticketHead {
          display: flex;
          justify-content: space-between;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: #B9C9BE;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
        }
        .teamsRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 16px;
        }
        .teamBlock { display: flex; align-items: center; gap: 8px; flex: 1; }
        .teamBlock.right { justify-content: flex-end; text-align: right; }
        .flag { font-size: 22px; }
        .teamName { font-family: 'Oswald', sans-serif; font-size: 17px; text-transform: uppercase; }
        .vs { font-family: 'IBM Plex Mono', monospace; color: #E8A33D; font-size: 12px; }

        .flipRow { display: flex; gap: 10px; margin-bottom: 12px; }
        .flipDigit {
          flex: 1;
          background: #0a2318;
          border-radius: 6px;
          text-align: center;
          padding: 10px 4px;
          border: 1px solid rgba(243,241,231,0.1);
        }
        .flipHot { border-color: #E8A33D; box-shadow: 0 0 0 1px #E8A33D inset; }
        .flipTop { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #B9C9BE; letter-spacing: 1px; }
        .flipNum {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 26px;
          font-weight: 600;
          color: #F3F1E7;
        }
        .flipHot .flipNum { color: #E8A33D; }
        .flipNum::after { content: '%'; font-size: 13px; margin-left: 2px; color: #B9C9BE; }

        .expGoals { font-size: 13px; color: #B9C9BE; margin-bottom: 10px; }
        .expGoals b { color: #F3F1E7; }

        .toggleBtn {
          background: none;
          border: none;
          color: #4FAE8C;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          cursor: pointer;
          padding: 0;
        }

        .detail { margin-top: 14px; border-top: 1px dashed rgba(243,241,231,0.15); padding-top: 14px; }
        .probRow { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .probLabel { width: 60px; font-size: 11px; font-family: 'IBM Plex Mono', monospace; color: #B9C9BE; }
        .probTrack { flex: 1; height: 8px; background: rgba(243,241,231,0.08); border-radius: 4px; overflow: hidden; }
        .probFill { height: 100%; border-radius: 4px; }
        .tone-amber { background: #E8A33D; }
        .tone-teal { background: #4FAE8C; }
        .probValue { font-size: 11px; font-family: 'IBM Plex Mono', monospace; width: 44px; text-align: right; }

        .ratingGrid { display: flex; gap: 20px; margin: 12px 0; font-size: 12px; color: #B9C9BE; }
        .ratingTitle { font-family: 'Oswald', sans-serif; color: #F3F1E7; margin-bottom: 4px; text-transform: uppercase; font-size: 13px; }

        .saveBtn {
          background: #4FAE8C;
          color: #0a2318;
          border: none;
          padding: 8px 14px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        }

        .addForm { background: #123A2A; border-radius: 10px; padding: 18px; border: 1px solid rgba(243,241,231,0.12); }
        .addGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .addCol label { display: block; font-size: 11px; color: #B9C9BE; margin: 8px 0 4px; font-family: 'IBM Plex Mono', monospace; }
        .addCol input {
          width: 100%;
          background: #0a2318;
          border: 1px solid rgba(243,241,231,0.15);
          border-radius: 5px;
          padding: 8px 10px;
          color: #F3F1E7;
          font-size: 13px;
        }
        .addBtn {
          margin-top: 16px;
          width: 100%;
          background: #E8A33D;
          color: #0E2F22;
          border: none;
          padding: 12px;
          border-radius: 6px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          cursor: pointer;
          font-family: 'Oswald', sans-serif;
        }

        .histItem { background: #123A2A; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; border: 1px solid rgba(243,241,231,0.1); }
        .histTop { display: flex; justify-content: space-between; font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 14px; }
        .histMeta { font-size: 11px; color: #B9C9BE; font-family: 'IBM Plex Mono', monospace; margin-top: 4px; }
        .histProbs { font-size: 12px; color: #E8A33D; margin-top: 6px; font-family: 'IBM Plex Mono', monospace; }
        .clearBtn { background: none; border: 1px solid rgba(243,241,231,0.2); color: #B9C9BE; padding: 6px 12px; border-radius: 6px; font-size: 11px; cursor: pointer; margin-bottom: 14px; }
        .empty { color: #B9C9BE; font-size: 13px; text-align: center; padding: 40px 0; }

        .footerNote {
          max-width: 640px;
          margin: 30px auto 0;
          padding: 14px 20px;
          font-size: 11px;
          color: #B9C9BE;
          text-align: center;
          border-top: 1px dashed rgba(243,241,231,0.15);
        }

        @media (max-width: 480px) {
          .addGrid { grid-template-columns: 1fr; }
        }

        .cameraBox { background: #123A2A; border-radius: 10px; padding: 20px; border: 1px solid rgba(243,241,231,0.12); }
        .camIdle { text-align: center; padding: 20px 10px; }
        .camIcon { font-size: 40px; margin-bottom: 10px; }
        .camIdle p { color: #B9C9BE; font-size: 13px; margin-bottom: 16px; line-height: 1.5; }
        .camStream, .camPreview { display: flex; flex-direction: column; gap: 12px; align-items: center; }
        .camVideo, .camImg { width: 100%; border-radius: 8px; background: #0a2318; max-height: 360px; object-fit: cover; }
        .camBtnRow { display: flex; gap: 10px; width: 100%; }
        .camBtnRow .toggleBtn { border: 1px solid rgba(243,241,231,0.2); border-radius: 6px; padding: 10px 14px; }
        .camBtnRow .addBtn { flex: 1; }
        .camResult { }
        .camReadout { font-size: 14px; margin: 8px 0; line-height: 1.6; }
        .camNotes { font-size: 12px; color: #B9C9BE; font-style: italic; margin-top: 8px; line-height: 1.5; }
        .pickBanner {
          margin-top: 12px;
          background: rgba(232,163,61,0.15);
          border: 1px solid #E8A33D;
          border-radius: 6px;
          padding: 10px 14px;
          font-size: 13px;
          color: #F3F1E7;
        }
        .pickBanner b { color: #E8A33D; font-family: 'Oswald', sans-serif; text-transform: uppercase; }
        .compareRow {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 11px;
          color: #B9C9BE;
          font-family: 'IBM Plex Mono', monospace;
          margin-bottom: 10px;
          border-top: 1px dashed rgba(243,241,231,0.1);
          padding-top: 8px;
        }
        .valueBadge {
          background: rgba(79,174,140,0.15);
          border: 1px solid #4FAE8C;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 12px;
          color: #A9E3CE;
          margin-bottom: 12px;
          line-height: 1.4;
        }
        .h2hNote {
          font-size: 12px;
          color: #B9C9BE;
          background: rgba(243,241,231,0.05);
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 10px;
          line-height: 1.4;
        }
        .accuracyBanner {
          background: #123A2A;
          border: 1px solid #E8A33D;
          border-radius: 8px;
          padding: 12px 14px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          color: #E8A33D;
          margin-bottom: 12px;
          text-align: center;
        }
        .histPick { font-size: 12px; color: #4FAE8C; margin-top: 4px; font-family: 'IBM Plex Mono', monospace; }
        .histStatusRow { display: flex; gap: 8px; margin-top: 10px; }
        .statusBtn {
          flex: 1;
          background: rgba(243,241,231,0.06);
          border: 1px solid rgba(243,241,231,0.15);
          color: #B9C9BE;
          padding: 8px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
        }
        .statusWon { background: #4FAE8C; color: #0a2318; border-color: #4FAE8C; font-weight: 600; }
        .statusLost { background: #C1443A; color: #F3F1E7; border-color: #C1443A; font-weight: 600; }
        .legRow { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
        .legNum {
          width: 22px; height: 22px; flex-shrink: 0;
          background: #E8A33D; color: #0E2F22;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; font-family: 'IBM Plex Mono', monospace;
        }
        .legName {
          flex: 1; background: #0a2318; border: 1px solid rgba(243,241,231,0.15);
          border-radius: 5px; padding: 8px 10px; color: #F3F1E7; font-size: 13px; min-width: 0;
        }
        .legOdd {
          width: 64px; flex-shrink: 0; background: #0a2318; border: 1px solid rgba(243,241,231,0.15);
          border-radius: 5px; padding: 8px; color: #F3F1E7; font-size: 13px; text-align: center;
        }
        .legDel {
          width: 30px; flex-shrink: 0; background: none; border: 1px solid rgba(193,68,58,0.4);
          color: #C1443A; border-radius: 5px; padding: 8px 0; cursor: pointer; font-size: 12px;
        }
        .kombineResult { display: flex; gap: 12px; margin: 16px 0; }
        .kombineBig {
          flex: 1; background: #0a2318; border-radius: 8px; padding: 14px; text-align: center;
          border: 1px solid rgba(243,241,231,0.1);
        }
        .kombineBig span { display: block; font-size: 11px; color: #B9C9BE; font-family: 'IBM Plex Mono', monospace; margin-bottom: 6px; }
        .kombineBig b { font-size: 24px; color: #E8A33D; font-family: 'IBM Plex Mono', monospace; }
        .stakeRow { margin-bottom: 12px; }
        .stakeRow label { display: block; font-size: 11px; color: #B9C9BE; margin-bottom: 4px; font-family: 'IBM Plex Mono', monospace; }
        .stakeRow input {
          width: 100%; background: #0a2318; border: 1px solid rgba(243,241,231,0.15);
          border-radius: 5px; padding: 8px 10px; color: #F3F1E7; font-size: 13px;
        }
        .stakeWin { margin-top: 8px; font-size: 14px; color: #F3F1E7; }
        .stakeWin b { color: #4FAE8C; }

        .bookHeaderRow, .bookRow {
          display: grid;
          grid-template-columns: 1.4fr 0.8fr 0.8fr 0.8fr 30px;
          gap: 6px;
          align-items: center;
          margin-bottom: 8px;
        }
        .bookHeaderRow span { font-size: 11px; color: #B9C9BE; font-family: 'IBM Plex Mono', monospace; text-align: center; }
        .bookHeaderRow span:first-child { text-align: left; }
        .bookName {
          background: #0a2318; border: 1px solid rgba(243,241,231,0.15); border-radius: 5px;
          padding: 8px; color: #F3F1E7; font-size: 12px; min-width: 0;
        }
        .bookOdd {
          background: #0a2318; border: 1px solid rgba(243,241,231,0.15); border-radius: 5px;
          padding: 8px; color: #F3F1E7; font-size: 12px; text-align: center; min-width: 0;
        }
        .bookBest { border-color: #4FAE8C; box-shadow: 0 0 0 1px #4FAE8C inset; color: #4FAE8C; font-weight: 600; }

        .favForm { display: flex; gap: 8px; margin-bottom: 16px; }
        .favItem {
          display: flex; justify-content: space-between; align-items: center;
          background: #0a2318; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px;
          font-size: 13px; border: 1px solid rgba(243,241,231,0.1);
        }

        .chartBox { background: #0a2318; border-radius: 8px; padding: 12px; margin: 14px 0; border: 1px solid rgba(243,241,231,0.1); }

        .scoreGrid { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .scoreChip {
          background: #0a2318; border: 1px solid rgba(243,241,231,0.15); border-radius: 6px;
          padding: 8px 10px; text-align: center; min-width: 56px;
        }
        .scoreChip b { display: block; font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: #F3F1E7; }
        .scoreChip span { font-size: 10px; color: #B9C9BE; font-family: 'IBM Plex Mono', monospace; }

        .countdownRow { margin-bottom: 10px; }
        .countdown {
          font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #E8A33D;
          background: rgba(232,163,61,0.1); border: 1px solid rgba(232,163,61,0.3);
          padding: 4px 10px; border-radius: 12px;
        }
        .countdownLive {
          font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #C1443A;
          background: rgba(193,68,58,0.1); border: 1px solid rgba(193,68,58,0.3);
          padding: 4px 10px; border-radius: 12px;
        }

        .rankHeaderRow, .rankRow {
          display: grid;
          grid-template-columns: 24px 1.6fr 0.7fr 0.7fr 0.6fr 0.6fr;
          gap: 6px;
          align-items: center;
          padding: 8px 4px;
          font-size: 12px;
        }
        .rankHeaderRow { color: #B9C9BE; font-family: 'IBM Plex Mono', monospace; font-size: 10px; border-bottom: 1px dashed rgba(243,241,231,0.15); }
        .rankRow { border-bottom: 1px solid rgba(243,241,231,0.06); }
        .rankNum { color: #B9C9BE; font-family: 'IBM Plex Mono', monospace; }
        .rankName { font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 12px; }
        .rankPower { color: #E8A33D; font-weight: 600; font-family: 'IBM Plex Mono', monospace; }

        .syncBox { display: flex; gap: 8px; margin-top: 14px; }
        .syncInput {
          flex: 1; background: rgba(243,241,231,0.06); border: 1px solid rgba(243,241,231,0.2);
          border-radius: 6px; padding: 8px 10px; color: #F3F1E7; font-size: 11px;
          font-family: 'IBM Plex Mono', monospace;
        }
        .syncBtn {
          background: #4FAE8C; color: #0a2318; border: none; border-radius: 6px;
          padding: 8px 14px; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap;
        }
        .syncBtn:disabled { opacity: 0.6; }
        .syncMsg { font-size: 11px; margin-top: 8px; font-family: 'IBM Plex Mono', monospace; }
        .syncOk { color: #4FAE8C; }
        .syncFail { color: #C1443A; }
      `}</style>

      <div className="header">
        <div className="headerTitle">Maç Analiz <span>Masası</span></div>
        <div className="headerSub">İstatistiksel Poisson modeliyle otomatik olasılık hesabı — kendi kuponun, kendi motorun</div>

        <div className="syncBox">
          <input
            className="syncInput"
            placeholder="GitHub Pages fixtures.json linkini yapıştır"
            value={liveDataUrl}
            onChange={(e) => setLiveDataUrl(e.target.value)}
          />
          <button className="syncBtn" onClick={syncLiveData} disabled={liveDataStatus === "loading"}>
            {liveDataStatus === "loading" ? "Çekiliyor…" : "🔄 Senkronize Et"}
          </button>
        </div>
        {liveDataStatus === "ok" && <div className="syncMsg syncOk">✓ Canlı veri başarıyla eklendi</div>}
        {liveDataStatus === "failed" && <div className="syncMsg syncFail">✕ Çekilemedi — artifact ortamı dış adrese erişimi engelliyor olabilir, script'in ürettiği JSON'u bana yapıştır, ben eklerim</div>}

        <div className="punchRow">
          {Array.from({ length: 14 }).map((_, i) => <span key={i} className="punch" />)}
        </div>
      </div>

      <div className="tabs">
        <button className={`tabBtn ${tab === "dunya-kupasi" ? "active" : ""}`} onClick={() => setTab("dunya-kupasi")}>2026 Dünya Kupası</button>
        <button className={`tabBtn ${tab === "ekle" ? "active" : ""}`} onClick={() => setTab("ekle")}>Özel Maç Ekle</button>
        <button className={`tabBtn ${tab === "gecmis" ? "active" : ""}`} onClick={() => setTab("gecmis")}>Kupon Geçmişi</button>
        <button className={`tabBtn ${tab === "kamera" ? "active" : ""}`} onClick={() => setTab("kamera")}>📷 Kamera</button>
        <button className={`tabBtn ${tab === "oran" ? "active" : ""}`} onClick={() => setTab("oran")}>Oran ile Tahmin</button>
        <button className={`tabBtn ${tab === "kombine" ? "active" : ""}`} onClick={() => setTab("kombine")}>Kombine</button>
        <button className={`tabBtn ${tab === "bahisci" ? "active" : ""}`} onClick={() => setTab("bahisci")}>Bahisçi Karşılaştır</button>
        <button className={`tabBtn ${tab === "favoriler" ? "active" : ""}`} onClick={() => setTab("favoriler")}>Favoriler</button>
        <button className={`tabBtn ${tab === "cevirici" ? "active" : ""}`} onClick={() => setTab("cevirici")}>Oran Çevirici</button>
        <button className={`tabBtn ${tab === "siralama" ? "active" : ""}`} onClick={() => setTab("siralama")}>Sıralama</button>
      </div>

      <div className="content">
        {tab === "dunya-kupasi" && fixtures
          .map((m) => (
            <MatchCard key={m.id} match={m} teams={teams} onSave={saveToHistory} />
          ))}

        {tab === "ekle" && (
          <>
            <AddMatchForm onAdd={addCustomMatch} />
            <div style={{ marginTop: 20 }}>
              {fixtures
                .filter((f) => f.round === "Kendi Analizim")
                .map((m) => (
                  <MatchCard key={m.id} match={m} teams={teams} onSave={saveToHistory} />
                ))}
            </div>
          </>
        )}

        {tab === "kamera" && <CameraAnalyzer onAdd={addCustomMatch} />}

        {tab === "oran" && <OddsPredictor onAdd={addCustomMatch} />}

        {tab === "kombine" && <KombineHesap />}

        {tab === "bahisci" && <BookmakerCompare />}

        {tab === "favoriler" && <Favoriler favorites={favorites} onAdd={addFavorite} onRemove={removeFavorite} />}

        {tab === "cevirici" && <OranCevirici />}

        {tab === "siralama" && <TeamRanking teams={teams} />}

        {tab === "gecmis" && (
          <>
            {history.length > 0 && (
              <>
                <div className="accuracyBanner">
                  {(() => {
                    const decided = history.filter((h) => h.status === "won" || h.status === "lost");
                    const won = decided.filter((h) => h.status === "won").length;
                    const rate = decided.length > 0 ? (won / decided.length) * 100 : null;
                    return decided.length > 0
                      ? `Başarı oranı: %${rate.toFixed(0)} (${won}/${decided.length} tuttu) · ${history.length - decided.length} beklemede`
                      : `${history.length} tahmin kayıtlı, henüz hiçbiri işaretlenmedi`;
                  })()}
                </div>

                {(() => {
                  const decided = [...history]
                    .filter((h) => h.status === "won" || h.status === "lost")
                    .reverse(); // eskiden yeniye sırala
                  if (decided.length < 2) return null;
                  let wonCount = 0;
                  const chartData = decided.map((h, i) => {
                    if (h.status === "won") wonCount++;
                    return { index: i + 1, rate: Math.round((wonCount / (i + 1)) * 100) };
                  });
                  return (
                    <div className="chartBox">
                      <div className="ratingTitle" style={{ marginBottom: 8 }}>Zaman içinde başarı oranı</div>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(243,241,231,0.08)" />
                          <XAxis dataKey="index" stroke="#B9C9BE" fontSize={11} label={{ value: "tahmin no", position: "insideBottom", offset: -2, fill: "#B9C9BE", fontSize: 10 }} />
                          <YAxis stroke="#B9C9BE" fontSize={11} domain={[0, 100]} unit="%" />
                          <Tooltip contentStyle={{ background: "#0a2318", border: "1px solid rgba(243,241,231,0.2)", borderRadius: 6, fontSize: 12 }} labelStyle={{ color: "#B9C9BE" }} />
                          <Line type="monotone" dataKey="rate" stroke="#E8A33D" strokeWidth={2} dot={{ fill: "#E8A33D", r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}

                <button className="clearBtn" onClick={clearHistory}>Geçmişi temizle</button>
              </>
            )}
            {history.length === 0 && (
              <div className="empty">Henüz kupona kaydedilen bir tahmin yok. Bir maçın detayını açıp "Kupona kaydet" ile buraya ekleyebilirsin.</div>
            )}
            {history.map((h) => (
              <div className="histItem" key={h.id}>
                <div className="histTop">{h.label}</div>
                <div className="histMeta">{h.date} · kaydedilme: {h.savedAt}</div>
                <div className="histProbs">MS1 %{h.p1.toFixed(1)} · X %{h.pX.toFixed(1)} · MS2 %{h.p2.toFixed(1)}</div>
                {h.pick && <div className="histPick">Model önerisi: {h.pick} (%{h.pickProb.toFixed(1)})</div>}
                <div className="histStatusRow">
                  <button className={`statusBtn ${h.status === "won" ? "statusWon" : ""}`} onClick={() => markHistory(h.id, "won")}>✓ Tuttu</button>
                  <button className={`statusBtn ${h.status === "lost" ? "statusLost" : ""}`} onClick={() => markHistory(h.id, "lost")}>✕ Tutmadı</button>
                  {h.status !== "pending" && (
                    <button className="statusBtn" onClick={() => markHistory(h.id, "pending")}>↺ Sıfırla</button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="footerNote">
        Bu araç istatistiksel bir model kullanır (Poisson dağılımı, hücum/savunma gücü, form).
        Kesin sonuç garanti etmez, yatırım ya da bahis tavsiyesi değildir. Sorumlu oyna.
      </div>
    </div>
  );
}
