const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
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

// 等級データをインポート
async function importGradeData() {
  console.log('Importing grade data...');
  console.log(`Project: kensyu10117`);
  console.log(`Collection: gradeData\n`);
  
  // JSONファイルを読み込む（src/assets/等級.json）
  const jsonFilePath = path.join(__dirname, 'src', 'assets', '等級.json');
  
  if (!fs.existsSync(jsonFilePath)) {
    console.error(`Error: JSON file not found at ${jsonFilePath}`);
    process.exit(1);
  }
  
  console.log(`Reading JSON file from: ${jsonFilePath}`);
  const gradeData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  
  try {
    // Firestoreに保存（単一のドキュメントとして）
    const docRef = doc(db, 'gradeData', 'reiwa7');
    await setDoc(docRef, {
      hyouzyungetugakuReiwa7: gradeData.hyouzyungetugakuReiwa7 || [],
      kouseinenkinReiwa7: gradeData.kouseinenkinReiwa7 || [],
      updatedAt: new Date()
    }, { merge: true });
    
    console.log('\n=== Import Summary ===');
    console.log(`標準報酬月額等級数: ${gradeData.hyouzyungetugakuReiwa7?.length || 0}`);
    console.log(`厚生年金保険等級数: ${gradeData.kouseinenkinReiwa7?.length || 0}`);
    console.log('\n✓ Grade data imported successfully!');
    console.log('  Collection: gradeData');
    console.log('  Document ID: reiwa7');
  } catch (error) {
    console.error('Error importing grade data:', error);
    throw error;
  }
}

// 実行
importGradeData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

