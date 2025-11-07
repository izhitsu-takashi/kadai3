import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  appName = 'Easy保険管理';
  description = '社会保険料を簡単に管理';

  constructor(private router: Router) {}

  onLogin(): void {
    this.router.navigateByUrl('/dashboard');
  }
}
