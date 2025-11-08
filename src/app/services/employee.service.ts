import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';

export interface Employee {
  id?: string;
  ID?: number;
  氏名?: string;
  標準報酬月額?: number;
  等級?: number;
  健康保険料?: number;
  厚生年金保険料?: number;
  介護保険料?: number;
  本人負担額?: number;
  会社負担額?: number;
  月?: string; // 月情報（例: "2025年04月"）
  年齢?: number;
  // 英語キーもサポート（後方互換性のため）
  name?: string;
  standardSalary?: number;
  grade?: number;
  healthInsurance?: number;
  welfarePension?: number;
  nursingInsurance?: number;
  personalBurden?: number;
  companyBurden?: number;
  month?: string;
  age?: number;
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private readonly collectionName = 'employee';
  private db: Firestore | null = null;

  constructor(private firestoreService: FirestoreService) {}

  private getDb(): Firestore | null {
    if (!this.db) {
      this.db = this.firestoreService.getFirestore();
    }
    return this.db;
  }

  getEmployees(month?: string): Observable<Employee[]> {
    const db = this.getDb();
    if (!db) {
      // SSR環境やFirestoreが初期化されていない場合は空の配列を返す
      return new Observable(observer => {
        observer.next([]);
        observer.complete();
      });
    }
    const employeesRef = collection(db, this.collectionName);
    return from(getDocs(employeesRef)).pipe(
      map(querySnapshot => {
        let employees = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Employee));
        
        // 月でフィルタリング
        if (month) {
          employees = employees.filter(emp => emp.月 === month || emp.month === month);
        }
        
        return employees;
      })
    );
  }

  addEmployee(employee: Omit<Employee, 'id'>): Promise<any> {
    const db = this.getDb();
    if (!db) {
      return Promise.reject(new Error('Firestore is not available'));
    }
    const employeesRef = collection(db, this.collectionName);
    return addDoc(employeesRef, employee);
  }

  updateEmployee(id: string, employee: Partial<Employee>): Promise<void> {
    const db = this.getDb();
    if (!db) {
      return Promise.reject(new Error('Firestore is not available'));
    }
    const employeeDocRef = doc(db, `${this.collectionName}/${id}`);
    return updateDoc(employeeDocRef, employee);
  }

  deleteEmployee(id: string): Promise<void> {
    const db = this.getDb();
    if (!db) {
      return Promise.reject(new Error('Firestore is not available'));
    }
    const employeeDocRef = doc(db, `${this.collectionName}/${id}`);
    return deleteDoc(employeeDocRef);
  }
}

