import { Component, signal, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

// AdminLayout component that provides the layout for the admin section of the application
@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
  readonly menuOpen = signal(false);

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((isOpen) => !isOpen);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
