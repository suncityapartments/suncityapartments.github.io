import { Component, inject } from '@angular/core';
import { ReplaySubject } from 'rxjs';
import * as XLSX from 'xlsx';
import { Data } from './data';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';

type SheetTable = any[][];

type UsageEntry = {
  date: string;
  reading: number;
  useAverage: boolean;
}

type UnitUsage = Array<UsageEntry>;

type Unit = {
  name: string;
  isCommon: boolean;
  usage: UnitUsage;
};

type SheetData = {
  [unit: string]: Unit;
}


@Component({
  selector: 'saoa-water',
  templateUrl: './water.component.html',
  styleUrls: ['./water.component.scss']
})
export class WaterComponent {
  public blocks = Data.blocks;
  public exportHeaders = ['Block', 'Unit', 'Charge Type', 'Charge Description', 'Charge Date', 'Pay by Date', 'Amount']
  public data$ = new ReplaySubject<SheetData | null>();
  public data: SheetData | null = null;
  public commonUsageUnits: Array<Unit> = [];
  public dates: Array<Pick<UsageEntry, 'date'>> | null = null;
  public measuredTotals: Array<number> = Array.from(Array(1), () => (0));
  public averagedTotals: Array<number> = Array.from(Array(1), () => (0));
  public averages: Array<number> = Array.from(Array(1), () => (0));
  public variations: Array<number> = Array.from(Array(1), () => (0));
  public commonUsageShares: Array<number> = Array.from(Array(1), () => (0));
  public billable: Array<number> = Array.from(Array(1), () => (0));
  public billed: Array<number> = Array.from(Array(1), () => (0));
  public calculatedConsumption: number = 0;
  public ohtInput: number = 0;
  public tankerPrice: number = 0;
  public txtBlock: string = '';
  public datePeriodFrom: Date = new Date();
  public datePeriodTo: Date = new Date();
  public dateChagred: Date = new Date();
  public datePaymentLast: Date = new Date();
  public exportForm: FormGroup
  public formsBuilder = inject(FormBuilder);

  constructor() {
    this.data$.subscribe((data) => {
      this.data = data;
      this.updateTotals();
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
        const wsname: string = wb.SheetNames[0];
        const ws: XLSX.WorkSheet = wb.Sheets[wsname];

        // save data
        const data = <SheetTable>XLSX.utils.sheet_to_json(ws, { header: 1 });

        // set the data
        this.data$.next(this.transposeData(data));
      } catch (error) {
        console.log(error);
      }
    };

    // read the file
    if (target.files[0]) {
      if (this.data) this.data$.next(null);
      reader.readAsBinaryString(target.files[0]);
    }
  }

  updateTotals = () => {
    if (this.data) {
      this.commonUsageUnits = Object.keys(this.data)
        .sort()
        .filter(unit => this.data?.[unit].isCommon)
        .map(unit => this.data![unit]);

      Object.keys(this.data)
        .sort()
        .forEach((unit, index) => {
          // measured entries of given unit
          let measuredEntries = this.data?.[unit].usage.filter(reading => !reading.useAverage && reading.reading > 0) ?? [];

          // averaged entries of given unit
          let averagedEntries = this.data?.[unit].usage.filter(reading => reading.useAverage) ?? [];

          // calculate the total of all the measured readings
          let measuredTotalForUnit = measuredEntries.reduce((prev, curr) => prev + curr.reading, 0);

          // calculate average of a unit
          let averageForUnit = measuredEntries.length > 0 ? Math.ceil(measuredTotalForUnit / measuredEntries.length) : 0;

          // calculate the total of all the measured readings
          let averageTotalForUnit = averagedEntries.reduce((prev) => prev + averageForUnit, 0);
          this.averages[index] = averageForUnit;

          this.measuredTotals[index] = measuredTotalForUnit ?? 0;
          this.averagedTotals[index] = averageTotalForUnit ?? 0;
        });
      const sumMeasuredTotals = this.measuredTotals.reduce((prev, curr) => (prev + curr), 0);
      const sumAveragedTotals = this.averagedTotals.reduce((prev, curr) => (prev + curr), 0);
      this.calculatedConsumption = sumMeasuredTotals + sumAveragedTotals;

      if (!!this.ohtInput) {
        const ohtVariation = Number(this.ohtInput) - this.calculatedConsumption
        this.variations = this.measuredTotals.map((measured, index) => Math.ceil(((measured + this.averagedTotals[index]) / this.calculatedConsumption * ohtVariation)));
      }

      // get the billable without common usage
      let billable = this.measuredTotals.map((measured, index) => Math.ceil(((measured + this.averagedTotals[index] + (this.ohtInput ? this.variations[index] : 0)))));

      if (this.commonUsageUnits.length > 0) {
        const commonUsageTotal = this.billable.reduce((prev, curr, index) => {
          if (this.data && this.data?.[Object.keys(this.data).sort()[index]].isCommon) {
            prev += curr;
          }
          return prev;
        }, 0);
        
        const commonUsageShare = Math.ceil(commonUsageTotal / (this.measuredTotals.length - this.commonUsageUnits.length));

        this.commonUsageShares = this.measuredTotals.map((measured, index) => (this.data && this.data?.[Object.keys(this.data).sort()[index]].isCommon)?0:commonUsageShare)

        billable = billable.map((amount, index) => amount + this.commonUsageShares[index]);
      }

      this.billable = billable;

      if (!!this.tankerPrice) {
        this.billed = this.measuredTotals.map((measured, index) => Math.ceil(this.billable[index] * this.tankerPrice / 6000));
      }
    } else {
      this.data = null
      this.measuredTotals = Array.from(Array(1), () => (0));
      this.averages = Array.from(Array(1), () => (0));
      this.variations = Array.from(Array(1), () => (0));
      this.averagedTotals = Array.from(Array(1), () => (0));
      this.commonUsageShares = Array.from(Array(1), () => (0));
      this.commonUsageUnits = [];
      this.calculatedConsumption = 0;
    }
  }

  commonUsageChanged = (event: Event, unit: string) => {
    const commonUsageCheckbox = event.currentTarget as HTMLInputElement;
    this.data$.next(this.updateCommonUsage(this.data!, commonUsageCheckbox.checked, unit));
  }

  useAverageChanged = (event: Event, unit: string, date: string) => {
    const useAverageCheckbox = event.currentTarget as HTMLInputElement;
    this.data$.next(this.updateData(this.data!, useAverageCheckbox.checked, unit, date));
  }

  useAverageForDateChanged = (event: Event, date: string) => {
    const useAverageForDateCheckbox = event.currentTarget as HTMLInputElement;
    this.data$.next(this.updateDataForDate(this.data!, useAverageForDateCheckbox.checked, date));
  }

  updateCommonUsage = (data: SheetData, checked: boolean, unit: string) => {
    if (data[unit]) {
      data[unit].isCommon = checked;
    }
    return data;
  }

  updateData = (data: SheetData, checked: boolean, unit: string, date: string) => {
    if (data[unit]) {
      let readings = data[unit].usage as Array<any>
      let reading = readings.find(reading => reading.date === date);
      if (reading) {
        reading.useAverage = checked;
      };
    }
    return data;
  }

  updateDataForDate = (data: SheetData, checked: boolean, date: string) => {
    if (data) {
      Object.keys(data).forEach((unit) => {
        let unitData = data[unit].usage;
        let entry = unitData.find(entry => entry.date === date);
        if (entry) {
          entry.useAverage = checked;
        }
      })
    }
    return data;
  }

  transposeData = (data: SheetTable): SheetData => {
    this.dates = data[0].map(cell => {
      return { date: cell }
    }).splice(1);
    this.dates = this.dates.slice(0, this.dates.length - 1);
    data = data.splice(1);

    const finalData: SheetData = {};
    return data.reduce((prev: any, row, index): SheetData => {
      const unit = row[0];
      row = row.splice(1);
      row = row.slice(0, row.length - 1);
      prev[`${unit}`] = {
        name: unit,
        isCommon: false,
        usage: [...row.map((reading, index) => ({ ...this.dates?.[index], reading: Number(reading), useAverage: false }))]
      };
      return prev;
    }, finalData)
  }

  export(): void {
    if (this.data) {
      let exportData: SheetTable = [this.exportHeaders];

      let unitData = Object.keys(this.data).sort().map((unit, index) => {
        return [this.txtBlock, unit, 'Water Charges', `Water Charges for ${this.datePeriodFrom} to ${this.datePeriodTo}`, this.dateChagred, this.datePaymentLast, this.billed[index]];
      })
      exportData.push(...unitData);

      /* generate worksheet */
      const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(exportData);

      // /* generate workbook and add the worksheet */
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, this.txtBlock);

      // /* save to file */
      XLSX.writeFile(wb, `water bill ${this.txtBlock.toLowerCase()} - ${this.datePeriodFrom} to ${this.datePeriodTo}.xlsx`);
    }
  }
}
