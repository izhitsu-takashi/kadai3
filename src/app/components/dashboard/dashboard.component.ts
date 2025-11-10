import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EmployeeService, Employee, Bonus } from '../../services/employee.service';
import { FirestoreService } from '../../services/firestore.service';
import { ImportComponent } from '../import/import.component';
import { Chart, registerables } from 'chart.js';
import { Firestore, collection, doc, setDoc, getDoc, getDocs } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

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
    { label: '保険料率照会', id: 'insurance-rate-inquiry' },
    { label: 'チュートリアル', id: 'tutorial' }
  ];

  isSettingsExpanded: boolean = false;
  isLoggingOut: boolean = false;

  // チュートリアル用
  isTutorialMode: boolean = false;
  currentTutorialStep: number = 0;
  tutorialSteps = [
    {
      menuId: 'insurance-list',
      title: '保険料一覧ページ',
      description: '社員ごとの社会保険料を一覧表示するページです。賞与にも対応しており、部署ごとにフィルターの設定なども行えます。'
    },
    {
      menuId: 'documents',
      title: '書類作成ページ',
      description: '社会保険料を管理できる書類を自動で作成します。作成した書類はPDFにてダウンロードが可能です。'
    },
    {
      menuId: 'reports',
      title: '保険料レポートページ',
      description: '指定した期間の社会保険料の合計額を確認できます。給与、賞与に対応しており、社員と会社の負担額が別々に表示されています。'
    },
    {
      menuId: 'company-settings',
      title: '企業情報設定ページ',
      description: '企業情報設定ページでは、会社の情報を入力して保存します。この情報は書類作成機能にて使用します。'
    },
    {
      menuId: 'health-insurance-settings',
      title: '健康保険設定ページ',
      description: '健康保険設定ページでは、健康保険料率の設定を行います。協会けんぽと組合保険をすぐに切り替え可能です。協会けんぽの際は自動で保険料率を決定し、組合保険の場合は自分で保険料率を設定できます。'
    },
    {
      menuId: 'employee-settings',
      title: '社員情報設定ページ',
      description: '社員情報設定ページでは、既存の人事給与システムから社員データをインポートし、自動で保険料一覧テーブルを作成できます。'
    },
    {
      menuId: 'insurance-rate-inquiry',
      title: '保険料率照会ページ',
      description: '保険料率照会ページでは、現在設定されている保険料率を表示します。'
    }
  ];

  // モーダル用
  isModalOpen: boolean = false;
  selectedEmployee: Employee | Bonus | null = null;

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
  healthInsuranceReduction: number = 0; // 保険料引き下げ額
  healthInsuranceReductionDisplay: string = ''; // 表示用
  healthInsuranceReductionError: string = ''; // エラーメッセージ
  isHealthInsuranceSaved: boolean = false;
  isHealthInsuranceEditing: boolean = true;
  
  // 協会けんぽの都道府県別保険料率
  kenpoRates: { [key: string]: { healthRate: number; careRate: number } } = {};
  
  // 保険料率設定（厚生年金、介護保険）
  welfarePensionRate: number = 18.3; // デフォルト値
  nursingInsuranceRate: number = 1.59; // デフォルト値

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
  bonuses: Bonus[] = [];
  sortedEmployees: Employee[] = [];
  sortedBonuses: Bonus[] = [];
  isLoading = false;
  
  // 給与/賞与の切り替え
  tableType: 'salary' | 'bonus' = 'salary';
  
  sortColumn: string | null = 'id'; // デフォルトで社員IDでソート
  sortDirection: 'asc' | 'desc' = 'asc';

  // 月選択用
  availableMonths: string[] = [];
  availableBonusMonths: string[] = [];
  selectedMonth: string = '';

  // フィルター用
  filterDepartment: string = '';
  filterEmploymentType: string = '';
  filterNursingInsurance: string = ''; // 'all', 'with', 'without'
  availableDepartments: string[] = [];
  availableEmploymentTypes: string[] = [];

  // 書類作成用
  documentTypes = [
    { id: 'document1', label: '社会保険料控除一覧表' },
    { id: 'document2', label: '標準報酬月額一覧' },
    { id: 'document3', label: '標準賞与額一覧' },
    { id: 'document4', label: '月次給与レポート' },
    { id: 'document5', label: '月次賞与レポート' },
  ];
  selectedDocumentType: string = 'document1';
  documentCreationMode: 'bulk' | 'individual' = 'bulk';
  
  // 一括作成用フィルター
  bulkFilterType: 'all' | 'department' | 'nursing' | 'custom' = 'all';
  bulkFilterDepartment: string = '';
  bulkFilterNursingInsurance: 'all' | 'with' | 'without' = 'all';
  bulkSelectedEmployees: Employee[] = [];
  bulkAvailableEmployees: Employee[] = [];
  bulkSearchTerm: string = '';
  
  // 個別作成用
  individualSearchTerm: string = '';
  individualSearchResults: Employee[] = [];
  individualSelectedEmployee: Employee | null = null;

  // 書類作成用の期間選択
  documentPeriodType: 'month' | 'year' = 'month';
  documentSelectedMonth: string = '';
  documentSelectedYear: string = '';
  documentAvailableMonths: string[] = [];
  documentAvailableYears: string[] = [];

  // レポート用
  reportTableType: 'salary' | 'bonus' = 'salary';
  reportEmployees: Employee[] = [];
  reportBonuses: Bonus[] = [];
  reportFilterType: 'month' | 'year' = 'month';
  reportSelectedMonth: string = '';
  reportSelectedYear: string = '';
  availableYears: string[] = [];
  availableBonusYears: string[] = [];
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

  salaryColumns = [
    { key: 'id', label: '社員ID', type: 'number', sortable: true },
    { key: 'name', label: '氏名', type: 'string', sortable: false },
    { key: 'salary', label: '給与', type: 'number', sortable: false },
    { key: 'standardSalary', label: '標準報酬月額', type: 'number', sortable: false },
    { key: 'grade', label: '等級', type: 'number', sortable: true },
    { key: 'healthInsurance', label: '健康保険料', type: 'number', sortable: false },
    { key: 'welfarePension', label: '厚生年金保険料', type: 'number', sortable: false },
    { key: 'nursingInsurance', label: '介護保険料', type: 'number', sortable: false },
    { key: 'personalBurden', label: '本人負担額', type: 'number', sortable: false },
    { key: 'companyBurden', label: '会社負担額', type: 'number', sortable: false }
  ];
  
  bonusColumns = [
    { key: 'id', label: '社員ID', type: 'number', sortable: true },
    { key: 'name', label: '氏名', type: 'string', sortable: false },
    { key: 'bonus', label: '賞与', type: 'number', sortable: false },
    { key: 'standardBonus', label: '標準賞与額', type: 'number', sortable: true },
    { key: 'healthInsurance', label: '健康保険料', type: 'number', sortable: false },
    { key: 'welfarePension', label: '厚生年金保険料', type: 'number', sortable: false },
    { key: 'nursingInsurance', label: '介護保険料', type: 'number', sortable: false },
    { key: 'personalBurden', label: '本人負担額', type: 'number', sortable: false },
    { key: 'companyBurden', label: '会社負担額', type: 'number', sortable: false }
  ];
  
  get columns() {
    return this.tableType === 'salary' ? this.salaryColumns : this.bonusColumns;
  }

  constructor(
    private employeeService: EmployeeService,
    private firestoreService: FirestoreService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // まずすべてのデータを読み込んで利用可能な月のリストを取得
    this.loadAvailableMonths();
    this.loadAvailableBonusMonths();
    // その後、選択された月のデータを読み込む
    this.loadEmployees();
    this.loadBonuses();
    // レポート用のデータも読み込む
    this.loadReportData();
    // 保存された設定情報を読み込む
    this.loadCompanyInfo();
    this.loadHealthInsuranceSettings();
    // 協会けんぽの都道府県別保険料率を読み込む
    this.loadKenpoRates();
    // 保険料率設定を読み込む
    this.loadInsuranceRateSettings();
    // 書類作成用の部署リストを読み込む
    this.loadDepartmentsForDocuments();
    // 書類作成用の期間リストを読み込む
    this.loadDocumentPeriods();
  }

  loadDepartmentsForDocuments(): void {
    this.employeeService.getEmployees().subscribe({
      next: (data) => {
        const departmentsSet = new Set<string>();
        data.forEach(emp => {
          const dept = (emp as any).部署 ?? (emp as any).department;
          if (dept) {
            departmentsSet.add(dept);
          }
        });
        this.availableDepartments = Array.from(departmentsSet).sort();
      },
      error: (error) => {
        console.error('Error loading departments:', error);
      }
    });
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

  loadAvailableBonusMonths(): void {
    // すべての賞与データを読み込んで利用可能な月のリストを取得
    this.employeeService.getBonuses().subscribe({
      next: (data) => {
        const monthsSet = new Set<string>();
        data.forEach(bonus => {
          const month = bonus.月 || bonus['month'];
          if (month) {
            monthsSet.add(month);
          }
        });
        this.availableBonusMonths = Array.from(monthsSet).sort();
      },
      error: (error) => {
        console.error('Error loading available bonus months:', error);
      }
    });
  }

  loadEmployees(): void {
    if (this.tableType !== 'salary') {
      return;
    }
    this.isLoading = true;
    // 必ず月を選択する必要がある
    if (!this.selectedMonth && this.availableMonths.length > 0) {
      this.selectedMonth = this.availableMonths[0];
    }
    this.employeeService.getEmployees(this.selectedMonth).subscribe({
      next: (data) => {
        this.employees = data;
        this.updateFilterOptions(data);
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading employees:', error);
        this.isLoading = false;
      }
    });
  }

  loadBonuses(): void {
    if (this.tableType !== 'bonus') {
      return;
    }
    this.isLoading = true;
    // 必ず月を選択する必要がある
    if (!this.selectedMonth && this.availableBonusMonths.length > 0) {
      this.selectedMonth = this.availableBonusMonths[0];
    }
    this.employeeService.getBonuses(this.selectedMonth).subscribe({
      next: (data) => {
        this.bonuses = data;
        this.updateFilterOptions(data);
        this.applyBonusFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading bonuses:', error);
        this.isLoading = false;
      }
    });
  }

  updateFilterOptions(data: Employee[] | Bonus[]): void {
    // 部署のリストを取得
    const departmentsSet = new Set<string>();
    const employmentTypesSet = new Set<string>();
    
    data.forEach(item => {
      const department = (item as any).部署 ?? (item as any).department;
      const employmentType = (item as any).雇用形態 ?? (item as any).employmentType;
      
      if (department) {
        departmentsSet.add(department);
      }
      if (employmentType) {
        employmentTypesSet.add(employmentType);
      }
    });
    
    this.availableDepartments = Array.from(departmentsSet).sort();
    this.availableEmploymentTypes = Array.from(employmentTypesSet).sort();
  }

  applyFilters(): void {
    let filtered = [...this.employees];

    // 部署でフィルター
    if (this.filterDepartment) {
      filtered = filtered.filter(emp => {
        const department = (emp as any).部署 ?? (emp as any).department;
        return department === this.filterDepartment;
      });
    }

    // 雇用形態でフィルター
    if (this.filterEmploymentType) {
      filtered = filtered.filter(emp => {
        const employmentType = (emp as any).雇用形態 ?? (emp as any).employmentType;
        return employmentType === this.filterEmploymentType;
      });
    }

    // 介護保険でフィルター
    if (this.filterNursingInsurance === 'with') {
      filtered = filtered.filter(emp => {
        const nursingInsurance = this.getNursingInsurance(emp);
        return nursingInsurance > 0;
      });
    } else if (this.filterNursingInsurance === 'without') {
      filtered = filtered.filter(emp => {
        const nursingInsurance = this.getNursingInsurance(emp);
        return nursingInsurance === 0;
      });
    }

    // ソートを適用（デフォルトで社員IDの昇順）
    const sortKey = this.sortColumn || 'id';
    const column = this.columns.find(col => col.key === sortKey);
    if (column && column.sortable) {
      filtered = filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortKey) {
          case 'id':
            aValue = this.getEmployeeId(a);
            bValue = this.getEmployeeId(b);
            break;
          case 'grade':
            aValue = this.getGrade(a);
            bValue = this.getGrade(b);
            break;
          default:
            return 0;
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return this.sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const aStr = String(aValue || '');
        const bStr = String(bValue || '');
        if (this.sortDirection === 'asc') {
          return aStr.localeCompare(bStr, 'ja');
        } else {
          return bStr.localeCompare(aStr, 'ja');
        }
      });
    } else {
      // デフォルトで社員IDの昇順でソート
      filtered = filtered.sort((a, b) => {
        const aValue = this.getEmployeeId(a);
        const bValue = this.getEmployeeId(b);
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return aValue - bValue;
        }
        const aStr = String(aValue || '');
        const bStr = String(bValue || '');
        return aStr.localeCompare(bStr, 'ja');
      });
    }

    this.sortedEmployees = filtered;
  }

  onFilterChange(): void {
    if (this.tableType === 'salary') {
      this.applyFilters();
    } else {
      this.applyBonusFilters();
    }
  }

  applyBonusFilters(): void {
    let filtered = [...this.bonuses];

    // 部署でフィルター
    if (this.filterDepartment) {
      filtered = filtered.filter(bonus => {
        const department = (bonus as any).部署 ?? (bonus as any).department;
        return department === this.filterDepartment;
      });
    }

    // 雇用形態でフィルター
    if (this.filterEmploymentType) {
      filtered = filtered.filter(bonus => {
        const employmentType = (bonus as any).雇用形態 ?? (bonus as any).employmentType;
        return employmentType === this.filterEmploymentType;
      });
    }

    // 介護保険でフィルター
    if (this.filterNursingInsurance === 'with') {
      filtered = filtered.filter(bonus => {
        const nursingInsurance = this.getNursingInsurance(bonus, true);
        return nursingInsurance > 0;
      });
    } else if (this.filterNursingInsurance === 'without') {
      filtered = filtered.filter(bonus => {
        const nursingInsurance = this.getNursingInsurance(bonus, true);
        return nursingInsurance === 0;
      });
    }

    // ソートを適用（デフォルトで社員IDの昇順）
    const sortKey = this.sortColumn || 'id';
    const column = this.columns.find(col => col.key === sortKey);
    if (column && column.sortable) {
      filtered = filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortKey) {
          case 'id':
            aValue = this.getEmployeeId(a as Employee);
            bValue = this.getEmployeeId(b as Employee);
            break;
          case 'grade':
            aValue = this.getGrade(a as Employee);
            bValue = this.getGrade(b as Employee);
            break;
          case 'standardBonus':
            aValue = this.getStandardBonus(a as Bonus);
            bValue = this.getStandardBonus(b as Bonus);
            break;
          default:
            return 0;
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return this.sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const aStr = String(aValue || '');
        const bStr = String(bValue || '');
        if (this.sortDirection === 'asc') {
          return aStr.localeCompare(bStr, 'ja');
        } else {
          return bStr.localeCompare(aStr, 'ja');
        }
      });
    } else {
      // デフォルトで社員IDの昇順でソート
      filtered = filtered.sort((a, b) => {
        const aValue = this.getEmployeeId(a as Employee);
        const bValue = this.getEmployeeId(b as Employee);
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return aValue - bValue;
        }
        const aStr = String(aValue || '');
        const bStr = String(bValue || '');
        return aStr.localeCompare(bStr, 'ja');
      });
    }

    this.sortedBonuses = filtered;
  }

  onMonthChange(month: string): void {
    this.selectedMonth = month;
    // フィルターをリセット
    this.filterDepartment = '';
    this.filterEmploymentType = '';
    this.filterNursingInsurance = '';
    if (this.tableType === 'salary') {
      this.loadEmployees();
    } else {
      this.loadBonuses();
    }
  }

  onTableTypeChange(type: 'salary' | 'bonus'): void {
    this.tableType = type;
    // フィルターをリセット
    this.filterDepartment = '';
    this.filterEmploymentType = '';
    this.filterNursingInsurance = '';
    // 月をリセット
    if (type === 'salary') {
      if (this.availableMonths.length > 0) {
        this.selectedMonth = this.availableMonths[0];
      }
      this.loadEmployees();
    } else {
      if (this.availableBonusMonths.length > 0) {
        this.selectedMonth = this.availableBonusMonths[0];
      }
      this.loadBonuses();
    }
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

    if (this.tableType === 'salary') {
      this.applyFilters();
    } else {
      this.applyBonusFilters();
    }
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
    // チュートリアルをクリックした場合
    if (subMenuId === 'tutorial') {
      this.startTutorial();
      return;
    }
    // サブメニューをクリックした場合は、そのページに遷移
    this.selectedMenuId = subMenuId;
  }

  startTutorial(): void {
    this.isTutorialMode = true;
    this.currentTutorialStep = 0;
    this.showTutorialStep(0);
  }

  showTutorialStep(step: number): void {
    if (step < 0 || step >= this.tutorialSteps.length) {
      this.endTutorial();
      return;
    }
    this.currentTutorialStep = step;
    const stepData = this.tutorialSteps[step];
    
    // 該当ページに遷移
    if (stepData.menuId === 'company-settings' || 
        stepData.menuId === 'health-insurance-settings' || 
        stepData.menuId === 'employee-settings' || 
        stepData.menuId === 'insurance-rate-inquiry') {
      // 設定のサブメニューの場合
      this.selectedMenuId = stepData.menuId;
      this.isSettingsExpanded = true;
    } else {
      // 通常のメニューの場合
      this.selectedMenuId = stepData.menuId;
      this.isSettingsExpanded = false;
      
      // レポートページに切り替えた場合はチャートを更新
      if (stepData.menuId === 'reports') {
        setTimeout(() => {
          this.updateCharts();
        }, 100);
      }
    }
  }

  nextTutorialStep(): void {
    if (this.currentTutorialStep < this.tutorialSteps.length - 1) {
      this.showTutorialStep(this.currentTutorialStep + 1);
    } else {
      this.endTutorial();
    }
  }

  previousTutorialStep(): void {
    if (this.currentTutorialStep > 0) {
      this.showTutorialStep(this.currentTutorialStep - 1);
    }
  }

  endTutorial(): void {
    this.isTutorialMode = false;
    this.currentTutorialStep = 0;
  }

  getCurrentTutorialStep(): any {
    if (this.currentTutorialStep >= 0 && this.currentTutorialStep < this.tutorialSteps.length) {
      return this.tutorialSteps[this.currentTutorialStep];
    }
    return null;
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
  getEmployeeId(employee: Employee | Bonus): number | string {
    return employee.ID ?? employee.id ?? '';
  }

  getEmployeeName(employee: Employee | Bonus): string {
    return employee.氏名 ?? employee.name ?? '';
  }

  getStandardSalary(employee: Employee | Bonus): number {
    return employee.標準報酬月額 ?? employee.standardSalary ?? 0;
  }

  getStandardBonus(employee: Employee | Bonus): number {
    return (employee as any).標準賞与額 ?? (employee as any)['standardBonus'] ?? 0;
  }

  getSalary(employee: Employee | Bonus): number {
    return (employee as any).給与 ?? (employee as any).salary ?? 0;
  }

  getBonus(employee: Employee | Bonus): number {
    return (employee as any).賞与 ?? (employee as any).bonus ?? 0;
  }

  getGrade(employee: Employee | Bonus): number {
    return employee.等級 ?? employee.grade ?? 0;
  }

  getHealthInsurance(employee: Employee | Bonus, isBonus: boolean = false): number {
    const baseAmount = isBonus ? this.getStandardBonus(employee) : this.getStandardSalary(employee);
    
    // 賞与の場合、標準賞与額が573万円以上の場合は573万円を上限とする
    if (isBonus && baseAmount >= 5730000) {
      const cappedAmount = 5730000;
      
      // 組合保険が選択されている場合、設定された保険料率を使用して計算
      if (this.healthInsuranceType === 'kumiai' && this.insuranceRate > 0) {
        return Math.round(cappedAmount * (this.insuranceRate / 100));
      }
      
      // 協会けんぽが選択されている場合、都道府県に基づいた保険料率を使用して計算
      if (this.healthInsuranceType === 'kyokai' && this.prefecture) {
        const kenpoRate = this.kenpoRates[this.prefecture];
        if (kenpoRate && kenpoRate.healthRate > 0) {
          return Math.round(cappedAmount * (kenpoRate.healthRate / 100));
        }
      }
    }
    
    // 通常の計算（給与、または賞与で上限未満の場合）
    // 組合保険が選択されている場合、設定された保険料率を使用して計算
    if (this.healthInsuranceType === 'kumiai' && this.insuranceRate > 0) {
      // 保険料率はパーセンテージなので、100で割ってから基準額を掛ける
      return Math.round(baseAmount * (this.insuranceRate / 100));
    }
    
    // 協会けんぽが選択されている場合、都道府県に基づいた保険料率を使用して計算
    if (this.healthInsuranceType === 'kyokai' && this.prefecture) {
      const kenpoRate = this.kenpoRates[this.prefecture];
      if (kenpoRate && kenpoRate.healthRate > 0) {
        // 保険料率はパーセンテージなので、100で割ってから基準額を掛ける
        return Math.round(baseAmount * (kenpoRate.healthRate / 100));
      }
    }
    
    // 設定がない場合は既存のデータを使用
    return employee.健康保険料 ?? employee.healthInsurance ?? 0;
  }

  getWelfarePension(employee: Employee | Bonus, isBonus: boolean = false): number {
    const grade = this.getGrade(employee);
    
    // 賞与の場合、標準賞与額が150万円以上の場合は150万円を上限とする
    if (isBonus) {
      const baseAmount = this.getStandardBonus(employee);
      const cappedAmount = baseAmount >= 1500000 ? 1500000 : baseAmount;
      
      // 保険料率設定から計算
      if (this.welfarePensionRate > 0) {
        // 保険料率はパーセンテージなので、100で割ってから基準額を掛ける
        return Math.round(cappedAmount * (this.welfarePensionRate / 100));
      }
      // 設定がない場合は既存のデータを使用
      return employee.厚生年金保険料 ?? employee.welfarePension ?? 0;
    }
    
    // 給与の場合の計算
    // 等級1~4の場合は16104円
    if (grade >= 1 && grade <= 4) {
      return 16104;
    }
    
    // 等級35以上の場合は118950円
    if (grade >= 35) {
      return 118950;
    }
    
    // その他の場合は保険料率設定から計算
    if (this.welfarePensionRate > 0) {
      const baseAmount = this.getStandardSalary(employee);
      // 保険料率はパーセンテージなので、100で割ってから基準額を掛ける
      return Math.round(baseAmount * (this.welfarePensionRate / 100));
    }
    // 設定がない場合は既存のデータを使用
    return employee.厚生年金保険料 ?? employee.welfarePension ?? 0;
  }

  getNursingInsurance(employee: Employee | Bonus, isBonus: boolean = false): number {
    // 年齢を取得（型アサーションを使用）
    const age = (employee as any).年齢 ?? (employee as any).age;
    
    // 40歳未満の場合は介護保険料は0
    if (age === undefined || age === null || age < 40) {
      return 0;
    }
    
    // 40歳以上の場合は保険料率設定から計算
    if (this.nursingInsuranceRate > 0) {
      const baseAmount = isBonus ? this.getStandardBonus(employee) : this.getStandardSalary(employee);
      // 保険料率はパーセンテージなので、100で割ってから基準額を掛ける
      return Math.round(baseAmount * (this.nursingInsuranceRate / 100));
    }
    // 設定がない場合は既存のデータを使用
    return employee.介護保険料 ?? employee.nursingInsurance ?? 0;
  }

  getPersonalBurden(employee: Employee | Bonus, isBonus: boolean = false): number {
    // 健康保険料、厚生年金保険料、介護保険料を個別に計算
    const healthInsurance = this.getHealthInsurance(employee, isBonus);
    const welfarePension = this.getWelfarePension(employee, isBonus);
    const nursingInsurance = this.getNursingInsurance(employee, isBonus);
    
    // 各保険料ごとに奇数チェックを行い、折半計算
    let personalBurden = 0;
    
    // 健康保険料の本人負担額
    let healthInsurancePersonal: number;
    let actualReduction: number = 0; // 実際に差し引かれた額
    if (healthInsurance % 2 === 1) {
      // 奇数の場合、1円引いて折半
      healthInsurancePersonal = Math.floor((healthInsurance - 1) / 2);
    } else {
      // 偶数の場合、通常通り折半
      healthInsurancePersonal = Math.floor(healthInsurance / 2);
    }
    
    // 組合保険の場合、引き下げ額を適用
    if (this.healthInsuranceType === 'kumiai' && this.healthInsuranceReduction > 0) {
      // 実際に差し引かれた額を計算（本人負担額を超えない）
      actualReduction = Math.min(healthInsurancePersonal, this.healthInsuranceReduction);
      healthInsurancePersonal = Math.max(0, healthInsurancePersonal - this.healthInsuranceReduction);
    }
    
    personalBurden += healthInsurancePersonal;
    
    // 厚生年金保険料の本人負担額
    if (welfarePension % 2 === 1) {
      // 奇数の場合、1円引いて折半
      personalBurden += Math.floor((welfarePension - 1) / 2);
    } else {
      // 偶数の場合、通常通り折半
      personalBurden += Math.floor(welfarePension / 2);
    }
    
    // 介護保険料の本人負担額
    if (nursingInsurance % 2 === 1) {
      // 奇数の場合、1円引いて折半
      personalBurden += Math.floor((nursingInsurance - 1) / 2);
    } else {
      // 偶数の場合、通常通り折半
      personalBurden += Math.floor(nursingInsurance / 2);
    }
    
    return personalBurden;
  }

  getCompanyBurden(employee: Employee | Bonus, isBonus: boolean = false): number {
    // 健康保険料、厚生年金保険料、介護保険料を個別に計算
    const healthInsurance = this.getHealthInsurance(employee, isBonus);
    const welfarePension = this.getWelfarePension(employee, isBonus);
    const nursingInsurance = this.getNursingInsurance(employee, isBonus);
    
    // 各保険料ごとに奇数チェックを行い、折半計算
    let companyBurden = 0;
    
    // 健康保険料の会社負担額
    let healthInsuranceCompany: number;
    if (healthInsurance % 2 === 1) {
      // 奇数の場合、1円引いて折半し、1円を足す
      healthInsuranceCompany = Math.floor((healthInsurance - 1) / 2) + 1;
    } else {
      // 偶数の場合、通常通り折半
      healthInsuranceCompany = Math.floor(healthInsurance / 2);
    }
    
    // 組合保険の場合、実際に差し引かれた額を会社負担額に追加
    if (this.healthInsuranceType === 'kumiai' && this.healthInsuranceReduction > 0) {
      // 本人負担額を計算（引き下げ前）
      let healthInsurancePersonalBeforeReduction: number;
      if (healthInsurance % 2 === 1) {
        healthInsurancePersonalBeforeReduction = Math.floor((healthInsurance - 1) / 2);
      } else {
        healthInsurancePersonalBeforeReduction = Math.floor(healthInsurance / 2);
      }
      // 実際に差し引かれた額（本人負担額を超えない）
      const actualReduction = Math.min(healthInsurancePersonalBeforeReduction, this.healthInsuranceReduction);
      healthInsuranceCompany += actualReduction;
    }
    
    companyBurden += healthInsuranceCompany;
    
    // 厚生年金保険料の会社負担額
    if (welfarePension % 2 === 1) {
      // 奇数の場合、1円引いて折半し、1円を足す
      companyBurden += Math.floor((welfarePension - 1) / 2) + 1;
    } else {
      // 偶数の場合、通常通り折半
      companyBurden += Math.floor(welfarePension / 2);
    }
    
    // 介護保険料の会社負担額
    if (nursingInsurance % 2 === 1) {
      // 奇数の場合、1円引いて折半し、1円を足す
      companyBurden += Math.floor((nursingInsurance - 1) / 2) + 1;
    } else {
      // 偶数の場合、通常通り折半
      companyBurden += Math.floor(nursingInsurance / 2);
    }
    
    return companyBurden;
  }

  // モーダル関連のメソッド
  openEmployeeModal(employee: Employee | Bonus): void {
    this.selectedEmployee = employee;
    this.isModalOpen = true;
  }

  closeEmployeeModal(): void {
    this.isModalOpen = false;
    this.selectedEmployee = null;
  }

  getEmployeeField(employee: Employee | Bonus, field: string): any {
    // 日本語キーと英語キーの両方をチェック
    return (employee as any)[field] ?? (employee as any)[this.getEnglishKey(field)] ?? '-';
  }
  
  isBonusEmployee(employee: Employee | Bonus | null): boolean {
    if (!employee) return false;
    // 標準賞与額が存在する場合は賞与データと判断
    return !!(employee as any).標準賞与額 || !!(employee as any).standardBonus;
  }

  getEnglishKey(japaneseKey: string): string {
    const keyMap: { [key: string]: string } = {
      'ID': 'ID',
      '氏名': 'name',
      '役職': 'position',
      '部署': 'department',
      '生年月日': 'birthDate',
      '雇用形態': 'employmentType',
      '勤務地': 'workLocation',
      '年齢': 'age',
      '性別': 'gender',
      '入社日': 'joinDate',
      '標準報酬月額': 'standardSalary',
      '等級': 'grade',
      '健康保険料': 'healthInsurance',
      '厚生年金保険料': 'welfarePension',
      '介護保険料': 'nursingInsurance',
      '本人負担額': 'personalBurden',
      '会社負担額': 'companyBurden',
      '月': 'month'
    };
    return keyMap[japaneseKey] || japaneseKey;
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) {
      return '-';
    }
    // yyyy-mm-dd形式の文字列を yyyy年mm月dd日 に変換
    const dateParts = dateString.split('-');
    if (dateParts.length === 3) {
      const year = dateParts[0];
      const month = parseInt(dateParts[1], 10).toString();
      const day = parseInt(dateParts[2], 10).toString();
      return `${year}年${month}月${day}日`;
    }
    return dateString;
  }

  // レポート関連のメソッド
  loadReportData(): void {
    // 給与データを読み込む
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
        
        if (this.reportTableType === 'salary') {
          this.calculateReportTotals();
        }
      },
      error: (error) => {
        console.error('Error loading report data:', error);
      }
    });
    
    // 賞与データを読み込む
    this.employeeService.getBonuses().subscribe({
      next: (data) => {
        this.reportBonuses = data;
        
        // 利用可能な年を取得
        const yearsSet = new Set<string>();
        data.forEach(bonus => {
          const month = bonus.月 || bonus['month'];
          if (month) {
            // "2024年06月" から "2024" を抽出
            const yearMatch = month.match(/^(\d{4})年/);
            if (yearMatch) {
              yearsSet.add(yearMatch[1]);
            }
          }
        });
        this.availableBonusYears = Array.from(yearsSet).sort();
        
        // デフォルトで最初の年を選択
        if (this.availableBonusYears.length > 0 && !this.reportSelectedYear && this.reportTableType === 'bonus') {
          this.reportSelectedYear = this.availableBonusYears[0];
        }
        
        if (this.reportTableType === 'bonus') {
          this.calculateReportTotals();
        }
      },
      error: (error) => {
        console.error('Error loading bonus report data:', error);
      }
    });
  }

  onReportTableTypeChange(type: 'salary' | 'bonus'): void {
    // 現在のタイプと新しいタイプが異なる場合のみ、デフォルト値を設定
    const isTypeChanged = this.reportTableType !== type;
    this.reportTableType = type;
    
    // タイプが切り替わった場合のみ、月/年をリセット（フィルタータイプに応じて適切な値を設定）
    if (isTypeChanged) {
      if (this.reportFilterType === 'month') {
        // 月フィルターの場合
        if (type === 'salary') {
          if (this.availableMonths.length > 0) {
            this.reportSelectedMonth = this.availableMonths[0];
          } else {
            this.reportSelectedMonth = '';
          }
        } else {
          if (this.availableBonusMonths.length > 0) {
            this.reportSelectedMonth = this.availableBonusMonths[0];
          } else {
            this.reportSelectedMonth = '';
          }
        }
      } else {
        // 年フィルターの場合
        if (type === 'salary') {
          if (this.availableYears.length > 0) {
            this.reportSelectedYear = this.availableYears[0];
          } else {
            this.reportSelectedYear = '';
          }
        } else {
          if (this.availableBonusYears.length > 0) {
            this.reportSelectedYear = this.availableBonusYears[0];
          } else {
            this.reportSelectedYear = '';
          }
        }
      }
    }
    // タイプが変わらなかった場合は、現在のreportSelectedMonth/reportSelectedYearを維持
    
    this.calculateReportTotals();
    setTimeout(() => {
      this.updateCharts();
    }, 100);
  }

  onReportFilterTypeChange(type: 'month' | 'year'): void {
    this.reportFilterType = type;
    // フィルタータイプに応じて適切な値を設定
    if (type === 'month') {
      // 月フィルターに切り替えた場合
      if (this.reportTableType === 'salary') {
        if (this.availableMonths.length > 0) {
          this.reportSelectedMonth = this.availableMonths[0];
        } else {
          this.reportSelectedMonth = '';
        }
      } else {
        if (this.availableBonusMonths.length > 0) {
          this.reportSelectedMonth = this.availableBonusMonths[0];
        } else {
          this.reportSelectedMonth = '';
        }
      }
    } else {
      // 年フィルターに切り替えた場合
      if (this.reportTableType === 'salary') {
        if (this.availableYears.length > 0) {
          this.reportSelectedYear = this.availableYears[0];
        } else {
          this.reportSelectedYear = '';
        }
      } else {
        if (this.availableBonusYears.length > 0) {
          this.reportSelectedYear = this.availableBonusYears[0];
        } else {
          this.reportSelectedYear = '';
        }
      }
    }
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
    // フィルター条件を確認
    if (this.reportFilterType === 'month' && !this.reportSelectedMonth) {
      // 月フィルターが選択されているが、月が選択されていない場合は計算しない
      this.personalHealthInsurance = 0;
      this.personalWelfarePension = 0;
      this.personalNursingInsurance = 0;
      this.personalBurdenTotal = 0;
      this.companyHealthInsurance = 0;
      this.companyWelfarePension = 0;
      this.companyNursingInsurance = 0;
      this.companyBurdenTotal = 0;
      return;
    }
    
    if (this.reportFilterType === 'year' && !this.reportSelectedYear) {
      // 年フィルターが選択されているが、年が選択されていない場合は計算しない
      this.personalHealthInsurance = 0;
      this.personalWelfarePension = 0;
      this.personalNursingInsurance = 0;
      this.personalBurdenTotal = 0;
      this.companyHealthInsurance = 0;
      this.companyWelfarePension = 0;
      this.companyNursingInsurance = 0;
      this.companyBurdenTotal = 0;
      return;
    }

    if (this.reportTableType === 'salary') {
      // 給与データの計算
      let filteredEmployees: Employee[] = [];
      
      if (this.reportFilterType === 'month') {
        // 月単位でフィルタリング（必ずreportSelectedMonthが設定されている）
        filteredEmployees = this.reportEmployees.filter(emp => {
          const month = emp.月 || emp.month;
          return month === this.reportSelectedMonth;
        });
      } else {
        // 年単位でフィルタリング（必ずreportSelectedYearが設定されている）
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
      
      // 社員負担額の合計を計算（各項目別、奇数チェック付き、引き下げ額考慮）
      this.personalHealthInsurance = filteredEmployees.reduce((sum, emp) => {
        const healthInsurance = this.getHealthInsurance(emp, false);
        let healthInsurancePersonal: number;
        // 奇数の場合、1円引いて折半
        if (healthInsurance % 2 === 1) {
          healthInsurancePersonal = Math.floor((healthInsurance - 1) / 2);
        } else {
          healthInsurancePersonal = Math.floor(healthInsurance / 2);
        }
        // 組合保険の場合、引き下げ額を適用
        if (this.healthInsuranceType === 'kumiai' && this.healthInsuranceReduction > 0) {
          healthInsurancePersonal = Math.max(0, healthInsurancePersonal - this.healthInsuranceReduction);
        }
        return sum + healthInsurancePersonal;
      }, 0);
      
      this.personalWelfarePension = filteredEmployees.reduce((sum, emp) => {
        const welfarePension = this.getWelfarePension(emp, false);
        // 奇数の場合、1円引いて折半
        if (welfarePension % 2 === 1) {
          return sum + Math.floor((welfarePension - 1) / 2);
        } else {
          return sum + Math.floor(welfarePension / 2);
        }
      }, 0);
      
      this.personalNursingInsurance = filteredEmployees.reduce((sum, emp) => {
        const nursingInsurance = this.getNursingInsurance(emp, false);
        // 奇数の場合、1円引いて折半
        if (nursingInsurance % 2 === 1) {
          return sum + Math.floor((nursingInsurance - 1) / 2);
        } else {
          return sum + Math.floor(nursingInsurance / 2);
        }
      }, 0);
      
      this.personalBurdenTotal = this.personalHealthInsurance + this.personalWelfarePension + this.personalNursingInsurance;
      
      // 会社負担額の合計を計算（各項目別、奇数チェック付き、引き下げ額考慮）
      this.companyHealthInsurance = filteredEmployees.reduce((sum, emp) => {
        const healthInsurance = this.getHealthInsurance(emp, false);
        let healthInsuranceCompany: number;
        // 奇数の場合、1円引いて折半し、1円を足す
        if (healthInsurance % 2 === 1) {
          healthInsuranceCompany = Math.floor((healthInsurance - 1) / 2) + 1;
        } else {
          healthInsuranceCompany = Math.floor(healthInsurance / 2);
        }
        // 組合保険の場合、実際に差し引かれた額を会社負担額に追加
        if (this.healthInsuranceType === 'kumiai' && this.healthInsuranceReduction > 0) {
          // 本人負担額を計算（引き下げ前）
          let healthInsurancePersonalBeforeReduction: number;
          if (healthInsurance % 2 === 1) {
            healthInsurancePersonalBeforeReduction = Math.floor((healthInsurance - 1) / 2);
          } else {
            healthInsurancePersonalBeforeReduction = Math.floor(healthInsurance / 2);
          }
          // 実際に差し引かれた額（本人負担額を超えない）
          const actualReduction = Math.min(healthInsurancePersonalBeforeReduction, this.healthInsuranceReduction);
          healthInsuranceCompany += actualReduction;
        }
        return sum + healthInsuranceCompany;
      }, 0);
      
      this.companyWelfarePension = filteredEmployees.reduce((sum, emp) => {
        const welfarePension = this.getWelfarePension(emp, false);
        // 奇数の場合、1円引いて折半し、1円を足す
        if (welfarePension % 2 === 1) {
          return sum + Math.floor((welfarePension - 1) / 2) + 1;
        } else {
          return sum + Math.floor(welfarePension / 2);
        }
      }, 0);
      
      this.companyNursingInsurance = filteredEmployees.reduce((sum, emp) => {
        const nursingInsurance = this.getNursingInsurance(emp, false);
        // 奇数の場合、1円引いて折半し、1円を足す
        if (nursingInsurance % 2 === 1) {
          return sum + Math.floor((nursingInsurance - 1) / 2) + 1;
        } else {
          return sum + Math.floor(nursingInsurance / 2);
        }
      }, 0);
      
      this.companyBurdenTotal = this.companyHealthInsurance + this.companyWelfarePension + this.companyNursingInsurance;
    } else {
      // 賞与データの計算
      let filteredBonuses: Bonus[] = [];
      
      if (this.reportFilterType === 'month') {
        // 月単位でフィルタリング（必ずreportSelectedMonthが設定されている）
        filteredBonuses = this.reportBonuses.filter(bonus => {
          const month = bonus.月 || bonus['month'];
          return month === this.reportSelectedMonth;
        });
      } else {
        // 年単位でフィルタリング（必ずreportSelectedYearが設定されている）
        filteredBonuses = this.reportBonuses.filter(bonus => {
          const month = bonus.月 || bonus['month'];
          if (month) {
            const yearMatch = month.match(/^(\d{4})年/);
            if (yearMatch) {
              return yearMatch[1] === this.reportSelectedYear;
            }
          }
          return false;
        });
      }
      
      // 社員負担額の合計を計算（各項目別、奇数チェック付き、引き下げ額考慮）
      this.personalHealthInsurance = filteredBonuses.reduce((sum, bonus) => {
        const healthInsurance = this.getHealthInsurance(bonus, true);
        let healthInsurancePersonal: number;
        // 奇数の場合、1円引いて折半
        if (healthInsurance % 2 === 1) {
          healthInsurancePersonal = Math.floor((healthInsurance - 1) / 2);
        } else {
          healthInsurancePersonal = Math.floor(healthInsurance / 2);
        }
        // 組合保険の場合、引き下げ額を適用
        if (this.healthInsuranceType === 'kumiai' && this.healthInsuranceReduction > 0) {
          healthInsurancePersonal = Math.max(0, healthInsurancePersonal - this.healthInsuranceReduction);
        }
        return sum + healthInsurancePersonal;
      }, 0);
      
      this.personalWelfarePension = filteredBonuses.reduce((sum, bonus) => {
        const welfarePension = this.getWelfarePension(bonus, true);
        // 奇数の場合、1円引いて折半
        if (welfarePension % 2 === 1) {
          return sum + Math.floor((welfarePension - 1) / 2);
        } else {
          return sum + Math.floor(welfarePension / 2);
        }
      }, 0);
      
      this.personalNursingInsurance = filteredBonuses.reduce((sum, bonus) => {
        const nursingInsurance = this.getNursingInsurance(bonus, true);
        // 奇数の場合、1円引いて折半
        if (nursingInsurance % 2 === 1) {
          return sum + Math.floor((nursingInsurance - 1) / 2);
        } else {
          return sum + Math.floor(nursingInsurance / 2);
        }
      }, 0);
      
      this.personalBurdenTotal = this.personalHealthInsurance + this.personalWelfarePension + this.personalNursingInsurance;
      
      // 会社負担額の合計を計算（各項目別、奇数チェック付き、引き下げ額考慮）
      this.companyHealthInsurance = filteredBonuses.reduce((sum, bonus) => {
        const healthInsurance = this.getHealthInsurance(bonus, true);
        let healthInsuranceCompany: number;
        // 奇数の場合、1円引いて折半し、1円を足す
        if (healthInsurance % 2 === 1) {
          healthInsuranceCompany = Math.floor((healthInsurance - 1) / 2) + 1;
        } else {
          healthInsuranceCompany = Math.floor(healthInsurance / 2);
        }
        // 組合保険の場合、実際に差し引かれた額を会社負担額に追加
        if (this.healthInsuranceType === 'kumiai' && this.healthInsuranceReduction > 0) {
          // 本人負担額を計算（引き下げ前）
          let healthInsurancePersonalBeforeReduction: number;
          if (healthInsurance % 2 === 1) {
            healthInsurancePersonalBeforeReduction = Math.floor((healthInsurance - 1) / 2);
          } else {
            healthInsurancePersonalBeforeReduction = Math.floor(healthInsurance / 2);
          }
          // 実際に差し引かれた額（本人負担額を超えない）
          const actualReduction = Math.min(healthInsurancePersonalBeforeReduction, this.healthInsuranceReduction);
          healthInsuranceCompany += actualReduction;
        }
        return sum + healthInsuranceCompany;
      }, 0);
      
      this.companyWelfarePension = filteredBonuses.reduce((sum, bonus) => {
        const welfarePension = this.getWelfarePension(bonus, true);
        // 奇数の場合、1円引いて折半し、1円を足す
        if (welfarePension % 2 === 1) {
          return sum + Math.floor((welfarePension - 1) / 2) + 1;
        } else {
          return sum + Math.floor(welfarePension / 2);
        }
      }, 0);
      
      this.companyNursingInsurance = filteredBonuses.reduce((sum, bonus) => {
        const nursingInsurance = this.getNursingInsurance(bonus, true);
        // 奇数の場合、1円引いて折半し、1円を足す
        if (nursingInsurance % 2 === 1) {
          return sum + Math.floor((nursingInsurance - 1) / 2) + 1;
        } else {
          return sum + Math.floor(nursingInsurance / 2);
        }
      }, 0);
      
      this.companyBurdenTotal = this.companyHealthInsurance + this.companyWelfarePension + this.companyNursingInsurance;
    }
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
      this.insuranceRateDisplay = '';
      this.healthInsuranceReduction = 0;
      this.healthInsuranceReductionDisplay = '';
    } else {
      this.prefecture = '';
    }
  }

  async loadKenpoRates(): Promise<void> {
    const db = this.firestoreService.getFirestore();
    if (!db) {
      return;
    }

    try {
      const kenpoRatesRef = collection(db, 'kenpoRates');
      const querySnapshot = await getDocs(kenpoRatesRef);
      
      this.kenpoRates = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data['prefecture'] && data['healthRate'] !== undefined) {
          this.kenpoRates[data['prefecture']] = {
            healthRate: data['healthRate'],
            careRate: data['careRate'] || 1.59
          };
        }
      });
    } catch (error) {
      console.error('Error loading kenpo rates:', error);
    }
  }

  async loadInsuranceRateSettings(): Promise<void> {
    const db = this.firestoreService.getFirestore();
    if (!db) {
      return;
    }

    try {
      const docRef = doc(db, 'insuranceRateSettings', 'settings');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        this.welfarePensionRate = data['welfarePensionRate'] || 18.3;
        this.nursingInsuranceRate = data['nursingInsuranceRate'] || 1.59;
        
        // 保険料率設定が読み込まれた後、データを再計算する
        this.loadEmployees();
        this.loadReportData();
      }
    } catch (error) {
      console.error('Error loading insurance rate settings:', error);
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
        this.healthInsuranceReduction = data['healthInsuranceReduction'] || 0;
        this.healthInsuranceReductionDisplay = this.healthInsuranceReduction > 0 ? this.healthInsuranceReduction.toString() : '';
        
        // データが存在する場合は保存済み状態にする
        if ((this.healthInsuranceType === 'kyokai' && this.prefecture) ||
            (this.healthInsuranceType === 'kumiai' && this.insuranceRate > 0)) {
          this.isHealthInsuranceSaved = true;
          this.isHealthInsuranceEditing = false;
        }
        
        // 健康保険設定が読み込まれた後、データを再計算する
        // 組合保険または協会けんぽの場合、保険料率が変更されている可能性があるため
        if ((this.healthInsuranceType === 'kumiai' && this.insuranceRate > 0) ||
            (this.healthInsuranceType === 'kyokai' && this.prefecture)) {
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
        healthInsuranceReduction: this.healthInsuranceReduction,
        updatedAt: new Date()
      }, { merge: true });

      // 保存完了の状態に変更
      this.isHealthInsuranceSaved = true;
      this.isHealthInsuranceEditing = false;
      
      // 組合保険または協会けんぽの場合、保険料率または引き下げ額が変更されたのでデータを再計算
      if ((this.healthInsuranceType === 'kumiai' && this.insuranceRate > 0) ||
          (this.healthInsuranceType === 'kyokai' && this.prefecture)) {
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

  onHealthInsuranceReductionInput(event: any): void {
    // エラーメッセージをクリア
    this.healthInsuranceReductionError = '';
    
    // 入力値を取得
    let value = event.target.value;
    
    // 空の場合は0に設定して終了
    if (value === '' || value === null || value === undefined) {
      this.healthInsuranceReduction = 0;
      this.healthInsuranceReductionDisplay = '';
      return;
    }
    
    // 数字以外の文字が含まれているかチェック
    if (!/^[0-9]*$/.test(value)) {
      this.healthInsuranceReductionError = '数字のみ入力できます';
      event.target.value = this.healthInsuranceReductionDisplay;
      return;
    }
    
    // 先頭の0を削除
    if (value.length > 1 && value[0] === '0') {
      value = value.replace(/^0+/, '');
      if (value === '') {
        value = '0';
      }
    }
    
    // 数値に変換
    const numValue = parseInt(value, 10);
    
    // 負の数のチェック
    if (value.includes('-')) {
      this.healthInsuranceReductionError = '負の数は入力できません';
      event.target.value = this.healthInsuranceReductionDisplay;
      return;
    }
    
    // 有効な数値の場合のみ更新
    if (!isNaN(numValue)) {
      this.healthInsuranceReduction = numValue;
      this.healthInsuranceReductionDisplay = value;
      event.target.value = value;
    } else if (value !== '') {
      // 無効な値の場合
      this.healthInsuranceReductionError = '正しい数値を入力してください';
      event.target.value = this.healthInsuranceReductionDisplay;
    } else {
      this.healthInsuranceReductionDisplay = value;
    }
  }

  onHealthInsuranceReductionBlur(): void {
    // エラーメッセージをクリア
    this.healthInsuranceReductionError = '';
    
    // フォーカスが外れた時に値を正規化
    if (this.healthInsuranceReduction !== null && this.healthInsuranceReduction !== undefined && !isNaN(this.healthInsuranceReduction)) {
      this.healthInsuranceReductionDisplay = this.healthInsuranceReduction.toString();
    } else if (this.healthInsuranceReductionDisplay === '') {
      this.healthInsuranceReduction = 0;
      this.healthInsuranceReductionDisplay = '';
    }
  }

  // 書類作成関連のメソッド
  onBulkSearch(): void {
    if (!this.bulkSearchTerm || this.bulkSearchTerm.trim() === '') {
      this.bulkAvailableEmployees = [];
      return;
    }
    
    const searchTerm = this.bulkSearchTerm.toLowerCase().trim();
    this.employeeService.getEmployees().subscribe({
      next: (data) => {
        // まず検索条件でフィルター
        const filtered = data.filter(emp => {
          const id = String(this.getEmployeeId(emp)).toLowerCase();
          const name = this.getEmployeeName(emp).toLowerCase();
          return id.includes(searchTerm) || name.includes(searchTerm);
        });
        
        // 社員IDで重複を除去（最新のデータを優先）
        const uniqueEmployeesMap = new Map<string | number, Employee>();
        filtered.forEach(emp => {
          const empId = this.getEmployeeId(emp);
          if (!uniqueEmployeesMap.has(empId)) {
            uniqueEmployeesMap.set(empId, emp);
          }
        });
        
        // 既に選択されている社員を除外し、IDでソート
        this.bulkAvailableEmployees = Array.from(uniqueEmployeesMap.values())
          .filter(emp => {
            const empId = this.getEmployeeId(emp);
            return !this.bulkSelectedEmployees.some(selected => 
              this.getEmployeeId(selected) === empId
            );
          })
          .sort((a, b) => {
            const idA = this.getEmployeeId(a);
            const idB = this.getEmployeeId(b);
            // 数値として比較できる場合は数値で比較、そうでなければ文字列で比較
            if (typeof idA === 'number' && typeof idB === 'number') {
              return idA - idB;
            }
            return String(idA).localeCompare(String(idB), 'ja', { numeric: true });
          });
      },
      error: (error) => {
        console.error('Error searching employees:', error);
        this.bulkAvailableEmployees = [];
      }
    });
  }

  addBulkEmployee(employee: Employee): void {
    // 既に選択されているかチェック（社員IDで比較）
    const empId = this.getEmployeeId(employee);
    const alreadySelected = this.bulkSelectedEmployees.some(emp => 
      this.getEmployeeId(emp) === empId
    );
    
    if (!alreadySelected) {
      this.bulkSelectedEmployees.push(employee);
      // 検索結果から削除（社員IDで比較）
      this.bulkAvailableEmployees = this.bulkAvailableEmployees.filter(emp => 
        this.getEmployeeId(emp) !== empId
      );
    }
  }

  removeBulkEmployee(employee: Employee): void {
    const empId = this.getEmployeeId(employee);
    this.bulkSelectedEmployees = this.bulkSelectedEmployees.filter(emp => 
      this.getEmployeeId(emp) !== empId
    );
    // 検索結果を更新
    if (this.bulkSearchTerm) {
      this.onBulkSearch();
    }
  }

  onIndividualSearch(): void {
    if (!this.individualSearchTerm || this.individualSearchTerm.trim() === '') {
      this.individualSearchResults = [];
      this.individualSelectedEmployee = null;
      return;
    }
    
    const searchTerm = this.individualSearchTerm.toLowerCase().trim();
    this.employeeService.getEmployees().subscribe({
      next: (data) => {
        // まず検索条件でフィルター
        const filtered = data.filter(emp => {
          const id = String(this.getEmployeeId(emp)).toLowerCase();
          const name = this.getEmployeeName(emp).toLowerCase();
          return id.includes(searchTerm) || name.includes(searchTerm);
        });
        
        // 社員IDで重複を除去（最新のデータを優先）
        const uniqueEmployeesMap = new Map<string | number, Employee>();
        filtered.forEach(emp => {
          const empId = this.getEmployeeId(emp);
          if (!uniqueEmployeesMap.has(empId)) {
            uniqueEmployeesMap.set(empId, emp);
          }
        });
        
        // IDでソート
        this.individualSearchResults = Array.from(uniqueEmployeesMap.values())
          .sort((a, b) => {
            const idA = this.getEmployeeId(a);
            const idB = this.getEmployeeId(b);
            // 数値として比較できる場合は数値で比較、そうでなければ文字列で比較
            if (typeof idA === 'number' && typeof idB === 'number') {
              return idA - idB;
            }
            return String(idA).localeCompare(String(idB), 'ja', { numeric: true });
          });
      },
      error: (error) => {
        console.error('Error searching employees:', error);
        this.individualSearchResults = [];
      }
    });
  }

  selectIndividualEmployee(employee: Employee): void {
    this.individualSelectedEmployee = employee;
  }

  // 書類作成用の期間リストを読み込む
  loadDocumentPeriods(): void {
    this.employeeService.getEmployees().subscribe({
      next: (data) => {
        const monthsSet = new Set<string>();
        const yearsSet = new Set<string>();
        data.forEach(emp => {
          const month = emp.月 || emp.month;
          if (month) {
            monthsSet.add(month);
            // 年を抽出
            const yearMatch = month.match(/^(\d{4})年/);
            if (yearMatch) {
              yearsSet.add(yearMatch[1]);
            }
          }
        });
        this.documentAvailableMonths = Array.from(monthsSet).sort();
        this.documentAvailableYears = Array.from(yearsSet).sort();
        
        // デフォルト値を設定
        if (this.documentAvailableMonths.length > 0 && !this.documentSelectedMonth) {
          this.documentSelectedMonth = this.documentAvailableMonths[0];
        }
        if (this.documentAvailableYears.length > 0 && !this.documentSelectedYear) {
          this.documentSelectedYear = this.documentAvailableYears[0];
        }
      },
      error: (error) => {
        console.error('Error loading document periods:', error);
      }
    });
  }

  // 書類作成
  createDocument(): void {
    if (this.selectedDocumentType === 'document1') {
      // 社会保険料控除一覧表
      this.createInsuranceDeductionList();
    } else {
      alert('この書類タイプはまだ実装されていません');
    }
  }

  // 社会保険料控除一覧表を作成
  createInsuranceDeductionList(): void {
    // フィルターに該当する社員を取得
    let targetEmployees: Employee[] = [];
    
    if (this.documentCreationMode === 'bulk') {
      // 一括作成の場合
      this.employeeService.getEmployees().subscribe({
        next: (allEmployees) => {
          // 期間でフィルタリング
          let filteredByPeriod: Employee[] = [];
          if (this.documentPeriodType === 'month') {
            filteredByPeriod = allEmployees.filter(emp => {
              const month = emp.月 || emp.month;
              return month === this.documentSelectedMonth;
            });
          } else {
            filteredByPeriod = allEmployees.filter(emp => {
              const month = emp.月 || emp.month;
              if (month) {
                const yearMatch = month.match(/^(\d{4})年/);
                if (yearMatch) {
                  return yearMatch[1] === this.documentSelectedYear;
                }
              }
              return false;
            });
          }
          
          // フィルター条件でフィルタリング
          targetEmployees = this.filterEmployeesForDocument(filteredByPeriod);
          
          // データを集計してPDFを作成
          this.generateInsuranceDeductionPDF(targetEmployees);
        },
        error: (error) => {
          console.error('Error loading employees for document:', error);
          alert('データの読み込みに失敗しました');
        }
      });
    } else {
      // 個別作成の場合
      if (!this.individualSelectedEmployee) {
        alert('社員を選択してください');
        return;
      }
      
      this.employeeService.getEmployees().subscribe({
        next: (allEmployees) => {
          // 期間でフィルタリング
          let filteredByPeriod: Employee[] = [];
          if (this.documentPeriodType === 'month') {
            filteredByPeriod = allEmployees.filter(emp => {
              const month = emp.月 || emp.month;
              const empId = this.getEmployeeId(emp);
              const selectedId = this.getEmployeeId(this.individualSelectedEmployee!);
              return month === this.documentSelectedMonth && empId === selectedId;
            });
          } else {
            filteredByPeriod = allEmployees.filter(emp => {
              const month = emp.月 || emp.month;
              const empId = this.getEmployeeId(emp);
              const selectedId = this.getEmployeeId(this.individualSelectedEmployee!);
              if (month) {
                const yearMatch = month.match(/^(\d{4})年/);
                if (yearMatch && yearMatch[1] === this.documentSelectedYear && empId === selectedId) {
                  return true;
                }
              }
              return false;
            });
          }
          
          targetEmployees = filteredByPeriod;
          
          // データを集計してPDFを作成
          this.generateInsuranceDeductionPDF(targetEmployees);
        },
        error: (error) => {
          console.error('Error loading employees for document:', error);
          alert('データの読み込みに失敗しました');
        }
      });
    }
  }

  // 書類作成用の社員フィルター
  filterEmployeesForDocument(employees: Employee[]): Employee[] {
    let filtered = employees;
    
    if (this.bulkFilterType === 'department' && this.bulkFilterDepartment) {
      filtered = filtered.filter(emp => {
        const dept = (emp as any).部署 ?? (emp as any).department;
        return dept === this.bulkFilterDepartment;
      });
    } else if (this.bulkFilterType === 'nursing') {
      if (this.bulkFilterNursingInsurance === 'with') {
        filtered = filtered.filter(emp => {
          const age = (emp as any).年齢 ?? (emp as any).age;
          return age !== undefined && age !== null && age >= 40;
        });
      } else if (this.bulkFilterNursingInsurance === 'without') {
        filtered = filtered.filter(emp => {
          const age = (emp as any).年齢 ?? (emp as any).age;
          return age === undefined || age === null || age < 40;
        });
      }
    } else if (this.bulkFilterType === 'custom') {
      const selectedIds = new Set(this.bulkSelectedEmployees.map(emp => this.getEmployeeId(emp)));
      filtered = filtered.filter(emp => selectedIds.has(this.getEmployeeId(emp)));
    }
    
    return filtered;
  }

  // 社会保険料控除一覧表のPDFを生成
  generateInsuranceDeductionPDF(employees: Employee[]): void {
    if (employees.length === 0) {
      alert('該当する社員がありません');
      return;
    }
    
    // データを集計
    let totalHealthInsurance = 0;
    let totalWelfarePension = 0;
    let totalNursingInsurance = 0;
    let totalPersonalBurden = 0;
    let totalCompanyBurden = 0;
    
    employees.forEach(emp => {
      totalHealthInsurance += this.getHealthInsurance(emp, false);
      totalWelfarePension += this.getWelfarePension(emp, false);
      totalNursingInsurance += this.getNursingInsurance(emp, false);
      totalPersonalBurden += this.getPersonalBurden(emp, false);
      totalCompanyBurden += this.getCompanyBurden(emp, false);
    });
    
    const totalAmount = totalHealthInsurance + totalWelfarePension + totalNursingInsurance;
    
    // 期間の文字列を生成
    let periodText = '';
    if (this.documentPeriodType === 'month') {
      periodText = this.documentSelectedMonth;
    } else {
      periodText = `${this.documentSelectedYear}年`;
    }
    
    // HTML要素を作成
    const content = document.createElement('div');
    content.style.position = 'absolute';
    content.style.left = '-9999px';
    content.style.width = '210mm';
    content.style.padding = '25mm';
    content.style.fontFamily = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "MS PGothic", sans-serif';
    content.style.fontSize = '12px';
    content.style.color = '#333';
    content.style.backgroundColor = '#fff';
    content.style.lineHeight = '1.6';
    
    content.innerHTML = `
      <div style="text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #000;">
        <h1 style="font-size: 28px; font-weight: bold; margin: 0 0 10px 0; color: #000; letter-spacing: 2px;">${periodText}　社会保険料控除額一覧</h1>
        <p style="font-size: 12px; color: #666; margin: 0;">作成日：${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h2 style="font-size: 18px; font-weight: bold; margin: 0 0 15px 0; color: #000; padding: 10px; background-color: #f5f5f5; border-left: 5px solid #000;">保険料内訳</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 18px; border: 1px solid #000; font-weight: 600; width: 40%; color: #000; font-size: 16px;">項目</td>
            <td style="padding: 18px; border: 1px solid #000; font-weight: 600; text-align: right; color: #000; font-size: 16px;">金額</td>
          </tr>
          <tr>
            <td style="padding: 18px; border: 1px solid #000; background-color: #fff; font-size: 16px;">健康保険料</td>
            <td style="padding: 18px; border: 1px solid #000; text-align: right; font-weight: 600; background-color: #fff; font-size: 16px;">${totalHealthInsurance.toLocaleString()}円</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 18px; border: 1px solid #000; font-size: 16px;">厚生年金保険料</td>
            <td style="padding: 18px; border: 1px solid #000; text-align: right; font-weight: 600; font-size: 16px;">${totalWelfarePension.toLocaleString()}円</td>
          </tr>
          <tr>
            <td style="padding: 18px; border: 1px solid #000; background-color: #fff; font-size: 16px;">介護保険料</td>
            <td style="padding: 18px; border: 1px solid #000; text-align: right; font-weight: 600; background-color: #fff; font-size: 16px;">${totalNursingInsurance.toLocaleString()}円</td>
          </tr>
        </table>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h2 style="font-size: 18px; font-weight: bold; margin: 0 0 15px 0; color: #000; padding: 10px; background-color: #f5f5f5; border-left: 5px solid #000;">負担額内訳</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 18px; border: 1px solid #000; font-weight: 600; width: 40%; color: #000; font-size: 16px;">項目</td>
            <td style="padding: 18px; border: 1px solid #000; font-weight: 600; text-align: right; color: #000; font-size: 16px;">金額</td>
          </tr>
          <tr>
            <td style="padding: 18px; border: 1px solid #000; background-color: #fff; font-size: 16px;">社員負担額</td>
            <td style="padding: 18px; border: 1px solid #000; text-align: right; font-weight: 600; background-color: #fff; font-size: 16px;">${totalPersonalBurden.toLocaleString()}円</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 18px; border: 1px solid #000; font-size: 16px;">会社負担額</td>
            <td style="padding: 18px; border: 1px solid #000; text-align: right; font-weight: 600; font-size: 16px;">${totalCompanyBurden.toLocaleString()}円</td>
          </tr>
        </table>
      </div>
      
      <div style="margin-top: 40px; padding: 25px; border: 2px solid #000; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 20px; font-weight: bold; color: #000;">合計額</span>
          <span style="font-size: 24px; font-weight: bold; color: #000;">${totalAmount.toLocaleString()}円</span>
        </div>
      </div>
    `;
    
    document.body.appendChild(content);
    
    // HTMLを画像に変換してPDFに追加
    html2canvas(content, {
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: content.scrollWidth,
      windowHeight: content.scrollHeight
    } as any).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // ファイル名を生成
      const fileName = `${periodText}_社会保険料控除額一覧.pdf`.replace(/\s+/g, '_');
      
      // PDFをダウンロード
      pdf.save(fileName);
      
      // 一時要素を削除
      document.body.removeChild(content);
    }).catch(error => {
      console.error('PDF生成エラー:', error);
      alert('PDFの生成に失敗しました');
      document.body.removeChild(content);
    });
  }

  // CSV出力機能
  exportToCSV(): void {
    // 現在表示されているテーブルのデータを取得
    const data = this.tableType === 'salary' ? this.sortedEmployees : this.sortedBonuses;
    const columns = this.columns;
    const tableTypeLabel = this.tableType === 'salary' ? '給与' : '賞与';
    const month = this.selectedMonth || '';

    if (!data || data.length === 0) {
      alert('出力するデータがありません');
      return;
    }

    // CSVの内容を構築
    let csvContent = '';
    
    // 1行目: タイトル（yyyy年mm月　給与/賞与　一覧）
    csvContent += `${month}　${tableTypeLabel}　一覧\n`;
    
    // 2行目: 空行
    csvContent += '\n';
    
    // 3行目: ヘッダー行
    const headers = columns.map(col => col.label);
    csvContent += headers.join(',') + '\n';
    
    // 4行目以降: データ行
    data.forEach(item => {
      const row: string[] = [];
      columns.forEach(column => {
        let value: any = '';
        
        switch (column.key) {
          case 'id':
            value = this.getEmployeeId(item);
            break;
          case 'name':
            value = this.getEmployeeName(item);
            break;
          case 'salary':
            value = this.getSalary(item);
            break;
          case 'bonus':
            value = this.getBonus(item);
            break;
          case 'standardSalary':
            value = this.getStandardSalary(item);
            break;
          case 'standardBonus':
            value = this.getStandardBonus(item);
            break;
          case 'grade':
            value = this.getGrade(item);
            break;
          case 'healthInsurance':
            value = this.getHealthInsurance(item, this.tableType === 'bonus');
            break;
          case 'welfarePension':
            value = this.getWelfarePension(item, this.tableType === 'bonus');
            break;
          case 'nursingInsurance':
            value = this.getNursingInsurance(item, this.tableType === 'bonus');
            break;
          case 'personalBurden':
            value = this.getPersonalBurden(item, this.tableType === 'bonus');
            break;
          case 'companyBurden':
            value = this.getCompanyBurden(item, this.tableType === 'bonus');
            break;
          default:
            value = (item as any)[column.key] ?? '';
        }
        
        // 数値の場合はそのまま、文字列の場合はダブルクォートで囲む
        if (typeof value === 'number') {
          row.push(value.toString());
        } else {
          // CSVの特殊文字（カンマ、改行、ダブルクォート）をエスケープ
          const escapedValue = String(value).replace(/"/g, '""');
          row.push(`"${escapedValue}"`);
        }
      });
      csvContent += row.join(',') + '\n';
    });
    
    // BOM付きUTF-8でエンコード（Excelで正しく開けるように）
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // ファイル名を生成（yyyy年mm月_給与/賞与_一覧.csv）
    const fileName = `${month}_${tableTypeLabel}_一覧.csv`.replace(/\s+/g, '_');
    
    // ダウンロードリンクを作成
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // メモリを解放
    URL.revokeObjectURL(url);
  }
}
