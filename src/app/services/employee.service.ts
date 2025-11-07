import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Employee {
  id?: string;
  name: string;
  standardSalary: number;
  grade: number;
  healthInsurance: number;
  welfarePension: number;
  nursingInsurance: number;
  personalBurden: number;
  companyBurden: number;
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private readonly collectionName = 'employee';
  private db: Firestore;

  constructor() {
    // main.tsで初期化されたFirestoreインスタンスを取得
    this.db = (window as any).firestoreDb;
  }

  getEmployees(): Observable<Employee[]> {
    const employeesRef = collection(this.db, this.collectionName);
    return from(getDocs(employeesRef)).pipe(
      map(querySnapshot => {
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Employee));
      })
    );
  }

  addEmployee(employee: Omit<Employee, 'id'>): Promise<any> {
    const employeesRef = collection(this.db, this.collectionName);
    return addDoc(employeesRef, employee);
  }

  updateEmployee(id: string, employee: Partial<Employee>): Promise<void> {
    const employeeDocRef = doc(this.db, `${this.collectionName}/${id}`);
    return updateDoc(employeeDocRef, employee);
  }

  deleteEmployee(id: string): Promise<void> {
    const employeeDocRef = doc(this.db, `${this.collectionName}/${id}`);
    return deleteDoc(employeeDocRef);
  }
}

