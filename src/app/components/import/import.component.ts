import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirestoreService } from '../../services/firestore.service';
import { EmployeeService } from '../../services/employee.service';

import employeeData from '../../../../社員テストデータ.json';
@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="import-container">
      <h2>データインポート</h2>
      <button (click)="importData()" [disabled]="isImporting">
        {{ isImporting ? 'インポート中...' : 'Firestoreにデータをインポート' }}
      </button>
      <div *ngIf="importResult" class="result">
        <p>{{ importResult }}</p>
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
      margin: 0 0 1.5rem 0;
      font-size: 1.5rem;
      color: #2d3748;
    }
    button {
      padding: 1rem 2rem;
      font-size: 1rem;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    button:hover:not(:disabled) {
      background: #5568d3;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .result {
      margin-top: 1rem;
      padding: 1rem;
      background: #f7fafc;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      color: #2d3748;
    }
  `]
})
export class ImportComponent {
  isImporting = false;
  importResult = '';

  constructor(
    private firestoreService: FirestoreService,
    private employeeService: EmployeeService
  ) {}

  async importData() {
    this.isImporting = true;
    this.importResult = 'インポートを開始します...';

    try {
      const firestore = this.firestoreService.getFirestore();
      if (!firestore) {
        this.importResult = 'エラー: Firestoreが初期化されていません。ブラウザ環境で実行してください。';
        this.isImporting = false;
        return;
      }

      const monthlyData = employeeData as { [key: string]: any[] };
      let successCount = 0;
      let errorCount = 0;
      let totalCount = 0;

      // 各月のデータを処理
      for (const [month, employees] of Object.entries(monthlyData)) {
        for (const employee of employees) {
          try {
            // 月情報を追加
            const employeeWithMonth = {
              ...employee,
              月: month
            };
            await this.employeeService.addEmployee(employeeWithMonth);
            successCount++;
            totalCount++;
            
            // 進捗を更新（100件ごと）
            if (totalCount % 100 === 0) {
              this.importResult = `インポート中... ${totalCount}件処理済み`;
            }
          } catch (error) {
            console.error('Error importing employee:', error);
            errorCount++;
            totalCount++;
          }
        }
      }

      this.importResult = `インポート完了: ${successCount}件成功, ${errorCount}件失敗 (合計: ${totalCount}件)`;
    } catch (error) {
      console.error('Import error:', error);
      this.importResult = `エラーが発生しました: ${error}`;
    } finally {
      this.isImporting = false;
    }
  }
}

