const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } = require('firebase/firestore');
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

// 既存のbonusデータを全て削除
async function deleteAllBonuses() {
  console.log('Deleting all existing bonus data...');
  console.log(`Project: kensyu10117`);
  console.log(`Collection: bonus\n`);
  
  try {
    const bonusesRef = collection(db, 'bonus');
    const querySnapshot = await getDocs(bonusesRef);
    
    let deleteCount = 0;
    let errorCount = 0;
    
    for (const docSnapshot of querySnapshot.docs) {
      try {
        await deleteDoc(doc(db, 'bonus', docSnapshot.id));
        deleteCount++;
        if (deleteCount % 100 === 0) {
          console.log(`Deleted ${deleteCount} documents...`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error deleting document ${docSnapshot.id}:`, error.message);
      }
    }
    
    console.log(`\n=== Delete Summary ===`);
    console.log(`Total deleted: ${deleteCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Delete completed!\n`);
  } catch (error) {
    console.error('Error deleting bonuses:', error);
    throw error;
  }
}

// 新しいJSONファイルをインポート
async function importNewBonuses() {
  console.log('Importing new bonus data...');
  console.log(`Project: kensyu10117`);
  console.log(`Collection: bonus\n`);
  
  // JSONファイルを読み込む（src/assets/賞与.json）
  const jsonFilePath = path.join(__dirname, 'src', 'assets', '賞与.json');
  const monthlyData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  
  let successCount = 0;
  let errorCount = 0;
  let totalCount = 0;
  
  // 各月のデータを処理
  for (const [month, bonuses] of Object.entries(monthlyData)) {
    console.log(`Processing ${month}...`);
    
    for (const bonus of bonuses) {
      try {
        // 月情報を追加
        const bonusWithMonth = {
          ...bonus,
          月: month
        };
        await addDoc(collection(db, 'bonus'), bonusWithMonth);
        successCount++;
        totalCount++;
        
        // 進捗を更新（100件ごと）
        if (totalCount % 100 === 0) {
          console.log(`  Imported ${totalCount} bonuses...`);
        }
      } catch (error) {
        errorCount++;
        totalCount++;
        console.error(`  Error importing bonus ${bonus.氏名} (ID: ${bonus.ID}):`, error.message);
      }
    }
  }
  
  console.log(`\n=== Import Summary ===`);
  console.log(`Total: ${totalCount} bonuses`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`\nImport completed!`);
}

// メイン処理
async function replaceBonusData() {
  try {
    // 1. 既存データを削除
    await deleteAllBonuses();
    
    // 2. 新しいデータをインポート
    await importNewBonuses();
    
    console.log('\n=== All operations completed successfully! ===');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// 実行
replaceBonusData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


