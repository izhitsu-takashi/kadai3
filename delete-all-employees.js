const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

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
    console.log(`Delete completed!`);
  } catch (error) {
    console.error('Error deleting employees:', error);
    throw error;
  }
}

// 実行
deleteAllEmployees()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });




