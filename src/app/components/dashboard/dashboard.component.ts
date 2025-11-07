import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Employee {
  id: number;
  name: string;
  standardSalary: number;
  grade: number;
  healthInsurance: number;
  welfarePension: number;
  nursingInsurance: number;
  personalBurden: number;
  companyBurden: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  appName = 'IMA';
  menuItems = [
    { label: '保険料一覧', id: 'insurance-list' },
    { label: '書類作成', id: 'documents' },
    { label: '保険料レポート', id: 'reports' },
    { label: '設定', id: 'settings' }
  ];

  employees: Employee[] = [
    {
      id: 1,
      name: '山田 太郎',
      standardSalary: 300000,
      grade: 15,
      healthInsurance: 15000,
      welfarePension: 27000,
      nursingInsurance: 3000,
      personalBurden: 22500,
      companyBurden: 22500
    },
    {
      id: 2,
      name: '佐藤 花子',
      standardSalary: 250000,
      grade: 13,
      healthInsurance: 12500,
      welfarePension: 22500,
      nursingInsurance: 2500,
      personalBurden: 18750,
      companyBurden: 18750
    },
    {
      id: 3,
      name: '鈴木 一郎',
      standardSalary: 400000,
      grade: 18,
      healthInsurance: 20000,
      welfarePension: 36000,
      nursingInsurance: 4000,
      personalBurden: 30000,
      companyBurden: 30000
    }
  ];
}
