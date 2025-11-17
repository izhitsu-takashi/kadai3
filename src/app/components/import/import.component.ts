import { Component, ChangeDetectorRef, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FirestoreService } from '../../services/firestore.service';
import { EmployeeService } from '../../services/employee.service';

export interface InsuranceExemption {
  id?: string;
  employeeId: number | string;
  employeeName?: string; // 社員氏名（表示用）
  startMonth: string; // "YYYY年MM月"形式
  endMonth: string; // "YYYY年MM月"形式
  reason: '育休' | '産休' | 'その他';
  otherReason?: string; // その他の場合の理由
  createdAt?: Date;
}

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="import-container">
      <h2>{{ showOnlyExemption ? '保険料免除設定' : '社員情報設定' }}</h2>
      <div *ngIf="!showOnlyExemption" class="import-section">
        <h3>社員データインポート</h3>
        <p class="description">給与データと賞与データをFirebaseにインポートします。</p>
        <button (click)="importData()" [disabled]="isImporting" class="import-button">
          {{ isImporting ? 'インポート中...' : '社員データインポート' }}
        </button>
        <div *ngIf="importResult" class="result" [class.success]="importSuccess" [class.error]="!importSuccess">
          <p>{{ importResult }}</p>
        </div>
      </div>
      
      <div *ngIf="showOnlyExemption" class="import-section">
        <p class="description">社員の保険料免除期間を設定します。設定した期間中は、該当社員の社会保険料が0円になります。</p>
        
        <form (ngSubmit)="addExemption()" class="exemption-form">
          <div class="form-group">
            <label for="employeeId" class="form-label">社員ID</label>
            <input 
              type="text" 
              id="employeeId" 
              class="form-input"
              [(ngModel)]="newExemption.employeeId"
              name="employeeId"
              (ngModelChange)="onEmployeeIdChange($event)"
              (input)="onEmployeeIdInput()"
              placeholder="社員IDを入力"
              required>
            <div *ngIf="employeePreview" class="employee-preview">
              {{ employeePreview }}
            </div>
          </div>
          
          <div class="form-group">
            <label for="startMonth" class="form-label">開始月</label>
            <input 
              type="month" 
              id="startMonth" 
              class="form-input"
              [(ngModel)]="startMonthInput"
              name="startMonth"
              (change)="onStartMonthChange()"
              required>
          </div>
          
          <div class="form-group">
            <label for="endMonth" class="form-label">終了月</label>
            <input 
              type="month" 
              id="endMonth" 
              class="form-input"
              [(ngModel)]="endMonthInput"
              name="endMonth"
              (change)="onEndMonthChange()"
              required>
          </div>
          
          <div class="form-group">
            <label for="reason" class="form-label">理由</label>
            <select 
              id="reason" 
              class="form-input"
              [(ngModel)]="newExemption.reason"
              name="reason"
              required>
              <option value="育休">育休</option>
              <option value="産休">産休</option>
              <option value="その他">その他</option>
            </select>
          </div>
          
          <div class="form-group" *ngIf="newExemption.reason === 'その他'">
            <label for="otherReason" class="form-label">その他の理由</label>
            <input 
              type="text" 
              id="otherReason" 
              class="form-input"
              [(ngModel)]="newExemption.otherReason"
              name="otherReason"
              placeholder="理由を入力">
          </div>
          
          <div class="form-actions">
            <button type="submit" class="submit-button" [disabled]="isSavingExemption">
              {{ isSavingExemption ? '保存中...' : '追加' }}
            </button>
          </div>
        </form>
        
        <div *ngIf="exemptionResult" class="result" [class.success]="exemptionSuccess" [class.error]="!exemptionSuccess">
          <p>{{ exemptionResult }}</p>
        </div>
        
        <div class="exemption-list" *ngIf="showOnlyExemption && exemptions.length > 0">
          <h4>設定済みの免除一覧</h4>
          <table class="exemption-table">
            <thead>
              <tr>
                <th>社員ID</th>
                <th>氏名</th>
                <th>開始月</th>
                <th>終了月</th>
                <th>理由</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let exemption of exemptions">
                <td>{{ exemption.employeeId }}</td>
                <td>{{ exemption.employeeName || '（取得中...）' }}</td>
                <td>{{ exemption.startMonth }}</td>
                <td>{{ exemption.endMonth }}</td>
                <td>{{ exemption.reason }}{{ exemption.otherReason ? '（' + exemption.otherReason + '）' : '' }}</td>
                <td>
                  <button (click)="deleteExemption(exemption.id!)" class="delete-button">削除</button>
                </td>
              </tr>
            </tbody>
          </table>
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
    .exemption-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .form-label {
      font-size: 0.95rem;
      font-weight: 600;
      color: #2d3748;
    }
    .form-input {
      padding: 0.75rem 1rem;
      font-size: 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 6px;
      background: white;
      color: #2d3748;
      transition: all 0.2s ease;
    }
    .form-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }
    .submit-button {
      padding: 0.75rem 2rem;
      font-size: 1rem;
      font-weight: 600;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .submit-button:hover:not(:disabled) {
      background: #5568d3;
    }
    .submit-button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .exemption-list {
      margin-top: 2rem;
    }
    .exemption-list h4 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: #2d3748;
    }
    .exemption-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .exemption-table thead {
      background: #f7fafc;
    }
    .exemption-table th {
      padding: 0.75rem 1rem;
      text-align: left;
      font-weight: 600;
      color: #2d3748;
      border-bottom: 2px solid #e2e8f0;
    }
    .exemption-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e2e8f0;
      color: #4a5568;
    }
    .exemption-table tbody tr:hover {
      background: #f7fafc;
    }
    .delete-button {
      padding: 0.5rem 1rem;
      font-size: 0.9rem;
      font-weight: 500;
      background: #f56565;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .delete-button:hover {
      background: #e53e3e;
    }
    .employee-preview {
      margin-top: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      font-size: 0.9rem;
      color: #4a5568;
    }
  `]
})
export class ImportComponent implements OnInit {
  @Input() showOnlyExemption: boolean = false; // 保険料免除設定のみを表示するかどうか
  
  isImporting = false;
  importResult = '';
  importSuccess = false;
  
  // 保険料免除設定用
  newExemption: InsuranceExemption = {
    employeeId: '',
    startMonth: '',
    endMonth: '',
    reason: '育休'
  };
  startMonthInput = '';
  endMonthInput = '';
  exemptions: InsuranceExemption[] = [];
  isSavingExemption = false;
  exemptionResult = '';
  exemptionSuccess = false;
  employeePreview = ''; // 社員IDプレビュー

  constructor(
    private firestoreService: FirestoreService,
    private employeeService: EmployeeService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    // 保険料免除設定ページの場合のみ、免除設定を読み込む
    // showOnlyExemptionは@Inputなので、ngOnInitでチェックする必要がある
  }
  
  ngOnInit(): void {
    // 保険料免除設定ページの場合のみ、免除設定を読み込む
    if (this.showOnlyExemption) {
      this.loadExemptions();
    }
  }
  
  onStartMonthChange(): void {
    if (this.startMonthInput) {
      // "YYYY-MM"形式を"YYYY年MM月"形式に変換
      const [year, month] = this.startMonthInput.split('-');
      this.newExemption.startMonth = `${year}年${month.padStart(2, '0')}月`;
    }
  }
  
  onEndMonthChange(): void {
    if (this.endMonthInput) {
      // "YYYY-MM"形式を"YYYY年MM月"形式に変換
      const [year, month] = this.endMonthInput.split('-');
      this.newExemption.endMonth = `${year}年${month.padStart(2, '0')}月`;
    }
  }
  
  onEmployeeIdChange(value: any): void {
    // ngModelChangeで値が変更された時にプレビューを更新
    const employeeId = value;
    if (!employeeId || String(employeeId).trim() === '') {
      this.employeePreview = '';
      return;
    }
    this.searchEmployee(employeeId);
  }
  
  onEmployeeIdInput(): void {
    // inputイベントでも検索（リアルタイム検索用）
    const employeeId = this.newExemption.employeeId;
    if (!employeeId || String(employeeId).trim() === '') {
      this.employeePreview = '';
      return;
    }
    this.searchEmployee(employeeId);
  }
  
  private searchEmployee(employeeId: any): void {
    // 社員IDで検索
    this.employeeService.getEmployees().subscribe({
      next: (data) => {
        // 現在の入力値を再確認（削除された可能性があるため）
        const currentId = this.newExemption.employeeId;
        if (!currentId || String(currentId).trim() === '') {
          this.employeePreview = '';
          return;
        }
        
        // 社員IDでフィルタリング（IDフィールドまたはIDプロパティで検索）
        const employeeIdStr = String(currentId).trim();
        const found = data.find(emp => {
          const empId = String(emp.ID ?? emp.id ?? '').trim();
          return empId === employeeIdStr;
        });
        
        if (found) {
          const name = found.氏名 ?? found.name ?? '';
          this.employeePreview = `${employeeIdStr}　${name}`;
        } else {
          this.employeePreview = `${employeeIdStr}　（該当する社員が見つかりません）`;
        }
      },
      error: (error) => {
        console.error('Error searching employee:', error);
        this.employeePreview = '';
      }
    });
  }
  
  async addExemption(): Promise<void> {
    if (!this.newExemption.employeeId || !this.newExemption.startMonth || !this.newExemption.endMonth) {
      this.exemptionResult = 'すべての項目を入力してください。';
      this.exemptionSuccess = false;
      return;
    }
    
    // 開始月と終了月の妥当性チェック
    const startNum = this.monthToNumber(this.newExemption.startMonth);
    const endNum = this.monthToNumber(this.newExemption.endMonth);
    if (startNum > endNum) {
      this.exemptionResult = '開始月は終了月より前である必要があります。';
      this.exemptionSuccess = false;
      return;
    }
    
    // 期間の重複チェック（同じ社員IDで期間が重複していないか）
    const employeeIdStr = String(this.newExemption.employeeId);
    for (const exemption of this.exemptions) {
      if (String(exemption.employeeId) === employeeIdStr) {
        const existingStartNum = this.monthToNumber(exemption.startMonth);
        const existingEndNum = this.monthToNumber(exemption.endMonth);
        
        // 期間が重複しているかチェック
        // 新しい期間が既存の期間と重複している場合
        if ((startNum >= existingStartNum && startNum <= existingEndNum) ||
            (endNum >= existingStartNum && endNum <= existingEndNum) ||
            (startNum <= existingStartNum && endNum >= existingEndNum)) {
          this.exemptionResult = `この社員ID（${employeeIdStr}）は、${exemption.startMonth}から${exemption.endMonth}の期間で既に設定されています。期間が重複しています。`;
          this.exemptionSuccess = false;
          return;
        }
      }
    }
    
    this.isSavingExemption = true;
    this.exemptionResult = '保存中...';
    this.exemptionSuccess = false;
    
    try {
      const firestore = this.firestoreService.getFirestore();
      if (!firestore) {
        this.exemptionResult = 'エラー: Firestoreが初期化されていません。';
        this.isSavingExemption = false;
        return;
      }
      
      const { collection, addDoc } = await import('firebase/firestore');
      const exemptionData = {
        ...this.newExemption,
        createdAt: new Date()
      };
      await addDoc(collection(firestore, 'insuranceExemptions'), exemptionData);
      
      this.exemptionResult = '保険料免除設定を追加しました。';
      this.exemptionSuccess = true;
      
      // フォームをリセット
      this.newExemption = {
        employeeId: '',
        startMonth: '',
        endMonth: '',
        reason: '育休'
      };
      this.startMonthInput = '';
      this.endMonthInput = '';
      this.employeePreview = '';
      
      // 一覧を再読み込み
      await this.loadExemptions();
      
      // ページをリロードして保険料を再計算
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Error adding exemption:', error);
      this.exemptionResult = `エラーが発生しました: ${error.message || error}`;
      this.exemptionSuccess = false;
    } finally {
      this.isSavingExemption = false;
    }
  }
  
  async loadExemptions(): Promise<void> {
    const firestore = this.firestoreService.getFirestore();
    if (!firestore) return;
    
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const exemptionsRef = collection(firestore, 'insuranceExemptions');
      const querySnapshot = await getDocs(exemptionsRef);
      
      this.exemptions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as InsuranceExemption));
      
      // 社員データを取得して氏名をマッピング（同期的に処理）
      try {
        const employees = await firstValueFrom(this.employeeService.getEmployees());
        
        // 社員IDでマップを作成（重複を避けるため、型を統一して比較）
        const employeeMap = new Map<string, string>();
        employees.forEach(emp => {
          const empId = emp.ID ?? emp.id;
          if (empId !== undefined && empId !== null) {
            const empIdStr = String(empId);
            const name = emp.氏名 ?? emp.name ?? '';
            if (!employeeMap.has(empIdStr)) {
              employeeMap.set(empIdStr, name);
            }
          }
        });
        
        // 免除設定に氏名を追加（型を統一して比較）
        this.exemptions.forEach(exemption => {
          const empIdStr = String(exemption.employeeId);
          exemption.employeeName = employeeMap.get(empIdStr) || '';
        });
      } catch (error) {
        console.error('Error loading employees for exemptions:', error);
      }
      
      // 開始月でソート
      this.exemptions.sort((a, b) => {
        const aNum = this.monthToNumber(a.startMonth);
        const bNum = this.monthToNumber(b.startMonth);
        return aNum - bNum;
      });
      
      // 変更検知をトリガー
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading exemptions:', error);
    }
  }
  
  async deleteExemption(id: string): Promise<void> {
    if (!confirm('この保険料免除設定を削除しますか？')) {
      return;
    }
    
    try {
      const firestore = this.firestoreService.getFirestore();
      if (!firestore) return;
      
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(firestore, 'insuranceExemptions', id));
      
      this.exemptionResult = '保険料免除設定を削除しました。';
      this.exemptionSuccess = true;
      
      // 一覧を再読み込み
      await this.loadExemptions();
      
      // ページをリロードして保険料を再計算
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Error deleting exemption:', error);
      this.exemptionResult = `エラーが発生しました: ${error.message || error}`;
      this.exemptionSuccess = false;
    }
  }
  
  private monthToNumber(month: string): number {
    // "YYYY年MM月"形式を数値に変換（例: "2025年11月" -> 202511）
    const match = month.match(/(\d{4})年(\d{1,2})月/);
    if (!match) return 0;
    const year = parseInt(match[1], 10);
    const monthNum = parseInt(match[2], 10);
    return year * 100 + monthNum;
  }

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

