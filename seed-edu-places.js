#!/usr/bin/env node
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ── 설정 ──────────────────────────────────────────────
const NAVER_ID     = 'cT8lwPWYEDzoOVMXeyKe';
const NAVER_SECRET = 'fYSU79ZaoN';
const GEOCODED_CACHE = path.join(__dirname, 'edu_places_geocoded.json');

const files = [
  { name: '경기도 교습소 현황(2025.7.1.)_광주.xlsx', type: 'tutor', cols: { name: '__EMPTY_1', addr: '__EMPTY_3', subCat: '__EMPTY_7', price: '__EMPTY_12' } },
  { name: '경기도 학원 현황(2025.7.1.)_광주.xlsx', type: 'academy', cols: { name: '__EMPTY', addr: '__EMPTY_3', subCat: '__EMPTY_7', price: '__EMPTY_12', phone: '__EMPTY_5' } }
];

// ── Firebase Admin 초기화 ──────────────────────────────
const admin = require('./functions/node_modules/firebase-admin');
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');

if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)) });
} else {
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'taegomap' });
}
const db = admin.firestore();

// ── 유틸리티 ──────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function cleanHtml(s) { return s ? s.replace(/<[^>]*>/g, '').trim() : ''; }
function naverCoordToWGS84(mapx, mapy) {
  const x = parseInt(mapx), y = parseInt(mapy);
  const lng = x / 10000000 > 100 ? x / 10000000 : x / 10000;
  const lat = y / 10000000 > 30  ? y / 10000000 : y / 10000;
  return { lat, lng };
}

function naverSearch(query) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'openapi.naver.com',
      path: `/v1/search/local.json?query=${encodeURIComponent(query)}&display=1`,
      method: 'GET',
      headers: { 'X-Naver-Client-Id': NAVER_ID, 'X-Naver-Client-Secret': NAVER_SECRET },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

// ── 메인 로직 ─────────────────────────────────────────
async function main() {
  let allRaw = [];
  
  // 1. 파일 읽기 및 필터링
  files.forEach(f => {
    const filePath = path.join(__dirname, f.name);
    if (!fs.existsSync(filePath)) return;
    
    const workbook = XLSX.readFile(filePath);
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    
    data.forEach(item => {
      const name = item[f.cols.name];
      const addr = item[f.cols.addr];
      const subCat = item[f.cols.subCat];
      
      if (!name || !addr) return;
      if (addr.includes('태전동') || addr.includes('고산동')) {
        allRaw.push({
          name: cleanHtml(name),
          addr: addr.trim(),
          subCategory: subCat || '기타',
          phone: item[f.cols.phone] || '',
          price: item[f.cols.price] || 0,
          type: f.type
        });
      }
    });
  });

  // 중복 제거 (상호명+주소 기준)
  const uniqueMap = new Map();
  allRaw.forEach(p => {
    const key = p.name + p.addr;
    if (!uniqueMap.has(key)) uniqueMap.set(key, p);
  });
  const uniquePlaces = Array.from(uniqueMap.values());
  console.log(`필터링된 유니크 데이터: ${uniquePlaces.length}개`);

  // 2. 지오코딩 (캐시 활용)
  let geocoded = fs.existsSync(GEOCODED_CACHE) ? JSON.parse(fs.readFileSync(GEOCODED_CACHE, 'utf-8')) : {};
  
  for (let i = 0; i < uniquePlaces.length; i++) {
    const p = uniquePlaces[i];
    const key = p.name + p.addr;
    
    if (geocoded[key] && geocoded[key].lat) continue;

    // 검색 품질 향상 로직
    let searchName = p.name
      .replace(/(학원|교습소|공부방|센터)$/, '')
      .replace(/\(.*\)/g, '')
      .trim();
    const searchAddr = p.addr.split(',')[0].split('(')[0].trim();
    
    let result = await naverSearch(`${searchName} ${searchAddr}`);
    
    // 실패 시 상호명만으로 재시도 (광주시 한정)
    if (!result || !result.items || result.items.length === 0) {
      result = await naverSearch(`광주 ${searchName}`);
    }
    
    if (result && result.items && result.items.length > 0) {
      const item = result.items[0];
      const { lat, lng } = naverCoordToWGS84(item.mapx, item.mapy);
      geocoded[key] = { ...p, lat, lng, naverName: cleanHtml(item.title) };
      console.log('OK');
    } else {
      geocoded[key] = { ...p, lat: null, lng: null };
      console.log('FAIL');
    }

    if (i % 20 === 0) fs.writeFileSync(GEOCODED_CACHE, JSON.stringify(geocoded, null, 2));
    await sleep(150);
  }
  fs.writeFileSync(GEOCODED_CACHE, JSON.stringify(geocoded, null, 2));

  // 3. Firestore 업로드
  const toUpload = Object.values(geocoded).filter(p => p.lat);
  console.log(`Firestore 업로드 대상: ${toUpload.length}개`);

  const BATCH_SIZE = 400;
  for (let i = 0; i < toUpload.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toUpload.slice(i, i + BATCH_SIZE);
    
    chunk.forEach(p => {
      // 상호명과 주소 해시로 ID 생성 (중복 방지)
      const id = 'edu_' + Buffer.from(p.name + p.addr).toString('hex').slice(0, 20);
      const ref = db.collection('places').doc(id);
      batch.set(ref, {
        ...p,
        category: 'academy',
        source: 'excel_edu_2025',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });
    
    await batch.commit();
    console.log(`배치 저장 완료 (${Math.min(i + BATCH_SIZE, toUpload.length)}/${toUpload.length})`);
  }

  console.log('✅ 모든 작업이 완료되었습니다.');
}

main().catch(console.error);
