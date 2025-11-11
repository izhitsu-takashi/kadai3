const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

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

// 保険料率設定を初期化
async function initInsuranceRateSettings() {
  console.log('Initializing insurance rate settings...');
  console.log(`Project: kensyu10117`);
  console.log(`Collection: insuranceRateSettings\n`);
  
  try {
    const docRef = doc(db, 'insuranceRateSettings', 'settings');
    await setDoc(docRef, {
      welfarePensionRate: 18.3,
      nursingInsuranceRate: 1.59,
      updatedAt: new Date()
    }, { merge: true });
    
    console.log('✓ Insurance rate settings initialized successfully!');
    console.log('  - 厚生年金保険料率: 18.3%');
    console.log('  - 介護保険料率: 1.59%');
  } catch (error) {
    console.error('Error initializing insurance rate settings:', error);
    throw error;
  }
}

// 実行
initInsuranceRateSettings()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });





