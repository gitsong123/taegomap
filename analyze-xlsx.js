const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const files = [
  '경기도 교습소 현황(2025.7.1.)_광주.xlsx',
  '경기도 학원 현황(2025.7.1.)_광주.xlsx'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`파일 없음: ${file}`);
    return;
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`\n--- 파일 분석: ${file} ---`);
  console.log(`전체 데이터 수: ${data.length}`);
  
  if (data.length > 0) {
    console.log('헤더 예시:', Object.keys(data[0]));
    
    // 태전동, 고산동 필터링 테스트
    const filtered = data.filter(item => {
      const addr = JSON.stringify(item);
      return addr.includes('태전동') || addr.includes('고산동');
    });
    console.log(`태전/고산 데이터 수: ${filtered.length}`);
    
    if (filtered.length > 0) {
      console.log('필터링 예시:', filtered[0]);
    }
  }
});
