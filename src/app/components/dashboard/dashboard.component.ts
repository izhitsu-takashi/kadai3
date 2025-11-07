import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmployeeService, Employee } from '../../services/employee.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  appName = 'IMA';
  selectedMenuId: string = 'insurance-list';
  menuItems = [
    { label: '保険料一覧', id: 'insurance-list' },
    { label: '書類作成', id: 'documents' },
    { label: '保険料レポート', id: 'reports' },
    { label: '設定', id: 'settings' }
  ];

  employees: Employee[] = [];
  sortedEmployees: Employee[] = [];
  isLoading = false;
  
  sortColumn: string | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

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

  constructor(private employeeService: EmployeeService) {}

  ngOnInit(): void {
    this.loadEmployees();
  }

  loadEmployees(): void {
    this.isLoading = true;
    this.employeeService.getEmployees().subscribe({
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
    this.selectedMenuId = menuId;
  }

  getSelectedMenuLabel(): string {
    const selectedItem = this.menuItems.find(item => item.id === this.selectedMenuId);
    return selectedItem ? selectedItem.label : '';
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
}
