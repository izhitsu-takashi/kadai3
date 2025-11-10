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

// 既存のemployeeデータを全て削除
async function deleteAllEmployees() {
  console.log('Deleting all existing employee data...');
  console.log(`Project: kensyu10117`);
  console.log(`Collection: employee\n`);
  
  try {
    const employeesRef = collection(db, 'employee');
    const querySnapshot = await getDocs(employeesRef);
    
    let deleteCount = 0;
    let errorCount = 0;
    
    for (const docSnapshot of querySnapshot.docs) {
      try {
        await deleteDoc(doc(db, 'employee', docSnapshot.id));
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
    console.error('Error deleting employees:', error);
    throw error;
  }
}

// 新しいJSONファイルをインポート
async function importNewEmployees() {
  console.log('Importing new employee data...');
  console.log(`Project: kensyu10117`);
  console.log(`Collection: employee\n`);
  
  // JSONファイルを読み込む
  const jsonFilePath = path.join(__dirname, '社員テストデータ_給与追加.json');
  const monthlyData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  
  let successCount = 0;
  let errorCount = 0;
  let totalCount = 0;
  
  // 各月のデータを処理
  for (const [month, employees] of Object.entries(monthlyData)) {
    console.log(`Processing ${month}...`);
    
    for (const employee of employees) {
      try {
        // 月情報を追加
        const employeeWithMonth = {
          ...employee,
          月: month
        };
        await addDoc(collection(db, 'employee'), employeeWithMonth);
        successCount++;
        totalCount++;
        
        // 進捗を更新（100件ごと）
        if (totalCount % 100 === 0) {
          console.log(`  Imported ${totalCount} employees...`);
        }
      } catch (error) {
        errorCount++;
        totalCount++;
        console.error(`  Error importing employee ${employee.氏名} (ID: ${employee.ID}):`, error.message);
      }
    }
  }
  
  console.log(`\n=== Import Summary ===`);
  console.log(`Total: ${totalCount} employees`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`\nImport completed!`);
}

// メイン処理
async function replaceEmployeeData() {
  try {
    // 1. 既存データを削除
    await deleteAllEmployees();
    
    // 2. 新しいデータをインポート
    await importNewEmployees();
    
    console.log('\n=== All operations completed successfully! ===');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// 実行
replaceEmployeeData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

