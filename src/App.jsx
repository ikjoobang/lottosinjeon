import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// 로또신전(LOTTO SINJEON) v3.4 — 브랜드 Identity 시스템 + 신전 세계관 UX
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
    tarot: "신전의 비밀 신관에서 오늘의 운세를 확인하세요",
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
const TOP_STORES = [
  { rank: 1, name: "노량진수산시장복권방", region: "서울 동작구", wins: 28, hot: true, addr: "서울 동작구 노량진로 136", tel: "02-814-1234", lat: 37.5132, lng: 126.9407, naverId: "1946872345", auto: 15, manual: 11, semi: 2, recent: [{ round: 1210, type: "자동", prize: "1등" }, { round: 1205, type: "수동", prize: "2등" }], tip: "1호선 노량진역 1번 출구 도보 3분. 토요일 오후 줄 서야 함" },
  { rank: 2, name: "명당로또방", region: "서울 강남구", wins: 24, hot: true, addr: "서울 강남구 테헤란로 152", tel: "02-555-5678", lat: 37.5002, lng: 127.0367, naverId: "1823456789", auto: 18, manual: 4, semi: 2, recent: [{ round: 1212, type: "자동", prize: "1등" }, { round: 1198, type: "반자동", prize: "1등" }], tip: "강남역 11번 출구 앞. 점심시간 회사원 많음" },
  { rank: 3, name: "복권명당 1번지", region: "대전 서구", wins: 22, hot: true, addr: "대전 서구 둔산로 100", tel: "042-222-3456", lat: 36.3510, lng: 127.3774, naverId: "1734567890", auto: 12, manual: 9, semi: 1, recent: [{ round: 1211, type: "자동", prize: "1등" }], tip: "둔산동 갤러리아백화점 맞은편" },
  { rank: 4, name: "로또의신", region: "부산 해운대구", wins: 19, addr: "부산 해운대구 해운대로 570", tel: "051-744-7890", lat: 35.1631, lng: 129.1637, naverId: "1645678901", auto: 7, manual: 11, semi: 1, recent: [{ round: 1208, type: "수동", prize: "1등" }], tip: "해운대역 3번 출구 도보 5분" },
  { rank: 5, name: "행운로또", region: "인천 남동구", wins: 17, addr: "인천 남동구 구월로 177", tel: "032-433-2345", lat: 37.4483, lng: 126.7312, naverId: "1556789012", auto: 12, manual: 4, semi: 1, recent: [{ round: 1207, type: "자동", prize: "2등" }], tip: "구월동 로데오거리 입구" },
  { rank: 6, name: "대박복권방", region: "경기 수원시", wins: 16, addr: "경기 수원시 팔달구 인계로 178", tel: "031-234-5678", lat: 37.2636, lng: 127.0286, naverId: "1467890123", auto: 10, manual: 5, semi: 1, recent: [{ round: 1209, type: "자동", prize: "1등" }], tip: "수원역 앞 AK플라자 건너편" },
  { rank: 7, name: "사거리복권", region: "광주 서구", wins: 15, addr: "광주 서구 상무중앙로 110", tel: "062-375-6789", lat: 35.1517, lng: 126.8896, naverId: "1378901234", auto: 6, manual: 7, semi: 2, recent: [{ round: 1206, type: "반자동", prize: "2등" }], tip: "상무지구 중심. 주차 편리" },
  { rank: 8, name: "만수대로또", region: "대구 수성구", wins: 14, addr: "대구 수성구 달구벌대로 2456", tel: "053-763-8901", lat: 35.8562, lng: 128.6306, naverId: "1289012345", auto: 9, manual: 4, semi: 1, recent: [{ round: 1204, type: "자동", prize: "1등" }], tip: "수성못 근처. 저녁 시간대 추천" },
  { rank: 9, name: "행복한복권방", region: "울산 남구", wins: 13, addr: "울산 남구 삼산로 274", tel: "052-267-9012", lat: 35.5384, lng: 129.3114, naverId: "1190123456", auto: 8, manual: 4, semi: 1, recent: [{ round: 1203, type: "자동", prize: "2등" }], tip: "삼산동 먹자골목 입구" },
  { rank: 10, name: "소문난로또", region: "제주 제주시", wins: 12, addr: "제주 제주시 중앙로 60", tel: "064-753-0123", lat: 33.5097, lng: 126.5312, naverId: "1001234567", auto: 5, manual: 6, semi: 1, recent: [{ round: 1201, type: "수동", prize: "1등" }], tip: "제주시청 인근. 관광객도 많이 찾음" },
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

// ── 봇 페르소나 ──
const BOTS = [
  { name: "로또분석러", color: "#fbbf24", avatar: "📊" },
  { name: "명당탐험가", color: "#22c55e", avatar: "🗺️" },
  { name: "사주마스터", color: "#D97757", avatar: "🔮" },
  { name: null, color: "#ef4444", avatar: "🎉" }, // 랜덤 닉
  { name: "꿀팁러", color: "#3b82f6", avatar: "💡" },
  { name: "응원봇", color: "#ec4899", avatar: "💪" },
  { name: "토론유도봇", color: "#f97316", avatar: "🗣️" },
];

// ── 봇 대화 풀 (반복 방지용 — 50개+) ──
const MSG_POOL = [
  { b: 0, m: "이번 1213회 분석 완료! 끝수 3,7 집중 구간이네요 🔥" },
  { b: 3, m: "저 지난주 4등 당첨됐어요!! 진짜 소름 ㅋㅋㅋ" },
  { b: 1, m: "오늘 노량진 복권방 다녀왔는데 줄이 장난 아님 ㄷㄷ" },
  { b: 5, m: "다들 이번 주 꼭 대박 나세요!! 🍀" },
  { b: 6, m: "여러분 이번 주 고정수 뭐 가져가세요?" },
  { b: 2, m: "오늘 사주 보니까 편재 대운 들어온 분들 많을 듯 👀" },
  { b: 4, m: "꿀팁: 연속번호 2개 포함시키면 적중률 올라갑니다" },
  { b: 3, m: "명당탐험가님 노량진 몇 시에 가셨어요?" },
  { b: 1, m: "오후 2시쯤요! 토요일은 일찍 가야 합니다" },
  { b: 5, m: "분석러님 끝수 3,7이면 3,13,23,33,43 이런 식?" },
  { b: 0, m: "네 맞아요! 최근 5회차 데이터 보면 끝수 3이 4번 나왔습니다" },
  { b: 6, m: "사주마스터님 편재 대운이면 복권 사도 되나요? ㅎ" },
  { b: 2, m: "편재는 의외의 재물이니까요 ㅋㅋ 한 장쯤은 괜찮죠" },
  { b: 4, m: "참고로 연속번호 없는 조합은 전체의 52%밖에 안 됩니다" },
  { b: 3, m: "오 그럼 거의 절반은 연번이 포함된다는 거네??" },
  { b: 0, m: "홀짝 비율 3:3이 가장 많이 나옵니다. 참고하세요" },
  { b: 1, m: "부산 해운대 로또의신 매장도 추천! 분위기 좋아요" },
  { b: 6, m: "서울 vs 지방, 어디서 사는 게 더 잘 되는 것 같아요?" },
  { b: 2, m: "장소보다 시간이에요. 사주 기운이 열리는 시간에 사세요" },
  { b: 5, m: "모두 화이팅!! 이번 주가 인생 역전 주간이 될 거예요 💪" },
  { b: 4, m: "이번 주 총합 구간 130~160 사이가 유력합니다" },
  { b: 0, m: "지난 10회차 분석하면 같은 번호대에서 2~3개 반복 나와요" },
  { b: 3, m: "진짜요?? 저도 같은 번호대 고정으로 해볼까..." },
  { b: 1, m: "대전 서구 복권명당 1번지도 1등 22회! 대단하네요" },
  { b: 6, m: "혹시 AI 추천 번호 써보신 분 있어요? 후기 궁금" },
  { b: 2, m: "사주에서 정재가 강한 분들은 고정수 전략이 맞아요" },
  { b: 5, m: "AI 추천 번호로 5등 두 번 당첨된 적 있어요! 신기했음" },
  { b: 4, m: "통계적으로 최근 5회 안 나온 번호 중심으로 조합하면 유리해요" },
  { b: 0, m: "이번 주 냉번호: 4, 9, 38. 역발상으로 넣어볼 만합니다" },
  { b: 3, m: "와 4등이라도 당첨되면 기분 최고일 듯 ㅋㅋ" },
  { b: 1, m: "인천 남동구 행운로또도 꽤 유명하더라구요" },
  { b: 6, m: "번호 생성할 때 자동 vs 수동, 뭐가 더 좋을까요?" },
  { b: 2, m: "수동으로 사주 기반 3개 + 자동 3개 조합이 최적입니다" },
  { b: 5, m: "그 조합 전략 좋네요!! 저도 이번 주 따라해볼게요" },
  { b: 4, m: "보너스 번호까지 맞추려면 끝수 분석이 핵심이에요" },
  { b: 0, m: "최근 보너스 번호 끝수 패턴: 2,5,8 반복 중입니다" },
  { b: 3, m: "오늘 뭔가 느낌이 좋아요... 이번 주 될 것 같은 예감!" },
  { b: 1, m: "광주 서구 사거리복권도 1등 15회 나온 곳입니다" },
  { b: 6, m: "로또 살 때 몇 장 사세요? 1장? 5장?" },
  { b: 5, m: "저는 매주 2장씩! 꾸준함이 답이라고 생각해요 ㅎㅎ" },
  { b: 2, m: "이번 달 사주 흐름상 화요일/목요일 구매가 길합니다" },
  { b: 4, m: "재미있는 통계: 1등 당첨자 43%가 '재미로 샀다'고 합니다" },
  { b: 0, m: "구간별로 보면 21~30번대가 이번 주 가장 활발합니다" },
  { b: 3, m: "진짜 대박나면 여기 다시 와서 후기 꼭 쓸게요 ㅋㅋ" },
  { b: 1, m: "제주 소문난로또 가봤는데 바다뷰에서 복권 사는 느낌 최고" },
  { b: 6, m: "당첨되면 제일 먼저 뭐 하실 거예요?" },
  { b: 5, m: "일단 부모님한테 효도여행!! 그다음 내 집 마련이요 🏠" },
  { b: 2, m: "오늘 인수(寅時) 이후 운기가 올라가니 오후에 구매하세요" },
  { b: 4, m: "로또 1게임 1000원 중 420원이 복권기금으로 쓰인대요" },
  { b: 0, m: "이번 회차 예상 1등 당첨금 약 23억 정도 될 듯합니다" },
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

// ── 구독 플랜 v3.4 — 신전 세계관 ──
const PLANS = [
  { tier: "FREE", badge: "신전 입구", price: "₩0", color: "#6b7280", features: [
    "QR 당첨확인","행운번호 5장 (주 1회)","AI 상담 1회/일","기본 타로 1회/일","오늘의 운세 (총운+금전운)"] },
  { tier: "Exclusive", badge: "신전 안쪽", price: "₩4,900/월", color: "#3b82f6", features: [
    "무제한 번호 생성 (5/10/20장)","AI 추천번호 + 오행 분석","사주팔자 완전 분석","오늘/월간/년간 운세 전체","AI 상담 5회/일","PDF/이미지 다운로드","미래 예측 (1개월/3개월)"] },
  { tier: "VIP", badge: "신전 최심부", price: "₩9,900/월", color: BRAND.colors.gold, features: [
    "Exclusive 전체 포함","운명 4종 (사주+타로+관상+궁합)","후나츠사카이 심화 분석","AI 상담 무제한 (3종 전체)","미래 예측 (6개월/1년)","회차별 번호 저장/관리","2km 명당 해금","VIP 전용 커뮤니티"] },
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
  const [tarotSuit, setTarotSuit] = useState("all"); // 타로 슈트 필터
  const [counselor, setCounselor] = useState(null);
  const [counselMsgs, setCounselMsgs] = useState([]);
  const [counselInput, setCounselInput] = useState("");
  const [savedHistory, setSavedHistory] = useState([]);
  const [checkedSheets, setCheckedSheets] = useState(new Set()); // ⑧ 체크박스 마스킹
  // ③⑥ GPS 위치 + 주변 명당
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | loading | done | error
  const [myLocation, setMyLocation] = useState(null); // { lat, lng }
  const [selectedDist, setSelectedDist] = useState("1km");
  const [nearStores, setNearStores] = useState([]);
  const [storeDetail, setStoreDetail] = useState(null); // ② 명당 상세 바텀시트
  const [sajuResult, setSajuResult] = useState(null);
  const [fortuneAskMode, setFortuneAskMode] = useState(false);
  const [fortuneQuestion, setFortuneQuestion] = useState("");
  const chatEndRef = useRef(null);
  const msgIndexRef = useRef(0);

  // ── 봇 대화 (반복 방지: 순서대로 소진 후 셔플) ──
  const shuffledPool = useRef([...MSG_POOL].sort(() => Math.random() - 0.5));

  useEffect(() => {
    const iv = setInterval(() => {
      if (msgIndexRef.current >= shuffledPool.current.length) {
        shuffledPool.current = [...MSG_POOL].sort(() => Math.random() - 0.5);
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
    if (tab === "community" && subTab.community === "chat") {
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
      id: Date.now(), round: 1213, date: new Date().toLocaleDateString("ko"),
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

  // ③⑥ GPS 위치 가져오기 + 주변 명당 검색
  const NEARBY_POOL = [
    { name: "행운로또", region: "서울 강남구", wins: 5, auto: 3, manual: 2, semi: 0, status: "영업중", lat: 37.5012, lng: 127.0396, naver: "1234567" },
    { name: "대박복권방", region: "서울 서초구", wins: 3, auto: 1, manual: 1, semi: 1, status: "영업중", lat: 37.4969, lng: 127.0278, naver: "2345678" },
    { name: "스타로또", region: "서울 송파구", wins: 4, auto: 4, manual: 0, semi: 0, status: "영업중", lat: 37.5145, lng: 127.1060, naver: "3456789" },
    { name: "명당복권", region: "서울 강동구", wins: 2, auto: 1, manual: 1, semi: 0, status: "영업중", lat: 37.5302, lng: 127.1237, naver: "4567890" },
    { name: "럭키세븐", region: "서울 마포구", wins: 6, auto: 3, manual: 2, semi: 1, status: "영업중", lat: 37.5565, lng: 126.9236, naver: "5678901" },
    { name: "천만로또", region: "서울 영등포구", wins: 3, auto: 2, manual: 1, semi: 0, status: "준비중", lat: 37.5164, lng: 126.9072, naver: "6789012" },
    { name: "무한당첨", region: "서울 용산구", wins: 2, auto: 0, manual: 2, semi: 0, status: "영업중", lat: 37.5326, lng: 126.9905, naver: "7890123" },
    { name: "골든복권", region: "서울 종로구", wins: 7, auto: 4, manual: 2, semi: 1, status: "영업중", lat: 37.5704, lng: 126.9920, naver: "8901234" },
  ];

  const calcDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const refreshGPS = () => {
    setGpsStatus("loading");
    setNearStores([]);
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(loc);
        // 거리 계산 + 정렬
        const stores = NEARBY_POOL.map(s => {
          const straight = calcDistance(loc.lat, loc.lng, s.lat, s.lng);
          const walking = Math.round(straight * 1.35); // 도보 ≈ 직선×1.35
          const walkMin = Math.round(walking / 80); // 80m/분 도보
          return { ...s, straight, walking, walkMin };
        }).sort((a, b) => a.straight - b.straight);
        setNearStores(stores);
        setGpsStatus("done");
      },
      () => setGpsStatus("error"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const distFilter = { "500m": 500, "1km": 1000, "2km": 2000 };
  const filteredStores = nearStores.filter(s => s.straight <= (distFilter[selectedDist] || 1000));

  // ── 스타일 ──
  const S = {
    wrap: { maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#0A0A0A", color: "#e2e2e8", fontFamily: "'Pretendard Variable', -apple-system, sans-serif", position: "relative", overflow: "hidden", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", touchAction: "pan-y", boxSizing: "border-box" },
    card: { background: "#111111", borderRadius: 12, padding: 14, marginBottom: 10, border: "1px solid #1C1C1C" },
    glow: { background: "linear-gradient(135deg, #1C1612, #141210)", border: "1px solid #3A2A20", borderRadius: 16, padding: 16, marginBottom: 16 },
    btn: { borderRadius: 12, border: "none", background: "linear-gradient(135deg, #D97757, #C4613F)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", padding: "14px 0", width: "100%" },
    btnSm: { borderRadius: 10, border: "1px solid #2C2C2C", background: "#111111", color: "#888", fontSize: 12, cursor: "pointer", padding: "8px 12px" },
    input: { background: "#111111", border: "1px solid #2C2C2C", borderRadius: 10, padding: "10px 12px", color: "#e2e2e8", fontSize: 13, outline: "none", width: "100%" },
    tag: (active, clr) => ({ padding: "8px 14px", borderRadius: 10, border: "none", background: active ? `${clr || "#D97757"}22` : "#111111", border: `1px solid ${active ? (clr || "#D97757") : "#2C2C2C"}`, color: active ? (clr || "#D97757") : "#888", fontSize: 12, fontWeight: 600, cursor: "pointer" }),
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

      {/* 🔴 LIVE 당첨현황 */}
      <div style={S.glow}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px #ef4444", animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>🔴 LIVE 당첨현황</span>
          <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>제1213회</span>
        </div>
        <div style={{ fontSize: 11, color: "#D97757", marginBottom: 10 }}>매주 토요일 오후 8시 35분 MBC 생방송</div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
          {[3, 11, 22, 27, 36, 42].map(n => <Ball key={n} num={n} size={40} />)}
          <span style={{ color: "#666", fontSize: 20, alignSelf: "center" }}>+</span>
          <Ball num={18} size={40} />
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: "#666" }}>
          1등 12명 · 각 <span style={{ color: "#fbbf24", fontWeight: 700 }}>2,345,678,900원</span>
        </div>
      </div>

      <div style={S.divider} />

      {/* 명당 TOP 10 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>🏆 전국 로또명당 TOP 10</span>
          <span style={{ fontSize: 9, color: "#666" }}>{BRAND.subTaglines.gps}</span>
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

      {/* 내 주변 명당 (③⑥ GPS 새로고침 + 거리 + 영업상태) */}
      <div style={{ ...S.card, padding: 16, marginBottom: 16 }}>
        {/* 타이틀 + GPS 새로고침 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>📍 명당 순례</span>
          <button onClick={refreshGPS} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #2C2C2C", background: gpsStatus === "loading" ? "#1C1C1C" : "#D9775711", color: gpsStatus === "loading" ? "#666" : "#D97757", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", animation: gpsStatus === "loading" ? "spin 1s linear infinite" : "none" }}>📡</span>
            {gpsStatus === "loading" ? "탐색 중..." : gpsStatus === "done" ? "새로고침" : "위치 찾기"}
          </button>
        </div>

        {/* 거리 필터 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[{ d: "500m", tier: null }, { d: "1km", tier: null }, { d: "2km", tier: "VIP" }].map(opt => (
            <button key={opt.d} onClick={() => !opt.tier && setSelectedDist(opt.d)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, cursor: opt.tier ? "default" : "pointer", position: "relative", background: selectedDist === opt.d && !opt.tier ? "#D9775722" : "#1C1C1C", color: selectedDist === opt.d && !opt.tier ? "#D97757" : "#666", border: `1px solid ${selectedDist === opt.d && !opt.tier ? "#D9775744" : "#2C2C2C"}` }}>
              {opt.d}
              {opt.tier && <span style={{ position: "absolute", top: -6, right: -2, fontSize: 8, background: "#D97757", color: "#fff", padding: "1px 4px", borderRadius: 4 }}>{opt.tier}</span>}
            </button>
          ))}
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
            📡 '위치 찾기' 버튼을 눌러 주변 명당을 검색하세요
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
            {selectedDist} 이내에 명당이 없습니다. 거리를 넓혀보세요.
          </div>
        )}
        {gpsStatus === "done" && filteredStores.length > 0 && (
          <div style={{ maxHeight: 260, overflowY: "auto" }} className="hs">
            {filteredStores.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1C1C1C" }}>
                {/* 순위 */}
                <span style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, marginRight: 10, background: i < 3 ? "linear-gradient(135deg, #D97757, #C4613F)" : "#1C1C1C", color: i < 3 ? "#fff" : "#666", flexShrink: 0 }}>{i + 1}</span>
                {/* 정보 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                    <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, flexShrink: 0, background: s.status === "영업중" ? "#22c55e22" : "#f5920022", color: s.status === "영업중" ? "#22c55e" : "#f59e0b", fontWeight: 600 }}>{s.status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{s.region} · 1등 {s.wins}회</div>
                  <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ flex: 1 }}><RatioBar auto={s.auto||0} manual={s.manual||0} semi={s.semi||0} size="sm" /></div>
                    <span style={{ fontSize: 9, color: "#888", whiteSpace: "nowrap" }}>자{s.auto} 수{s.manual} 반{s.semi||0}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 10, color: "#D97757" }}>📏 직선 {s.straight >= 1000 ? (s.straight/1000).toFixed(1)+"km" : s.straight+"m"}</span>
                    <span style={{ fontSize: 10, color: "#888" }}>🚶 도보 {s.walking >= 1000 ? (s.walking/1000).toFixed(1)+"km" : s.walking+"m"} ({s.walkMin}분)</span>
                  </div>
                </div>
                {/* 길찾기 버튼 */}
                <button onClick={() => {
                  const mapUrls = {
                    naver: `nmap://route/walk?dlat=${s.lat}&dlng=${s.lng}&dname=${encodeURIComponent(s.name)}&appname=xivix`,
                    tmap: `tmap://route?goalx=${s.lng}&goaly=${s.lat}&goalname=${encodeURIComponent(s.name)}`,
                    kakao: `kakaomap://route?ep=${s.lat},${s.lng}&by=FOOT`,
                    google: `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=walking`,
                  };
                  window.open(mapUrls[selectedMap] || mapUrls.naver, "_blank");
                }} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #2C2C2C", background: "#111111", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, marginLeft: 8 }}>
                  🧭
                </button>
              </div>
            ))}
          </div>
        )}
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

  // ═══ 운세 — 신전의 신관 (사주 + 타로 + 운세) ═══
  const Fortune = () => (
    <div style={{ padding: "16px 16px 100px" }}>
      {/* 서브탭 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[{ id: "saju", l: "⛩️ 사주 제단" }, { id: "tarot", l: "🃏 타로 신관" }, { id: "fortune", l: "🌙 운세" }].map(t => (
          <button key={t.id} onClick={() => setSub(p => ({ ...p, fortune: t.id }))} style={S.tag(subTab.fortune === t.id)}>{t.l}</button>
        ))}
      </div>

      {/* ── 사주분석 (사주 제단) ── */}
      {subTab.fortune === "saju" && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>⛩️ 사주 제단</div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>{BRAND.copy.sajuInput}</div>

          {/* 입력: 이름→년→월→일→시 */}
          <div style={{ ...S.card, padding: 16 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>이름</div>
              <input value={sajuForm.name} onChange={e => setSajuForm({...sajuForm, name: e.target.value})} placeholder="홍길동" style={S.input} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
              {[{ k: "year", l: "년(年)", p: "1990" }, { k: "month", l: "월(月)", p: "01" }, { k: "day", l: "일(日)", p: "15" }, { k: "hour", l: "시(時)", p: "14" }].map(f => (
                <div key={f.k}>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 3, textAlign: "center" }}>{f.l}</div>
                  <input value={sajuForm[f.k]} onChange={e => setSajuForm({...sajuForm, [f.k]: e.target.value})} placeholder={f.p} style={{ ...S.input, textAlign: "center", fontSize: 15, fontWeight: 600 }} />
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
        return (
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🃏 타로 리딩 · {TAROT.length}장</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>카드를 선택하면 운세를 알려드립니다 · 30% 역방향</div>

          {/* 슈트 필터 */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12, overflowX: "auto", WebkitOverflowScrolling: "touch" }} className="hs">
            {suits.map(s => (
              <button key={s} onClick={() => { setTarotSuit(s); setSelectedTarot(null); }} style={{ ...S.tag(tarotSuit === s), whiteSpace: "nowrap", fontSize: 11 }}>{suitLabels[s]}</button>
            ))}
          </div>

          {/* 랜덤 1장 뽑기 */}
          <button onClick={() => { const pool = tarotSuit === "all" ? TAROT : filtered; const card = pool[Math.floor(Math.random() * pool.length)]; const isReversed = Math.random() < 0.3; setSelectedTarot({ ...card, isReversed }); }} style={{ ...S.btn, marginBottom: 14, background: "linear-gradient(135deg, #D97757, #C4613F)", fontSize: 14 }}>
            🎴 카드 1장 뽑기 (랜덤)
          </button>

          {/* 카드 그리드 (face down → 클릭 시 reveal) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 16, maxHeight: 320, overflowY: "auto" }} className="hs">
            {filtered.map(c => {
              const sel = selectedTarot?.id === c.id;
              return (
              <button key={c.id} onClick={() => { const isReversed = Math.random() < 0.3; setSelectedTarot({ ...c, isReversed }); }} style={{ padding: "12px 2px", borderRadius: 10, border: `1px solid ${sel ? "#D97757" : "#2C2C2C"}`, cursor: "pointer", background: sel ? "linear-gradient(135deg, #D9775744, #C4613F44)" : "#111111", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "all 0.3s", transform: sel ? "scale(1.08) rotateY(0deg)" : "scale(1)" }}>
                <span style={{ fontSize: 22, transform: selectedTarot?.id === c.id && selectedTarot.isReversed ? "rotate(180deg)" : "none", transition: "transform 0.5s" }}>{sel ? c.emoji : "🂠"}</span>
                <span style={{ fontSize: 8, color: sel ? "#D97757" : "#555", textAlign: "center", lineHeight: 1.2 }}>{sel ? c.ko : `#${c.id+1}`}</span>
              </button>
              );
            })}
          </div>

          {/* 선택된 카드 상세 */}
          {selectedTarot && (
            <>
              <div style={{ ...S.glow, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 8, transform: selectedTarot.isReversed ? "rotate(180deg)" : "none", transition: "transform 0.5s" }}>{selectedTarot.emoji}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedTarot.ko} {selectedTarot.isReversed && <span style={{ fontSize: 12, color: "#ef4444" }}>(역방향)</span>}</div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{selectedTarot.name}</div>
                {selectedTarot.suit && <div style={{ fontSize: 10, color: selectedTarot.color || "#666", marginBottom: 4 }}>{selectedTarot.element} · {selectedTarot.theme}</div>}
                <div style={{ fontSize: 14, color: selectedTarot.isReversed ? "#ef4444" : "#D97757", fontWeight: 600, marginTop: 4 }}>
                  {selectedTarot.isReversed ? (selectedTarot.reversed || "역방향 해석") : selectedTarot.meaning}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btnSm, flex: 1, position: "relative" }}>📄 타로 PDF<span style={{ position: "absolute", top: -6, right: 4, fontSize: 8, background: "#3b82f6", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>EX</span></button>
                <button style={{ ...S.btnSm, flex: 1, position: "relative" }}>🖼️ 이미지 저장<span style={{ position: "absolute", top: -6, right: 4, fontSize: 8, background: "#3b82f6", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>EX</span></button>
              </div>
            </>
          )}
        </div>
        );
      })()}

      {/* ── 운세 (오늘/월간/년간) ── */}
      {subTab.fortune === "fortune" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {[{ id: "today", l: "오늘" }, { id: "monthly", l: "월간" }, { id: "yearly", l: "년간" }].map(p => (
              <button key={p.id} onClick={() => setFortunePeriod(p.id)} style={S.tag(fortunePeriod === p.id)}>{p.l}</button>
            ))}
          </div>

          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            {fortunePeriod === "today" && "⭐ 오늘의 운세"}
            {fortunePeriod === "monthly" && "📅 2026년 3월 운세"}
            {fortunePeriod === "yearly" && "🗓️ 2026년 년간 운세"}
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
        {[{ id: "posts", l: "📰 인기글" }, { id: "chat", l: "💬 실시간대화" }, { id: "counsel", l: "🌙 신전 상담사" }].map(t => (
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
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#1C1C1C", margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>👤</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>게스트</div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>신전 입구 · FREE</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>⛩️ 신전 등급</div>
      {PLANS.map(p => (
        <div key={p.tier} style={{ ...S.card, padding: 16, border: `1px solid ${p.tier === "VIP" ? `${BRAND.colors.gold}44` : "#1C1C1C"}` }}>
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
          {p.tier !== "FREE" && <button style={{ ...S.btn, marginTop: 10, fontSize: 13, padding: "10px 0", background: p.tier === "VIP" ? `linear-gradient(135deg, ${BRAND.colors.gold}, ${BRAND.colors.darkGold})` : p.color }}>{p.tier === "VIP" ? "최심부 입장" : "신전 안쪽으로"}</button>}
        </div>
      ))}

      {/* 브랜드 푸터 */}
      <div style={{ textAlign: "center", marginTop: 20, padding: "16px 0", borderTop: "1px solid #1C1C1C" }}>
        <div style={{ fontSize: 11, color: "#555" }}>{BRAND.name} · {BRAND.domain}</div>
        <div style={{ fontSize: 9, color: "#333", marginTop: 4 }}>Powered by XIVIX · AI 사주 기반 로또 번호 추천</div>
      </div>
    </div>
  );

  // ═══ 네비게이션 — 신전 세계관 ═══
  const NAV = [
    { id: "home", icon: "⛩️", label: "신전" },
    { id: "generate", icon: "🔮", label: "신탁" },
    { id: "qr", icon: "📷", label: "QR", center: true },
    { id: "fortune", icon: "🌙", label: "운세" },
    { id: "community", icon: "💬", label: "광장" },
    { id: "my", icon: "👤", label: "MY" },
  ];

  return (
    <div style={S.wrap} onContextMenu={e => e.preventDefault()}>
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
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{storeDetail.name}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{storeDetail.region} · 1등 {storeDetail.wins}회 배출</div>
              </div>
              {storeDetail.hot && <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>HOT</span>}
            </div>
            {/* 정보 카드 */}
            <div style={{ background: "#0A0A0A", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <span style={{ fontSize: 14 }}>📍</span>
                <span style={{ fontSize: 12, color: "#ccc" }}>{storeDetail.addr}</span>
              </div>
              {storeDetail.tel && (
                <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 14 }}>📞</span>
                  <a href={`tel:${storeDetail.tel}`} style={{ fontSize: 12, color: "#D97757", textDecoration: "none" }}>{storeDetail.tel}</a>
                </div>
              )}
              {storeDetail.tip && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 14 }}>💡</span>
                  <span style={{ fontSize: 12, color: "#E8956A" }}>{storeDetail.tip}</span>
                </div>
              )}
            </div>
            {/* 최근 당첨 이력 */}
            {storeDetail.recent && storeDetail.recent.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#e2e2e8" }}>🏆 최근 당첨 이력</div>
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
            {/* 당첨 방식 비율 분석 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#e2e2e8" }}>📊 당첨 방식 비율</div>
              <div style={{ background: "#0A0A0A", borderRadius: 12, padding: 14 }}>
                <RatioBar auto={storeDetail.auto || 0} manual={storeDetail.manual || 0} semi={storeDetail.semi || 0} size="lg" />
                <div style={{ marginTop: 10, padding: "8px 10px", background: "#1C1C1C", borderRadius: 8, fontSize: 11, color: "#ccc", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>💡</span>
                  <span>{getInsight(storeDetail.auto || 0, storeDetail.manual || 0, storeDetail.semi || 0)}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: "#666", textAlign: "right" }}>전국 평균: 자동 {AVG_RATIO.auto}% · 수동 {AVG_RATIO.manual}% · 반자동 {AVG_RATIO.semi}%</div>
              </div>
            </div>
            {/* 액션 버튼 */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => window.open(`https://m.place.naver.com/${storeDetail.naverId}`, "_blank")} style={{ flex: 1, padding: "14px 0", borderRadius: 12, border: "none", background: "#22c55e", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                🟢 네이버 플레이스
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
