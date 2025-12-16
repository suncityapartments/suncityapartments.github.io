import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'saoa-login',
  templateUrl: './login.component.html',
  standalone: false,
})
export class LoginComponent implements OnInit {
  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit() {
    this.authService.initGoogleSignIn(async () => {
      console.log('User profile:', this.authService.getUserProfile());

      // check if user has access to the configured Sheet
      const hasAccess = await this.checkSheetAccess();

      if (hasAccess) {
        // maintain auth state, redirect
        this.router.navigateByUrl('/parking/dash');
      } else {
        alert('You do not have access to this sheet.');
      }
    });

    this.authService.renderButton('g_id_signin');
  }

  private async checkSheetAccess(): Promise<boolean> {
    const accessToken = this.authService.getAccessToken();
    if (!accessToken) return false;

    try {
      const sheetID = environment.sheetID;
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      return response.ok; // 200 = has access
    } catch (err) {
      console.error('Error checking sheet access', err);

      return false;
    }
  }
}
