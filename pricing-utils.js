// pricing-utils.js

// ── 교습비 조정기준 Firestore 조회 (캐싱 포함)
let ratesCache = {};

export async function getOfficialRate(rateKey) {
  if (ratesCache[rateKey]) return ratesCache[rateKey];
  if (!window.FS || !window.db) {
    console.error("Firebase Firestore not initialized.");
    return null;
  }
  const snap = await window.FS.getDoc(
    window.FS.doc(window.db, 'officialRates', rateKey)
  );
  if (snap.exists()) {
    ratesCache[rateKey] = snap.data();
    return snap.data();
  }
  return null;
}

// ── 법정 교습비 계산 (분당단가 방식)
export function calcLegalFee(ratePerMin, minutesPerSession, sessionsPerWeek, weeks = 4.3) {
  if (!ratePerMin) return null;
  return Math.floor(ratePerMin * minutesPerSession * sessionsPerWeek * weeks);
}

// ── 초과 여부 판정 (학원법 §15④)
export function judgeExcess(officialFee, actualTuition) {
  if (!officialFee || !actualTuition) return null;
  const diff = actualTuition - officialFee;
  const pct = (diff / officialFee * 100).toFixed(1);
  return {
    isExcess: diff > 0,
    isAlarmExcess: diff > officialFee * 0.05, // 5% 초과 = 경고
    diff,
    pct,
    label: diff > 0 ?
      `법정 교습비 ${Math.abs(pct)}% 초과 (${diff.toLocaleString()}원)` :
      `법정 범위 내 (${Math.abs(pct)}% 낮음)`
  };
}

// ── 실제 총 납부액 계산 (교습비등 = 교습비 + 기타경비)
export function calcTotalActual(fees = {}) {
  return ['tuition', 'textbook', 'shuttle', 'mockExam', 'material', 'meal', 'other']
    .reduce((sum, key) => sum + (parseInt(fees[key]) || 0), 0);
}

// Helper function to render extra fees
function renderExtras(actualFee) {
  const extraItems = [];
  if (actualFee.textbook) extraItems.push(`<span>교재비: ${actualFee.textbook.toLocaleString()}원</span>`);
  if (actualFee.shuttle) extraItems.push(`<span>차량비: ${actualFee.shuttle.toLocaleString()}원</span>`);
  if (actualFee.mockExam) extraItems.push(`<span>모의고사비: ${actualFee.mockExam.toLocaleString()}원</span>`);
  if (actualFee.material) extraItems.push(`<span>재료비: ${actualFee.material.toLocaleString()}원</span>`);
  if (actualFee.meal) extraItems.push(`<span>급식비: ${actualFee.meal.toLocaleString()}원</span>`);
  if (actualFee.other) extraItems.push(`<span>기타 경비: ${actualFee.other.toLocaleString()}원</span>`);
  return extraItems.length > 0 ? `<div class="extras-list">${extraItems.join('')}</div>` : '';
}


// ── 하단 시트: 교육 분야 가격 섹션 렌더링
export async function renderEduPriceSection(placeData, container) {
  const rate = await getOfficialRate(placeData.rateKey);
  if (!rate) {
    container.innerHTML = `<div class="edu-price-section">공식 교습비 정보를 찾을 수 없습니다.</div>`;
    return;
  }

  const {
    min,
    sessions
  } = placeData.officialFeeParams || {
    min: 60,
    sessions: 5
  };
  const legalFee = rate.isFlat ? rate.flatMonth : calcLegalFee(rate.ratePerMin, min, sessions);
  const total = calcTotalActual(placeData.actualFee);
  const judgment = judgeExcess(legalFee, placeData.actualFee?.tuition);

  container.innerHTML = `
    <div class="edu-price-section">
      <!-- 학원등록번호 (학원법 §15③ 의무 게시) -->
      <div class="reg-no-row">
        등록번호: ${placeData.registrationNo||'미입력'}
        <a href="https://www.goeyi.kr" target="_blank">교육청 확인 ↗</a>
      </div>

      <!-- 법정 교습비 박스 (파랑) -->
      <div class="legal-fee-box">
        <div class="fee-label">법정 최대 교습비 <span class="law-tag">학원법 §15③</span></div>
        <div class="fee-amount blue">${legalFee ? legalFee.toLocaleString()+'원/월' : '미입력'}</div>
        <div class="fee-sub">${rate.ratePerMin}원/분 × ${min}분 × 주${sessions}회 × 4.3주</div>
      </div>

      <!-- 실납부액 박스 -->
      <div class="actual-fee-box ${judgment?.isExcess?'excess':'safe'}">
        <div class="fee-label">실제 수강료 (제보)</div>
        <div class="fee-amount">${(placeData.actualFee?.tuition||0).toLocaleString()}원/월</div>
        ${judgment ? `<div class="excess-badge">${judgment.label}</div>` : ''}
      </div>

      <!-- 기타경비 항목별 -->
      <div class="extras-section">
        ${renderExtras(placeData.actualFee)}
      </div>

      <!-- 초과 경고 박스 -->
      ${judgment?.isAlarmExcess ? `
        <div class="warning-box">
          ⚠ 수강료가 법정 교습비를 ${judgment.pct}% 초과합니다.<br>
          학원법 제15조 제4항 위반 — 과태료 300만원 이하<br>
          <a href="tel:031-760-4500">경기도광주하남교육지원청 031-760-4500</a>
        </div>` : ''}

      <!-- 비교 막대 -->
      <div class="compare-bars">
        <div class="bar-row">
          <span>법정 교습비</span>
          <div class="bar blue" style="width:100%"></div>
          <span>${legalFee?.toLocaleString()}원</span>
        </div>
        <div class="bar-row">
          <span>실제 수강료</span>
          <div class="bar ${judgment?.isExcess?'red':'green'}"
               style="width:${legalFee?Math.min(150,Math.round((placeData.actualFee?.tuition||0)/legalFee*100)):0}%"></div>
          <span>${(placeData.actualFee?.tuition||0).toLocaleString()}원</span>
        </div>
      </div>
    </div>
  `;
}