import { ReplaySubject } from 'rxjs';
import * as XLSX from 'xlsx';

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';

import { Data } from '../../data';

type UsageEntry = {
  date: string;
  reading: number;
  averageReading: number;
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
type SheetTable = Array<Array<any>>;

@Component({
  selector: 'saoa-metered',
  templateUrl: './metered.page.html',
  styleUrls: ['./metered.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeteredPage {
  public readonly blocks = Data.blocks;
  public sheet$ = new ReplaySubject<Sheet>();
  public sheet: Sheet | null = null;
  public dates: Array<string> = [];
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

  parseData = (sheetTable: SheetTable): Sheet => {
    const [[waste, ...headers], ...dataRows] = sheetTable;
    this.dates = headers.slice(0, -1);
    console.log(waste, this.dates, dataRows);
    const sheet: Sheet = sheetTable.slice(1).map(row => {
      const unitName = row.slice(0)[0];

      return {
        unitName,
        isCommon: false,
        usage: row.slice(1, -1).map((reading, i) => ({ date: this.dates[i], reading, useAverage: false })),
      } as Unit;
    });

    return sheet;
  };

  updateCalculations = () => {
    this.sheet?.forEach(unitData => {
      // any reading which is not marked to be averaged and is greater than zero
      const unitMeasuredEntries = unitData.usage.filter(reading => !reading.useAverage && reading.reading > 0) ?? [];
      // any reading which is marked as average
      const averagedEntries = unitData.usage.filter(reading => reading.useAverage) ?? [];

      // calculate the totals for measured and averaged values
      unitData.measuredTotal = unitMeasuredEntries.reduce((prev, curr) => prev + curr.reading, 0);
      unitData.unitAverage = (unitMeasuredEntries.length > 0 ? Math.ceil(unitData.measuredTotal / unitMeasuredEntries.length) : 0);
      averagedEntries.forEach(entry => entry.averageReading = unitData.unitAverage);
      unitData.averagedTotal = averagedEntries.reduce((prev, curr) => (prev + curr.averageReading), 0);
    });

    // get the units which are marked for the common usage
    this.commonUsageUnits = this.sheet?.filter(unit => unit.isCommon).length ?? 0;

    // get the block level consumption for all the units
    const sumMeasuredTotals = this.sheet?.reduce((prev, curr) => (prev + curr.measuredTotal), 0);
    const sumAveragedTotals = this.sheet?.reduce((prev, curr) => (prev + curr.averagedTotal), 0);
    this.calculatedConsumption = (sumMeasuredTotals ?? 0) + (sumAveragedTotals ?? 0);

    // unit wise weighted variation
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

    // calculate the billable amount with common usage
    if (this.sheet && this.commonUsageUnits) {
      const commonUsageTotal = this.sheet.filter(unit => unit.isCommon).reduce((prev, curr) => (prev + curr.billable), 0);
      // const commonUsageShare = Math.ceil(commonUsageTotal / (this.sheet.length - this.commonUsageUnits));

      this.sheet.forEach(unitData => {
        unitData.commonShare = unitData.isCommon ? 0 : Math.ceil((unitData.measuredTotal + unitData.averagedTotal) / this.calculatedConsumption * commonUsageTotal);
      });

      this.sheet?.forEach(unitData => {
        unitData.billable = unitData.isCommon ? 0 : unitData.billable + unitData.commonShare;
      });
    }

    if (this.importForm.value.tankerPrice) {
      this.sheet?.forEach(unitData => {
        unitData.billed = unitData.isCommon ? 0 : Math.ceil(unitData.billable * this.importForm.value.tankerPrice / 6000);
      });
    }
  };

  commonUsageChanged = (event: Event, unit: Unit) => {
    const isCommonUsage = (event.currentTarget as HTMLInputElement).checked;
    const unitName = unit.unitName;

    if (this.sheet) {
      const selectedUnit = this.sheet?.find(unitData => unitData.unitName === unitName);

      if (selectedUnit) {
        selectedUnit.isCommon = isCommonUsage;

        this.sheet$.next(this.sheet);
      }
    }
  };

  useAverageChanged = (event: Event, unitName: string, date: string) => {
    const useAverageCheckbox = event.currentTarget as HTMLInputElement;
    this.updateData(unitName, date, useAverageCheckbox.checked);
  };

  useAverageForDateChanged = (event: Event, date: string) => {
    const useAverageForDateCheckbox = event.currentTarget as HTMLInputElement;
    this.updateDataForDate(date, useAverageForDateCheckbox.checked);
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

  export(): void {
    const exportHeaders = ['Block', 'Unit', 'Charge Type', 'Charge Description', 'Charge Date', 'Pay by Date', 'Amount'];

    if (this.sheet) {
      const exportData: SheetTable = [exportHeaders];
      //   console.log(this.data);
      const unitData = this.sheet
        .filter((unitData) => !unitData.isCommon)
        .map((unitData) => {
          return [Data.blocks.find(block => block.key === this.exportForm.value.blockName)?.name, unitData.unitName, 'Water Charges', `Water Charges for ${this.exportForm.value.billingFrom} to ${this.exportForm.value.billingTo}`, this.exportForm.value.billingDate, this.exportForm.value.dueDate, unitData.billed];
        });
      exportData.push(...unitData);

      /* generate worksheet */
      const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(exportData);
      // /* generate workbook and add the worksheet */
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, this.exportForm.value.blockName);

      // /* save to file */
      XLSX.writeFile(wb, `water bill ${Data.blocks.find(block => block.key === this.exportForm.value.blockName)?.name.toLowerCase()} - ${this.exportForm.value.billingFrom} to ${this.exportForm.value.billingTo}.xlsx`);
    }
  }

  canSelectReport = (event: Event) => {
    if (!this.importForm.valid) {
      event.preventDefault();
    }
  };
}
