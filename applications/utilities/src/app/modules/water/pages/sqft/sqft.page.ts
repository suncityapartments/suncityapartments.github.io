import { ReplaySubject, Subject } from 'rxjs';
import * as XLSX from 'xlsx';

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';

import { Data } from '../../data';

type Unit = {
  unitName: string;
  area: number;
  billed: number;
};

type Sheet = Array<Unit>;
type SheetTable = Array<Array<any>>;

@Component({
    selector: 'saoa-sqft',
    templateUrl: './sqft.page.html',
    styleUrl: './sqft.page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class SQFTPage {
  public readonly blocks = Data.blocks;
  public valueChanged$ = new Subject();
  public sheet$ = new ReplaySubject<Sheet>();
  public sheet: Sheet | null = null;
  public baseForm: FormGroup;
  public formsBuilder = inject(FormBuilder);
  public changeDetectionRef = inject(ChangeDetectorRef);

  private ohtInput = 0;
  private tankerPrice = 0;

  constructor() {
    this.sheet$.subscribe((sheet) => {
      this.sheet = sheet;
      this.updateCalculations();
      this.changeDetectionRef.detectChanges();
    });
    this.valueChanged$.subscribe(() => {
      this.updateCalculations();
      this.changeDetectionRef.detectChanges();
    });
    this.baseForm = this.formsBuilder.group({
      ohtInput: new FormControl(null, { updateOn: 'blur', validators: [Validators.required] }),
      tankerPrice: new FormControl(null, { updateOn: 'blur', validators: [Validators.required] }),
      blockName: new FormControl(null, { validators: [Validators.required] }),
      billingFrom: new FormControl(null, { validators: [Validators.required] }),
      billingTo: new FormControl(null, { validators: [Validators.required] }),
      billingDate: new FormControl(null, { validators: [Validators.required] }),
      dueDate: new FormControl(null, { validators: [Validators.required] }),
    });
    this.baseForm.get('blockName')?.valueChanges.subscribe((selectedBlock) => {
      const blockUnits = [...Data.units.filter(unit => unit.block === selectedBlock)];
      // const [[waste, ...headers], ...dataRows] = sheetTable;
      // this.dates = headers.slice(0, -1);
      // console.log(waste, this.dates, dataRows);
      // const sheet: Sheet = sheetTable.slice(1).map(row => {
      //   const unitName = row.slice(0)[0];

      //   return {
      //     unitName,
      //     isCommon: false,
      //     usage: row.slice(1, -1).map((reading, i) => ({ date: this.dates[i], reading, useAverage: false })),
      //   } as Unit;
      // });

      // return sheet;
      this.sheet$.next(blockUnits.map(unit => ({ unitName: unit.unitName, area: unit.area, billed: 0 })));
    });

    this.baseForm.get('tankerPrice')?.valueChanges.subscribe((val: number) => {
      this.tankerPrice = val;
      this.valueChanged$.next(true);
    });

    this.baseForm.get('ohtInput')?.valueChanges.subscribe((val: number) => {
      this.ohtInput = val;
      this.valueChanged$.next(true);
    });
  }

  updateCalculations = () => {
    const consumptionCost = ((this.ohtInput ?? 0) / 6000) * (this.tankerPrice);

    if (this.sheet) {
      const blockArea = this.sheet.reduce((a, b) => (a + b.area), 0);
      this.sheet.forEach(unit => unit.billed = Math.ceil(consumptionCost * unit.area / blockArea));
    }
    console.log(`Consumption Cost: ${consumptionCost}`);
  };

  export(): void {
    const exportHeaders = ['Block', 'Unit', 'Charge Type', 'Charge Description', 'Charge Date', 'Pay by Date', 'Amount'];

    if (this.sheet) {
      const exportData: SheetTable = [exportHeaders];
      //   console.log(this.data);
      const unitData = this.sheet
        .map((unitData) => {
          return [Data.blocks.find(block => block.key === this.baseForm.value.blockName)?.name, unitData.unitName, 'Water Charges', `Water Charges for ${this.baseForm.value.billingFrom} to ${this.baseForm.value.billingTo}`, this.baseForm.value.billingDate, this.baseForm.value.dueDate, unitData.billed];
        });
      exportData.push(...unitData);

      /* generate worksheet */
      const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(exportData);
      // /* generate workbook and add the worksheet */
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, this.baseForm.value.blockName);

      // /* save to file */
      XLSX.writeFile(wb, `water bill ${Data.blocks.find(block => block.key === this.baseForm.value.blockName)?.name} - ${this.baseForm.value.billingFrom} to ${this.baseForm.value.billingTo}.xlsx`);
    }
  }
}
