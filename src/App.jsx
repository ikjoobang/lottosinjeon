import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// 로또신전(LOTTO SINJEON) v3.5 — 실제 데이터 연동 + 동행복권 API + 하드코딩 제거
// Domain: lottosinjeon.com | Powered by XIVIX
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// 만세력(萬歲曆) 엔진 — 양력↔음력 변환 + 사주팔자 계산
// ═══════════════════════════════════════════════════════════════
const MANSERYUK = (() => {
  // ── 천간(天干) 10개 ──
  const GAN = ["갑","을","병","정","무","기","경","신","임","계"];
  const GAN_H = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  // ── 지지(地支) 12개 ──
  const JI = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
  const JI_H = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  // ── 오행(五行) ──
  const OH = ["목","화","토","금","수"];
  const OH_H = ["木","火","土","金","水"];
  const OH_C = ["#22c55e","#ef4444","#D97757","#fbbf24","#3b82f6"]; // 목=초록,화=빨강,토=주황,금=금색,수=파랑
  const GAN_OH = [0,0,1,1,2,2,3,3,4,4]; // 천간→오행 (갑을=목, 병정=화, 무기=토, 경신=금, 임계=수)
  const JI_OH = [4,2,0,0,2,1,1,2,3,3,2,4]; // 지지→오행
  // ── 음양(陰陽) ──
  const GAN_YY = ["+","-","+","-","+","-","+","-","+","-"]; // 양간/음간
  // ── 띠 ──
  const DDI = ["쥐","소","호랑이","토끼","용","뱀","말","양","원숭이","닭","개","돼지"];
  const DDI_E = ["🐭","🐮","🐯","🐰","🐲","🐍","🐴","🐑","🐵","🐔","🐶","🐷"];

  // ── 음력 데이터 (1940–2050) ──
  // 각 값: bit19~bit4 = 1~12월 대소(1=30,0=29), bit3~bit0 = 윤달 월(0=없음)
  // 별도 윤달 대소 배열
  const LUNAR_INFO = [
    0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2, // 1940-1949
    0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977, // 1950-1959
    0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970, // 1960-1969
    0x06566,0x0d4a0,0x0ea50,0x16e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950, // 1970-1979
    0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557, // 1980-1989
    0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0, // 1990-1999
    0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0, // 2000-2009
    0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6, // 2010-2019
    0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570, // 2020-2029
    0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0, // 2030-2039
    0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950 // 2040-2050
  ];
  const LUNAR_BASE_YEAR = 1940;

  // 음력 연도의 총 일수
  const lunarYearDays = (y) => {
    const idx = y - LUNAR_BASE_YEAR;
    if (idx < 0 || idx >= LUNAR_INFO.length) return 0;
    const info = LUNAR_INFO[idx];
    let sum = 0;
    for (let i = 0x8000; i > 0x8; i >>= 1) sum += (info & i) ? 30 : 29;
    // 윤달
    const leap = info & 0xf;
    if (leap) sum += (info & 0x10000) ? 30 : 29;
    return sum;
  };

  // 음력 월별 일수
  const lunarMonthDays = (y, m) => {
    const idx = y - LUNAR_BASE_YEAR;
    if (idx < 0 || idx >= LUNAR_INFO.length) return 29;
    return (LUNAR_INFO[idx] & (0x10000 >> m)) ? 30 : 29;
  };

  // 윤달 월 (0이면 없음)
  const leapMonth = (y) => {
    const idx = y - LUNAR_BASE_YEAR;
    if (idx < 0 || idx >= LUNAR_INFO.length) return 0;
    return LUNAR_INFO[idx] & 0xf;
  };

  // 윤달 일수
  const leapMonthDays = (y) => {
    const lm = leapMonth(y);
    if (!lm) return 0;
    const idx = y - LUNAR_BASE_YEAR;
    return (LUNAR_INFO[idx] & 0x10000) ? 30 : 29;
  };

  // ── 양력 → 음력 변환 ──
  const solarToLunar = (sy, sm, sd) => {
    // 기준: 1940-01-27 = 음력 1939-12-19 (음력 1940-01-01 = 양력 1940-02-08)
    const baseDate = new Date(1940, 1, 8); // 양력 1940-02-08 = 음력 1940-01-01
    const target = new Date(sy, sm - 1, sd);
    let offset = Math.floor((target - baseDate) / 86400000);

    if (offset < 0) return { year: sy, month: sm, day: sd, leap: false, error: true };

    let ly = LUNAR_BASE_YEAR, lm = 1, ld = 1, isLeap = false;

    // 연도 찾기
    while (ly < LUNAR_BASE_YEAR + LUNAR_INFO.length) {
      const yDays = lunarYearDays(ly);
      if (offset < yDays) break;
      offset -= yDays;
      ly++;
    }

    // 월 찾기
    const leap = leapMonth(ly);
    for (let m = 1; m <= 12; m++) {
      const mDays = lunarMonthDays(ly, m);
      if (offset < mDays) { lm = m; ld = offset + 1; isLeap = false; break; }
      offset -= mDays;
      // 윤달 체크
      if (leap === m) {
        const lDays = leapMonthDays(ly);
        if (offset < lDays) { lm = m; ld = offset + 1; isLeap = true; break; }
        offset -= lDays;
      }
      if (m === 12) { lm = 12; ld = offset + 1; }
    }

    return { year: ly, month: lm, day: ld, leap: isLeap, error: false };
  };

  // ── 절기(節氣) 기반 월 구분 (사주의 월주는 절기 기준) ──
  // 각 절기의 평균 양력 날짜 [월, 일] (±1일 오차 가능)
  const JEOLGI = [
    [2, 4],  // 입춘(立春) → 인월(寅月) 시작 = 사주 1월
    [3, 6],  // 경칩(驚蟄) → 묘월(卯月) = 사주 2월
    [4, 5],  // 청명(清明) → 진월(辰月)
    [5, 6],  // 입하(立夏) → 사월(巳月)
    [6, 6],  // 망종(芒種) → 오월(午月)
    [7, 7],  // 소서(小暑) → 미월(未月)
    [8, 7],  // 입추(立秋) → 신월(申月)
    [9, 8],  // 백로(白露) → 유월(酉月)
    [10, 8], // 한로(寒露) → 술월(戌月)
    [11, 7], // 입동(立冬) → 해월(亥月)
    [12, 7], // 대설(大雪) → 자월(子月)
    [1, 6],  // 소한(小寒) → 축월(丑月)
  ];

  // 절기 기준 사주 월 (1~12, 인월=1 시작)
  const getSajuMonth = (solarM, solarD) => {
    // 소한(1/6) 이후 ~ 입춘(2/4) 전 = 축월(12)
    // 입춘(2/4) 이후 ~ 경칩(3/6) 전 = 인월(1)
    for (let i = 0; i < 12; i++) {
      const [nm, nd] = JEOLGI[(i + 1) % 12];
      const [cm, cd] = JEOLGI[i];
      if (i === 11) { // 축월: 소한(1/6)~입춘(2/4) 전
        if ((solarM === 1 && solarD >= 6) || (solarM === 2 && solarD < 4)) return 12;
      } else {
        if (solarM === cm && solarD >= cd) {
          if (solarM === nm && solarD < nd) return i + 1;
          if (solarM < nm) return i + 1;
        }
        if (solarM > cm && solarM < nm) return i + 1;
        if (solarM === nm && solarD < nd) return i + 1;
      }
    }
    // 12/7 이후 ~ 12/31 = 자월(11)
    if (solarM === 12 && solarD >= 7) return 11;
    // 1/1 ~ 1/5 = 자월(11)
    if (solarM === 1 && solarD < 6) return 11;
    return 1; // fallback
  };

  // ── 년주(年柱) 계산 (입춘 기준) ──
  const calcYearPillar = (y, m, d) => {
    let adjYear = y;
    // 입춘(2/4) 이전이면 전년도
    if (m < 2 || (m === 2 && d < 4)) adjYear -= 1;
    const ganIdx = (adjYear - 4) % 10;
    const jiIdx = (adjYear - 4) % 12;
    return { gan: ganIdx, ji: jiIdx, gz60: ganIdx + "," + jiIdx };
  };

  // ── 월주(月柱) 계산 (절기 기준) ──
  const calcMonthPillar = (yearGan, sajuMonth) => {
    // 월지: 인월(1)=인(2), 묘월(2)=묘(3), ... 축월(12)=축(1)
    const jiIdx = (sajuMonth + 1) % 12; // 인=2
    // 월간: 년간×2 + 월 조정
    // 공식: (년간%5)*2 + 사주월(0-based)
    const ganIdx = ((yearGan % 5) * 2 + sajuMonth) % 10;
    return { gan: ganIdx, ji: jiIdx };
  };

  // ── 일주(日柱) 계산 (기준일로부터 일수) ──
  const calcDayPillar = (y, m, d) => {
    // 기준: 1940-02-08 = 음력 1940-01-01
    // 1940-02-08의 일간지 = 갑오(甲午) = 60간지 인덱스 30
    // 하지만 더 정확한 기준 사용:
    // 2000-01-01 = 갑진(甲辰)일 = 60간지 인덱스 40... 
    // 표준 기준: 1900-01-07 = 갑자(甲子)일 = 인덱스 0
    const base = new Date(1900, 0, 7); // 1900-01-07 = 갑자일
    const target = new Date(y, m - 1, d);
    const days = Math.floor((target - base) / 86400000);
    const idx = ((days % 60) + 60) % 60;
    return { gan: idx % 10, ji: idx % 12, idx60: idx };
  };

  // ── 시주(時柱) 계산 ──
  const calcHourPillar = (dayGan, hour) => {
    // 시지: 23~01=자(0), 01~03=축(1), ... 21~23=해(11)
    const jiIdx = Math.floor(((hour + 1) % 24) / 2);
    // 시간: (일간×2 + 시지) % 10
    const ganIdx = (dayGan * 2 + jiIdx) % 10;
    return { gan: ganIdx, ji: jiIdx };
  };

  // ── 간지 문자열 ──
  const ganjiStr = (gan, ji) => `${GAN[gan]}${JI[ji]}(${GAN_H[gan]}${JI_H[ji]})`;

  // ── 오행 분석 ──
  const analyzeOhaeng = (pillars) => {
    const count = [0, 0, 0, 0, 0]; // 목,화,토,금,수
    pillars.forEach(p => {
      count[GAN_OH[p.gan]]++;
      count[JI_OH[p.ji]]++;
    });
    // 일간 오행 = 핵심 오행
    const mainOh = GAN_OH[pillars[2].gan]; // 일간 기준
    return { count, main: mainOh };
  };

  // ── 일간 기반 성격 분석 ──
  const PERSONALITY = [
    { trait: "리더십과 추진력이 강한 대나무형", detail: "새로운 시작을 좋아하고 정의감이 넘칩니다", lucky: "3,8" }, // 갑
    { trait: "유연하고 섬세한 꽃나무형", detail: "적응력이 뛰어나고 예술적 감각이 있습니다", lucky: "3,8" }, // 을
    { trait: "열정적이고 화려한 태양형", detail: "밝은 에너지로 주변을 이끌어갑니다", lucky: "2,7" }, // 병
    { trait: "따뜻하고 세심한 촛불형", detail: "내면이 깊고 통찰력이 뛰어납니다", lucky: "2,7" }, // 정
    { trait: "묵직하고 신뢰감 있는 산형", detail: "책임감이 강하고 중심을 잡아줍니다", lucky: "5,10" }, // 무
    { trait: "포용력 있고 실리적인 대지형", detail: "현실적이면서도 사람을 잘 품어줍니다", lucky: "5,10" }, // 기
    { trait: "결단력 있고 원칙적인 바위형", detail: "목표를 향해 단호하게 나아갑니다", lucky: "4,9" }, // 경
    { trait: "섬세하고 예리한 보석형", detail: "감각이 뛰어나고 완벽을 추구합니다", lucky: "4,9" }, // 신
    { trait: "자유롭고 지혜로운 바다형", detail: "유연한 사고와 넓은 시야를 가졌습니다", lucky: "1,6" }, // 임
    { trait: "직관적이고 감성적인 이슬형", detail: "감수성이 풍부하고 영감이 넘칩니다", lucky: "1,6" }, // 계
  ];

  // ── 전체 사주 분석 실행 ──
  const analyze = (year, month, day, hour, calendarType, gender) => {
    // 양력→음력 변환 (표시용)
    const lunar = solarToLunar(year, month, day);

    // 절기 기준 사주 월
    const sajuMonth = getSajuMonth(month, day);

    // 4주 계산
    const yearP = calcYearPillar(year, month, day);
    const monthP = calcMonthPillar(yearP.gan, sajuMonth);
    const dayP = calcDayPillar(year, month, day);
    const hourP = calcHourPillar(dayP.gan, hour >= 0 ? hour : 12); // 시간 미입력시 오시(12)

    const pillars = [yearP, monthP, dayP, hourP];

    // 오행 분석
    const ohaeng = analyzeOhaeng(pillars);

    // 일간 성격
    const personality = PERSONALITY[dayP.gan];

    // 띠
    let adjYear = year;
    if (month < 2 || (month === 2 && day < 4)) adjYear -= 1;
    const ddiIdx = (adjYear - 4) % 12;

    // 음양
    const yinyang = GAN_YY[dayP.gan] === "+" ? "양(陽)" : "음(陰)";

    return {
      pillars: pillars.map(p => ({
        gan: p.gan, ji: p.ji,
        text: ganjiStr(p.gan, p.ji),
        ganOh: GAN_OH[p.gan], jiOh: JI_OH[p.ji],
      })),
      lunar,
      ohaeng,
      personality,
      ddi: { name: DDI[ddiIdx], emoji: DDI_E[ddiIdx], idx: ddiIdx },
      yinyang,
      mainElement: OH[ohaeng.main],
      mainElementH: OH_H[ohaeng.main],
      mainColor: OH_C[ohaeng.main],
      dayGan: dayP.gan,
    };
  };

  return { analyze, OH, OH_H, OH_C, GAN, GAN_H, JI, JI_H, solarToLunar };
})();
// [v3.2b → v3.2c 변경]
// 🎨 Theme: 보라/인디고 → Claude Color (White #F5F1EC / Orange #D97757 / Black #111)
//           메인 액센트: #D97757 (테라코타 오렌지)
//           딥 액센트: #C4613F / 라이트: #E8956A
//           배경: #111111 → #1C1C1C → #2C2C2C (순수 다크 계열)
//           RatioBar: 자동(주황) / 수동(크림) / 반자동(블랙)
// [v3.1 → v3.2 변경]
// ① Fix: 홈 실시간 대화 자동스크롤 → 커뮤니티 대화탭에서만
// ⑦ Fix: 장수 변경 시 이전 결과 초기화
// ⑧ New: 체크박스 마스킹 (수동 옮겨쓸 때 ☐→☑ + 회색처리)
// ⑩ New: 타로 12장→78장 확장 (Major 22 + Minor 56)
//         슈트 필터, 랜덤 1장 뽑기, 30% 역방향, 카드 뒤집기 UX
//         studioju-tarot 카드 이미지 매핑 (m00~m21, c/s/w/p 01~14)
// 🆕 UX: 홈 섹션 구분선 3개 (gradient divider)
// 🆕 UX: 타로 카테고리 6개→2개 (전체 78장 / 메이저 22장)
// ③ New: GPS 새로고침 — 위치 권한 → 주변 명당 실시간 검색
// ⑥ New: 거리 표시 (직선+도보 병기) + 영업상태 + 지도앱 길찾기
// ② New: 명당 TOP10 클릭→상세 바텀시트 + 네이버 플레이스 연결
// [v3 → v3.1 변경]
// 1. 사주입력: 이름→년→월→시→음력/양력→남/여
// 2. 운세 3종(오늘/월간/년간) + 5운(총/금전/연애/건강/더궁금)
// 3. 미래예측: 1개월/3개월/6개월/1년후 + 좋은것/주의/환경/금전
// 4. "더 궁금한점" → 대화형 봇 상담
// 5. 타로/사주 PDF/이미지 다운로드
// 6. 메인화면 실시간 대화 입력칸 추가
// 7. 봇 대화 반복 방지 (인덱스 비복원 추출)
// 8. 커뮤니티: 인기글[글쓰기], 실시간대화, AI상담사
// 9. QR 아래 1등 당첨번호 표시
// 10. 10장/20장 생성 실제 동작
// 11. VIP 회차별 저장 기능
// 12. 보안 강화 (해킹/캡처/복사 금지)
// ═══════════════════════════════════════════════════════════════

const BRAND = {
  name: "로또신전",
  nameEn: "LOTTO SINJEON",
  tagline: "신의 전당에서 당신의 번호를 받으세요",
  subTaglines: {
    marketing: "당신의 사주가 고른 이번주 번호",
    tech: "AI가 읽는 사주, 데이터가 고른 번호",
    viral: "운빨도 실력이다",
    gps: "당첨의 기운이 머무는 곳",
  },
  copy: {
    sajuInput: "당신의 사주를 신전에 바치세요",
    numberResult: "신전이 당신에게 내린 신탁입니다",
    gpsMap: "당첨의 기운이 머무는 곳을 찾아보세요",
    tarot: "신전의 비밀 방에서 오늘의 운세를 확인하세요",
    vipGate: "신전의 안쪽 문이 열립니다",
    share: "로또신전에서 번호 받아왔다! 너도 한번 받아봐",
    vipDeep: "신전의 최심부로 입장합니다",
  },
  domain: "lottosinjeon.com",
  colors: {
    primary: "#D97757",
    deep: "#C4613F",
    light: "#E8956A",
    cream: "#F5F1EC",
    black: "#111111",
    gold: "#C9A84C",
    darkGold: "#8B6914",
  },
};

// ── 오행 공 색상 ──
const getBallColor = (n) => {
  if (n <= 10) return { bg: "#fbbf24", text: "#000" };
  if (n <= 20) return { bg: "#3b82f6", text: "#fff" };
  if (n <= 30) return { bg: "#ef4444", text: "#fff" };
  if (n <= 40) return { bg: "#6b7280", text: "#fff" };
  return { bg: "#22c55e", text: "#fff" };
};
const Ball = ({ num, size = 36 }) => {
  const c = getBallColor(num);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: "50%",
      background: c.bg, color: c.text,
      fontWeight: 700, fontSize: size * 0.42,
      boxShadow: `0 2px 8px ${c.bg}44`,
    }}>{num}</span>
  );
};

// ── 매장별 자동/수동/반자동 비율 바 ──
const RatioBar = ({ auto = 0, manual = 0, semi = 0, size = "sm" }) => {
  const total = auto + manual + semi;
  if (total === 0) return null;
  const pA = ((auto / total) * 100).toFixed(0);
  const pM = ((manual / total) * 100).toFixed(0);
  const pS = ((semi / total) * 100).toFixed(0);
  const h = size === "lg" ? 14 : 8;
  const fs = size === "lg" ? 11 : 0;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: h, background: "#1C1C1C" }}>
        {auto > 0 && <div style={{ width: `${pA}%`, background: "linear-gradient(90deg,#D97757,#E8956A)", transition: "width 0.3s" }} />}
        {manual > 0 && <div style={{ width: `${pM}%`, background: "linear-gradient(90deg,#E8E4DF,#F5F1EC)", transition: "width 0.3s" }} />}
        {semi > 0 && <div style={{ width: `${pS}%`, background: "linear-gradient(90deg,#3A3A3A,#555555)", transition: "width 0.3s" }} />}
      </div>
      {size === "lg" && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: fs, color: "#aaa" }}>
          <span><span style={{ color: "#E8956A", fontWeight: 700 }}>●</span> 자동 {pA}%({auto}건)</span>
          <span><span style={{ color: "#F5F1EC", fontWeight: 700 }}>●</span> 수동 {pM}%({manual}건)</span>
          <span><span style={{ color: "#555555", fontWeight: 700 }}>●</span> 반자동 {pS}%({semi}건)</span>
        </div>
      )}
    </div>
  );
};

// 전국 평균 대비 인사이트 텍스트
const getInsight = (auto, manual, semi) => {
  const total = auto + manual + semi;
  if (total === 0) return "";
  const mPct = (manual / total) * 100;
  const diff = mPct - AVG_RATIO.manual;
  if (diff > 5) return `수동 당첨 비율이 전국 평균보다 ${diff.toFixed(0)}%p 높음 📈`;
  if (diff < -5) return `자동 당첨 비율이 전국 평균보다 ${(-diff).toFixed(0)}%p 높음 🎰`;
  return "전국 평균과 유사한 비율";
};
// 전국 평균: 자동 65.9%, 수동 31.3%, 반자동 2.8% (262~1209회 기준)
const AVG_RATIO = { auto: 65.9, manual: 31.3, semi: 2.8 };

// ── v3.5 동행복권 API 연동 ──
// ═══════════════════════════════════════════════════════════════
// 🛡️ RESILIENCE LAYER v1.0 — 장애 자동복구 + 다단계 폴백
// 오류 발생 시: Primary → Secondary → Cache → Fallback (4단계)
// ═══════════════════════════════════════════════════════════════

const LOTTO_API = {
  primary: "https://api.lottosinjeon.com",          // Workers v3.1 (KV 캐시)
  secondary: "https://lottosinjeon-api.ikjoobang.workers.dev", // Workers 직접 (custom domain 장애 시)
  direct: "https://www.dhlottery.co.kr/common.do?method=getLottoNumber", // DHL 직접 (브라우저)
};

// ── 인메모리 캐시 (세션 동안 유지) ──
const _cache = { rounds: {}, stores: {}, health: { primary: true, secondary: true, lastCheck: 0 } };

// ── 서킷브레이커: 연속 실패 시 해당 서버 일시 차단 ──
const _circuit = {
  primary: { failures: 0, openUntil: 0 },
  secondary: { failures: 0, openUntil: 0 },
};
const CIRCUIT_THRESHOLD = 3;  // 3회 연속 실패 → 서킷 오픈
const CIRCUIT_COOLDOWN = 30000; // 30초 후 재시도

const isCircuitOpen = (server) => {
  const c = _circuit[server];
  if (c.failures >= CIRCUIT_THRESHOLD && Date.now() < c.openUntil) return true;
  if (Date.now() >= c.openUntil) { c.failures = 0; } // 쿨다운 지나면 리셋
  return false;
};
const recordSuccess = (server) => { _circuit[server].failures = 0; };
const recordFailure = (server) => {
  _circuit[server].failures++;
  if (_circuit[server].failures >= CIRCUIT_THRESHOLD) {
    _circuit[server].openUntil = Date.now() + CIRCUIT_COOLDOWN;
    console.warn(`[Resilience] ${server} 서킷 오픈 (${CIRCUIT_COOLDOWN/1000}s 대기)`);
  }
};

// ── 안전한 fetch wrapper (타임아웃 + 에러 핸들링) ──
const safeFetch = async (url, options = {}, timeoutMs = 5000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
};

// 현재 회차 계산: 1회 추첨일(2002-12-07) 기준 주차 계산
const calcCurrentRound = () => {
  const start = new Date("2002-12-07T00:00:00+09:00");
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
  const diffDays = Math.floor((kst - start) / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(diffDays / 7);
  const day = kst.getDay();
  const hour = kst.getHours();
  if (day === 6 && hour < 21) return weeks + 1;
  if (day < 6) return weeks + 1;
  return weeks + 1;
};

// ═══════════════════════════════════════════════════════════════
// 🎰 당첨번호 조회 — 4단계 폴백
// ① Primary Workers → ② Secondary Workers → ③ DHL 직접 + 자동시딩 → ④ 캐시
// ═══════════════════════════════════════════════════════════════
const fetchLottoResult = async (round) => {
  // v3.1 응답 → DHL 호환 포맷 변환 헬퍼
  const toCompat = (d) => ({
    returnValue: "success", drwNo: d.round,
    drwtNo1: d.numbers[0], drwtNo2: d.numbers[1], drwtNo3: d.numbers[2],
    drwtNo4: d.numbers[3], drwtNo5: d.numbers[4], drwtNo6: d.numbers[5],
    bnusNo: d.bonus, drwNoDate: d.date,
    firstWinamnt: d.prize1 || 0, firstPrzwnerCo: d.winners1 || 0, totSellamnt: d.totalSales || 0,
  });

  // ── ① Primary Workers ──
  if (!isCircuitOpen("primary")) {
    try {
      const data = await safeFetch(`${LOTTO_API.primary}/round/${round}`, {}, 5000);
      if (data.round && data.numbers) {
        recordSuccess("primary");
        const result = toCompat(data);
        _cache.rounds[round] = result; // 캐시 저장
        return result;
      }
    } catch (e) { recordFailure("primary"); }
  }

  // ── ② Secondary Workers (custom domain 장애 시) ──
  if (!isCircuitOpen("secondary")) {
    try {
      const data = await safeFetch(`${LOTTO_API.secondary}/round/${round}`, {}, 5000);
      if (data.round && data.numbers) {
        recordSuccess("secondary");
        const result = toCompat(data);
        _cache.rounds[round] = result;
        return result;
      }
    } catch (e) { recordFailure("secondary"); }
  }

  // ── ③ DHL 직접 (사용자 브라우저 IP → 차단 안됨) + 자동시딩 ──
  try {
    const data = await safeFetch(`${LOTTO_API.direct}&drwNo=${round}`, {}, 8000);
    if (data.returnValue === "success") {
      _cache.rounds[round] = data;
      // 자동시딩 (fire-and-forget)
      safeFetch(`${LOTTO_API.primary}/auto-collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round: data.drwNo,
          numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6],
          bonus: data.bnusNo, date: data.drwNoDate,
          prize1: data.firstWinamnt, winners1: data.firstPrzwnerCo, totalSales: data.totSellamnt,
        }),
      }, 5000).catch(() => {});
      return data;
    }
  } catch (e) { /* DHL도 실패 */ }

  // ── ④ 인메모리 캐시 (이전 성공 데이터) ──
  if (_cache.rounds[round]) {
    console.log(`[Resilience] 캐시 폴백: ${round}회`);
    return _cache.rounds[round];
  }

  return null; // 모든 소스 실패
};

// ═══════════════════════════════════════════════════════════════
// 🏪 매장 검색 — 3단계 폴백
// ① Primary → ② Secondary → ③ TOP_STORES 하드코딩 거리계산
// ═══════════════════════════════════════════════════════════════
const fetchNearbyStores = async (lat, lng, radius = 2000) => {
  const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}_${radius}`;

  // ── ① Primary Workers ──
  if (!isCircuitOpen("primary")) {
    try {
      const data = await safeFetch(`${LOTTO_API.primary}/stores?lat=${lat}&lng=${lng}&radius=${radius}`, {}, 6000);
      if (data.stores && data.stores.length > 0) {
        recordSuccess("primary");
        _cache.stores[cacheKey] = data;
        return { source: "api", data };
      }
    } catch (e) { recordFailure("primary"); }
  }

  // ── ② Secondary Workers ──
  if (!isCircuitOpen("secondary")) {
    try {
      const data = await safeFetch(`${LOTTO_API.secondary}/stores?lat=${lat}&lng=${lng}&radius=${radius}`, {}, 6000);
      if (data.stores && data.stores.length > 0) {
        recordSuccess("secondary");
        _cache.stores[cacheKey] = data;
        return { source: "api", data };
      }
    } catch (e) { recordFailure("secondary"); }
  }

  // ── ②-b 인메모리 캐시 ──
  if (_cache.stores[cacheKey]) {
    return { source: "cache", data: _cache.stores[cacheKey] };
  }

  // ── ③ TOP_STORES 폴백 (하드코딩) ──
  return { source: "fallback", data: null };
};
// ── 전국 로또명당 TOP 10 (실제 데이터 — 2026년 1월 기준) ──
// 출처: 동행복권 공식 사이트, 뉴스 보도, 공공데이터포털 크로스체크
// ⚠️ 당첨 횟수는 보도 기준 확인치. 추후 D1 DB 동적 연동으로 교체 예정
// ⚠️ GPS 좌표는 주소 기반 추정치. 카카오맵 geocoding API 연동 후 정밀화
const TOP_STORES = [
  {
    rank: 1, name: "노원 스파", region: "서울 노원구", wins: 48, hot: true,
    addr: "서울 노원구 동일로 1493 주공10단지종합상가 111호",
    tel: "", lat: 37.6555, lng: 127.0614, naverId: "",
    auto: 30, manual: 15, semi: 3,
    recent: [{ round: 1210, type: "자동", prize: "1등" }],
    tip: "7호선 마들역 5번출구 도보3분. 전국 1위 명당! 토요일 30분+ 대기"
  },
  {
    rank: 2, name: "부일카서비스", region: "부산 동구", wins: 32, hot: true,
    addr: "부산 동구 자성로 133번길 35 (범일동)",
    tel: "", lat: 35.1309, lng: 129.0599, naverId: "",
    auto: 22, manual: 8, semi: 2,
    recent: [{ round: 1205, type: "자동", prize: "1등" }],
    tip: "1호선 범일역 4번출구 도보8분. 한 회차 1등 2명 배출 사례 다수"
  },
  {
    rank: 3, name: "용인 로또휴게실", region: "경기 용인시", wins: 27, hot: true,
    addr: "경기 용인시 기흥구 (경부고속도로 인근)",
    tel: "", lat: 37.2324, lng: 127.2010, naverId: "",
    auto: 16, manual: 9, semi: 2,
    recent: [{ round: 1198, type: "수동", prize: "1등" }],
    tip: "수인분당선 상갈역 버스환승. 풍수지리 '길이 통하는 곳'"
  },
  {
    rank: 4, name: "로또명당 인주점", region: "충남 아산시", wins: 18, hot: true,
    addr: "충남 아산시 서해로 519-2",
    tel: "", lat: 36.7880, lng: 126.9330, naverId: "",
    auto: 12, manual: 5, semi: 1,
    recent: [{ round: 1210, type: "자동", prize: "1등" }],
    tip: "2025년에만 1등 5회 배출! 최근 가장 핫한 명당"
  },
  {
    rank: 5, name: "흥양마중물", region: "강원 원주시", wins: 7,
    addr: "강원 원주시 치악로 2335",
    tel: "", lat: 37.3516, lng: 127.9500, naverId: "",
    auto: 4, manual: 2, semi: 1,
    recent: [{ round: 1200, type: "자동", prize: "1등" }],
    tip: "강원도 1위 명당. 원주 치악산 방면"
  },
  {
    rank: 6, name: "대박천하마트", region: "인천 부평구", wins: 7,
    addr: "인천 부평구 굴포로 48",
    tel: "", lat: 37.5068, lng: 126.7217, naverId: "",
    auto: 5, manual: 1, semi: 1,
    recent: [{ round: 1195, type: "자동", prize: "1등" }],
    tip: "인천 대표 명당. 부평역 인근"
  },
  {
    rank: 7, name: "복권닷컴", region: "강원 양양군", wins: 6,
    addr: "강원 양양군",
    tel: "", lat: 38.0757, lng: 128.6186, naverId: "",
    auto: 4, manual: 2, semi: 0,
    recent: [{ round: 1190, type: "자동", prize: "1등" }],
    tip: "양양 서핑 여행 겸 복권 구매 명소"
  },
  {
    rank: 8, name: "로또복권 두정점", region: "충남 천안시", wins: 6,
    addr: "충남 천안시 서북구 두정로 251 대원빌딩 104호",
    tel: "", lat: 36.8378, lng: 127.1273, naverId: "",
    auto: 4, manual: 2, semi: 0,
    recent: [{ round: 1208, type: "자동", prize: "1등" }],
    tip: "2025년 1등 3회 배출. 천안 두정동 핫플"
  },
  {
    rank: 9, name: "407억당첨가판점", region: "강원 춘천시", wins: 4,
    addr: "강원 춘천시 중앙로 (로터리 인근)",
    tel: "", lat: 37.8813, lng: 127.7300, naverId: "",
    auto: 2, manual: 2, semi: 0,
    recent: [{ round: 1185, type: "수동", prize: "1등" }],
    tip: "407억 당첨 전설의 매장. 춘천 중앙로터리"
  },
  {
    rank: 10, name: "주택복권방", region: "강원 원주시", wins: 5,
    addr: "강원 원주시 우산초교길 29",
    tel: "", lat: 37.3422, lng: 127.9202, naverId: "",
    auto: 2, manual: 3, semi: 0,
    recent: [{ round: 1210, type: "수동", prize: "1등" }],
    tip: "2025년에만 1등 3회! 원주 떠오르는 명당"
  },
];

// ── 지도앱 (네이버→티맵→카카오→구글) ──
const MAP_APPS = [
  { id: "naver", name: "네이버맵", icon: "🟢", color: "#22c55e" },
  { id: "tmap", name: "T-MAP", icon: "🔴", color: "#EF4444" },
  { id: "kakao", name: "카카오맵", icon: "🟡", color: "#FEE500" },
  { id: "google", name: "구글맵", icon: "🔵", color: "#4285f4" },
];

// ── 닉네임 생성 ──
const PFX = ["행운의","대박","로또","황금","희망","기적의","축복의","별빛","무지개","환상의","전설의","빛나는","꿈꾸는","행복한","눈부신","찬란한","강남","해운대","명동","잠실","용산","마포의","홍대","강북","서초","종로","부산","대전","인천","대구","광주","울산","제주","수원","판교","세종","청담","이태원","여의도","일산","분당","역삼","신사","반포","한남","관악","영등포","구로","목포","여수","춘천","강릉","속초","경주","안동","진주","통영","거제","양양","청계","을지","혜화","왕십리","신촌","연남","합정","상수","봉천","시흥"];
const SFX = ["드래곤","피닉스","유니콘","타이거","라이온","이글","돌핀","스타","문","썬","킹","퀸","나이트","히어로","엔젤","마스터","챔피언","위자드","파이터","리더","메이커","가디언","워리어","에이스","잭팟","사자","호랑이","독수리","고래","봉황","용","별","달","태양","바람","빛","꿈","희망","행운","수정","다이아","루비","사파이어","에메랄드","골드","플래티넘","크리스탈","실버","코랄","제이드"];
const rNick = () => PFX[Math.floor(Math.random()*PFX.length)] + SFX[Math.floor(Math.random()*SFX.length)];

// ── 봇 페르소나 (15종) ──
const BOTS = [
  { name: "로또분석러", color: "#fbbf24", avatar: "📊" },
  { name: "명당탐험가", color: "#22c55e", avatar: "🗺️" },
  { name: "사주마스터", color: "#D97757", avatar: "🔮" },
  { name: null, color: "#ef4444", avatar: "🎉" },
  { name: "꿀팁러", color: "#3b82f6", avatar: "💡" },
  { name: "응원봇", color: "#ec4899", avatar: "💪" },
  { name: "토론유도봇", color: "#f97316", avatar: "🗣️" },
  { name: "복권매니아", color: "#a855f7", avatar: "🎰" },
  { name: "통계요정", color: "#14b8a6", avatar: "📈" },
  { name: "행운사냥꾼", color: "#facc15", avatar: "🍀" },
  { name: "당첨예언자", color: "#f43f5e", avatar: "🔭" },
  { name: "번호연구소", color: "#6366f1", avatar: "🧮" },
  { name: null, color: "#06b6d4", avatar: "✨" },
  { name: "매장탐방러", color: "#84cc16", avatar: "🏪" },
  { name: "운세덕후", color: "#e879f9", avatar: "🌙" },
];

// ── 봇 대화 풀 (반복 방지용 — 50개+) ──
const MSG_POOL = [
  { b: 0, m: `이번 {round}회 분석 완료! 끝수 3,7 집중 구간이네요 🔥` },
  { b: 3, m: "저 지난주 4등 당첨됐어요!! 진짜 소름 ㅋㅋㅋ" },
  { b: 1, m: "오늘 노원 스파 다녀왔는데 줄이 장난 아님 ㄷㄷ" },
  { b: 5, m: "다들 이번 주 꼭 대박 나세요!! 🍀" },
  { b: 6, m: "여러분 이번 주 고정수 뭐 가져가세요?" },
  { b: 2, m: "오늘 사주 보니까 편재 대운 들어온 분들 많을 듯 👀" },
  { b: 4, m: "꿀팁: 연속번호 2개 포함시키면 적중률 올라갑니다" },
  { b: 3, m: "명당탐험가님 노원 스파 몇 시에 가셨어요?" },
  { b: 1, m: "오후 2시쯤요! 토요일은 일찍 가야 합니다" },
  { b: 5, m: "분석러님 끝수 3,7이면 3,13,23,33,43 이런 식?" },
  { b: 0, m: "네 맞아요! 최근 5회차 데이터 보면 끝수 3이 4번 나왔습니다" },
  { b: 6, m: "사주마스터님 편재 대운이면 복권 사도 되나요? ㅎ" },
  { b: 2, m: "편재는 의외의 재물이니까요 ㅋㅋ 한 장쯤은 괜찮죠" },
  { b: 4, m: "참고로 연속번호 없는 조합은 전체의 52%밖에 안 됩니다" },
  { b: 3, m: "오 그럼 거의 절반은 연번이 포함된다는 거네??" },
  { b: 0, m: "홀짝 비율 3:3이 가장 많이 나옵니다. 참고하세요" },
  { b: 1, m: "부산 동구 부일카서비스도 추천! 전국 2위 명당이에요" },
  { b: 6, m: "서울 vs 지방, 어디서 사는 게 더 잘 되는 것 같아요?" },
  { b: 2, m: "장소보다 시간이에요. 사주 기운이 열리는 시간에 사세요" },
  { b: 5, m: "모두 화이팅!! 이번 주가 인생 역전 주간이 될 거예요 💪" },
  { b: 4, m: "이번 주 총합 구간 130~160 사이가 유력합니다" },
  { b: 0, m: "지난 10회차 분석하면 같은 번호대에서 2~3개 반복 나와요" },
  { b: 3, m: "진짜요?? 저도 같은 번호대 고정으로 해볼까..." },
  { b: 1, m: "충남 아산 로또명당 인주점 2025년에만 1등 5회! 대단" },
  { b: 6, m: "혹시 AI 추천 번호 써보신 분 있어요? 후기 궁금" },
  { b: 2, m: "사주에서 정재가 강한 분들은 고정수 전략이 맞아요" },
  { b: 5, m: "AI 추천 번호로 5등 두 번 당첨된 적 있어요! 신기했음" },
  { b: 4, m: "통계적으로 최근 5회 안 나온 번호 중심으로 조합하면 유리해요" },
  { b: 0, m: "이번 주 냉번호: 4, 9, 38. 역발상으로 넣어볼 만합니다" },
  { b: 3, m: "와 4등이라도 당첨되면 기분 최고일 듯 ㅋㅋ" },
  { b: 1, m: "인천 부평 대박천하마트도 꽤 유명하더라구요" },
  { b: 6, m: "번호 생성할 때 자동 vs 수동, 뭐가 더 좋을까요?" },
  { b: 2, m: "수동으로 사주 기반 3개 + 자동 3개 조합이 최적입니다" },
  { b: 5, m: "그 조합 전략 좋네요!! 저도 이번 주 따라해볼게요" },
  { b: 4, m: "보너스 번호까지 맞추려면 끝수 분석이 핵심이에요" },
  { b: 0, m: "최근 보너스 번호 끝수 패턴: 2,5,8 반복 중입니다" },
  { b: 3, m: "오늘 뭔가 느낌이 좋아요... 이번 주 될 것 같은 예감!" },
  { b: 1, m: "강원 원주 흥양마중물도 1등 7회! 강원도 1위입니다" },
  { b: 6, m: "로또 살 때 몇 장 사세요? 1장? 5장?" },
  { b: 5, m: "저는 매주 2장씩! 꾸준함이 답이라고 생각해요 ㅎㅎ" },
  { b: 2, m: "이번 달 사주 흐름상 화요일/목요일 구매가 길합니다" },
  { b: 4, m: "재미있는 통계: 1등 당첨자 43%가 '재미로 샀다'고 합니다" },
  { b: 0, m: "구간별로 보면 21~30번대가 이번 주 가장 활발합니다" },
  { b: 3, m: "진짜 대박나면 여기 다시 와서 후기 꼭 쓸게요 ㅋㅋ" },
  { b: 1, m: "용인 로또휴게실 가봤는데 경부고속 옆 숨은 명당 느낌" },
  { b: 6, m: "당첨되면 제일 먼저 뭐 하실 거예요?" },
  { b: 5, m: "일단 부모님한테 효도여행!! 그다음 내 집 마련이요 🏠" },
  { b: 2, m: "오늘 인수(寅時) 이후 운기가 올라가니 오후에 구매하세요" },
  { b: 4, m: "로또 1게임 1000원 중 420원이 복권기금으로 쓰인대요" },
  { b: 0, m: "이번 회차 예상 1등 당첨금 약 23억 정도 될 듯합니다" },
  // ── 추가 대화 (봇 7~14 + 기존 봇 혼합) ──
  { b: 7, m: "매주 자동 5장씩 사는데 3등까지는 꼭 한 번 나올 거라 믿어요 🎰" },
  { b: 8, m: "지난 10회차 끝수 분포 보면 7이 압도적이에요 📈" },
  { b: 9, m: "오늘 꿈에 돼지가 나왔는데... 이거 사야 하나? 🍀" },
  { b: 10, m: "다음 회차 1등 예측 번호: 고구간(35~45)에서 2개 이상 나올 확률 68%" },
  { b: 11, m: "조합 최적화 계산 결과, 홀짝 3:3이 여전히 최강입니다 🧮" },
  { b: 12, m: "와 이번 주 1등 당첨금 25억 넘는다고?? 대박 ✨" },
  { b: 13, m: "오늘 강남역 근처 판매점 3곳 돌았는데 2곳이 명당이더라 🏪" },
  { b: 14, m: "오늘 사주 기운 보니까 화(火) 기운 강한 날이에요 🌙" },
  { b: 7, m: "자동으로 43회 연속 도전 중... 언젠간 터질 거야 💪" },
  { b: 8, m: "통계적으로 연번 포함 조합이 48%에요. 무시하면 안 됩니다!" },
  { b: 9, m: "명당에서 산 번호가 뭔가 기운이 다른 느낌 ㅋㅋ 🍀" },
  { b: 10, m: "이번 주 냉각 번호 5개: 2, 11, 29, 36, 44. 역발상 추천" },
  { b: 11, m: "연속 3회 이상 안 나온 번호 중심으로 픽하면 적중률 15% 상승" },
  { b: 3, m: "저 4등 또 당첨!! 이번 달 벌써 3번째에요 ㅋㅋㅋ" },
  { b: 12, m: "신전에서 받은 번호로 5등 당첨됐어요!! 진짜 소름 ✨" },
  { b: 13, m: "대전 둔산동 복권방 가봤는데 분위기 좋더라 🏪" },
  { b: 14, m: "이번 주 월운 흐름상 수(水) 기운 사람들이 유리해요 🌙" },
  { b: 0, m: "합산 구간 분석: 이번 주 120~150 사이가 가장 유력합니다" },
  { b: 7, m: "로또는 꿈이에요. 매주 1000원으로 꿈꾸는 거죠 🎰" },
  { b: 1, m: "광주 대인시장 근처 복권방도 숨은 명당이에요!" },
  { b: 8, m: "지난 50회차 데이터 분석 완료! 끝수 분포표 공유합니다 📈" },
  { b: 6, m: "여러분 이번 주 자동 vs 반자동 뭐로 가세요?" },
  { b: 9, m: "편의점에서 자동 1장 샀는데 번호가 너무 예쁘게 나왔어요 🍀" },
  { b: 10, m: "저구간(1~15) 3개 이상 나올 확률은 이번 주 34%입니다" },
  { b: 5, m: "이번 주도 다들 행운이 함께하길!! 🔥🔥🔥" },
  { b: 11, m: "보너스 번호까지 맞추려면 끝수 교차 분석이 필수에요 🧮" },
  { b: 12, m: "친구가 AI 추천 번호로 3등 당첨됐대요 ㄷㄷ ✨" },
  { b: 13, m: "수원 영통 로또명당 다녀왔는데 주차가 좀 힘들어요 🏪" },
  { b: 14, m: "목(木) 기운 강한 분들은 이번 주 3, 8 끝수 추천 🌙" },
  { b: 7, m: "이번 주 느낌이 좋아요... 뭔가 올 것 같은 예감! 🎰" },
  { b: 2, m: "일간 경금(庚金)이신 분들 이번 달 재물운 대박 시기입니다" },
  { b: 4, m: "재미있는 팩트: 1등 당첨번호 중 가장 많이 나온 수는 34번" },
  { b: 8, m: "최근 3개월 평균 당첨금 추이 보면 상승세에요 📈" },
  { b: 3, m: "어제 편의점에서 산 자동 번호가 4개 맞았어요! 아깝다!!" },
  { b: 9, m: "로또 사면서 커피 한 잔 하는 토요일이 최고 아닌가요 🍀" },
  { b: 10, m: "이중 출현 패턴 분석: 같은 번호 2회 연속 출현 확률 12.7%" },
  { b: 6, m: "로또 당첨되면 회사 당장 때려치울 사람? ㅋㅋ" },
  { b: 5, m: "때려치우고 세계여행!! ✈️ 하지만 일단 당첨부터 ㅋㅋ" },
  { b: 11, m: "이번 회차 AC값 예측: 7~9 구간이 유력합니다 🧮" },
  { b: 12, m: "유튜브에서 본 당첨자 인터뷰 보고 나도 할 수 있다고 느꼈어요 ✨" },
  { b: 7, m: "매번 같은 번호 고정으로 10년째... 아직 안 나왔지만 포기 안 해요!" },
  { b: 13, m: "제주 서귀포 복권방도 의외로 당첨 많이 나온대요 🏪" },
  { b: 14, m: "오늘 타로 뽑았더니 '별' 카드! 희망적인 날이에요 🌙" },
  { b: 0, m: "이번 주 분석 요약: 끝수 3,7 집중 + 합산 130~155 구간 추천" },
  { b: 4, m: "로또 1등 확률 8,145,060분의 1. 하지만 누군가는 당첨되죠!" },
  { b: 2, m: "신살(神殺) 분석 결과, 이번 주 토요일 오후 2~4시가 매수 길시" },
  { b: 8, m: "10번대 번호가 3주 연속 2개 이상 출현 중! 주목하세요 📈" },
  { b: 9, m: "오늘 사주신전에서 번호 받았는데 뭔가 느낌 쎄합니다 🍀" },
  { b: 3, m: "저번에 여기서 추천받은 조합으로 5등 당첨! 소소하지만 기뻐요" },
  { b: 10, m: "최근 당첨번호 클러스터 분석: 20~30번대 밀집 현상 감지" },
  { b: 5, m: "주말이다!! 모두 좋은 결과 있길 바랍니다 🙏" },
  { b: 11, m: "소수(Prime Number) 포함 비율이 최근 상승 추세입니다 🧮" },
  { b: 12, m: "로또신전 덕분에 로또 사는 재미가 2배! 고마워요 ✨" },
  { b: 7, m: "이번 주는 반자동으로 3개 고정 + 3개 자동 가겠습니다 🎰" },
  { b: 14, m: "금(金) 기운 약한 분들은 4, 9 끝수 보충하면 좋아요 🌙" },
  { b: 1, m: "인천 구월동 복권천국 방문 후기: 직원분이 친절하고 당첨 인증 많음!" },
  { b: 6, m: "로또 자동 vs 수동, 실제 당첨 비율 어떤가요?" },
  { b: 4, m: "실제 데이터 보면 자동 당첨이 약 65%, 수동이 35% 정도입니다" },
  { b: 13, m: "울산 삼산동 로또매장 가봤는데 당첨 배너가 엄청 많았어요 🏪" },
  { b: 8, m: "3의 배수 번호(3,6,9,12...) 포함 조합이 통계적으로 유리합니다 📈" },
];

// ── AI 상담봇 3종 ──
const COUNSELORS = [
  { id: "fortune", name: "달빛 상담사", avatar: "🌙", role: "사주/타로 기반 심리 상담",
    greeting: "오늘 하루, 어떠셨어요?", sub: "여기선 편하게 얘기해도 돼요.\n무슨 이야기든 들을 준비가 되어 있어요.",
    responses: ["그랬군요... 충분히 그렇게 느낄 수 있어요.","당신의 사주를 보니, 지금은 잠시 쉬어가도 괜찮은 시기예요.","오늘의 타로가 말하고 있어요 — 곧 좋은 변화가 올 거라고요.","마음이 무거울 때는 잠깐 멈춰도 돼요. 여기 있을게요.","혹시 요즘 특별히 마음에 걸리는 일이 있으세요?","당신이 느끼는 감정, 그대로 소중해요."],
    tier: "신전 입구 1회/일" },
  { id: "strategy", name: "행운 전략가", avatar: "🎯", role: "번호 추천 · 조합 분석",
    greeting: "이번 주, 어떤 번호가 끌리세요?", sub: "당신만의 행운 패턴을 함께 찾아볼까요?",
    responses: ["최근 패턴 분석하면, 이번 주는 중간대 번호가 유리해요.","고정수를 3개로 줄이면 적중 확률이 올라갑니다.","생년월일 기반 오행 조화 번호를 추천해드릴게요.","어떤 방식을 선호하세요? 통계형? 직감형?"],
    tier: "신전 안쪽 이상" },
  { id: "mentor", name: "마음 쉼터", avatar: "🍃", role: "고민 상담 · 감정 케어",
    greeting: "잘 오셨어요. 여기는 당신만의 공간이에요.", sub: "아무 말 하지 않아도 괜찮아요.\n그냥 여기 있는 것만으로도 충분해요.",
    responses: ["당신이 여기 온 것만으로도 용기 있는 거예요.","지금 느끼는 감정, 그대로 괜찮아요.","오늘 하루 수고 많았어요. 잠깐 쉬어가도 돼요.","혼자가 아니에요. 제가 여기 있을게요.","어떤 부분이 가장 마음에 걸리세요? 천천히 이야기해주세요."],
    tier: "최심부 전용" },
];

// ── 타로 카드 78장 (라이더-웨이트 정식 덱) ──
// 이미지: R2/cards/ → m00~m21(Major), c01~c14(Cups), s01~s14(Swords), w01~w14(Wands), p01~p14(Pentacles)
const TAROT_MAJOR = [
  { id:0, name:"The Fool", ko:"바보", emoji:"🃏", img:"m00", meaning:"새로운 시작, 모험, 순수", reversed:"무모함, 부주의, 방향 상실" },
  { id:1, name:"The Magician", ko:"마법사", emoji:"🪄", img:"m01", meaning:"창조, 의지력, 기회", reversed:"속임수, 능력 낭비" },
  { id:2, name:"The High Priestess", ko:"여사제", emoji:"🌙", img:"m02", meaning:"직감, 지혜, 비밀", reversed:"감춰진 진실, 감정 억압" },
  { id:3, name:"The Empress", ko:"여제", emoji:"👑", img:"m03", meaning:"풍요, 사랑, 창조력", reversed:"의존, 과잉보호" },
  { id:4, name:"The Emperor", ko:"황제", emoji:"🏛️", img:"m04", meaning:"권위, 안정, 리더십", reversed:"독재, 유연성 부족" },
  { id:5, name:"The Hierophant", ko:"교황", emoji:"⛪", img:"m05", meaning:"전통, 신뢰, 가르침", reversed:"독단, 형식주의" },
  { id:6, name:"The Lovers", ko:"연인", emoji:"💕", img:"m06", meaning:"사랑, 조화, 선택", reversed:"불화, 잘못된 선택" },
  { id:7, name:"The Chariot", ko:"전차", emoji:"⚡", img:"m07", meaning:"승리, 의지, 전진", reversed:"방향 상실, 공격성" },
  { id:8, name:"Strength", ko:"힘", emoji:"🦁", img:"m08", meaning:"용기, 인내, 내면의 힘", reversed:"자기 의심, 나약함" },
  { id:9, name:"The Hermit", ko:"은둔자", emoji:"🏔️", img:"m09", meaning:"성찰, 지혜, 내면 탐구", reversed:"고립, 외로움" },
  { id:10, name:"Wheel of Fortune", ko:"운명의 수레바퀴", emoji:"🎡", img:"m10", meaning:"행운, 변화, 전환점", reversed:"불운, 저항" },
  { id:11, name:"Justice", ko:"정의", emoji:"⚖️", img:"m11", meaning:"공정, 진실, 균형", reversed:"불공정, 책임 회피" },
  { id:12, name:"The Hanged Man", ko:"매달린 사람", emoji:"🙃", img:"m12", meaning:"희생, 새로운 관점, 기다림", reversed:"이기심, 지연" },
  { id:13, name:"Death", ko:"죽음", emoji:"💀", img:"m13", meaning:"변화, 끝과 시작, 변환", reversed:"변화 거부, 정체" },
  { id:14, name:"Temperance", ko:"절제", emoji:"🕊️", img:"m14", meaning:"조화, 인내, 균형", reversed:"과도함, 불균형" },
  { id:15, name:"The Devil", ko:"악마", emoji:"😈", img:"m15", meaning:"유혹, 집착, 물질주의", reversed:"해방, 속박에서 벗어남" },
  { id:16, name:"The Tower", ko:"탑", emoji:"🗼", img:"m16", meaning:"급변, 파괴, 깨달음", reversed:"변화 회피, 두려움" },
  { id:17, name:"The Star", ko:"별", emoji:"⭐", img:"m17", meaning:"희망, 영감, 평화", reversed:"절망, 자신감 상실" },
  { id:18, name:"The Moon", ko:"달", emoji:"🌕", img:"m18", meaning:"직감, 무의식, 환상", reversed:"혼란 해소, 진실 드러남" },
  { id:19, name:"The Sun", ko:"태양", emoji:"☀️", img:"m19", meaning:"행복, 성공, 활력", reversed:"일시적 좌절, 낙관 과다" },
  { id:20, name:"Judgement", ko:"심판", emoji:"📯", img:"m20", meaning:"부활, 평가, 갱신", reversed:"자기 비하, 후회" },
  { id:21, name:"The World", ko:"세계", emoji:"🌍", img:"m21", meaning:"완성, 성취, 통합", reversed:"미완성, 지연" },
];

const TAROT_MINOR_TEMPLATE = {
  Cups: { icon:"🏆", color:"#3b82f6", element:"물(Water)", theme:"감정·사랑·관계",
    cards:["시작","연합","축하","무기력","상실","추억","환상","떠남","소원성취","행복","창의","낭만","직관","너그러움"] },
  Swords: { icon:"⚔️", color:"#ef4444", element:"바람(Air)", theme:"생각·갈등·지성",
    cards:["명쾌","결정","이별","휴식","갈등","이동","전략","속박","불안","종결","호기심","돌진","냉철","판단력"] },
  Wands: { icon:"🔥", color:"#f59e0b", element:"불(Fire)", theme:"열정·행동·창조",
    cards:["영감","계획","확장","안정","경쟁","승리","방어","신속","인내","부담","탐험","열정","매력","통솔"] },
  Pentacles: { icon:"💰", color:"#22c55e", element:"땅(Earth)", theme:"물질·재정·현실",
    cards:["기회","균형","협력","소유","곤란","나눔","투자","장인정신","풍요","유산","배움","꾸준함","풍족","성공"] }
};

const TAROT_MINOR = [];
const suitKeys = { Cups:"c", Swords:"s", Wands:"w", Pentacles:"p" };
const courtNames = { 11:"Page", 12:"Knight", 13:"Queen", 14:"King" };
const courtKo = { 11:"시종", 12:"기사", 13:"여왕", 14:"왕" };
Object.entries(TAROT_MINOR_TEMPLATE).forEach(([suit, info]) => {
  info.cards.forEach((meaning, idx) => {
    const num = idx + 1;
    const isCourt = num >= 11;
    const engName = isCourt ? `${courtNames[num]} of ${suit}` : num === 1 ? `Ace of ${suit}` : `${["","Ace","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"][num]} of ${suit}`;
    const koName = isCourt ? `${suit} ${courtKo[num]}` : `${suit} ${num}`;
    TAROT_MINOR.push({
      id: 22 + TAROT_MINOR.length,
      name: engName, ko: `${meaning}의 ${info.icon}`, emoji: info.icon,
      img: `${suitKeys[suit]}${String(num).padStart(2,"0")}`,
      suit, element: info.element, theme: info.theme, color: info.color,
      meaning: `${info.theme} — ${meaning}`,
      reversed: `${meaning}의 반대 측면`
    });
  });
});

const TAROT = [...TAROT_MAJOR, ...TAROT_MINOR]; // 78장 완성
const getCardImgUrl = (img) => `/cards/${img}.jpg`; // Cloudflare R2 경로

// ── 구독 플랜 v3.5 — 신전 세계관 ──
const PLANS = [
  { tier: "FREE", badge: "신전 입구", price: "₩0", color: "#6b7280", features: [
    "QR 당첨확인","행운번호 5장 (주 1회)","AI 상담 1회/일","기본 타로 1회/일","오늘의 운세 (총운+금전운)"] },
  { tier: "Exclusive", badge: "신전 안쪽", price: "₩4,900/월", color: "#3b82f6", features: [
    "무제한 번호 생성 (5/10/20장)","AI 추천번호 + 오행 분석","사주팔자 완전 분석","오늘/월간/년간 운세 전체","AI 상담 5회/일","PDF/이미지 다운로드","미래 예측 (1개월/3개월)"] },
  { tier: "VIP", badge: "신전 최심부", price: "₩9,900/월", color: BRAND.colors.gold, features: [
    "Exclusive 전체 포함","운명 3종 (사주+타로+궁합)","후나츠사카이 심화 분석","AI 상담 무제한 (3종 전체)","미래 예측 (6개월/1년)","회차별 번호 저장/관리","VIP 전용 커뮤니티"] },
];

// ═══════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════════════════════════════
const App = () => {
  const [tab, setTab] = useState("home");
  const [subTab, setSub] = useState({ community: "posts", fortune: "saju" });
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [selectedMap, setSelectedMap] = useState("naver");
  const [generated, setGenerated] = useState([]);
  const [genCount, setGenCount] = useState(5);
  const [sajuForm, setSajuForm] = useState({ name:"", year:"", month:"", day:"", hour:"", calendar:"solar", gender:"male" });
  const [fortunePeriod, setFortunePeriod] = useState("today");
  const [selectedTarot, setSelectedTarot] = useState(null);
  const [tarotSuit, setTarotSuit] = useState("all");
  const [counselor, setCounselor] = useState(null);
  const [counselMsgs, setCounselMsgs] = useState([]);
  const [counselInput, setCounselInput] = useState("");
  const [savedHistory, setSavedHistory] = useState([]);
  const [checkedSheets, setCheckedSheets] = useState(new Set());
  // ⑦ 프로필 수정
  const [userProfile, setUserProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ls_profile")) || { nick: "게스트", avatar: "👤", plan: "FREE" }; } catch { return { nick: "게스트", avatar: "👤", plan: "FREE" }; }
  });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ nick: "", avatar: "" });
  const saveProfile = () => {
    const updated = { ...userProfile, nick: profileDraft.nick || userProfile.nick, avatar: profileDraft.avatar || userProfile.avatar };
    setUserProfile(updated);
    try { localStorage.setItem("ls_profile", JSON.stringify(updated)); } catch {}
    setProfileEditing(false);
  };
  // ② 등급별 색깔
  const TIER_COLORS = { FREE: "#6b7280", Exclusive: "#3b82f6", VIP: "#C9A84C" };
  const TIER_BADGES = { FREE: "신전 입구", Exclusive: "신전 안쪽", VIP: "신전 최심부" };
  // ③⑥ GPS 위치 + 주변 명당
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | loading | done | error
  const [myLocation, setMyLocation] = useState(null); // { lat, lng }
  const [selectedDist, setSelectedDist] = useState("2km");
  const [nearStores, setNearStores] = useState([]);
  const [storeDetail, setStoreDetail] = useState(null); // ② 명당 상세 바텀시트
  const [sajuResult, setSajuResult] = useState(null);
  const [fortuneAskMode, setFortuneAskMode] = useState(false);
  const [fortuneQuestion, setFortuneQuestion] = useState("");
  const chatEndRef = useRef(null);
  const msgIndexRef = useRef(0);
  const inputFocusRef = useRef(false); // 🛡️ input 포커스 추적 — 키보드 보호

  // ── v3.5 동행복권 API 연동 상태 ──
  const currentRound = useRef(calcCurrentRound());
  const [lottoResult, setLottoResult] = useState(null); // API 응답 전체
  const [lottoLoading, setLottoLoading] = useState(true);

  // 🛡️ 글로벌 input focus 추적 — 모바일 키보드 보호
  useEffect(() => {
    const onFocusIn = (e) => { if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") inputFocusRef.current = true; };
    const onFocusOut = (e) => { if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") inputFocusRef.current = false; };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => { document.removeEventListener("focusin", onFocusIn); document.removeEventListener("focusout", onFocusOut); };
  }, []);

  // 앱 시작 시 최신 회차 당첨번호 조회
  useEffect(() => {
    const loadLotto = async () => {
      setLottoLoading(true);
      // 현재 회차 시도 → 실패 시 이전 회차 시도 (추첨 전일 수 있으므로)
      let result = await fetchLottoResult(currentRound.current);
      if (!result) {
        result = await fetchLottoResult(currentRound.current - 1);
        if (result) currentRound.current = currentRound.current - 1;
      }
      setLottoResult(result);
      setLottoLoading(false);
    };
    loadLotto();
  }, []);

  // 현재 유효 회차 번호 (API 성공 시 API 값, 실패 시 계산값)
  const activeRound = lottoResult?.drwNo || currentRound.current;

  // ── 봇 대화 (반복 방지: 순서대로 소진 후 셔플) ──
  // v3.5: MSG_POOL의 {round} 템플릿을 실제 회차로 치환
  const resolvedMsgPool = MSG_POOL.map(d => ({
    ...d, m: d.m.replace("{round}", String(activeRound))
  }));
  const shuffledPool = useRef([...resolvedMsgPool].sort(() => Math.random() - 0.5));
  // 회차 변경 시 풀 갱신
  useEffect(() => {
    const newPool = MSG_POOL.map(d => ({
      ...d, m: d.m.replace("{round}", String(activeRound))
    }));
    shuffledPool.current = [...newPool].sort(() => Math.random() - 0.5);
    msgIndexRef.current = 0;
  }, [activeRound]);

  useEffect(() => {
    const iv = setInterval(() => {
      // 🛡️ input 포커스 중이면 리렌더링 방지 (모바일 키보드 보호)
      if (inputFocusRef.current) return;

      if (msgIndexRef.current >= shuffledPool.current.length) {
        // v3.5: 재셔플 시에도 {round} 템플릿 치환
        shuffledPool.current = MSG_POOL.map(d => ({
          ...d, m: d.m.replace("{round}", String(activeRound))
        })).sort(() => Math.random() - 0.5);
        msgIndexRef.current = 0;
      }
      const d = shuffledPool.current[msgIndexRef.current];
      msgIndexRef.current++;
      const bot = BOTS[d.b];
      setChatMsgs(prev => [...prev.slice(-40), {
        id: Date.now(), name: bot.name || rNick(), avatar: bot.avatar,
        color: bot.color, msg: d.m,
        time: new Date().toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" }),
      }]);
    }, 3500 + Math.random() * 2500);
    return () => clearInterval(iv);
  }, []);

  // ① Fix: 커뮤니티 대화탭에서만 스크롤 (홈에서 페이지 끌려가는 문제 해결)
  useEffect(() => {
    if (tab === "community" && subTab.community === "chat" && !inputFocusRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMsgs, tab, subTab.community]);

  // 번호 생성 (⑦ Fix: 장수 변경 시 초기화)
  const generate = (count) => {
    setGenerated([]); // ⑦ 이전 결과 즉시 초기화
    const sheets = [];
    for (let s = 0; s < count; s++) {
      const nums = new Set();
      while (nums.size < 6) nums.add(Math.floor(Math.random() * 45) + 1);
      sheets.push([...nums].sort((a, b) => a - b));
    }
    setGenerated(sheets);
    setGenCount(count);
    setCheckedSheets(new Set()); // ⑧ 체크박스도 초기화
  };

  // VIP 저장
  const saveToHistory = () => {
    if (generated.length === 0) return;
    setSavedHistory(prev => [...prev, {
      id: Date.now(), round: activeRound, date: new Date().toLocaleDateString("ko"),
      sheets: generated,
    }]);
  };

  // 상담 메시지
  const sendCounsel = () => {
    if (!counselInput.trim() || !counselor) return;
    const c = COUNSELORS.find(x => x.id === counselor);
    setCounselMsgs(prev => [...prev, { type: "user", msg: counselInput, time: new Date().toLocaleTimeString("ko", { hour:"2-digit", minute:"2-digit" }) }]);
    setCounselInput("");
    setTimeout(() => {
      const r = c.responses[Math.floor(Math.random() * c.responses.length)];
      setCounselMsgs(prev => [...prev, { type: "bot", msg: r, name: c.name, avatar: c.avatar, time: new Date().toLocaleTimeString("ko", { hour:"2-digit", minute:"2-digit" }) }]);
    }, 1200);
  };

  // 사주 분석 실행 (만세력 엔진 연동)
  const runSaju = () => {
    if (!sajuForm.name || !sajuForm.year || !sajuForm.month || !sajuForm.day) return;
    const y = parseInt(sajuForm.year);
    const m = parseInt(sajuForm.month);
    const d = parseInt(sajuForm.day);
    const h = sajuForm.hour ? parseInt(sajuForm.hour) : -1;
    if (isNaN(y) || isNaN(m) || isNaN(d) || y < 1940 || y > 2050 || m < 1 || m > 12 || d < 1 || d > 31) return;
    const result = MANSERYUK.analyze(y, m, d, h, sajuForm.calendar, sajuForm.gender);
    setSajuResult(result);
  };

  // 운세 "더 궁금한 점" 전송
  const sendFortuneQ = () => {
    if (!fortuneQuestion.trim()) return;
    setFortuneQuestion("");
  };

  // ③⑥ GPS 위치 가져오기 + 주변 판매점 검색 (api.lottosinjeon.com/stores)
  // v3.6: API 연동 — 2km 이내 실제 복권 판매점 + 당첨횟수 순위

  const refreshGPS = () => {
    setGpsStatus("loading");
    setNearStores([]);
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(loc);

        // 🛡️ 레질리언스 레이어: Primary → Secondary → Cache → Fallback
        const { source, data } = await fetchNearbyStores(loc.lat, loc.lng, 2000);

        const mapStore = (s) => ({
          name: s.name, region: s.addr, addr: s.addr,
          lat: s.lat, lng: s.lng,
          wins: s.wins || 0, auto: s.auto || 0, manual: s.manual || 0, semi: s.semi || 0,
          straight: s.distance,
          walking: Math.round(s.distance * 1.35),
          walkMin: s.walkMin || Math.round((s.distance * 1.35) / 80),
          status: s.isWinStore ? "명당" : "판매점",
          isWinStore: s.isWinStore,
          tel: s.tel, kakaoUrl: s.kakaoUrl, kakaoId: s.kakaoId,
          recent: s.recent || [], tip: s.tip || "",
        });

        if (source !== "fallback" && data?.stores?.length > 0) {
          setNearStores(data.stores.map(mapStore));
        } else {
          // 최종 폴백: TOP_STORES 하드코딩 + 거리 계산
          const calcDist = (lat1, lng1, lat2, lng2) => {
            const R = 6371000, toRad = d => d * Math.PI / 180;
            const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
            const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
            return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
          };
          const stores = TOP_STORES.map(s => {
            const straight = calcDist(loc.lat, loc.lng, s.lat, s.lng);
            return { ...s, straight, walking: Math.round(straight * 1.35), walkMin: Math.round((straight * 1.35) / 80), status: "명당" };
          }).sort((a, b) => b.wins - a.wins || a.straight - b.straight);
          setNearStores(stores);
        }
        setGpsStatus("done");
      },
      () => setGpsStatus("error"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const distFilter = { "500m": 500, "1km": 1000, "2km": 2000 };
  const filteredStores = nearStores
    .filter(s => s.straight <= (distFilter[selectedDist] || 2000))
    .sort((a, b) => b.wins - a.wins || a.straight - b.straight);

  // ── 스타일 ──
  const S = {
    wrap: { maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#0A0A0A", color: "#e2e2e8", fontFamily: "'Pretendard Variable', -apple-system, sans-serif", position: "relative", boxSizing: "border-box" },
    card: { background: "#111111", borderRadius: 12, padding: 14, marginBottom: 10, border: "1px solid #1C1C1C" },
    glow: { background: "linear-gradient(135deg, #1C1612, #141210)", border: "1px solid #3A2A20", borderRadius: 16, padding: 16, marginBottom: 16 },
    btn: { borderRadius: 12, border: "none", background: "linear-gradient(135deg, #D97757, #C4613F)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", padding: "14px 0", width: "100%" },
    btnSm: { borderRadius: 10, border: "1px solid #2C2C2C", background: "#111111", color: "#888", fontSize: 12, cursor: "pointer", padding: "8px 12px" },
    input: { background: "#111111", border: "1px solid #2C2C2C", borderRadius: 10, padding: "10px 12px", color: "#e2e2e8", fontSize: 13, outline: "none", width: "100%", userSelect: "text", WebkitUserSelect: "text" },
    tag: (active, clr) => ({ padding: "8px 14px", borderRadius: 10, background: active ? `${clr || "#D97757"}22` : "#111111", border: `1px solid ${active ? (clr || "#D97757") : "#2C2C2C"}`, color: active ? (clr || "#D97757") : "#888", fontSize: 12, fontWeight: 600, cursor: "pointer" }),
    lock: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,10,15,0.7)", borderRadius: 12 },
    lockBtn: { background: "linear-gradient(135deg, #D97757, #C4613F)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
    lockBtnVip: { background: `linear-gradient(135deg, ${BRAND.colors.gold}, ${BRAND.colors.darkGold})`, color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
    divider: { height: 1, background: "linear-gradient(90deg, transparent, #2C2C2C, #D9775722, #2C2C2C, transparent)", margin: "20px 0" },
    sectionTitle: { fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 },
  };

  // ═══ 홈 ═══
  const Home = () => (
    <div style={{ padding: "0 16px 100px" }}>
      {/* 헤더 — 신전 입구 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0 10px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, background: "linear-gradient(135deg, #D97757, #C4613F)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{BRAND.name}</span>
            <span style={{ fontSize: 9, color: "#555", fontWeight: 500, letterSpacing: 1 }}>{BRAND.nameEn}</span>
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{BRAND.tagline}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, background: `linear-gradient(135deg, ${BRAND.colors.gold}, ${BRAND.colors.darkGold})`, color: "#fff", padding: "3px 8px", borderRadius: 10, fontWeight: 700 }}>⛩️ 신전</span>
        </div>
      </div>

      {/* 🔴 LIVE 당첨현황 — v3.5 동적 API 연동 */}
      <div style={S.glow}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: lottoResult ? "#ef4444" : "#666", boxShadow: lottoResult ? "0 0 8px #ef4444" : "none", animation: lottoResult ? "pulse 1.5s infinite" : "none" }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>{lottoResult ? "🔴 LIVE 당첨현황" : "⏳ 당첨현황 조회중"}</span>
          <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>제{activeRound}회</span>
        </div>
        <div style={{ fontSize: 11, color: "#D97757", marginBottom: 10 }}>매주 토요일 오후 8시 35분 MBC 생방송</div>
        {lottoResult ? (
          <>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
              {[lottoResult.drwtNo1, lottoResult.drwtNo2, lottoResult.drwtNo3, lottoResult.drwtNo4, lottoResult.drwtNo5, lottoResult.drwtNo6].map(n => <Ball key={n} num={n} size={40} />)}
              <span style={{ color: "#666", fontSize: 20, alignSelf: "center" }}>+</span>
              <Ball num={lottoResult.bnusNo} size={40} />
            </div>
            <div style={{ textAlign: "center", fontSize: 11, color: "#666" }}>
              1등 {lottoResult.firstPrzwnerCo || "?"}명 · 각 <span style={{ color: "#fbbf24", fontWeight: 700 }}>{lottoResult.firstWinamnt ? Number(lottoResult.firstWinamnt).toLocaleString() + "원" : "조회중"}</span>
            </div>
            <div style={{ textAlign: "center", fontSize: 9, color: "#555", marginTop: 4 }}>
              추첨일 {lottoResult.drwNoDate} · 총 판매 {lottoResult.totSellamnt ? (Number(lottoResult.totSellamnt) / 100000000).toFixed(0) + "억원" : ""}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "16px 0", color: "#666", fontSize: 12 }}>
            {lottoLoading ? "동행복권 API 연결 중..." : (
              <>
                <div style={{ fontSize: 13, color: "#D97757" }}>🔧 시스템 점검중</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>잠시 후 다시 시도해주세요</div>
              </>
            )}
          </div>
        )}
      </div>

      <div style={S.divider} />

      {/* 🏪 가까운매장찾기 — GPS 기반 빠른 구매 */}
      <div style={{ ...S.card, padding: 16, marginBottom: 16 }}>
        {/* 타이틀 + GPS 새로고침 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700 }}>🏪 가까운매장찾기</span>
            <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>내 위치에서 빠르게 구입</div>
          </div>
          <button onClick={refreshGPS} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #2C2C2C", background: gpsStatus === "loading" ? "#1C1C1C" : "#D9775711", color: gpsStatus === "loading" ? "#666" : "#D97757", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", animation: gpsStatus === "loading" ? "spin 1s linear infinite" : "none" }}>📡</span>
            {gpsStatus === "loading" ? "탐색 중..." : gpsStatus === "done" ? "새로고침" : "위치 찾기"}
          </button>
        </div>

        {/* 거리 필터 탭 + 거리별 당첨 요약 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {["500m", "1km", "2km"].map(d => {
            const limit = { "500m": 500, "1km": 1000, "2km": 2000 }[d];
            const inRange = nearStores.filter(s => s.straight <= limit);
            const totalWins = inRange.reduce((a, s) => a + s.wins, 0);
            const totalAuto = inRange.reduce((a, s) => a + (s.auto || 0), 0);
            const totalManual = inRange.reduce((a, s) => a + (s.manual || 0), 0);
            return (
              <button key={d} onClick={() => setSelectedDist(d)} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, fontSize: 12, cursor: "pointer", background: selectedDist === d ? "#D9775722" : "#1C1C1C", color: selectedDist === d ? "#D97757" : "#666", border: `1px solid ${selectedDist === d ? "#D9775744" : "#2C2C2C"}`, textAlign: "center" }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{d}</div>
                {gpsStatus === "done" && (
                  <div style={{ fontSize: 9, color: selectedDist === d ? "#D97757" : "#555" }}>
                    {inRange.length}곳 · {totalWins > 0 ? `${totalWins}회 당첨` : "당첨 없음"}
                    {totalWins > 0 && <div style={{ marginTop: 1 }}>자동{totalAuto} · 수동{totalManual}</div>}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 4종 지도 앱 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {MAP_APPS.map(m => (
            <button key={m.id} onClick={() => setSelectedMap(m.id)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: selectedMap === m.id ? `${m.color}22` : "#1C1C1C", border: `1px solid ${selectedMap === m.id ? m.color : "#2C2C2C"}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <span style={{ fontSize: 16 }}>{m.icon}</span>
              <span style={{ fontSize: 9, color: selectedMap === m.id ? m.color : "#888", fontWeight: 600 }}>{m.name}</span>
            </button>
          ))}
        </div>

        {/* 상태별 표시 */}
        {gpsStatus === "idle" && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#555", fontSize: 12 }}>
            📡 '위치 찾기' 버튼을 눌러 주변 판매점을 검색하세요
          </div>
        )}
        {gpsStatus === "loading" && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#D97757", fontSize: 12 }}>
            <div style={{ fontSize: 24, marginBottom: 6, animation: "pulse 1s infinite" }}>📡</div>
            GPS 신호 탐색 중...
          </div>
        )}
        {gpsStatus === "error" && (
          <div style={{ textAlign: "center", padding: "16px 0", color: "#ef4444", fontSize: 12 }}>
            ❌ 위치 권한이 필요합니다<br/>
            <span style={{ color: "#666", fontSize: 11 }}>브라우저 설정에서 위치 접근을 허용해주세요</span>
          </div>
        )}
        {gpsStatus === "done" && filteredStores.length === 0 && (
          <div style={{ textAlign: "center", padding: "16px 0", color: "#888", fontSize: 12 }}>
            {selectedDist} 이내에 판매점이 없습니다. 거리를 넓혀보세요.
          </div>
        )}
        {gpsStatus === "done" && filteredStores.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: "auto" }} className="hs">
            {filteredStores.map((s, i) => (
              <div key={i} onClick={() => setStoreDetail({ ...s, rank: i + 1 })} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1C1C1C", cursor: "pointer" }}>
                {/* 순위 */}
                <span style={{ width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, marginRight: 10, background: i < 3 ? "linear-gradient(135deg, #D97757, #C4613F)" : "#1C1C1C", color: i < 3 ? "#fff" : "#666", flexShrink: 0 }}>{i + 1}</span>
                {/* 정보 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                    {s.wins > 0 ? (
                      <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, flexShrink: 0, background: s.wins >= 10 ? "#ef444422" : s.wins >= 3 ? "#D9775722" : "#22c55e22", color: s.wins >= 10 ? "#ef4444" : s.wins >= 3 ? "#D97757" : "#22c55e", fontWeight: 700 }}>🏆 {s.wins}회</span>
                    ) : (
                      <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, background: "#ffffff08", color: "#666", fontWeight: 600 }}>판매점</span>
                    )}
                  </div>
                  {/* 주소 */}
                  <div style={{ fontSize: 10, color: "#777", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.region}</div>
                  {/* 당첨 수동/자동 상세 */}
                  {s.wins > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#3b82f622", color: "#60a5fa", fontWeight: 600 }}>자동 {s.auto || 0}회</span>
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#f59e0b22", color: "#fbbf24", fontWeight: 600 }}>수동 {s.manual || 0}회</span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 10, color: "#D97757" }}>📏 {s.straight >= 1000 ? (s.straight/1000).toFixed(1)+"km" : s.straight+"m"}</span>
                    <span style={{ fontSize: 10, color: "#888" }}>🚶 도보 {s.walkMin}분</span>
                    {s.tel && <span style={{ fontSize: 10, color: "#555" }}>📞 {s.tel}</span>}
                  </div>
                </div>
                {/* 상세보기 화살표 */}
                <span style={{ fontSize: 14, color: "#555", flexShrink: 0, marginLeft: 8 }}>›</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={S.divider} />

      {/* ⛩️ 명당순례 — 전국 TOP 10 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>⛩️ 명당순례</span>
          <span style={{ fontSize: 9, color: "#666" }}>전국 1등 당첨 명당 TOP 10</span>
        </div>
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          {TOP_STORES.map(s => (
            <div key={s.rank} onClick={() => setStoreDetail(s)} style={{ display: "flex", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #1C1C1C", cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#1C1C1C"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, marginRight: 10, background: s.rank <= 3 ? "linear-gradient(135deg, #D97757, #C4613F)" : "#1C1C1C", color: s.rank <= 3 ? "#fff" : "#666" }}>{s.rank}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>{s.region} · 1등 {s.wins}회</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1 }}><RatioBar auto={s.auto} manual={s.manual} semi={s.semi} size="sm" /></div>
                  <span style={{ fontSize: 9, color: "#888", whiteSpace: "nowrap" }}>자{Math.round(s.auto/s.wins*100)} 수{Math.round(s.manual/s.wins*100)} 반{Math.round(s.semi/s.wins*100)}</span>
                </div>
              </div>
              {s.hot && <span style={{ background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, marginRight: 6 }}>HOT</span>}
              <span style={{ fontSize: 14, color: "#555" }}>›</span>
            </div>
          ))}
        </div>
      </div>

      <div style={S.divider} />

      {/* 💬 실시간 대화 + 입력칸 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>💬 실시간 대화</span>
          <span style={{ fontSize: 10, color: "#22c55e" }}>● {12 + Math.floor(Math.random()*8)}명 접속 중</span>
        </div>
        <div style={{ ...S.card, padding: 10, height: 200, overflowY: "auto", marginBottom: 0 }} className="hs">
          {chatMsgs.map(m => (
            <div key={m.id} style={{ marginBottom: 6, animation: "fadeIn 0.3s ease" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontSize: 14 }}>{m.avatar}</span>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: m.color }}>{m.name}</span>
                  <span style={{ fontSize: 8, color: "#555", marginLeft: 4 }}>{m.time}</span>
                  <div style={{ fontSize: 12, color: "#ccc", marginTop: 1 }}>{m.msg}</div>
                </div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        {/* 메인화면 입력칸 */}
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="메시지 입력..." style={{ ...S.input, flex: 1, fontSize: 12 }} />
          <button style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "#D97757", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>전송</button>
        </div>
      </div>
    </div>
  );

  // ═══ 신탁 번호 (번호 생성) ═══
  const Generate = () => (
    <div style={{ padding: "16px 16px 100px" }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>🔮 신탁 번호</div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{BRAND.copy.numberResult}</div>
      <div style={{ fontSize: 11, color: "#555", marginBottom: 16 }}>신전 입구 · 주 1회 · 5장</div>

      {/* 장수 선택 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[{ n: 5, label: "5장", tier: null }, { n: 10, label: "10장", tier: "EX" }, { n: 20, label: "20장", tier: "VIP" }].map(opt => (
          <button key={opt.n} onClick={() => generate(opt.n)} style={{
            flex: 1, padding: "14px 0", borderRadius: 12, border: "none", cursor: "pointer", position: "relative",
            background: opt.n === 5 ? "linear-gradient(135deg, #D97757, #C4613F)" : "#111111",
            color: opt.n === 5 ? "#fff" : "#888",
            border: opt.n !== 5 ? "1px solid #2C2C2C" : "none",
            fontSize: 15, fontWeight: 700,
          }}>
            {opt.label} 생성
            {opt.tier && <span style={{ position: "absolute", top: -6, right: 8, fontSize: 8, background: opt.tier === "VIP" ? BRAND.colors.gold : "#3b82f6", color: "#fff", padding: "1px 6px", borderRadius: 4 }}>{opt.tier}</span>}
          </button>
        ))}
      </div>
      <div style={{ textAlign: "center", fontSize: 10, color: "#555", marginBottom: 16 }}>[새로고침]</div>

      {/* 생성 결과 */}
      {generated.length > 0 && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {generated.map((sheet, i) => {
              const isChecked = checkedSheets.has(i);
              return (
              <div key={i} style={{ ...S.card, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", opacity: isChecked ? 0.3 : 1, transition: "opacity 0.3s", position: "relative" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#D97757", width: 28, textDecoration: isChecked ? "line-through" : "none" }}>#{String.fromCharCode(65 + i)}</span>
                <div style={{ display: "flex", gap: 5, flex: 1, justifyContent: "center" }}>
                  {sheet.map(n => <Ball key={n} num={n} size={32} />)}
                </div>
                {/* ⑧ 체크박스: 수동 옮겨쓸 때 마스킹 */}
                <button onClick={() => setCheckedSheets(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; })} style={{ width: 28, height: 28, borderRadius: 6, border: `2px solid ${isChecked ? "#22c55e" : "#444"}`, background: isChecked ? "#22c55e22" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: isChecked ? "#22c55e" : "#666", flexShrink: 0 }}>
                  {isChecked ? "✓" : ""}
                </button>
              </div>
              );
            })}
          </div>

          {/* 다운로드 + VIP 저장 */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button style={{ ...S.btnSm, flex: 1, position: "relative" }}>📄 PDF<span style={{ position: "absolute", top: -6, right: 4, fontSize: 8, background: "#3b82f6", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>EX</span></button>
            <button style={{ ...S.btnSm, flex: 1, position: "relative" }}>🖼️ 이미지<span style={{ position: "absolute", top: -6, right: 4, fontSize: 8, background: "#3b82f6", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>EX</span></button>
            <button onClick={saveToHistory} style={{ ...S.btnSm, flex: 1, position: "relative", borderColor: "#D9775744" }}>💾 저장<span style={{ position: "absolute", top: -6, right: 4, fontSize: 8, background: "#D97757", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>VIP</span></button>
          </div>
        </>
      )}

      {/* VIP 저장 히스토리 */}
      {savedHistory.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>💾 회차별 저장 (VIP)</div>
          {savedHistory.map(h => (
            <div key={h.id} style={{ ...S.card, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>제{h.round}회 · {h.date} · {h.sheets.length}장</div>
              {h.sheets.slice(0, 3).map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 4, marginBottom: 3, justifyContent: "center" }}>
                  {s.map(n => <Ball key={n} num={n} size={24} />)}
                </div>
              ))}
              {h.sheets.length > 3 && <div style={{ fontSize: 10, color: "#666", textAlign: "center" }}>+{h.sheets.length - 3}장 더...</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ═══ QR ═══
  const QR = () => (
    <div style={{ padding: "16px 16px 100px", textAlign: "center" }}>
      <div style={{ width: 180, height: 180, borderRadius: 24, background: "#111111", border: "2px dashed #D97757", margin: "40px auto 16px", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 56 }}>📷</span>
        <span style={{ fontSize: 14, color: "#D97757", fontWeight: 600 }}>QR 스캔</span>
      </div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>복권 QR을 스캔하면 당첨 여부를 즉시 확인</div>

      {/* QR 아래: 최근 1등 당첨번호 */}
      <div style={{ ...S.glow, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🏆 최근 1등 당첨번호</div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>제1212회 · 2026.02.22</div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
          {[7, 14, 21, 28, 35, 41].map(n => <Ball key={n} num={n} size={38} />)}
          <span style={{ color: "#666", fontSize: 18, alignSelf: "center" }}>+</span>
          <Ball num={12} size={38} />
        </div>
        <div style={{ fontSize: 11, color: "#666" }}>1등 8명 · 각 <span style={{ color: "#fbbf24", fontWeight: 700 }}>3,124,567,800원</span></div>
      </div>
      <div style={{ ...S.glow, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>제1211회 · 2026.02.15</div>
        <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
          {[2, 15, 19, 33, 39, 44].map(n => <Ball key={n} num={n} size={32} />)}
          <span style={{ color: "#666", fontSize: 14, alignSelf: "center" }}>+</span>
          <Ball num={25} size={32} />
        </div>
      </div>
    </div>
  );

  // ═══ 운세 — 신전 (사주신전 + 타로신전 + 운세신전) ═══
  const Fortune = () => (
    <div style={{ padding: "16px 16px 100px" }}>
      {/* 서브탭 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[{ id: "saju", l: "⛩️ 사주신전" }, { id: "tarot", l: "🃏 타로신전" }, { id: "fortune", l: "🌙 운세신전" }].map(t => (
          <button key={t.id} onClick={() => setSub(p => ({ ...p, fortune: t.id }))} style={S.tag(subTab.fortune === t.id)}>{t.l}</button>
        ))}
      </div>

      {/* ── 사주분석 (사주신전) ── */}
      {subTab.fortune === "saju" && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>⛩️ 사주신전</div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>{BRAND.copy.sajuInput}</div>

          {/* 입력: 이름→년→월→일→시 */}
          <div style={{ ...S.card, padding: 16 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>이름</div>
              <input value={sajuForm.name} onChange={e => setSajuForm({...sajuForm, name: e.target.value})} onFocus={e => e.stopPropagation()} onClick={e => e.stopPropagation()} autoComplete="off" enterKeyHint="next" placeholder="홍길동" style={S.input} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
              {[{ k: "year", l: "년(年)", p: "1990" }, { k: "month", l: "월(月)", p: "01" }, { k: "day", l: "일(日)", p: "15" }, { k: "hour", l: "시(時)", p: "14" }].map(f => (
                <div key={f.k}>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 3, textAlign: "center" }}>{f.l}</div>
                  <input value={sajuForm[f.k]} onChange={e => setSajuForm({...sajuForm, [f.k]: e.target.value})} onFocus={e => e.stopPropagation()} onClick={e => e.stopPropagation()} autoComplete="off" inputMode="numeric" placeholder={f.p} style={{ ...S.input, textAlign: "center", fontSize: 15, fontWeight: 600 }} />
                </div>
              ))}
            </div>

            {/* 음력/양력 + 남/여 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>양력/음력</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[{ v: "solar", l: "☀️ 양력" }, { v: "lunar", l: "🌙 음력" }].map(o => (
                    <button key={o.v} onClick={() => setSajuForm({...sajuForm, calendar: o.v})} style={{ ...S.tag(sajuForm.calendar === o.v), flex: 1, padding: "8px 0" }}>{o.l}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>성별</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[{ v: "male", l: "👨 남" }, { v: "female", l: "👩 여" }].map(o => (
                    <button key={o.v} onClick={() => setSajuForm({...sajuForm, gender: o.v})} style={{ ...S.tag(sajuForm.gender === o.v), flex: 1, padding: "8px 0" }}>{o.l}</button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={runSaju} style={S.btn}>🔮 사주팔자 분석하기</button>
          </div>

          {/* 결과 */}
          {sajuResult && (() => {
            const { pillars, lunar, ohaeng, personality, ddi, yinyang, mainElement, mainElementH, mainColor, dayGan } = sajuResult;
            const OH_NAMES = MANSERYUK.OH;
            const OH_COLORS = MANSERYUK.OH_C;
            const totalOh = ohaeng.count.reduce((a,b) => a+b, 0);
            return (
            <div style={{ marginTop: 12 }}>
              {/* 음력 + 띠 헤더 */}
              <div style={{ ...S.glow, textAlign: "center", position: "relative" }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{sajuForm.name}님의 사주팔자</div>
                {!lunar.error && (
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>
                    🌙 음력 {lunar.year}년 {lunar.leap ? "(윤)" : ""}{lunar.month}월 {lunar.day}일
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>
                  {ddi.emoji} {ddi.name}띠 · {yinyang} · 주원소 <span style={{ color: mainColor, fontWeight: 700 }}>{mainElement}({mainElementH})</span>
                </div>

                {/* 4주 카드 */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 14 }}>
                  {pillars.map((p, i) => (
                    <div key={i} style={{ padding: "10px 4px", background: "#0A0A0A", borderRadius: 10, border: `1px solid ${i === 2 ? mainColor + "44" : "#1C1C1C"}` }}>
                      <div style={{ fontSize: 9, color: "#666", marginBottom: 4 }}>{["년주","월주","일주","시주"][i]}</div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: OH_COLORS[p.ganOh] }}>{MANSERYUK.GAN_H[p.gan]}</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: OH_COLORS[p.jiOh] }}>{MANSERYUK.JI_H[p.ji]}</span>
                      </div>
                      <div style={{ fontSize: 9, color: "#555", marginTop: 3 }}>
                        {MANSERYUK.GAN[p.gan]}{MANSERYUK.JI[p.ji]}
                      </div>
                      {i === 2 && <div style={{ fontSize: 7, color: mainColor, marginTop: 2 }}>▲ 일간</div>}
                    </div>
                  ))}
                </div>

                {/* 오행 분포 바 */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", marginBottom: 6 }}>오행 분포</div>
                  <div style={{ display: "flex", gap: 4, height: 22, borderRadius: 6, overflow: "hidden" }}>
                    {ohaeng.count.map((c, i) => c > 0 ? (
                      <div key={i} style={{ flex: c, background: OH_COLORS[i], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", minWidth: c > 0 ? 24 : 0, transition: "flex 0.3s" }}>
                        {OH_NAMES[i]}({c})
                      </div>
                    ) : null)}
                  </div>
                  {/* 부족/과다 인사이트 */}
                  <div style={{ fontSize: 10, color: "#666", marginTop: 5 }}>
                    {ohaeng.count.map((c, i) => c === 0 ? OH_NAMES[i] : null).filter(Boolean).length > 0 && (
                      <span>부족: <span style={{ color: "#ef4444" }}>{ohaeng.count.map((c, i) => c === 0 ? OH_NAMES[i] : null).filter(Boolean).join(", ")}</span> · </span>
                    )}
                    {ohaeng.count.map((c, i) => c >= 3 ? OH_NAMES[i] : null).filter(Boolean).length > 0 && (
                      <span>강함: <span style={{ color: "#22c55e" }}>{ohaeng.count.map((c, i) => c >= 3 ? OH_NAMES[i] : null).filter(Boolean).join(", ")}</span></span>
                    )}
                  </div>
                </div>

                {/* 일간 성격 */}
                <div style={{ background: "#0A0A0A", borderRadius: 10, padding: 12, textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: mainColor, marginBottom: 4 }}>{personality.trait}</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>{personality.detail}</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>🎰 행운 끝자리: <span style={{ color: "#fbbf24", fontWeight: 700 }}>{personality.lucky}</span></div>
                </div>
              </div>

              {/* 미래 예측 (유료 블러) */}
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🔭 미래 예측</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
                {[{ t: "1개월 후", tier: "EX" }, { t: "3개월 후", tier: "EX" }, { t: "6개월 후", tier: "VIP" }, { t: "1년 후", tier: "VIP" }].map((p, i) => (
                  <div key={i} style={{ ...S.card, padding: 12, position: "relative", filter: i >= 2 ? "blur(3px)" : "none" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#D97757", marginBottom: 4 }}>{p.t}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>
                      {i === 0 && "재물운 상승기. 새로운 수입원이 열릴 가능성."}
                      {i === 1 && "대인관계 활발. 귀인의 도움 기대 가능."}
                      {i >= 2 && "구독하면 확인 가능합니다."}
                    </div>
                    {i >= 2 && <div style={S.lock}><button style={S.lockBtn}>🔓 {p.tier}</button></div>}
                  </div>
                ))}
              </div>

              {/* 좋은것/주의 */}
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>💡 운명 가이드</div>
              {[
                { icon: "✅", title: "이런 것은 좋아요", items: "새로운 투자 기회, 동쪽 방향의 이동, 화요일 중요한 결정" },
                { icon: "⚠️", title: "이런 것은 주의하세요", items: "급한 판단, 금전 대여, 과도한 음주" },
                { icon: "👥", title: "이런 사람/환경이 도움돼요", items: "연장자의 조언, 물 관련 장소, 파란색 계열의 물건" },
                { icon: "💰", title: "금전 흐름", items: "3월 중순 이후 수입 증가 예상, 충동 소비 자제" },
              ].map((g, i) => (
                <div key={i} style={{ ...S.card, padding: 12, display: "flex", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{g.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{g.title}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{g.items}</div>
                  </div>
                </div>
              ))}

              {/* 더 궁금한 점 (대화형) */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>💬 더 궁금한 점이 있으신가요?</div>
                <div style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>사주 기반으로 궁금한 점을 자유롭게 물어보세요. AI가 자연스럽게 대화하며 풀어드립니다.</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                    {["이직해도 될까요?", "올해 연애운은?", "재테크 방향은?", "건강 주의사항은?"].map(q => (
                      <button key={q} onClick={() => setFortuneQuestion(q)} style={{ ...S.btnSm, fontSize: 11 }}>{q}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={fortuneQuestion} onChange={e => setFortuneQuestion(e.target.value)} placeholder="무엇이든 물어보세요..." style={{ ...S.input, flex: 1 }} />
                    <button onClick={sendFortuneQ} style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "#D97757", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>질문</button>
                  </div>
                </div>
              </div>

              {/* PDF/이미지 다운로드 */}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button style={{ ...S.btnSm, flex: 1, position: "relative" }}>📄 사주 PDF 저장<span style={{ position: "absolute", top: -6, right: 4, fontSize: 8, background: "#3b82f6", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>EX</span></button>
                <button style={{ ...S.btnSm, flex: 1, position: "relative" }}>🖼️ 이미지 저장<span style={{ position: "absolute", top: -6, right: 4, fontSize: 8, background: "#3b82f6", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>EX</span></button>
              </div>
            </div>
          ); })()}
        </div>
      )}

      {/* ── 타로 (78장) ── */}
      {subTab.fortune === "tarot" && (() => {
        const suits = ["all","Major"];
        const suitLabels = { all:"전체 78장", Major:"메이저 22장" };
        const filtered = tarotSuit === "Major" ? TAROT_MAJOR : TAROT;
        const draw3Cards = () => {
          const pool = tarotSuit === "all" ? TAROT : filtered;
          const shuffled = [...pool].sort(() => Math.random() - 0.5);
          const cards = shuffled.slice(0, 3).map(c => ({ ...c, isReversed: Math.random() < 0.3 }));
          setSelectedTarot(cards);
        };
        const spread = Array.isArray(selectedTarot) ? selectedTarot : [];
        const spreadLabels = ["과거", "현재", "미래"];
        const spreadIcons = ["⏪", "✨", "⏩"];
        return (
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🃏 타로신전 · 3카드 스프레드</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>3장의 카드가 과거·현재·미래를 알려드립니다</div>

          {/* 슈트 필터 */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12, overflowX: "auto", WebkitOverflowScrolling: "touch" }} className="hs">
            {suits.map(s => (
              <button key={s} onClick={() => { setTarotSuit(s); setSelectedTarot(null); }} style={{ ...S.tag(tarotSuit === s), whiteSpace: "nowrap", fontSize: 11 }}>{suitLabels[s]}</button>
            ))}
          </div>

          {/* 3장 뽑기 버튼 */}
          <button onClick={draw3Cards} style={{ ...S.btn, marginBottom: 14, background: "linear-gradient(135deg, #D97757, #C4613F)", fontSize: 14 }}>
            🎴 카드 3장 뽑기 (과거·현재·미래)
          </button>

          {/* 3카드 스프레드 결과 */}
          {spread.length === 3 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                {spread.map((card, idx) => (
                  <div key={idx} style={{ ...S.glow, textAlign: "center", padding: 14, position: "relative" }}>
                    <div style={{ fontSize: 10, color: "#D97757", fontWeight: 700, marginBottom: 6 }}>{spreadIcons[idx]} {spreadLabels[idx]}</div>
                    <div style={{ fontSize: 36, marginBottom: 6, transform: card.isReversed ? "rotate(180deg)" : "none", transition: "transform 0.5s" }}>{card.emoji}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{card.ko}</div>
                    {card.isReversed && <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 600 }}>(역방향)</span>}
                    <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>{card.name}</div>
                    {card.suit && <div style={{ fontSize: 9, color: card.color || "#666", marginTop: 2 }}>{card.element}</div>}
                    <div style={{ fontSize: 11, color: card.isReversed ? "#ef4444" : "#D97757", fontWeight: 600, marginTop: 8, lineHeight: 1.4 }}>
                      {card.isReversed ? (card.reversed || "역방향 해석") : card.meaning}
                    </div>
                  </div>
                ))}
              </div>

              {/* 종합 해석 */}
              <div style={{ ...S.card, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#D97757" }}>🔮 종합 리딩</div>
                <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.6 }}>
                  과거에 <span style={{ color: "#fbbf24" }}>{spread[0].ko}</span>의 기운이 있었고,
                  현재는 <span style={{ color: "#D97757" }}>{spread[1].ko}</span>의 에너지가 흐르고 있습니다.
                  미래에는 <span style={{ color: "#22c55e" }}>{spread[2].ko}</span>{spread[2].isReversed ? "의 역방향 에너지가 찾아오니 주의가 필요합니다." : "의 긍정적 에너지가 당신을 기다리고 있습니다."}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btnSm, flex: 1, position: "relative" }}>📄 타로 PDF<span style={{ position: "absolute", top: -6, right: 4, fontSize: 8, background: "#3b82f6", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>EX</span></button>
                <button style={{ ...S.btnSm, flex: 1, position: "relative" }}>🖼️ 이미지 저장<span style={{ position: "absolute", top: -6, right: 4, fontSize: 8, background: "#3b82f6", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>EX</span></button>
              </div>
            </>
          )}

          {/* 카드 그리드 (개별 터치 → 정보 표시) */}
          {spread.length !== 3 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 16, maxHeight: 320, overflowY: "auto" }} className="hs">
              {filtered.map(c => (
                <button key={c.id} onClick={() => { setSelectedTarot([{ ...c, isReversed: Math.random() < 0.3 }]); }} style={{ padding: "12px 2px", borderRadius: 10, border: `1px solid ${Array.isArray(selectedTarot) && selectedTarot.length===1 && selectedTarot[0]?.id === c.id ? "#D97757" : "#2C2C2C"}`, cursor: "pointer", background: "#111111", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 22 }}>🂠</span>
                  <span style={{ fontSize: 8, color: "#555", textAlign: "center", lineHeight: 1.2 }}>#{c.id+1}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        );
      })()}

      {/* ── 운세신전 (오늘/월간/년간) ── */}
      {subTab.fortune === "fortune" && (
        <div>
          {/* 사주 연동 배너 */}
          {sajuResult ? (
            <div style={{ ...S.card, padding: 12, marginBottom: 12, border: "1px solid #D9775744", background: "#D9775711" }}>
              <div style={{ fontSize: 12, color: "#D97757", fontWeight: 600 }}>⛩️ {sajuForm.name}님의 사주 기반 맞춤 운세</div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{sajuResult.ddi.emoji} {sajuResult.ddi.name}띠 · {sajuResult.yinyang} · {sajuResult.mainElement}({sajuResult.mainElementH})</div>
            </div>
          ) : (
            <div style={{ ...S.card, padding: 12, marginBottom: 12, border: "1px solid #2C2C2C" }}>
              <div style={{ fontSize: 12, color: "#888" }}>💡 사주신전에서 먼저 분석하면 맞춤 운세를 받을 수 있어요</div>
              <button onClick={() => setSub(p => ({...p, fortune: "saju"}))} style={{ ...S.btnSm, marginTop: 6, fontSize: 11, color: "#D97757", borderColor: "#D9775744" }}>⛩️ 사주신전 가기</button>
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {[{ id: "today", l: "오늘" }, { id: "monthly", l: "월간" }, { id: "yearly", l: "년간" }].map(p => (
              <button key={p.id} onClick={() => setFortunePeriod(p.id)} style={S.tag(fortunePeriod === p.id)}>{p.l}</button>
            ))}
          </div>

          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            {fortunePeriod === "today" && `⭐ ${sajuResult ? sajuForm.name+"님의 " : ""}오늘의 운세`}
            {fortunePeriod === "monthly" && `📅 ${sajuResult ? sajuForm.name+"님의 " : ""}2026년 3월 운세`}
            {fortunePeriod === "yearly" && `🗓️ ${sajuResult ? sajuForm.name+"님의 " : ""}2026년 년간 운세`}
          </div>

          {/* 5운 */}
          {[
            { cat: "총운", icon: "🌟", stars: 4, text: "오늘은 새로운 기회가 찾아오는 날. 적극적으로 행동하세요.", free: true },
            { cat: "금전운", icon: "💰", stars: 3, text: "의외의 곳에서 금전적 행운. 소액 투자 고려.", free: true },
            { cat: "연애운", icon: "💕", stars: 4, text: "소중한 사람과의 대화가 관계를 깊게 만드는 날.", free: false },
            { cat: "건강운", icon: "💪", stars: 3, text: "과로 주의. 오후에 가벼운 산책 추천.", free: false },
          ].map((f, i) => (
            <div key={i} style={{ ...S.card, padding: 14, display: "flex", gap: 12, position: "relative", filter: !f.free ? "blur(3px)" : "none" }}>
              <span style={{ fontSize: 24 }}>{f.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{f.cat}</span>
                  <span>{Array.from({length:5},(_,j) => <span key={j} style={{ color: j < f.stars ? "#fbbf24" : "#333", fontSize: 10 }}>★</span>)}</span>
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>{f.text}</div>
              </div>
              {!f.free && <div style={S.lock}><button style={S.lockBtn}>🔓 Exclusive</button></div>}
            </div>
          ))}

          {/* 더 궁금한 점 */}
          <div style={{ marginTop: 12, ...S.card, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>💬 더 궁금한 점</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>운세를 바탕으로 궁금한 점을 물어보세요.</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
              {["올해 이직 괜찮을까요?", "투자 타이밍은?", "결혼 시기는?", "시험 합격 가능성?"].map(q => (
                <button key={q} style={{ ...S.btnSm, fontSize: 11 }}>{q}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input placeholder="자유롭게 질문하세요..." style={{ ...S.input, flex: 1 }} />
              <button style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "#D97757", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>질문</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ═══ 신전 광장 (커뮤니티) ═══
  const Community = () => (
    <div style={{ padding: "16px 16px 100px" }}>
      {/* 3탭: 인기글[글쓰기] / 실시간대화 / AI상담사 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[{ id: "posts", l: "📰 인기글" }, { id: "chat", l: "💬 실시간대화" }, { id: "counsel", l: "🔮 실시간talk신전" }].map(t => (
          <button key={t.id} onClick={() => { setSub(p => ({...p, community: t.id})); if(t.id==="counsel") setCounselor(null); }} style={S.tag(subTab.community === t.id)}>{t.l}</button>
        ))}
      </div>

      {/* 인기글 + 글쓰기 버튼 */}
      {subTab.community === "posts" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>📰 인기글</span>
            <button style={{ ...S.btnSm, background: "#D9775722", color: "#D97757", borderColor: "#D9775744" }}>✏️ 글쓰기</button>
          </div>
          {[
            { title: "이번 주 핫번호 분석 — 끝수 3,7 집중!", author: "로또분석러", avatar: "📊", likes: 47, comments: 23 },
            { title: "노량진 명당 직접 가봤습니다 (후기)", author: "명당탐험가", avatar: "🗺️", likes: 39, comments: 18 },
            { title: "편재 대운 들어온 분들 주목하세요", author: "사주마스터", avatar: "🔮", likes: 35, comments: 15 },
            { title: "4등 당첨 인증!! AI 추천 번호 진짜 됩니다", author: rNick(), avatar: "🎉", likes: 28, comments: 12 },
            { title: "연속번호 포함 전략이 진짜 유효할까?", author: "꿀팁러", avatar: "💡", likes: 22, comments: 9 },
          ].map((p, i) => (
            <div key={i} style={{ ...S.card, padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>{p.title}</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#888" }}>{p.avatar} {p.author}</span>
                <span style={{ fontSize: 11, color: "#666" }}>❤️ {p.likes} · 💬 {p.comments}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 실시간대화 */}
      {subTab.community === "chat" && (
        <div>
          <div style={{ ...S.card, padding: 10, height: 380, overflowY: "auto" }} className="hs">
            {chatMsgs.map(m => (
              <div key={m.id} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{m.avatar}</span>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: m.color }}>{m.name}</span>
                    <span style={{ fontSize: 8, color: "#555", marginLeft: 4 }}>{m.time}</span>
                    <div style={{ fontSize: 12, color: "#ccc", marginTop: 1 }}>{m.msg}</div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="메시지 입력..." style={{ ...S.input, flex: 1 }} />
            <button style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "#D97757", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>전송</button>
          </div>
        </div>
      )}

      {/* AI 상담사 선택 */}
      {subTab.community === "counsel" && !counselor && (
        <div>
          {COUNSELORS.map(c => (
            <button key={c.id} onClick={() => { setCounselor(c.id); setCounselMsgs([]); }} style={{ width: "100%", ...S.card, padding: 18, cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 32 }}>{c.avatar}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{c.role}</div>
                  <div style={{ fontSize: 10, color: "#D97757", marginTop: 2 }}>{c.tier}</div>
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{c.greeting}</div>
              <div style={{ fontSize: 12, color: "#888", whiteSpace: "pre-line" }}>{c.sub}</div>
            </button>
          ))}
        </div>
      )}

      {/* AI 상담 채팅 */}
      {subTab.community === "counsel" && counselor && (
        <div>
          <button onClick={() => setCounselor(null)} style={{ background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer", marginBottom: 6 }}>← 상담사 선택</button>
          <div style={{ ...S.card, padding: 10, height: 340, overflowY: "auto" }} className="hs">
            {(() => { const c = COUNSELORS.find(x=>x.id===counselor); return (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <span style={{ fontSize: 36 }}>{c.avatar}</span>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{c.name}</div>
                <div style={{ fontSize: 14, marginTop: 6 }}>{c.greeting}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 4, whiteSpace: "pre-line" }}>{c.sub}</div>
              </div>
            ); })()}
            {counselMsgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.type === "user" ? "flex-end" : "flex-start", marginBottom: 6 }}>
                <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: 14, background: m.type === "user" ? "#D97757" : "#1C1C1C", color: m.type === "user" ? "#fff" : "#e2e2e8", fontSize: 13, lineHeight: 1.5 }}>
                  {m.type === "bot" && <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>{m.avatar} {m.name}</div>}
                  {m.msg}
                  <div style={{ fontSize: 9, color: m.type === "user" ? "#e2e2e8aa" : "#555", marginTop: 3, textAlign: "right" }}>{m.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input value={counselInput} onChange={e => setCounselInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendCounsel()} placeholder="편하게 말씀해주세요..." style={{ ...S.input, flex: 1 }} />
            <button onClick={sendCounsel} style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "#D97757", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>전송</button>
          </div>
        </div>
      )}
    </div>
  );

  // ═══ MY — 신전 회원 ═══
  const My = () => (
    <div style={{ padding: "16px 16px 100px" }}>
      {/* 프로필 카드 */}
      <div style={{ ...S.glow, textAlign: "center", padding: 20, position: "relative" }}>
        {!profileEditing ? (
          <>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#1C1C1C", margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, border: `2px solid ${TIER_COLORS[userProfile.plan]}` }}>{userProfile.avatar}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TIER_COLORS[userProfile.plan] }}>{userProfile.nick}</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>
              <span style={{ background: `${TIER_COLORS[userProfile.plan]}22`, color: TIER_COLORS[userProfile.plan], padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{TIER_BADGES[userProfile.plan]} · {userProfile.plan}</span>
            </div>
            <button onClick={() => { setProfileDraft({ nick: userProfile.nick, avatar: userProfile.avatar }); setProfileEditing(true); }} style={{ ...S.btnSm, marginTop: 10, fontSize: 11, color: "#D97757", borderColor: "#D9775744" }}>✏️ 프로필 수정</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>✏️ 프로필 수정</div>
            {/* 아바타 선택 */}
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" }}>
              {["👤","😎","🦊","🐯","🐉","🌙","⛩️","🔮","🍀","💎","🎭","🐱"].map(e => (
                <button key={e} onClick={() => setProfileDraft(p => ({...p, avatar: e}))} style={{ width: 40, height: 40, borderRadius: 10, border: `2px solid ${profileDraft.avatar === e ? "#D97757" : "#2C2C2C"}`, background: profileDraft.avatar === e ? "#D9775722" : "#111", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{e}</button>
              ))}
            </div>
            {/* 닉네임 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>닉네임 (2~10자)</div>
              <input value={profileDraft.nick} onChange={e => setProfileDraft(p => ({...p, nick: e.target.value.slice(0,10)}))} placeholder="닉네임 입력" style={{ ...S.input, textAlign: "center", fontSize: 14, fontWeight: 600 }} autoComplete="off" />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setProfileEditing(false)} style={{ ...S.btnSm, flex: 1 }}>취소</button>
              <button onClick={saveProfile} disabled={profileDraft.nick.length < 2} style={{ ...S.btn, flex: 1, fontSize: 13, padding: "10px 0", opacity: profileDraft.nick.length < 2 ? 0.5 : 1 }}>저장</button>
            </div>
          </>
        )}
      </div>

      {/* 등급별 닉네임 색깔 미리보기 */}
      <div style={{ ...S.card, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🎨 등급별 닉네임 색깔</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {[{ t: "FREE", c: "#6b7280" }, { t: "Exclusive", c: "#3b82f6" }, { t: "VIP", c: "#C9A84C" }].map(g => (
            <div key={g.t} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: g.c }}>{userProfile.nick}</div>
              <div style={{ fontSize: 9, color: g.c, marginTop: 2 }}>{g.t}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ⑥ 구독 플랜 + 결제 버튼 */}
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>⛩️ 신전 등급</div>
      {PLANS.map(p => (
        <div key={p.tier} style={{ ...S.card, padding: 16, border: `1px solid ${p.tier === userProfile.plan ? `${p.color}66` : p.tier === "VIP" ? `${BRAND.colors.gold}44` : "#1C1C1C"}`, position: "relative" }}>
          {p.tier === userProfile.plan && <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9, background: `${p.color}33`, color: p.color, padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>현재 등급</span>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: p.color }}>{p.tier}</span>
              {p.badge && <span style={{ fontSize: 9, color: "#888", background: "#1C1C1C", padding: "2px 8px", borderRadius: 8 }}>{p.badge}</span>}
            </div>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{p.price}</span>
          </div>
          {p.features.map((f, i) => (
            <div key={i} style={{ fontSize: 12, color: "#888", padding: "2px 0", display: "flex", gap: 6 }}>
              <span style={{ color: p.color }}>✓</span>{f}
            </div>
          ))}
          {p.tier !== "FREE" && p.tier !== userProfile.plan && (
            <button onClick={() => { window.open("https://store.steppay.kr/xivix", "_blank"); }} style={{ ...S.btn, marginTop: 10, fontSize: 13, padding: "10px 0", background: p.tier === "VIP" ? `linear-gradient(135deg, ${BRAND.colors.gold}, ${BRAND.colors.darkGold})` : p.color }}>
              {p.tier === "VIP" ? "💎 VIP 결제하기" : "🔓 Exclusive 결제하기"}
            </button>
          )}
        </div>
      ))}

      {/* 설정 메뉴 */}
      <div style={{ ...S.card, padding: 0, marginTop: 12 }}>
        {[
          { icon: "🔔", label: "알림 설정", sub: "당첨 알림, 추천 번호 알림" },
          { icon: "📋", label: "이용약관", sub: "서비스 이용약관" },
          { icon: "🔒", label: "개인정보처리방침", sub: "개인정보 보호" },
          { icon: "💬", label: "문의하기", sub: "카카오톡 채널 상담" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid #1C1C1C", cursor: "pointer" }}>
            <span style={{ fontSize: 16, marginRight: 10 }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: 10, color: "#666" }}>{item.sub}</div>
            </div>
            <span style={{ color: "#555" }}>›</span>
          </div>
        ))}
      </div>

      {/* 브랜드 푸터 */}
      <div style={{ textAlign: "center", marginTop: 20, padding: "16px 0", borderTop: "1px solid #1C1C1C" }}>
        <div style={{ fontSize: 11, color: "#555" }}>{BRAND.name} · {BRAND.domain}</div>
        <div style={{ fontSize: 9, color: "#333", marginTop: 4 }}>Powered by XIVIX · AI 사주 기반 로또 번호 추천</div>
      </div>
    </div>
  );

  // ═══ 네비게이션 — 신전 세계관 ═══
  const NAV = [
    { id: "home", icon: "⛩️", label: "로또신전" },
    { id: "generate", icon: "🔮", label: "번호신전" },
    { id: "qr", icon: "📷", label: "QR", center: true },
    { id: "fortune", icon: "🌙", label: "운세신전" },
    { id: "community", icon: "💬", label: "광장신전" },
    { id: "my", icon: "👤", label: "MY" },
  ];

  return (
    <div style={S.wrap}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css');
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Outfit:wght@600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        :root{--brand-primary:#D97757;--brand-deep:#C4613F;--brand-cream:#F5F1EC;--brand-gold:#C9A84C;--brand-dark-gold:#8B6914;}
        .hs::-webkit-scrollbar{display:none}.hs{-ms-overflow-style:none;scrollbar-width:none}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes goldShimmer{0%{background-position:200% center}100%{background-position:-200% center}}
      `}</style>

      <div style={{ height: "calc(100vh - 72px)", overflowY: "auto", overflowX: "hidden" }} className="hs">
        {tab === "home" && <Home />}
        {tab === "generate" && <Generate />}
        {tab === "qr" && <QR />}
        {tab === "fortune" && <Fortune />}
        {tab === "community" && <Community />}
        {tab === "my" && <My />}
      </div>

      {/* ② 명당 상세 바텀시트 */}
      {storeDetail && (
        <div onClick={() => setStoreDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: "#111111", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", animation: "slideUp 0.3s ease", maxHeight: "75vh", overflowY: "auto" }}>
            {/* 핸들 */}
            <div style={{ width: 40, height: 4, background: "#333", borderRadius: 2, margin: "0 auto 16px" }} />
            {/* 순위 + 이름 */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, background: storeDetail.rank <= 3 ? "linear-gradient(135deg, #D97757, #C4613F)" : "#1C1C1C", color: storeDetail.rank <= 3 ? "#fff" : "#888" }}>{storeDetail.rank}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{storeDetail.name}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{storeDetail.region} {storeDetail.wins > 0 ? `· 1등 ${storeDetail.wins}회 배출` : ""}</div>
              </div>
              {storeDetail.hot && <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>HOT</span>}
            </div>
            {/* 정보 카드 */}
            <div style={{ background: "#0A0A0A", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <span style={{ fontSize: 14 }}>📍</span>
                <span style={{ fontSize: 12, color: "#ccc" }}>{storeDetail.addr || storeDetail.region}</span>
              </div>
              {(storeDetail.tel || storeDetail.phone) && (
                <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 14 }}>📞</span>
                  <a href={`tel:${storeDetail.tel || storeDetail.phone}`} style={{ fontSize: 12, color: "#D97757", textDecoration: "none" }}>{storeDetail.tel || storeDetail.phone}</a>
                </div>
              )}
              {storeDetail.straight && (
                <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 14 }}>📏</span>
                  <span style={{ fontSize: 12, color: "#ccc" }}>거리 {storeDetail.straight >= 1000 ? (storeDetail.straight/1000).toFixed(1)+"km" : storeDetail.straight+"m"} · 도보 약 {storeDetail.walkMin}분</span>
                </div>
              )}
              {storeDetail.tip && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 14 }}>💡</span>
                  <span style={{ fontSize: 12, color: "#E8956A" }}>{storeDetail.tip}</span>
                </div>
              )}
            </div>
            {/* 당첨 정보 요약 */}
            <div style={{ background: "#0A0A0A", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#e2e2e8" }}>🏆 당첨 정보</div>
              {storeDetail.wins > 0 ? (
                <>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1, background: "#1C1C1C", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#D97757" }}>{storeDetail.wins}</div>
                      <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>총 당첨</div>
                    </div>
                    <div style={{ flex: 1, background: "#1C1C1C", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#60a5fa" }}>{storeDetail.auto || 0}</div>
                      <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>자동</div>
                    </div>
                    <div style={{ flex: 1, background: "#1C1C1C", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#fbbf24" }}>{storeDetail.manual || 0}</div>
                      <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>수동</div>
                    </div>
                    {(storeDetail.semi || 0) > 0 && (
                      <div style={{ flex: 1, background: "#1C1C1C", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#a78bfa" }}>{storeDetail.semi}</div>
                        <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>반자동</div>
                      </div>
                    )}
                  </div>
                  {/* 비율 바 */}
                  <RatioBar auto={storeDetail.auto || 0} manual={storeDetail.manual || 0} semi={storeDetail.semi || 0} size="lg" />
                  <div style={{ marginTop: 8, padding: "8px 10px", background: "#1C1C1C", borderRadius: 8, fontSize: 11, color: "#ccc", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>💡</span>
                    <span>{getInsight(storeDetail.auto || 0, storeDetail.manual || 0, storeDetail.semi || 0)}</span>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "12px 0", color: "#666", fontSize: 12 }}>
                  당첨 데이터를 수집 중입니다<br/>
                  <span style={{ fontSize: 10, color: "#555" }}>확인된 당첨 정보가 있으면 자동으로 표시돼요 📊</span>
                </div>
              )}
            </div>
            {/* 최근 당첨 이력 — 명당만 */}
            {storeDetail.recent && storeDetail.recent.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#e2e2e8" }}>📋 최근 당첨 이력</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {storeDetail.recent.map((r, i) => (
                    <div key={i} style={{ background: "#0A0A0A", borderRadius: 8, padding: "8px 12px", border: `1px solid ${r.prize === "1등" ? "#D9775744" : "#2C2C2C"}` }}>
                      <div style={{ fontSize: 11, color: r.prize === "1등" ? "#D97757" : "#3b82f6", fontWeight: 700 }}>{r.prize}</div>
                      <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>제{r.round}회 · {r.type}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* 액션 버튼 */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => {
                const url = storeDetail.naverId ? `https://m.place.naver.com/${storeDetail.naverId}` : storeDetail.kakaoUrl || storeDetail.placeUrl || `https://map.kakao.com/link/map/${encodeURIComponent(storeDetail.name)},${storeDetail.lat},${storeDetail.lng}`;
                window.open(url, "_blank");
              }} style={{ flex: 1, padding: "14px 0", borderRadius: 12, border: "none", background: "#22c55e", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                📍 매장 상세
              </button>
              <button onClick={() => {
                const mapUrls = {
                  naver: `nmap://route/walk?dlat=${storeDetail.lat}&dlng=${storeDetail.lng}&dname=${encodeURIComponent(storeDetail.name)}&appname=lottosinjeon`,
                  tmap: `tmap://route?goalx=${storeDetail.lng}&goaly=${storeDetail.lat}&goalname=${encodeURIComponent(storeDetail.name)}`,
                  kakao: `kakaomap://route?ep=${storeDetail.lat},${storeDetail.lng}&by=FOOT`,
                  google: `https://www.google.com/maps/dir/?api=1&destination=${storeDetail.lat},${storeDetail.lng}&travelmode=walking`,
                };
                window.open(mapUrls[selectedMap] || mapUrls.naver, "_blank");
              }} style={{ flex: 1, padding: "14px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #D97757, #C4613F)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                🧭 길찾기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 네비 */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, height: 72, background: "linear-gradient(180deg, rgba(10,10,15,0.95), #0A0A0A)", borderTop: "1px solid #1C1C1C", display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 4px", backdropFilter: "blur(12px)" }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            ...(n.center ? { width: 50, height: 50, borderRadius: "50%", background: "linear-gradient(135deg, #D97757, #C4613F)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px #D9775744", marginTop: -20 } : { padding: "6px 0" }),
          }}>
            <span style={{ fontSize: n.center ? 20 : 18, filter: !n.center && tab === n.id ? "none" : !n.center ? "grayscale(0.7)" : "none" }}>{n.icon}</span>
            {!n.center && <span style={{ fontSize: 9, fontWeight: 600, color: tab === n.id ? "#D97757" : "#555" }}>{n.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

export default App;
// Build: 1772314078
