#!/usr/bin/env node
/**
 * seed-food-places.js
 * 태전고산 음식점 엑셀 데이터를 Firestore places 컬렉션에 시딩
 *
 * 실행 전 준비:
 *   1) Firebase 서비스 계정 JSON 파일 경로를 SERVICE_ACCOUNT_PATH에 설정
 *   2) node seed-food-places.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ── 설정 ──────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.join(__dirname, 'serviceAccountKey.json'); // 서비스 계정 JSON 경로

const NAVER_ID     = 'cT8lwPWYEDzoOVMXeyKe';
const NAVER_SECRET = 'fYSU79ZaoN';
const RAW_DATA     = path.join(__dirname, 'food_places_raw.json');
const GEOCODED_CACHE = path.join(__dirname, 'food_places_geocoded.json');

// ── Firebase Admin 초기화 ──────────────────────────────
const admin = require('./functions/node_modules/firebase-admin');

// 서비스 계정 키가 있으면 사용, 없으면 ADC(Application Default Credentials) 사용
if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  admin.initializeApp({
    credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
  });
} else {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'taegomap',
  });
}
const db = admin.firestore();

// ── 네이버 지역 검색 (좌표 획득) ──────────────────────
function naverSearch(query) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(query);
    const options = {
      hostname: 'openapi.naver.com',
      path: `/v1/search/local.json?query=${encoded}&display=1&sort=comment`,
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': NAVER_ID,
        'X-Naver-Client-Secret': NAVER_SECRET,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cleanHtml(s) { return s ? s.replace(/<[^>]*>/g, '') : ''; }

// mapx/mapy (Naver 좌표) → WGS84
function naverCoordToWGS84(mapx, mapy) {
  const x = parseInt(mapx), y = parseInt(mapy);
  const lng = x / 10000000 > 100 ? x / 10000000 : x / 10000;
  const lat = y / 10000000 > 30  ? y / 10000000 : y / 10000;
  return { lat, lng };
}

// ── 카테고리 추정 ──────────────────────────────────────
function guessCategory(naverCat, name) {
  const c = (naverCat || '') + ' ' + (name || '');
  if (/카페|커피|베이커리|제과|빵/.test(c)) return 'cafe';
  if (/학원|교습|독서실|보습/.test(c)) return 'academy';
  return 'food';
}

// ── 메인 ──────────────────────────────────────────────
async function main() {
  const rawPlaces = JSON.parse(fs.readFileSync(RAW_DATA, 'utf-8'));

  // 캐시 로드 (중단 후 재실행 시 이어서 처리)
  let geocoded = {};
  if (fs.existsSync(GEOCODED_CACHE)) {
    geocoded = JSON.parse(fs.readFileSync(GEOCODED_CACHE, 'utf-8'));
    console.log(`캐시 ${Object.keys(geocoded).length}개 로드됨`);
  }

  let geocodeCount = 0;
  for (let i = 0; i < rawPlaces.length; i++) {
    const p = rawPlaces[i];
    const key = p.name;

    if (geocoded[key]) continue; // 이미 처리됨

    // 상호명 + 주소로 검색
    const result = await naverSearch(`${p.name} ${p.area}`);
    geocodeCount++;

    if (result && result.items && result.items.length > 0) {
      const item = result.items[0];
      const { lat, lng } = naverCoordToWGS84(item.mapx, item.mapy);
      geocoded[key] = {
        name: cleanHtml(item.title) || p.name,
        addr: item.roadAddress || item.address || p.addr,
        lat, lng,
        area: p.area,
        category: guessCategory(item.category, p.name),
        naverCategory: item.category || '',
        phone: item.telephone || '',
        saves: 0,
        source: 'excel_seed',
      };
    } else {
      // 검색 실패 → 좌표 없이 저장 (나중에 수동 수정)
      geocoded[key] = {
        name: p.name,
        addr: p.addr,
        lat: null,
        lng: null,
        area: p.area,
        category: 'food',
        saves: 0,
        source: 'excel_seed_no_coord',
      };
    }

    // 10개마다 캐시 저장
    if (geocodeCount % 10 === 0) {
      fs.writeFileSync(GEOCODED_CACHE, JSON.stringify(geocoded, null, 2), 'utf-8');
      console.log(`[${i + 1}/${rawPlaces.length}] 지오코딩 진행 중...`);
    }

    await sleep(120); // 네이버 API 초당 10건 제한 대응
  }

  fs.writeFileSync(GEOCODED_CACHE, JSON.stringify(geocoded, null, 2), 'utf-8');
  console.log(`\n지오코딩 완료: ${Object.keys(geocoded).length}개`);

  // ── Firestore 업로드 ──────────────────────────────
  const places = Object.values(geocoded).filter(p => p.lat && p.lng);
  const skipped = Object.values(geocoded).filter(p => !p.lat);
  console.log(`Firestore 저장: ${places.length}개 (좌표없음 제외: ${skipped.length}개)`);

  const BATCH_SIZE = 400;
  for (let i = 0; i < places.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = places.slice(i, i + BATCH_SIZE);
    chunk.forEach(p => {
      const ref = db.collection('places').doc();
      batch.set(ref, {
        ...p,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    console.log(`Firestore 배치 저장: ${Math.min(i + BATCH_SIZE, places.length)}/${places.length}`);
  }

  if (skipped.length > 0) {
    console.log('\n좌표를 찾지 못한 업체 목록:');
    skipped.forEach(p => console.log(`  - ${p.name} | ${p.addr}`));
  }

  console.log('\n✅ 완료!');
}

main().catch(e => { console.error(e); process.exit(1); });
