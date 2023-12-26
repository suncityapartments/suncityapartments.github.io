import { ReplaySubject } from 'rxjs';
import * as XLSX from 'xlsx';

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';

import { Data } from '../../data';

type SheetTable = Array<Array<any>>;

type UsageEntry = {
  date: string;
  reading: number;
  useAverage: boolean;
}

type UnitUsage = Array<UsageEntry>;

type Unit = {
  unitName: string;
  isCommon: boolean;
  usage: UnitUsage;
  measuredTotal: number;
  averagedTotal: number;
  unitAverage: number;
  variation: number;
  billable: number;
  commonShare: number;
  billed: number;
};

type Sheet = Array<Unit>;

@Component({
  selector: 'saoa-metered',
  templateUrl: './metered.component.html',
  styleUrls: ['./metered.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeteredComponent {
  public blockList = Data.blockList;
  public sheet$ = new ReplaySubject<Sheet>();
  public sheet: Sheet | null = null;
  public importHeaders: Array<string> = [];
  public calculatedConsumption = 0;
  public importForm: FormGroup;
  public exportForm: FormGroup;
  public formsBuilder = inject(FormBuilder);
  public changeDetectionRef = inject(ChangeDetectorRef);
  public commonUsageUnits = 0;

  constructor() {
    this.sheet$.subscribe((sheet) => {
      this.sheet = sheet;
      this.updateCalculations();
      this.changeDetectionRef.detectChanges();
    });
    this.importForm = this.formsBuilder.group({
      ohtInput: new FormControl(null, { updateOn: 'blur', validators: [Validators.required] }),
      tankerPrice: new FormControl(null, { updateOn: 'blur', validators: [Validators.required] }),
    });
    this.exportForm = this.formsBuilder.group({
      blockName: new FormControl(null, { validators: [Validators.required] }),
      billingFrom: new FormControl(null, { validators: [Validators.required] }),
      billingTo: new FormControl(null, { validators: [Validators.required] }),
      billingDate: new FormControl(null, { validators: [Validators.required] }),
      dueDate: new FormControl(null, { validators: [Validators.required] }),
    });
  }

  onFileChange(evt: any) {
    // wire up file reader
    const target: DataTransfer = <DataTransfer>(evt.target);
    const reader: FileReader = new FileReader();

    reader.onload = (e: any) => {
      try {
        // read workbook
        const bstr: string = e.target.result;
        const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });
        // grab first sheet
        const worksheetName: string = wb.SheetNames[0];
        const ws: XLSX.WorkSheet = wb.Sheets[worksheetName];
        // save data
        const data = <SheetTable>XLSX.utils.sheet_to_json(ws, { header: 1 });

        // set the data
        this.sheet$.next(this.parseData(data));
      } catch (error) {
        console.log(error);
      }
    };

    // read the file
    if (target.files[0]) {
      reader.readAsBinaryString(target.files[0]);
    }
  }

  updateCalculations = () => {
    this.sheet?.forEach(unitData => {
      const unitMeasuredEntries = unitData.usage.filter(reading => !reading.useAverage && reading.reading > 0) ?? [];
      const averagedEntries = unitData.usage.filter(reading => reading.useAverage) ?? [];
      unitData.measuredTotal = unitMeasuredEntries.reduce((prev, curr) => prev + curr.reading, 0);
      unitData.unitAverage = (unitMeasuredEntries.length > 0 ? Math.ceil(unitData.measuredTotal / unitMeasuredEntries.length) : 0);
      unitData.averagedTotal = averagedEntries.length * unitData.unitAverage;
    });
    this.commonUsageUnits = this.sheet?.filter(unit => unit.isCommon).length ?? 0;
    const sumMeasuredTotals = this.sheet?.reduce((prev, curr) => (prev + curr.measuredTotal), 0);
    const sumAveragedTotals = this.sheet?.reduce((prev, curr) => (prev + curr.averagedTotal), 0);
    this.calculatedConsumption = (sumMeasuredTotals ?? 0) + (sumAveragedTotals ?? 0);

    if (this.importForm.value.ohtInput) {
      const ohtVariation = Number(this.importForm.value.ohtInput) - this.calculatedConsumption;
      this.sheet?.forEach(unitData => {
        unitData.variation = Math.ceil((unitData.measuredTotal + unitData.averagedTotal) / this.calculatedConsumption * ohtVariation);
      });
    }

    // calculate the billable without common usage
    this.sheet?.forEach(unitData => {
      unitData.billable = unitData.measuredTotal + unitData.averagedTotal + (this.importForm.value.ohtInput ? unitData.variation : 0);
    });

    if (this.sheet && this.commonUsageUnits) {
      const commonUsageTotal = this.sheet.filter(unit => unit.isCommon).reduce((prev, curr) => {
        prev += curr.billable;

        return prev;
      }, 0);

      const commonUsageShare = Math.ceil(commonUsageTotal / (this.sheet.length - this.commonUsageUnits));

      this.sheet.forEach(unit => {
        unit.commonShare = unit.isCommon ? 0 : commonUsageShare;
      });

      this.sheet?.forEach(unitData => {
        unitData.billable = unitData.billable + unitData.commonShare;
      });
    }

    if (this.importForm.value.tankerPrice) {
      this.sheet?.forEach(unitData => {
        unitData.billed = Math.ceil(unitData.billable * this.importForm.value.tankerPrice / 6000);
      });
    }
  };

  commonUsageChanged = (event: Event, unit: Unit) => {
    const commonUsageCheckbox = event.currentTarget as HTMLInputElement;
    this.updateCommonUsage(unit.unitName, commonUsageCheckbox.checked);
  };

  useAverageChanged = (event: Event, unitName: string, date: string) => {
    const useAverageCheckbox = event.currentTarget as HTMLInputElement;
    this.updateData(unitName, date, useAverageCheckbox.checked);
  };

  useAverageForDateChanged = (event: Event, date: string) => {
    const useAverageForDateCheckbox = event.currentTarget as HTMLInputElement;
    this.updateDataForDate(date, useAverageForDateCheckbox.checked);
  };

  updateCommonUsage = (unitName: string, checked: boolean) => {
    if (this.sheet) {
      const unit = this.sheet?.find(unit => unit.unitName === unitName);

      if (unit) {
        unit.isCommon = checked;

        this.sheet$.next(this.sheet);
      }
    }
  };

  updateData = (unitName: string, date: string, checked: boolean) => {
    if (this.sheet) {
      const unit = this.sheet?.find(unit => unit.unitName === unitName);
      const usage = unit?.usage.find(usage => usage.date === date);

      if (usage) {
        usage.useAverage = checked;

        this.sheet$.next(this.sheet);
      }
    }
  };

  updateDataForDate = (date: string, checked: boolean) => {
    let changed = false;

    if (this.sheet) {
      this.sheet.forEach((unit => {
        const usage = unit.usage.find(usage => usage.date === date);

        if (usage) {
          changed = true;
          usage.useAverage = checked;
        }
      }));

      if (changed) {
        this.sheet$.next(this.sheet);
      }
    }
  };

  parseData = (sheetTable: SheetTable): Sheet => {
    const headerRow = sheetTable.splice(0, 1)[0].splice(1);
    this.importHeaders = headerRow.splice(0, headerRow.length - 1);
    const sheet: Sheet = sheetTable.map(row => {
      const unitName = row.splice(0, 1)[0];

      return {
        unitName,
        isCommon: false,
        usage: row.splice(0, row.length - 1).map((reading, i) => ({ date: this.importHeaders[i], reading, useAverage: false })),
      } as Unit;
    });

    return sheet;
  };

  // export(): void { 
  //   const exportHeaders = ['Block', 'Unit', 'Charge Type', 'Charge Description', 'Charge Date', 'Pay by Date', 'Amount'];
  //   if (this.data) {
  //     let exportData: SheetTable = [exportHeaders];

  //     console.log(this.data);

  //     let unitData = Object.keys(this.data).sort()
  //       .map((unit, index) => {
  //         return [this.exportForm.value.blockName, unit, 'Water Charges', `Water Charges for ${this.exportForm.value.billingFrom} to ${this.exportForm.value.billingTo}`, this.exportForm.value.billingDate, this.exportForm.value.dueDate, this.billed[index]];
  //       })
  //       .filter(unit => {
  //         console.log(unit, unit[0]);
  //         return !this.data?.[unit[1]]?.isCommon
  //       });
  //     exportData.push(...unitData);

  //     /* generate worksheet */
  //     const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(exportData);

  //     // /* generate workbook and add the worksheet */
  //     const wb: XLSX.WorkBook = XLSX.utils.book_new();
  //     XLSX.utils.book_append_sheet(wb, ws, this.exportForm.value.blockName);

  //     // /* save to file */
  //     XLSX.writeFile(wb, `water bill ${this.exportForm.value.blockName.toLowerCase()} - ${this.exportForm.value.billingFrom} to ${this.exportForm.value.billingTo}.xlsx`);
  //   }
  // }

  canSelectReport = (event: Event) => {
    if (!this.importForm.valid) {
      event.preventDefault();
    }
  };
}
