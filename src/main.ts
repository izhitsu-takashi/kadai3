import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { environment } from './environments/environment';

// Firebaseを初期化
const app = initializeApp(environment.firebase);
const db = getFirestore(app);

// グローバルにFirestoreインスタンスを設定（サービスで使用するため）
(window as any).firestoreDb = db;

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
