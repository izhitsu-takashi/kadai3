import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EmployeeService, Employee } from '../../services/employee.service';
import { FirestoreService } from '../../services/firestore.service';
import { ImportComponent } from '../import/import.component';
import { Chart, registerables } from 'chart.js';
import { Firestore, collection, doc, setDoc, getDoc } from 'firebase/firestore';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ImportComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('personalBurdenChart', { static: false }) personalBurdenChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('companyBurdenChart', { static: false }) companyBurdenChartRef!: ElementRef<HTMLCanvasElement>;
  appName = 'Easy保険管理';
  selectedMenuId: string = 'insurance-list';
  menuItems = [
    { label: '保険料一覧', id: 'insurance-list' },
    { label: '書類作成', id: 'documents' },
    { label: '保険料レポート', id: 'reports' },
    { label: '設定', id: 'settings' }
  ];

  settingsSubMenus = [
    { label: '企業情報設定', id: 'company-settings' },
    { label: '健康保険設定', id: 'health-insurance-settings' },
    { label: '社員情報設定', id: 'employee-settings' },
    { label: '保険料率照会', id: 'insurance-rate-inquiry' }
  ];

  isSettingsExpanded: boolean = false;
  isLoggingOut: boolean = false;

  // 企業情報設定用
  companyInfo = {
    companyName: '',
    address: '',
    corporateNumber: '',
    officeNumber: ''
  };
  isCompanyInfoSaved: boolean = false;
  isCompanyInfoEditing: boolean = true;

  // 健康保険設定用
  healthInsuranceType: 'kyokai' | 'kumiai' = 'kyokai';
  prefecture: string = '';
  insuranceRate: number = 0;
  insuranceRateDisplay: string = '';
  insuranceRateError: string = '';
  isHealthInsuranceSaved: boolean = false;
  isHealthInsuranceEditing: boolean = true;

  prefectures = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
    '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
    '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
    '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
  ];

  employees: Employee[] = [];
  sortedEmployees: Employee[] = [];
  isLoading = false;
  
  sortColumn: string | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  // 月選択用
  availableMonths: string[] = [];
  selectedMonth: string = '';

  // レポート用
  reportEmployees: Employee[] = [];
  reportFilterType: 'month' | 'year' = 'month';
  reportSelectedMonth: string = '';
  reportSelectedYear: string = '';
  availableYears: string[] = [];
  personalBurdenTotal: number = 0;
  companyBurdenTotal: number = 0;
  personalHealthInsurance: number = 0;
  personalWelfarePension: number = 0;
  personalNursingInsurance: number = 0;
  companyHealthInsurance: number = 0;
  companyWelfarePension: number = 0;
  companyNursingInsurance: number = 0;
  personalBurdenChart: any = null;
  companyBurdenChart: any = null;

  columns = [
    { key: 'id', label: '社員ID', type: 'number', sortable: true },
    { key: 'name', label: '氏名', type: 'string', sortable: false },
    { key: 'standardSalary', label: '標準報酬月額', type: 'number', sortable: false },
    { key: 'grade', label: '等級', type: 'number', sortable: true },
    { key: 'healthInsurance', label: '健康保険料', type: 'number', sortable: false },
    { key: 'welfarePension', label: '厚生年金料', type: 'number', sortable: false },
    { key: 'nursingInsurance', label: '介護保険料', type: 'number', sortable: false },
    { key: 'personalBurden', label: '本人負担額', type: 'number', sortable: false },
    { key: 'companyBurden', label: '会社負担額', type: 'number', sortable: false }
  ];

  constructor(
    private employeeService: EmployeeService,
    private firestoreService: FirestoreService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // まずすべてのデータを読み込んで利用可能な月のリストを取得
    this.loadAvailableMonths();
    // その後、選択された月のデータを読み込む
    this.loadEmployees();
    // レポート用のデータも読み込む
    this.loadReportData();
    // 保存された設定情報を読み込む
    this.loadCompanyInfo();
    this.loadHealthInsuranceSettings();
  }

  ngAfterViewInit(): void {
    // ビューが初期化された後にチャートを描画
    setTimeout(() => {
      if (this.selectedMenuId === 'reports') {
        this.updateCharts();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    // チャートを破棄
    if (this.personalBurdenChart) {
      this.personalBurdenChart.destroy();
    }
    if (this.companyBurdenChart) {
      this.companyBurdenChart.destroy();
    }
  }

  loadAvailableMonths(): void {
    // すべてのデータを読み込んで利用可能な月のリストを取得
    this.employeeService.getEmployees().subscribe({
      next: (data) => {
        const monthsSet = new Set<string>();
        data.forEach(emp => {
          const month = emp.月 || emp.month;
          if (month) {
            monthsSet.add(month);
          }
        });
        this.availableMonths = Array.from(monthsSet).sort();
        
        // デフォルトで最初の月を選択（必ず月を選択する）
        if (this.availableMonths.length > 0 && !this.selectedMonth) {
          this.selectedMonth = this.availableMonths[0];
          // 選択された月のデータを読み込む
          this.loadEmployees();
        }
      },
      error: (error) => {
        console.error('Error loading available months:', error);
      }
    });
  }

  loadEmployees(): void {
    this.isLoading = true;
    // 必ず月を選択する必要がある
    if (!this.selectedMonth && this.availableMonths.length > 0) {
      this.selectedMonth = this.availableMonths[0];
    }
    this.employeeService.getEmployees(this.selectedMonth).subscribe({
      next: (data) => {
        this.employees = data;
        this.sortedEmployees = [...data];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading employees:', error);
        this.isLoading = false;
      }
    });
  }

  onMonthChange(month: string): void {
    this.selectedMonth = month;
    this.loadEmployees();
  }

  sortTable(columnKey: string): void {
    // ソート可能な列かどうかをチェック
    const column = this.columns.find(col => col.key === columnKey);
    if (!column || !column.sortable) {
      return;
    }

    if (this.sortColumn === columnKey) {
      // 同じ列をクリックした場合は昇順/降順を切り替え
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // 新しい列をクリックした場合は昇順でソート
      this.sortColumn = columnKey;
      this.sortDirection = 'asc';
    }

    this.sortedEmployees = [...this.employees].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (columnKey) {
        case 'id':
          aValue = this.getEmployeeId(a);
          bValue = this.getEmployeeId(b);
          break;
        case 'name':
          aValue = this.getEmployeeName(a);
          bValue = this.getEmployeeName(b);
          break;
        case 'standardSalary':
          aValue = this.getStandardSalary(a);
          bValue = this.getStandardSalary(b);
          break;
        case 'grade':
          aValue = this.getGrade(a);
          bValue = this.getGrade(b);
          break;
        case 'healthInsurance':
          aValue = this.getHealthInsurance(a);
          bValue = this.getHealthInsurance(b);
          break;
        case 'welfarePension':
          aValue = this.getWelfarePension(a);
          bValue = this.getWelfarePension(b);
          break;
        case 'nursingInsurance':
          aValue = this.getNursingInsurance(a);
          bValue = this.getNursingInsurance(b);
          break;
        case 'personalBurden':
          aValue = this.getPersonalBurden(a);
          bValue = this.getPersonalBurden(b);
          break;
        case 'companyBurden':
          aValue = this.getCompanyBurden(a);
          bValue = this.getCompanyBurden(b);
          break;
        default:
          return 0;
      }

      // 数値の場合は数値として比較
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return this.sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // 文字列の場合は文字列として比較
      const aStr = String(aValue || '');
      const bStr = String(bValue || '');
      if (this.sortDirection === 'asc') {
        return aStr.localeCompare(bStr, 'ja');
      } else {
        return bStr.localeCompare(aStr, 'ja');
      }
    });
  }

  getSortIcon(columnKey: string): string {
    const column = this.columns.find(col => col.key === columnKey);
    if (!column || !column.sortable) {
      return ''; // ソート不可の列はアイコンを表示しない
    }
    if (this.sortColumn !== columnKey) {
      return '↕️'; // ソートなし
    }
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  isSortable(columnKey: string): boolean {
    const column = this.columns.find(col => col.key === columnKey);
    return column ? column.sortable : false;
  }

  selectMenu(menuId: string): void {
    if (menuId === 'settings') {
      // 設定ボタンをクリックした場合は、展開/折りたたみを切り替え
      this.isSettingsExpanded = !this.isSettingsExpanded;
      // 設定ページには遷移しない（サブメニューを表示するだけ）
    } else {
      // その他のメニューをクリックした場合は通常通り遷移
      this.selectedMenuId = menuId;
      this.isSettingsExpanded = false;
      
      // レポートページに切り替えた場合はチャートを更新
      if (menuId === 'reports') {
        setTimeout(() => {
          this.updateCharts();
        }, 100);
      }
    }
  }

  selectSettingsSubMenu(subMenuId: string): void {
    // サブメニューをクリックした場合は、そのページに遷移
    this.selectedMenuId = subMenuId;
  }

  isSettingsSubMenuSelected(subMenuId: string): boolean {
    return this.selectedMenuId === subMenuId;
  }

  isSettingsSubMenuActive(): boolean {
    return this.settingsSubMenus.some(subMenu => subMenu.id === this.selectedMenuId);
  }

  getSelectedMenuLabel(): string {
    const selectedItem = this.menuItems.find(item => item.id === this.selectedMenuId);
    return selectedItem ? selectedItem.label : '';
  }

  getSettingsSubMenuLabel(): string {
    const selectedSubMenu = this.settingsSubMenus.find(subMenu => subMenu.id === this.selectedMenuId);
    return selectedSubMenu ? selectedSubMenu.label : '';
  }

  // データアクセサー（日本語キーと英語キーの両方に対応）
  getEmployeeId(employee: Employee): number | string {
    return employee.ID ?? employee.id ?? '';
  }

  getEmployeeName(employee: Employee): string {
    return employee.氏名 ?? employee.name ?? '';
  }

  getStandardSalary(employee: Employee): number {
    return employee.標準報酬月額 ?? employee.standardSalary ?? 0;
  }

  getGrade(employee: Employee): number {
    return employee.等級 ?? employee.grade ?? 0;
  }

  getHealthInsurance(employee: Employee): number {
    // 組合保険が選択されている場合、設定された保険料率を使用して計算
    if (this.healthInsuranceType === 'kumiai' && this.insuranceRate > 0) {
      const standardSalary = this.getStandardSalary(employee);
      // 保険料率はパーセンテージなので、100で割ってから標準報酬月額を掛ける
      return Math.round(standardSalary * (this.insuranceRate / 100));
    }
    // 協会けんぽの場合、または組合保険の設定がない場合は既存のデータを使用
    return employee.健康保険料 ?? employee.healthInsurance ?? 0;
  }

  getWelfarePension(employee: Employee): number {
    return employee.厚生年金保険料 ?? employee.welfarePension ?? 0;
  }

  getNursingInsurance(employee: Employee): number {
    return employee.介護保険料 ?? employee.nursingInsurance ?? 0;
  }

  getPersonalBurden(employee: Employee): number {
    return employee.本人負担額 ?? employee.personalBurden ?? 0;
  }

  getCompanyBurden(employee: Employee): number {
    return employee.会社負担額 ?? employee.companyBurden ?? 0;
  }

  // レポート関連のメソッド
  loadReportData(): void {
    this.employeeService.getEmployees().subscribe({
      next: (data) => {
        this.reportEmployees = data;
        
        // 利用可能な年を取得
        const yearsSet = new Set<string>();
        data.forEach(emp => {
          const month = emp.月 || emp.month;
          if (month) {
            // "2025年04月" から "2025" を抽出
            const yearMatch = month.match(/^(\d{4})年/);
            if (yearMatch) {
              yearsSet.add(yearMatch[1]);
            }
          }
        });
        this.availableYears = Array.from(yearsSet).sort();
        
        // デフォルトで最初の月を選択
        if (this.availableMonths.length > 0 && !this.reportSelectedMonth) {
          this.reportSelectedMonth = this.availableMonths[0];
        }
        
        // デフォルトで最初の年を選択
        if (this.availableYears.length > 0 && !this.reportSelectedYear) {
          this.reportSelectedYear = this.availableYears[0];
        }
        
        this.calculateReportTotals();
      },
      error: (error) => {
        console.error('Error loading report data:', error);
      }
    });
  }

  onReportFilterTypeChange(type: 'month' | 'year'): void {
    this.reportFilterType = type;
    this.calculateReportTotals();
    setTimeout(() => {
      this.updateCharts();
    }, 100);
  }

  onReportMonthChange(month: string): void {
    this.reportSelectedMonth = month;
    this.calculateReportTotals();
    setTimeout(() => {
      this.updateCharts();
    }, 100);
  }

  onReportYearChange(year: string): void {
    this.reportSelectedYear = year;
    this.calculateReportTotals();
    setTimeout(() => {
      this.updateCharts();
    }, 100);
  }

  calculateReportTotals(): void {
    let filteredEmployees: Employee[] = [];
    
    if (this.reportFilterType === 'month') {
      // 月単位でフィルタリング
      filteredEmployees = this.reportEmployees.filter(emp => {
        const month = emp.月 || emp.month;
        return month === this.reportSelectedMonth;
      });
    } else {
      // 年単位でフィルタリング
      filteredEmployees = this.reportEmployees.filter(emp => {
        const month = emp.月 || emp.month;
        if (month) {
          const yearMatch = month.match(/^(\d{4})年/);
          if (yearMatch) {
            return yearMatch[1] === this.reportSelectedYear;
          }
        }
        return false;
      });
    }
    
    // 社員負担額の合計を計算（各項目別）
    this.personalHealthInsurance = filteredEmployees.reduce((sum, emp) => {
      return sum + (this.getHealthInsurance(emp) / 2); // 本人負担は半額
    }, 0);
    
    this.personalWelfarePension = filteredEmployees.reduce((sum, emp) => {
      return sum + (this.getWelfarePension(emp) / 2); // 本人負担は半額
    }, 0);
    
    this.personalNursingInsurance = filteredEmployees.reduce((sum, emp) => {
      return sum + (this.getNursingInsurance(emp) / 2); // 本人負担は半額
    }, 0);
    
    this.personalBurdenTotal = this.personalHealthInsurance + this.personalWelfarePension + this.personalNursingInsurance;
    
    // 会社負担額の合計を計算（各項目別）
    this.companyHealthInsurance = filteredEmployees.reduce((sum, emp) => {
      return sum + (this.getHealthInsurance(emp) / 2); // 会社負担は半額
    }, 0);
    
    this.companyWelfarePension = filteredEmployees.reduce((sum, emp) => {
      return sum + (this.getWelfarePension(emp) / 2); // 会社負担は半額
    }, 0);
    
    this.companyNursingInsurance = filteredEmployees.reduce((sum, emp) => {
      return sum + (this.getNursingInsurance(emp) / 2); // 会社負担は半額
    }, 0);
    
    this.companyBurdenTotal = this.companyHealthInsurance + this.companyWelfarePension + this.companyNursingInsurance;
  }

  updateCharts(): void {
    if (!this.personalBurdenChartRef || !this.companyBurdenChartRef) {
      return;
    }

    // 既存のチャートを破棄
    if (this.personalBurdenChart) {
      this.personalBurdenChart.destroy();
    }
    if (this.companyBurdenChart) {
      this.companyBurdenChart.destroy();
    }

    // 社員負担額の円グラフ（健康保険料、厚生年金保険料、介護保険料の3項目）
    const personalCtx = this.personalBurdenChartRef.nativeElement.getContext('2d');
    if (personalCtx) {
      this.personalBurdenChart = new Chart(personalCtx, {
        type: 'pie',
        data: {
          labels: ['健康保険料', '厚生年金保険料', '介護保険料'],
          datasets: [{
            data: [
              this.personalHealthInsurance,
              this.personalWelfarePension,
              this.personalNursingInsurance
            ],
            backgroundColor: [
              '#90EE90', // 薄い緑
              '#FFB6C1', // 薄い赤
              '#87CEEB'  // 水色
            ],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                padding: 15,
                font: {
                  size: 12
                }
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                  return `${label}: ${value.toLocaleString()}円 (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }

    // 会社負担額の円グラフ（健康保険料、厚生年金保険料、介護保険料の3項目）
    const companyCtx = this.companyBurdenChartRef.nativeElement.getContext('2d');
    if (companyCtx) {
      this.companyBurdenChart = new Chart(companyCtx, {
        type: 'pie',
        data: {
          labels: ['健康保険料', '厚生年金保険料', '介護保険料'],
          datasets: [{
            data: [
              this.companyHealthInsurance,
              this.companyWelfarePension,
              this.companyNursingInsurance
            ],
            backgroundColor: [
              '#90EE90', // 薄い緑
              '#FFB6C1', // 薄い赤
              '#87CEEB'  // 水色
            ],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                padding: 15,
                font: {
                  size: 12
                }
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                  return `${label}: ${value.toLocaleString()}円 (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
  }

  onLogout(): void {
    this.isLoggingOut = true;
    // 少し遅延を入れてログアウト中の表示を見せる
    setTimeout(() => {
      this.router.navigateByUrl('/login');
    }, 500);
  }

  async loadCompanyInfo(): Promise<void> {
    const db = this.firestoreService.getFirestore();
    if (!db) {
      return;
    }

    try {
      const docRef = doc(db, 'companyInfo', 'settings');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        this.companyInfo = {
          companyName: data['companyName'] || '',
          address: data['address'] || '',
          corporateNumber: data['corporateNumber'] || '',
          officeNumber: data['officeNumber'] || ''
        };
        // データが存在する場合は保存済み状態にする
        if (this.companyInfo.companyName || this.companyInfo.address || 
            this.companyInfo.corporateNumber || this.companyInfo.officeNumber) {
          this.isCompanyInfoSaved = true;
          this.isCompanyInfoEditing = false;
        }
      }
    } catch (error) {
      console.error('Error loading company info:', error);
    }
  }

  async onCompanyInfoSubmit(): Promise<void> {
    const db = this.firestoreService.getFirestore();
    if (!db) {
      alert('Firestoreが初期化されていません');
      return;
    }

    try {
      // Firestoreに保存
      const docRef = doc(db, 'companyInfo', 'settings');
      await setDoc(docRef, {
        companyName: this.companyInfo.companyName,
        address: this.companyInfo.address,
        corporateNumber: this.companyInfo.corporateNumber,
        officeNumber: this.companyInfo.officeNumber,
        updatedAt: new Date()
      }, { merge: true });

      // 保存完了の状態に変更
      this.isCompanyInfoSaved = true;
      this.isCompanyInfoEditing = false;
      
      // アラートで保存完了を通知
      alert('保存しました');
    } catch (error) {
      console.error('Error saving company info:', error);
      alert('保存に失敗しました');
    }
  }

  onEditCompanyInfo(): void {
    // 編集モードに切り替え
    this.isCompanyInfoEditing = true;
    this.isCompanyInfoSaved = false;
  }

  // 健康保険設定関連のメソッド
  onHealthInsuranceTypeChange(type: 'kyokai' | 'kumiai'): void {
    this.healthInsuranceType = type;
    // 種別変更時に値をリセット
    if (type === 'kyokai') {
      this.insuranceRate = 0;
    } else {
      this.prefecture = '';
    }
  }

  async loadHealthInsuranceSettings(): Promise<void> {
    const db = this.firestoreService.getFirestore();
    if (!db) {
      return;
    }

    try {
      const docRef = doc(db, 'healthInsuranceSettings', 'settings');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        this.healthInsuranceType = data['type'] || 'kyokai';
        this.prefecture = data['prefecture'] || '';
        this.insuranceRate = data['insuranceRate'] || 0;
        this.insuranceRateDisplay = this.insuranceRate > 0 ? this.insuranceRate.toString() : '';
        
        // データが存在する場合は保存済み状態にする
        if ((this.healthInsuranceType === 'kyokai' && this.prefecture) ||
            (this.healthInsuranceType === 'kumiai' && this.insuranceRate > 0)) {
          this.isHealthInsuranceSaved = true;
          this.isHealthInsuranceEditing = false;
        }
        
        // 健康保険設定が読み込まれた後、データを再計算する
        // 組合保険の場合、保険料率が変更されている可能性があるため
        if (this.healthInsuranceType === 'kumiai' && this.insuranceRate > 0) {
          // テーブルデータを再読み込み（表示を更新）
          this.loadEmployees();
          // レポートデータも再計算
          this.loadReportData();
        }
      }
    } catch (error) {
      console.error('Error loading health insurance settings:', error);
    }
  }

  async onHealthInsuranceSubmit(): Promise<void> {
    // バリデーション
    if (this.healthInsuranceType === 'kumiai') {
      // 保険料率のバリデーション
      if (this.insuranceRate === null || this.insuranceRate === undefined || isNaN(this.insuranceRate)) {
        alert('保険料率を正しく入力してください');
        return;
      }
      
      // 範囲チェック
      if (this.insuranceRate < 0 || this.insuranceRate > 100) {
        alert('保険料率は0〜100の範囲で入力してください');
        return;
      }
    }

    if (this.healthInsuranceType === 'kyokai' && !this.prefecture) {
      alert('都道府県を選択してください');
      return;
    }
    
    const db = this.firestoreService.getFirestore();
    if (!db) {
      alert('Firestoreが初期化されていません');
      return;
    }

    try {
      // Firestoreに保存
      const docRef = doc(db, 'healthInsuranceSettings', 'settings');
      await setDoc(docRef, {
        type: this.healthInsuranceType,
        prefecture: this.prefecture,
        insuranceRate: this.insuranceRate,
        updatedAt: new Date()
      }, { merge: true });

      // 保存完了の状態に変更
      this.isHealthInsuranceSaved = true;
      this.isHealthInsuranceEditing = false;
      
      // 組合保険の場合、保険料率が変更されたのでデータを再計算
      if (this.healthInsuranceType === 'kumiai' && this.insuranceRate > 0) {
        // テーブルデータを再読み込み（表示を更新）
        this.loadEmployees();
        // レポートデータも再計算
        this.loadReportData();
      }
      
      // アラートで保存完了を通知
      alert('保存しました');
    } catch (error) {
      console.error('Error saving health insurance settings:', error);
      alert('保存に失敗しました');
    }
  }

  onInsuranceRateInput(event: any): void {
    // エラーメッセージをクリア
    this.insuranceRateError = '';
    
    // 入力値を取得
    let value = event.target.value;
    
    // 空の場合は0に設定して終了
    if (value === '' || value === null || value === undefined) {
      this.insuranceRate = 0;
      this.insuranceRateDisplay = '';
      return;
    }
    
    // %記号を削除（ユーザーが入力した場合）
    value = value.replace(/%/g, '');
    
    // 数字と小数点以外の文字が含まれているかチェック
    if (!/^[0-9.]*$/.test(value)) {
      this.insuranceRateError = '数字と小数点のみ入力できます';
      event.target.value = this.insuranceRateDisplay;
      return;
    }
    
    // 複数の小数点を1つに統一
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // 先頭の0を削除（ただし、0.XXの形式は許可）
    if (value.length > 1 && value[0] === '0' && value[1] !== '.') {
      value = value.replace(/^0+/, '');
      if (value === '' || value === '.') {
        value = '0';
      }
    }
    
    // 数値に変換
    const numValue = parseFloat(value);
    
    // 負の数のチェック
    if (value.includes('-')) {
      this.insuranceRateError = '負の数は入力できません';
      event.target.value = this.insuranceRateDisplay;
      return;
    }
    
    // 有効な数値の場合のみ更新
    if (!isNaN(numValue)) {
      // 100を超える場合は100に制限
      if (numValue > 100) {
        this.insuranceRate = 100;
        this.insuranceRateDisplay = '100';
        event.target.value = '100';
      } else {
        this.insuranceRate = numValue;
        // 小数点以下2桁まで表示
        if (value.includes('.')) {
          const decimalParts = value.split('.');
          if (decimalParts[1] && decimalParts[1].length > 2) {
            value = numValue.toFixed(2);
          }
        }
        this.insuranceRateDisplay = value;
        event.target.value = value;
      }
    } else if (value !== '' && value !== '.') {
      // 無効な値の場合
      this.insuranceRateError = '正しい数値を入力してください';
      event.target.value = this.insuranceRateDisplay;
    } else {
      this.insuranceRateDisplay = value;
    }
  }

  onInsuranceRateBlur(): void {
    // エラーメッセージをクリア
    this.insuranceRateError = '';
    
    // フォーカスが外れた時に値を正規化
    if (this.insuranceRate !== null && this.insuranceRate !== undefined && !isNaN(this.insuranceRate)) {
      // 小数点以下2桁に統一
      this.insuranceRate = parseFloat(this.insuranceRate.toFixed(2));
      this.insuranceRateDisplay = this.insuranceRate.toString();
    } else if (this.insuranceRateDisplay === '' || this.insuranceRateDisplay === '.') {
      this.insuranceRate = 0;
      this.insuranceRateDisplay = '';
    }
  }

  onEditHealthInsurance(): void {
    // 編集モードに切り替え
    this.isHealthInsuranceEditing = true;
    this.isHealthInsuranceSaved = false;
  }
}
