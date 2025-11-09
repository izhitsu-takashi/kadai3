const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

// Firebase設定（プロジェクト「kensyu10117」の設定をここに追加してください）
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'kensyu10117.firebaseapp.com',
  projectId: 'kensyu10117',
  storageBucket: 'kensyu10117.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// JSONファイルを読み込む
const jsonFilePath = path.join(__dirname, '..', '社員情報テストデータ_firestore用.json');
const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

// データをFirestoreに追加
async function importEmployees() {
  console.log(`Starting import of ${jsonData.length} employees...`);
  
  for (let i = 0; i < jsonData.length; i++) {
    const employee = jsonData[i];
    
    try {
      await addDoc(collection(db, 'employee'), employee);
      console.log(`Imported employee ${i + 1}/${jsonData.length}: ${employee.氏名}`);
    } catch (error) {
      console.error(`Error importing employee ${i + 1} (${employee.氏名}):`, error);
    }
  }
  
  console.log(`Successfully imported ${jsonData.length} employees to Firestore!`);
}

// 実行
importEmployees()
  .then(() => {
    console.log('Import completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error importing employees:', error);
    process.exit(1);
  });




