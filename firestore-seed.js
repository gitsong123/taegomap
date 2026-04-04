// firestore-seed.js
// This script is intended to be run once to seed the officialRates collection.

export async function seedOfficialRates() {
  const RATES_2025 = [
    {id:'보습_초등',  domain:'보습', series:'보통교과', course:'단과', grade:'초등', ratePerMin:210, effectiveDate:'2025-02-01'},
    {id:'보습_중등',  domain:'보습', series:'보통교과', course:'단과', grade:'중등', ratePerMin:222, effectiveDate:'2025-02-01'},
    {id:'보습_고등',  domain:'보습', series:'보통교과', course:'단과', grade:'고등', ratePerMin:234, effectiveDate:'2025-02-01'},
    {id:'진학지도_전체', domain:'진학지도', series:'진학상담', course:'진학상담·지도', grade:'전체', ratePerMin:234, effectiveDate:'2025-02-01'},
    {id:'외국어_전체', domain:'국제화', series:'외국어', course:'어학', grade:'전체', ratePerMin:259, effectiveDate:'2025-02-01'},
    {id:'음악_일반',  domain:'예능', series:'음악', course:'음악', grade:'유·초·중·고', ratePerMin:224, effectiveDate:'2025-02-01'},
    {id:'음악_입시',  domain:'예능', series:'음악', course:'음악', grade:'입시', ratePerMin:336, effectiveDate:'2025-02-01'},
    {id:'미술_일반',  domain:'예능', series:'미술', course:'미술', grade:'유·초·중·고', ratePerMin:212, effectiveDate:'2025-02-01'},
    {id:'미술_입시',  domain:'예능', series:'미술', course:'미술', grade:'입시', ratePerMin:255, effectiveDate:'2025-02-01'},
    {id:'무용_일반',  domain:'예능', series:'무용', course:'무용', grade:'유·초·중·고', ratePerMin:212, effectiveDate:'2025-02-01'},
    {id:'무용_입시',  domain:'예능', series:'무용', course:'무용', grade:'입시', ratePerMin:255, effectiveDate:'2025-02-01'},
    {id:'독서실_다인실', domain:'독서실', series:'독서실', course:'다인실', grade:'다인실', isFlat:true, flatDay:8960, flatMonth:140280},
    {id:'독서실_1인실', domain:'독서실', series:'독서실', course:'1인실', grade:'1인실',  isFlat:true, flatDay:10440,flatMonth:166650},
    {id:'정보_일반',  domain:'정보', series:'정보', course:'정보', grade:'일반', ratePerMin:230, effectiveDate:'2025-02-01'},
    {id:'기타_일반',  domain:'기타', series:'기타', course:'기타(직업기술·인문사회·기예·공예)', grade:'일반', ratePerMin:230, effectiveDate:'2025-02-01'},
    {id:'과외_초중고', domain:'개인과외', series:'과외', course:'개인과외(초·중·고)', grade:'초·중·고',ratePerMin:333, effectiveDate:'2025-02-01'},
  ];

  for (const r of RATES_2025) {
    // Adding common fields as specified in the document
    const dataToSet = {
      ...r,
      monthlyWeeks: 4.3,
      source: '경기도광주하남교육지원청 교습비 조정기준',
      updatedAt: window.FS.serverTimestamp() // Assuming serverTimestamp is part of window.FS
    };

    // Ensure proper document reference using window.db and window.FS.doc
    await window.FS.setDoc(
      window.FS.doc(window.db, 'officialRates', r.id),
      dataToSet
    );
  }
  console.log('[태고맵] officialRates Seed 완료');
}

// You can call this function from the browser console (after Firebase is initialized)
// or temporarily add a call to it in main.js for one-time execution.
// Example: setTimeout(seedOfficialRates, 3000); // Call after 3 seconds to ensure Firebase is ready
