import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';

export interface Employee {
  id?: string;
  ID?: number;
  氏名?: string;
  給与?: number;
  標準報酬月額?: number;
  標準報酬月額算出基準給与?: number; // 標準報酬月額算出に使用された給与の平均値または途中入社時の給与
  標準報酬月額算出方法?: string; // "平均値" または "途中入社時給与"
  標準賞与額?: number;
  等級?: number;
  健康保険料?: number;
  厚生年金保険料?: number;
  介護保険料?: number;
  本人負担額?: number;
  会社負担額?: number;
  月?: string; // 月情報（例: "2025年04月"）
  年齢?: number;
  役職?: string;
  部署?: string;
  所属部署?: string; // 部署の別名
  生年月日?: string;
  雇用形態?: string;
  勤務地?: string;
  性別?: string;
  入社日?: string;
  // 英語キーもサポート（後方互換性のため）
  name?: string;
  salary?: number;
  standardSalary?: number;
  standardSalaryCalculationBase?: number; // 標準報酬月額算出に使用された給与の平均値または途中入社時の給与
  standardSalaryCalculationMethod?: string; // "average" または "joinDateSalary"
  standardBonus?: number;
  grade?: number;
  healthInsurance?: number;
  welfarePension?: number;
  nursingInsurance?: number;
  personalBurden?: number;
  companyBurden?: number;
  month?: string;
  age?: number;
  position?: string;
  department?: string;
  birthDate?: string;
  employmentType?: string;
  workLocation?: string;
  gender?: string;
  joinDate?: string;
}

export interface Bonus {
  id?: string;
  ID?: number;
  氏名?: string;
  賞与?: number;
  標準賞与額?: number;
  等級?: number;
  健康保険料?: number;
  厚生年金保険料?: number;
  介護保険料?: number;
  本人負担額?: number;
  会社負担額?: number;
  月?: string; // 月情報（例: "2025年06月"）
  年齢?: number;
  役職?: string;
  部署?: string;
  所属部署?: string; // 部署の別名
  生年月日?: string;
  雇用形態?: string;
  勤務地?: string;
  性別?: string;
  入社日?: string;
  // その他のフィールドも必要に応じて追加
  bonus?: number;
  position?: string;
  department?: string;
  birthDate?: string;
  employmentType?: string;
  workLocation?: string;
  gender?: string;
  joinDate?: string;
  [key: string]: any;
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

  getBonuses(month?: string): Observable<Bonus[]> {
    const db = this.getDb();
    if (!db) {
      // SSR環境やFirestoreが初期化されていない場合は空の配列を返す
      return new Observable(observer => {
        observer.next([]);
        observer.complete();
      });
    }
    const bonusesRef = collection(db, 'bonus');
    return from(getDocs(bonusesRef)).pipe(
      map(querySnapshot => {
        let bonuses = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Bonus));
        
        // 月でフィルタリング
        if (month) {
          bonuses = bonuses.filter(bonus => bonus.月 === month || bonus['month'] === month);
        }
        
        return bonuses;
      })
    );
  }
}

