import { Component } from '@angular/core';

@Component({
  selector: '#saoa-qr-print',
  standalone: false,
  templateUrl: './qr-print.page.html',
  styleUrl: './qr-print.page.scss',
})
export class QRPrintPage {
  protected items?: Array<any> = new Array(30);
}
