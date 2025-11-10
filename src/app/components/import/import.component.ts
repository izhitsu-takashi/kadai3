import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FirestoreService } from '../../services/firestore.service';
import { EmployeeService } from '../../services/employee.service';

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="import-container">
      <h2>社員情報設定</h2>
      <div class="import-section">
        <h3>社員データインポート</h3>
        <p class="description">給与データと賞与データをFirebaseにインポートします。</p>
        <button (click)="importData()" [disabled]="isImporting" class="import-button">
          {{ isImporting ? 'インポート中...' : '社員データインポート' }}
        </button>
        <div *ngIf="importResult" class="result" [class.success]="importSuccess" [class.error]="!importSuccess">
          <p>{{ importResult }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .import-container {
      padding: 2rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .import-container h2 {
      margin: 0 0 2rem 0;
      font-size: 1.75rem;
      font-weight: 700;
      color: #2d3748;
      padding-bottom: 1rem;
      border-bottom: 2px solid #e2e8f0;
    }
    .import-section {
      margin-bottom: 2rem;
    }
    .import-section h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #2d3748;
    }
    .description {
      margin: 0 0 1.5rem 0;
      color: #4a5568;
      font-size: 0.95rem;
    }
    .import-button {
      padding: 1rem 2rem;
      font-size: 1rem;
      font-weight: 600;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .import-button:hover:not(:disabled) {
      background: #5568d3;
    }
    .import-button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .result {
      margin-top: 1rem;
      padding: 1rem;
      border-radius: 6px;
      border: 2px solid;
      font-weight: 500;
    }
    .result.success {
      background: #f0fff4;
      border-color: #48bb78;
      color: #22543d;
    }
    .result.error {
      background: #fff5f5;
      border-color: #f56565;
      color: #742a2a;
    }
  `]
})
export class ImportComponent {
  isImporting = false;
  importResult = '';
  importSuccess = false;

  constructor(
    private firestoreService: FirestoreService,
    private employeeService: EmployeeService,
    private http: HttpClient
  ) {}

  async importData() {
    // 確認ダイアログを表示
    const confirmed = confirm('既存のデータを削除して新しいデータをインポートします。よろしいですか？');
    if (!confirmed) {
      return;
    }

    this.isImporting = true;
    this.importResult = 'インポートを開始します...';
    this.importSuccess = false;

    try {
      const firestore = this.firestoreService.getFirestore();
      if (!firestore) {
        this.importResult = 'エラー: Firestoreが初期化されていません。ブラウザ環境で実行してください。';
        this.isImporting = false;
        return;
      }

      // JSONファイルを読み込む
      const employeeFileName = encodeURIComponent('社員テストデータ_給与追加.json');
      const bonusFileName = encodeURIComponent('社員賞与データ_賞与追加.json');
      const employeeData = await firstValueFrom(this.http.get<any>(`/assets/${employeeFileName}`));
      const bonusData = await firstValueFrom(this.http.get<any>(`/assets/${bonusFileName}`));

      if (!employeeData || !bonusData) {
        this.importResult = 'エラー: JSONファイルの読み込みに失敗しました。';
        this.isImporting = false;
        return;
      }

      // 既存のデータを削除
      this.importResult = '既存のデータを削除中...';
      await this.deleteAllEmployees();
      await this.deleteAllBonuses();

      // 給与データをインポート
      this.importResult = '給与データをインポート中...';
      const employeeResult = await this.importEmployees(employeeData);
      
      // 賞与データをインポート
      this.importResult = '賞与データをインポート中...';
      const bonusResult = await this.importBonuses(bonusData);

      this.importResult = `インポート完了: 給与データ ${employeeResult.success}件成功/${employeeResult.total}件, 賞与データ ${bonusResult.success}件成功/${bonusResult.total}件`;
      this.importSuccess = true;
      
      // インポート完了後、ページをリロード
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Import error:', error);
      this.importResult = `エラーが発生しました: ${error.message || error}`;
      this.importSuccess = false;
    } finally {
      this.isImporting = false;
    }
  }

  async deleteAllEmployees(): Promise<void> {
    const firestore = this.firestoreService.getFirestore();
    if (!firestore) return;

    const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
    const employeesRef = collection(firestore, 'employee');
    const querySnapshot = await getDocs(employeesRef);
    
    const deletePromises = querySnapshot.docs.map(docSnapshot => 
      deleteDoc(doc(firestore, 'employee', docSnapshot.id))
    );
    await Promise.all(deletePromises);
  }

  async deleteAllBonuses(): Promise<void> {
    const firestore = this.firestoreService.getFirestore();
    if (!firestore) return;

    const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
    const bonusesRef = collection(firestore, 'bonus');
    const querySnapshot = await getDocs(bonusesRef);
    
    const deletePromises = querySnapshot.docs.map(docSnapshot => 
      deleteDoc(doc(firestore, 'bonus', docSnapshot.id))
    );
    await Promise.all(deletePromises);
  }

  async importEmployees(monthlyData: { [key: string]: any[] }): Promise<{ success: number; total: number }> {
    let successCount = 0;
    let totalCount = 0;

    for (const [month, employees] of Object.entries(monthlyData)) {
      for (const employee of employees) {
        try {
          const employeeWithMonth = {
            ...employee,
            月: month
          };
          await this.employeeService.addEmployee(employeeWithMonth);
          successCount++;
          totalCount++;
          
          if (totalCount % 50 === 0) {
            this.importResult = `給与データインポート中... ${totalCount}件処理済み`;
          }
        } catch (error) {
          console.error('Error importing employee:', error);
          totalCount++;
        }
      }
    }

    return { success: successCount, total: totalCount };
  }

  async importBonuses(monthlyData: { [key: string]: any[] }): Promise<{ success: number; total: number }> {
    const firestore = this.firestoreService.getFirestore();
    if (!firestore) return { success: 0, total: 0 };

    const { collection, addDoc } = await import('firebase/firestore');
    let successCount = 0;
    let totalCount = 0;

    for (const [month, bonuses] of Object.entries(monthlyData)) {
      for (const bonus of bonuses) {
        try {
          const bonusWithMonth = {
            ...bonus,
            月: month
          };
          await addDoc(collection(firestore, 'bonus'), bonusWithMonth);
          successCount++;
          totalCount++;
          
          if (totalCount % 50 === 0) {
            this.importResult = `賞与データインポート中... ${totalCount}件処理済み`;
          }
        } catch (error) {
          console.error('Error importing bonus:', error);
          totalCount++;
        }
      }
    }

    return { success: successCount, total: totalCount };
  }
}

