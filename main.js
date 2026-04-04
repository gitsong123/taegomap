// main.js - Taegomap Core Logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import * as PricingUtils from "./pricing-utils.js";

// ── 1. Firebase Configuration ──
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "taegomap",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global Access
window.FS = { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, where };
window.db = db;
window.PricingUtils = PricingUtils;

// ── 2. State Management ──
let map2d = null;
let markerLayer = null;
let mkCache = {};
let PLACES = [];
let curCat = 'all';
let curPf = 'all';
let curTab = 'map';
let curSideTab = 'map';
let naverMap = null; // Placeholder for Naver Maps

// ── 3. Map Initialization (V-World SDK) ──
function initMap() {
    vw.ol3.MapOptions = {
        basemapType: vw.ol3.BasemapType.GRAPHIC,
        controlDensity: vw.ol3.DensityType.EMPTY,
        interactionDensity: vw.ol3.DensityType.BASIC,
        controlsAutoArrange: true,
        homePosition: vw.ol3.CameraPosition,
        initPosition: vw.ol3.CameraPosition
    };
    
    map2d = new vw.ol3.Map('ol3map', vw.ol3.MapOptions);
    map2d.getView().setCenter(ol.proj.fromLonLat([127.2456, 37.3892])); // 태전지구 중심
    map2d.getView().setZoom(15);

    markerLayer = new vw.ol3.layer.Marker(map2d, { showTitle: false });
    map2d.addLayer(markerLayer);

    // Map Click → Place Selection
    map2d.on('singleclick', function(evt) {
        const clickCoord = ol.proj.toLonLat(evt.coordinate);
        let best = null, bestDist = Infinity;
        
        PLACES.forEach(p => {
            const pCoord = ol.proj.fromLonLat([p.lng, p.lat]);
            const pPx = map2d.getPixelFromCoordinate(pCoord);
            const cPx = map2d.getPixelFromCoordinate(evt.coordinate);
            if (!pPx || !cPx) return;
            const dx = pPx[0] - cPx[0], dy = pPx[1] - cPx[1];
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 40 && d < bestDist) { bestDist = d; best = p; }
        });

        if (best) openPlace(best.id);
        else closeSheet();
    });

    // Sync with Firestore
    fetchPlaces();
}

// ── 4. Data Fetching (Firestore) ──
async function fetchPlaces() {
    try {
        const q = collection(db, "places");
        const snap = await getDocs(q);
        PLACES = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // If empty, use dummy data for testing
        if (PLACES.length === 0) {
            PLACES = [
                { id: 'test1', name: '태전 OO 영수학원', category: 'academy', lat: 37.3892, lng: 127.2456, rateKey: '보습_중등', officialFeeParams: { min: 90, sessions: 3 }, actualFee: { tuition: 280000 }, saves: 42 },
                { id: 'test2', name: '맛있는 분식집', category: 'food', lat: 37.3912, lng: 127.2436, votes: { taste: 90, amount: 80, price: 95 }, saves: 120 }
            ];
        }
        
        loadMarkers();
        renderTop3();
    } catch (e) {
        console.error("Error fetching places:", e);
    }
}

// ── 5. Marker Logic ──
function getSVGUrl(category, isFlagged) {
    const colors = { academy: '#3B82F6', study: '#8B5CF6', food: '#F97316', cafe: '#10B981', reading_room: '#8B5CF6' };
    const icons = { academy: '학', study: '방', food: '밥', cafe: '카', reading_room: '독' };
    const c = isFlagged ? '#9CA3AF' : (colors[category] || '#6B7280');
    const icon = icons[category] || '?';

    const svg = `<svg width="44" height="54" viewBox="0 0 44 54" xmlns="http://www.w3.org/2000/svg">
        <filter id="sh"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25"/></filter>
        <path d="M22 2C13 2 5.5 9.5 5.5 18.5C5.5 30.5 22 52 22 52C22 52 38.5 30.5 38.5 18.5C38.5 9.5 31 2 22 2Z" fill="${c}" filter="url(#sh)"/>
        <circle cx="22" cy="18" r="9" fill="white" opacity="0.95"/>
        <text x="22" y="23" text-anchor="middle" fill="${c}" font-size="11" font-weight="bold" font-family="sans-serif">${icon}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function loadMarkers() {
    if (!map2d || !markerLayer) return;
    
    // Clear existing
    Object.keys(mkCache).forEach(id => {
        try { markerLayer.removeMarker(mkCache[id]); } catch (e) {}
    });
    mkCache = {};

    const filtered = PLACES.filter(p => {
        if (curCat !== 'all' && p.category !== curCat) return false;
        // Add price filter logic here if needed
        return true;
    });

    filtered.forEach(p => {
        const mk = markerLayer.addMarker({
            x: p.lng, y: p.lat, epsg: 'EPSG:4326',
            iconUrl: getSVGUrl(p.category, false),
            iconSize: [44, 54],
            iconAnchor: [22, 54],
            attr: { id: 'mk_' + p.id }
        });
        if (mk) mkCache[p.id] = mk;
    });
}

// ── 6. UI Interaction Functions ──
window.setCategory = function(btn) {
    curCat = btn.dataset.c;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('on', b.dataset.c === curCat));
    
    const pb = document.getElementById('price-bar');
    if (curCat === 'all') {
        pb.classList.remove('show');
    } else {
        pb.classList.add('show');
        // Dynamic price filter buttons could be added here
        pb.innerHTML = `<button class="pf-btn on" onclick="toast('필터 기능 준비 중')">전체 가격</button>`;
    }
    loadMarkers();
};

window.openPlace = async function(id) {
    const p = PLACES.find(x => x.id === id);
    if (!p) return;

    const sheetBody = document.getElementById('sheet-body');
    const desktopSheet = document.getElementById('desktop-sheet');
    
    const isEdu = ['academy', 'study', 'reading_room'].includes(p.category);
    
    let html = `
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:15px;">
            <div style="width:48px;height:48px;border-radius:12px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:24px;">📍</div>
            <div style="flex:1;">
                <div style="font-size:18px;font-weight:700;">${p.name}</div>
                <div style="font-size:12px;color:#666;margin-top:2px;">${p.category} · ❤️ ${p.saves || 0}</div>
            </div>
        </div>
        <div class="action-row">
            <button class="action-btn" onclick="window.open('https://map.naver.com/v5/search/${encodeURIComponent(p.name)}', '_blank')">🗺️ 네이버지도</button>
            <button class="action-btn" onclick="toast('저장되었습니다')">❤️ 저장</button>
        </div>
        <div id="place-detail-content"></div>
    `;

    sheetBody.innerHTML = html;
    desktopSheet.innerHTML = html;

    const detailContent = document.querySelectorAll('#place-detail-content');
    for (let el of detailContent) {
        if (isEdu) {
            await PricingUtils.renderEduPriceSection(p, el);
        } else {
            el.innerHTML = `<div class="card">맛집/카페 상세 정보 준비 중입니다.</div>`;
        }
    }

    // Show Sheet
    document.getElementById('sheet-overlay').classList.add('show');
    document.getElementById('sheet').classList.add('open');
};

window.closeSheet = function() {
    document.getElementById('sheet-overlay').classList.remove('show');
    document.getElementById('sheet').classList.remove('open');
};

window.switchTab = function(tab) {
    curTab = tab;
    document.querySelectorAll('.tb-btn').forEach(b => b.classList.toggle('on', b.id === 'tb-' + tab));
    toast(tab + " 탭은 준비 중입니다.");
};

window.toast = function(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
};

function renderTop3() {
    const bar = document.getElementById('top3-bar');
    const top3 = [...PLACES].sort((a, b) => (b.saves || 0) - (a.saves || 0)).slice(0, 3);
    bar.innerHTML = top3.map((p, i) => `
        <div class="t3card" onclick="openPlace('${p.id}')">
            <div class="t3rank" style="background:${['#F59E0B','#9CA3AF','#D97706'][i]}">${i+1}</div>
            <div class="t3info">
                <div class="t3name">${p.name}</div>
                <div class="t3meta">❤️ ${p.saves || 0}</div>
            </div>
        </div>
    `).join('');
}

// ── 7. Naver Maps Placeholder ──
window.initNaverMap = function() {
    // If ncpClientId is provided, this will work
    console.log("Naver Maps SDK loaded.");
    // naverMap = new naver.maps.Map('map', { ... });
};

// ── 8. Execution ──
// Ensure V-World is ready
if (typeof vw !== 'undefined') {
    vw.ol3.MapInit(initMap);
} else {
    window.onload = () => { if (typeof vw !== 'undefined') vw.ol3.MapInit(initMap); };
}
