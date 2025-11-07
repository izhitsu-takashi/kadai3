import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import employeeData from '../../../../社員情報テストデータ_firestore用.json';

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
    }
    button {
      padding: 1rem 2rem;
      font-size: 1rem;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .result {
      margin-top: 1rem;
      padding: 1rem;
      background: #f0f0f0;
      border-radius: 6px;
    }
  `]
})
export class ImportComponent {
  isImporting = false;
  importResult = '';

  constructor(private firestore: Firestore) {}

  async importData() {
    this.isImporting = true;
    this.importResult = 'インポートを開始します...';

    try {
      const employees = employeeData as any[];
      let successCount = 0;
      let errorCount = 0;

      for (const employee of employees) {
        try {
          await addDoc(collection(this.firestore, 'employee'), employee);
          successCount++;
        } catch (error) {
          console.error('Error importing employee:', error);
          errorCount++;
        }
      }

      this.importResult = `インポート完了: ${successCount}件成功, ${errorCount}件失敗`;
    } catch (error) {
      console.error('Import error:', error);
      this.importResult = `エラーが発生しました: ${error}`;
    } finally {
      this.isImporting = false;
    }
  }
}

