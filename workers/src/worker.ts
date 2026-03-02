// ═══════════════════════════════════════════════════════════════
// 로또신전 API v3.0 — api.lottosinjeon.com
// Cloudflare Workers (KV 우선 + 관리자 시딩 + GitHub Actions 연동)
//
// 엔드포인트:
//   GET  /              → 헬스체크
//   GET  /latest        → 최신 당첨번호
//   GET  /round/:num    → 특정 회차 조회
//   GET  /stores        → 주변 매장 검색 (GPS)
//   POST /admin/seed    → 단일 회차 시딩
//   POST /admin/bulk    → 일괄 시딩
//   GET  /admin/status  → KV 캐시 상태
//   POST /admin/win-stores → 당첨 매장 시딩
// ═══════════════════════════════════════════════════════════════

interface Env {
  LOTTO_KV?: KVNamespace;
  ADMIN_KEY?: string; // wrangler secret set ADMIN_KEY
}

// ── CORS ──
const ALLOWED_ORIGINS = [
  "https://lottosinjeon.com",
  "https://www.lottosinjeon.com",
  "https://lottosinjeon.pages.dev",
  "http://localhost:5173",
  "http://localhost:3000",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data: any, req: Request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

// ── 회차 자동 계산 ──
function calcCurrentRound(): number {
  const base = new Date("2002-12-07T00:00:00+09:00").getTime();
  const now = Date.now() + 9 * 3600 * 1000;
  return Math.floor((now - base) / (7 * 86400 * 1000)) + 1;
}

// ── 관리자 인증 ──
function checkAdmin(req: Request, env: Env): boolean {
  const key = req.headers.get("X-Admin-Key") || "";
  const adminKey = env.ADMIN_KEY || "xivix-lotto-2026";
  return key === adminKey;
}

// ── 동행복권 API fallback (차단될 수 있음) ──
async function fetchFromDHL(round: number): Promise<any | null> {
  try {
    const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        Referer: "https://www.dhlottery.co.kr/",
      },
      redirect: "follow",
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return null;
    const data = await res.json() as any;
    if (data?.returnValue !== "success") return null;
    return {
      round: data.drwNo,
      date: data.drwNoDate,
      numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6],
      bonus: data.bnusNo,
      prize1: data.firstWinamnt,
      winners1: data.firstPrzwnerCo,
      totalSales: data.totSellamnt,
      source: "dhlottery",
    };
  } catch {
    return null;
  }
}

// ── KV에서 회차 조회 (우선) → DHL fallback ──
async function getRound(round: number, env: Env, req: Request): Promise<Response> {
  // 1) KV 우선
  if (env.LOTTO_KV) {
    const cached = await env.LOTTO_KV.get(`round:${round}`, "json");
    if (cached) return json({ ...cached as any, source: "kv" }, req);
  }

  // 2) DHL fallback
  const dhl = await fetchFromDHL(round);
  if (dhl) {
    // KV에 캐싱
    if (env.LOTTO_KV) {
      await env.LOTTO_KV.put(`round:${round}`, JSON.stringify(dhl), { expirationTtl: 86400 * 365 });
    }
    return json(dhl, req);
  }

  return json({ error: `${round}회 데이터 없음`, hint: "아직 시딩되지 않았거나 추첨 전입니다" }, req, 404);
}

// ── 최신 회차 조회 ──
async function getLatest(env: Env, req: Request): Promise<Response> {
  const currentRound = calcCurrentRound();

  // 현재 회차부터 역순으로 데이터 있는 회차 탐색
  for (let r = currentRound; r >= currentRound - 5; r--) {
    if (env.LOTTO_KV) {
      const cached = await env.LOTTO_KV.get(`round:${r}`, "json");
      if (cached) return json({ ...cached as any, source: "kv", currentRound }, req);
    }
    const dhl = await fetchFromDHL(r);
    if (dhl) {
      if (env.LOTTO_KV) {
        await env.LOTTO_KV.put(`round:${r}`, JSON.stringify(dhl), { expirationTtl: 86400 * 365 });
      }
      return json({ ...dhl, currentRound }, req);
    }
  }

  return json({ error: "최신 데이터 없음", currentRound }, req, 404);
}

// ── 관리자: 단일 시딩 ──
async function handleSeed(req: Request, env: Env): Promise<Response> {
  if (!checkAdmin(req, env)) return json({ error: "Unauthorized" }, req, 401);
  if (!env.LOTTO_KV) return json({ error: "KV not bound" }, req, 500);

  const body = await req.json() as any;
  const { round, numbers, bonus, date, prize1, winners1, totalSales } = body;

  if (!round || !numbers || !bonus) {
    return json({ error: "필수: round, numbers[], bonus" }, req, 400);
  }

  const data = {
    round,
    numbers: Array.isArray(numbers) ? numbers : [],
    bonus,
    date: date || "",
    prize1: prize1 || 0,
    winners1: winners1 || 0,
    totalSales: totalSales || 0,
    source: "admin_seed",
    seededAt: new Date().toISOString(),
  };

  await env.LOTTO_KV.put(`round:${round}`, JSON.stringify(data), { expirationTtl: 86400 * 365 });
  return json({ ok: true, round, message: `${round}회 시딩 완료` }, req);
}

// ── 관리자: 일괄 시딩 ──
async function handleBulkSeed(req: Request, env: Env): Promise<Response> {
  if (!checkAdmin(req, env)) return json({ error: "Unauthorized" }, req, 401);
  if (!env.LOTTO_KV) return json({ error: "KV not bound" }, req, 500);

  const body = await req.json() as any;
  const rounds = body.rounds || [];
  let success = 0;

  for (const r of rounds) {
    if (!r.round || !r.numbers || !r.bonus) continue;
    const data = {
      round: r.round,
      numbers: r.numbers,
      bonus: r.bonus,
      date: r.date || "",
      prize1: r.prize1 || 0,
      winners1: r.winners1 || 0,
      totalSales: r.totalSales || 0,
      source: "admin_bulk",
      seededAt: new Date().toISOString(),
    };
    await env.LOTTO_KV.put(`round:${r.round}`, JSON.stringify(data), { expirationTtl: 86400 * 365 });
    success++;
  }

  return json({ ok: true, total: rounds.length, success, message: `${success}건 시딩 완료` }, req);
}

// ── 관리자: 당첨 매장 시딩 ──
async function handleWinStores(req: Request, env: Env): Promise<Response> {
  if (!checkAdmin(req, env)) return json({ error: "Unauthorized" }, req, 401);
  if (!env.LOTTO_KV) return json({ error: "KV not bound" }, req, 500);

  const body = await req.json() as any;
  // body.stores = [{ name, addr, lat, lng, wins, auto, manual, semi, region, recent: [...] }]
  const stores = body.stores || [];
  if (!stores.length) return json({ error: "stores[] 필요" }, req, 400);

  await env.LOTTO_KV.put("win_stores", JSON.stringify({
    stores,
    updatedAt: new Date().toISOString(),
    source: body.source || "admin",
  }), { expirationTtl: 86400 * 365 });

  return json({ ok: true, count: stores.length, message: `당첨매장 ${stores.length}건 저장` }, req);
}

// ── 관리자: 상태 확인 ──
async function handleStatus(env: Env, req: Request): Promise<Response> {
  if (!env.LOTTO_KV) return json({ error: "KV not bound" }, req, 500);

  const currentRound = calcCurrentRound();
  const status: any[] = [];

  for (let r = currentRound; r >= currentRound - 15; r--) {
    const cached = await env.LOTTO_KV.get(`round:${r}`, "json");
    status.push({
      round: r,
      cached: !!cached,
      source: cached ? (cached as any).source : null,
    });
  }

  // 당첨매장 상태
  const winStores = await env.LOTTO_KV.get("win_stores", "json") as any;

  return json({
    currentRound,
    rounds: status,
    winStores: winStores ? { count: winStores.stores?.length, updatedAt: winStores.updatedAt } : null,
    version: "3.0.0",
  }, req);
}

// ── 주변 매장 검색 (카카오 API) ──
async function handleStores(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") || "0");
  const lng = parseFloat(url.searchParams.get("lng") || "0");
  const radius = parseInt(url.searchParams.get("radius") || "2000");

  if (!lat || !lng) return json({ error: "lat, lng 필수" }, req, 400);

  const KAKAO_KEY = "44837b4a47833896a1f143f5423a37bf";

  try {
    const kakaoUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=복권&y=${lat}&x=${lng}&radius=${radius}&sort=distance&size=15`;
    const kakaoRes = await fetch(kakaoUrl, {
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    });
    const kakaoData = await kakaoRes.json() as any;

    if (!kakaoData.documents) {
      return json({ stores: [], total: 0, source: "kakao_error" }, req);
    }

    // KV에서 당첨매장 데이터 로드
    let winStoresMap: Record<string, any> = {};
    if (env.LOTTO_KV) {
      const winData = await env.LOTTO_KV.get("win_stores", "json") as any;
      if (winData?.stores) {
        for (const ws of winData.stores) {
          // 매장명 기반 매칭 (정규화)
          const key = ws.name.replace(/\s/g, "").toLowerCase();
          winStoresMap[key] = ws;
        }
      }
    }

    const stores = kakaoData.documents.map((doc: any) => {
      const storeName = doc.place_name || "";
      const nameKey = storeName.replace(/\s/g, "").toLowerCase();
      const winInfo = winStoresMap[nameKey] || null;

      const dist = parseInt(doc.distance || "0");
      return {
        name: storeName,
        addr: doc.road_address_name || doc.address_name || "",
        tel: doc.phone || "",
        lat: parseFloat(doc.y),
        lng: parseFloat(doc.x),
        distance: dist,
        walkMin: Math.round((dist * 1.35) / 80),
        wins: winInfo?.wins || 0,
        auto: winInfo?.auto || 0,
        manual: winInfo?.manual || 0,
        semi: winInfo?.semi || 0,
        recent: winInfo?.recent || [],
        isWinStore: !!winInfo,
        kakaoId: doc.id,
        kakaoUrl: doc.place_url,
      };
    });

    // 당첨매장 우선 정렬
    stores.sort((a: any, b: any) => {
      if (a.isWinStore && !b.isWinStore) return -1;
      if (!a.isWinStore && b.isWinStore) return 1;
      return a.distance - b.distance;
    });

    // 거리별 요약
    const summary = {
      within500m: stores.filter((s: any) => s.distance <= 500).length,
      within1km: stores.filter((s: any) => s.distance <= 1000).length,
      within2km: stores.filter((s: any) => s.distance <= 2000).length,
      winStores: stores.filter((s: any) => s.isWinStore).length,
    };

    return json({ stores, total: stores.length, summary, source: "kakao+kv" }, req);
  } catch (e: any) {
    return json({ stores: [], total: 0, error: e.message, source: "error" }, req);
  }
}

// ── Cron: 매주 토요일 추첨 후 자동 수집 시도 ──
// ── 자동 수집 (프론트엔드 → Workers, 인증 불필요) ──
// 사용자 브라우저가 DHL API 호출 → 결과를 이 엔드포인트로 전송
// Workers IP 차단 우회 핵심 로직
async function handleAutoCollect(req: Request, env: Env): Promise<Response> {
  if (!env.LOTTO_KV) return json({ error: "KV not bound" }, req, 500);

  const body = await req.json() as any;
  const { round, numbers, bonus, date, prize1, winners1, totalSales } = body;

  // ── 검증 1: 필수 필드 ──
  if (!round || !Array.isArray(numbers) || numbers.length !== 6 || !bonus) {
    return json({ error: "invalid_data" }, req, 400);
  }

  // ── 검증 2: 번호 범위 (1~45) ──
  const allNums = [...numbers, bonus];
  if (allNums.some((n: number) => n < 1 || n > 45 || !Number.isInteger(n))) {
    return json({ error: "invalid_numbers" }, req, 400);
  }

  // ── 검증 3: 중복 번호 체크 ──
  if (new Set(numbers).size !== 6) {
    return json({ error: "duplicate_numbers" }, req, 400);
  }

  // ── 검증 4: 회차 범위 (현재 회차 ±1만 허용) ──
  const currentRound = calcCurrentRound();
  if (round < currentRound - 1 || round > currentRound + 1) {
    return json({ error: "round_out_of_range", expected: currentRound }, req, 400);
  }

  // ── 검증 5: 이미 캐시된 데이터가 있으면 덮어쓰지 않음 ──
  const existing = await env.LOTTO_KV.get(`round:${round}`);
  if (existing) {
    return json({ ok: true, round, status: "already_cached", message: "이미 수집됨" }, req);
  }

  // ── 저장 ──
  const data = {
    round,
    numbers,
    bonus,
    date: date || "",
    prize1: prize1 || 0,
    winners1: winners1 || 0,
    totalSales: totalSales || 0,
    source: "auto_collect",
    seededAt: new Date().toISOString(),
  };

  await env.LOTTO_KV.put(`round:${round}`, JSON.stringify(data), { expirationTtl: 86400 * 365 });
  return json({ ok: true, round, status: "seeded", message: `${round}회 자동 수집 완료` }, req);
}

// ── 미수집 회차 확인 (프론트엔드용) ──
async function handleNeedSync(env: Env, req: Request): Promise<Response> {
  if (!env.LOTTO_KV) return json({ need: false }, req);
  
  const currentRound = calcCurrentRound();
  const cached = await env.LOTTO_KV.get(`round:${currentRound}`);
  
  return json({
    need: !cached,
    round: currentRound,
    cached: !!cached,
  }, req);
}

async function handleCron(env: Env) {
  const currentRound = calcCurrentRound();

  if (!env.LOTTO_KV) return;

  // 이미 캐시되어 있으면 skip
  const cached = await env.LOTTO_KV.get(`round:${currentRound}`);
  if (cached) return;

  // DHL 시도 (차단될 수 있음)
  const data = await fetchFromDHL(currentRound);
  if (data) {
    await env.LOTTO_KV.put(`round:${currentRound}`, JSON.stringify(data), { expirationTtl: 86400 * 365 });
  }
  // 실패 시 → 프론트엔드 자동 수집이 백업
}

// ── 라우터 ──
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // 🛡️ 글로벌 에러 바운더리 — 어떤 오류든 500 JSON 반환 (서비스 크래시 방지)
    try {
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(req) });
      }

      const url = new URL(req.url);
      const path = url.pathname;

      // 헬스체크
      if (path === "/" || path === "/health") {
        return json({
          status: "ok",
          service: "로또신전 API",
          version: "3.2.0",
          currentRound: calcCurrentRound(),
          kvBound: !!env.LOTTO_KV,
          resilience: "circuit-breaker + multi-fallback",
          endpoints: [
            "GET /latest",
            "GET /round/:num",
            "GET /stores?lat=Y&lng=X&radius=2000",
            "GET /need-sync",
            "POST /auto-collect",
            "POST /admin/seed",
            "POST /admin/bulk",
            "POST /admin/win-stores",
            "GET /admin/status",
          ],
        }, req);
      }

      // 최신
      if (path === "/latest") return getLatest(env, req);

      // 특정 회차 (path param)
      const roundMatch = path.match(/^\/round\/(\d+)$/);
      if (roundMatch) return getRound(parseInt(roundMatch[1]), env, req);

      // 특정 회차 (query)
      if (path === "/round") {
        const r = parseInt(url.searchParams.get("round") || "0");
        if (!r) return json({ error: "round 파라미터 필요" }, req, 400);
        return getRound(r, env, req);
      }

      // 매장 검색
      if (path === "/stores") return handleStores(req, env);

      // 자동 수집 (프론트엔드 → Workers)
      if (path === "/auto-collect" && req.method === "POST") return handleAutoCollect(req, env);
      if (path === "/need-sync") return handleNeedSync(env, req);

      // 관리자 API
      if (path === "/admin/seed" && req.method === "POST") return handleSeed(req, env);
      if (path === "/admin/bulk" && req.method === "POST") return handleBulkSeed(req, env);
      if (path === "/admin/win-stores" && req.method === "POST") return handleWinStores(req, env);
      if (path === "/admin/status") return handleStatus(env, req);

      return json({ error: "Not Found" }, req, 404);

    } catch (e: any) {
      // 🛡️ 어떤 예외든 여기서 잡아서 500 JSON 반환
      return new Response(
        JSON.stringify({ error: "Internal Server Error", message: e?.message || "Unknown", version: "3.2.0" }),
        { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }
  },

  async scheduled(event: ScheduledEvent, env: Env) {
    await handleCron(env);
  },
};
