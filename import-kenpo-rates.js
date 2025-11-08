const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

// Firebase設定 - プロジェクト「kensyu10117」の設定を環境変数または直接指定
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'kensyu10117.firebaseapp.com',
  projectId: 'kensyu10117',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'kensyu10117.appspot.com',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || 'YOUR_MESSAGING_SENDER_ID',
  appId: process.env.FIREBASE_APP_ID || 'YOUR_APP_ID'
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// JSONファイルを読み込む
const jsonFilePath = path.join(__dirname, 'kenpo-rates.json');
const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

// データをFirestoreに追加
async function importKenpoRates() {
  console.log(`Starting import of ${jsonData.length} prefecture rates to Firestore...`);
  console.log(`Project: kensyu10117`);
  console.log(`Collection: kenpoRates\n`);
  
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < jsonData.length; i++) {
    const rate = jsonData[i];
    
    try {
      await addDoc(collection(db, 'kenpoRates'), rate);
      successCount++;
      console.log(`[${i + 1}/${jsonData.length}] ✓ Imported: ${rate.prefecture} (健康保険料率: ${rate.healthRate}%, 介護保険料率: ${rate.careRate}%)`);
    } catch (error) {
      errorCount++;
      console.error(`[${i + 1}/${jsonData.length}] ✗ Error importing ${rate.prefecture}:`, error.message);
    }
  }
  
  console.log(`\n=== Import Summary ===`);
  console.log(`Total: ${jsonData.length} prefecture rates`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`\nImport completed!`);
}

// 実行
importKenpoRates()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });

