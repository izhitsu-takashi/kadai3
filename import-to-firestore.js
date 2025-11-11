const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

// Firebase設定 - プロジェクト「kensyu10117」の設定を環境変数または直接指定
// 環境変数から取得、または直接指定
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
const jsonFilePath = path.join(__dirname, '社員情報テストデータ_firestore用.json');
const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

// データをFirestoreに追加
async function importEmployees() {
  console.log(`Starting import of ${jsonData.length} employees to Firestore...`);
  console.log(`Project: kensyu10117`);
  console.log(`Collection: employee\n`);
  
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < jsonData.length; i++) {
    const employee = jsonData[i];
    
    try {
      await addDoc(collection(db, 'employee'), employee);
      successCount++;
      console.log(`[${i + 1}/${jsonData.length}] ✓ Imported: ${employee.氏名} (ID: ${employee.ID})`);
    } catch (error) {
      errorCount++;
      console.error(`[${i + 1}/${jsonData.length}] ✗ Error importing ${employee.氏名}:`, error.message);
    }
  }
  
  console.log(`\n=== Import Summary ===`);
  console.log(`Total: ${jsonData.length} employees`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`\nImport completed!`);
}

// 実行
importEmployees()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });






