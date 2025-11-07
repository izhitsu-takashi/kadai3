import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Firestore, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private firestore: Firestore | null = null;
  private app: FirebaseApp | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeFirebase();
    }
  }

  private initializeFirebase(): void {
    try {
      // 既に初期化されている場合は既存のアプリを使用
      const apps = getApps();
      if (apps.length > 0) {
        this.app = apps[0];
      } else {
        this.app = initializeApp(environment.firebase);
      }
      this.firestore = getFirestore(this.app);
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
  }

  getFirestore(): Firestore | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    if (!this.firestore) {
      // ブラウザ環境でまだ初期化されていない場合は初期化を試みる
      this.initializeFirebase();
    }
    return this.firestore;
  }
}

