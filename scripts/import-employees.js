const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Firebase Admin SDKの初期化
// サービスアカウントキーが必要です
// または、環境変数GOOGLE_APPLICATION_CREDENTIALSにサービスアカウントキーのパスを設定してください

// プロジェクトIDを指定
const projectId = 'kensyu10117';

// Firebase Admin SDKを初期化（サービスアカウントキーがない場合は、デフォルト認証情報を使用）
try {
  admin.initializeApp({
    projectId: projectId
  });
} catch (error) {
  console.log('Firebase Admin already initialized');
}

const db = admin.firestore();

// JSONファイルを読み込む
const jsonFilePath = path.join(__dirname, '..', '社員情報テストデータ_firestore用.json');
const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

// データをFirestoreに追加
async function importEmployees() {
  const batch = db.batch();
  const collectionRef = db.collection('employee');
  
  let batchCount = 0;
  const BATCH_SIZE = 500; // Firestoreのバッチ書き込み制限

  for (let i = 0; i < jsonData.length; i++) {
    const employee = jsonData[i];
    
    // データをFirestore用の形式に変換（日本語キーをそのまま使用）
    const employeeData = {
      ID: employee.ID,
      氏名: employee.氏名,
      役職: employee.役職,
      部署: employee.部署,
      生年月日: employee.生年月日,
      雇用形態: employee.雇用形態,
      勤務地: employee.勤務地,
      年齢: employee.年齢,
      性別: employee.性別,
      入社日: employee.入社日,
      標準報酬月額: employee.標準報酬月額,
      等級: employee.等級,
      健康保険料: employee.健康保険料,
      厚生年金保険料: employee.厚生年金保険料,
      介護保険料: employee.介護保険料,
      本人負担額: employee.本人負担額,
      会社負担額: employee.会社負担額
    };

    const docRef = collectionRef.doc();
    batch.set(docRef, employeeData);
    batchCount++;

    // バッチサイズに達したらコミット
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`Imported ${i + 1} employees...`);
      batchCount = 0;
    }
  }

  // 残りのデータをコミット
  if (batchCount > 0) {
    await batch.commit();
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





