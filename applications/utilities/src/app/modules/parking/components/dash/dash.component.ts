import { Component, OnInit } from '@angular/core';
import { AuthService } from 'applications/utilities/src/app/services/auth.service';

@Component({
  selector: 'saoa-dash',
  standalone: false,
  templateUrl: './dash.component.html',
  styleUrl: './dash.component.scss',
})
export class DashComponent implements OnInit {
  rows: any[] = [];
  loading = true;
  error: string | null = null;

  constructor(private auth: AuthService) { }

  async ngOnInit() {
    try {
      this.rows = await this.auth.fetchSheetData('Sheet1!A1:E20'); // adjust range
    } catch (err: any) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  }
}
