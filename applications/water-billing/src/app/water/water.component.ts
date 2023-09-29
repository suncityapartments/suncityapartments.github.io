import { Component, inject } from '@angular/core';
import { ReplaySubject } from 'rxjs';
import * as XLSX from 'xlsx';
import { Data } from './data';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';


@Component({
  selector: 'saoa-water',
  templateUrl: './water.component.html',
  styleUrls: ['./water.component.scss']
})
export class WaterComponent { }