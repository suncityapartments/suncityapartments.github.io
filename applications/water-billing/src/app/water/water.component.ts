import { Component } from '@angular/core';
import { ReplaySubject } from 'rxjs';
import * as XLSX from 'xlsx';

type SheetTable = any[][];

type UsageEntry = {
  date: string;
  reading: number;
  useAverage: boolean;
}

type UnitUsage = Array<UsageEntry>;

type SheetData = {
  [key: string]: UnitUsage;
}


@Component({
  selector: 'saoa-water',
  templateUrl: './water.component.html',
  styleUrls: ['./water.component.scss']
})
export class WaterComponent {
  public data$ = new ReplaySubject<SheetData | null>();
  public data: SheetData | null = null;
  public dates: Array<Pick<UsageEntry, 'date'>> | null = null;
  public measuredTotals: Array<number> = Array.from(Array(1), () => (0));
  public averagedTotals: Array<number> = Array.from(Array(1), () => (0));
  public averages: Array<number> = Array.from(Array(1), () => (0));
  public variations: Array<number> = Array.from(Array(1), () => (0));
  public billable: Array<number> = Array.from(Array(1), () => (0));
  public billed: Array<number> = Array.from(Array(1), () => (0));
  public calculatedConsumption: number = 0;
  public ohtInput: number = 0;
  public tankerPrice: number = 0;

  constructor() {
    this.data$.subscribe((data) => {
      this.data = data;
      this.updateTotals();
    });
  }

  onFileChange(evt: any) {
    /* wire up file reader */
    const target: DataTransfer = <DataTransfer>(evt.target);
    // if (target.files.length !== 1) throw new Error('Cannot use multiple files');
    const reader: FileReader = new FileReader();
    this.data$.next(null);
    reader.onload = (e: any) => {
      try {
        /* read workbook */
        const bstr: string = e.target.result;
        const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });

        /* grab first sheet */
        const wsname: string = wb.SheetNames[0];
        const ws: XLSX.WorkSheet = wb.Sheets[wsname];

        /* save data */
        const data = <SheetTable>XLSX.utils.sheet_to_json(ws, { header: 1 });
        // console.log(data);
        this.data$.next(this.transposeData(data));
      } catch (error) {
        console.log(error);
      }
    };
    if (target.files[0]) {
      reader.readAsBinaryString(target.files[0]);
    }
  }

  updateTotals = () => {
    if (this.data) {
      Object.keys(this.data).sort().map((unit, index) => {
        let measuredEntries = this.data?.[unit].filter(reading => !reading.useAverage && reading.reading > 0) ?? [];
        let averagedEntries = this.data?.[unit].filter(reading => reading.useAverage) ?? [];

        let measuredTotalForUnit = measuredEntries.reduce((prev, curr) => prev + curr.reading, 0);
        let averageForUnit = measuredEntries.length > 0 ? Math.ceil(measuredTotalForUnit / measuredEntries.length) : 0;
        let averageTotalForUnit = averagedEntries.reduce((prev) => prev + averageForUnit, 0);
        this.averages[index] = averageForUnit;

        this.measuredTotals[index] = measuredTotalForUnit ?? 0;
        this.averagedTotals[index] = averageTotalForUnit ?? 0;
      })
      this.calculatedConsumption = this.measuredTotals.reduce((prev, curr) => (prev + curr), 0) + this.averagedTotals.reduce((prev, curr) => (prev + curr), 0);

      if (!!this.ohtInput) {
        const ohtVariation = Number(this.ohtInput) - this.calculatedConsumption
        this.variations = this.measuredTotals.map((measured, index) => Math.ceil(((measured + this.averagedTotals[index]) / this.calculatedConsumption * ohtVariation)));
      }
      this.billable = this.measuredTotals.map((measured, index) => Math.ceil(((measured + this.averagedTotals[index] + (this.ohtInput ? this.variations[index] : 0)))));
      if (!!this.tankerPrice) {
        this.billed = this.measuredTotals.map((measured, index) => Math.ceil(this.billable[index] * this.tankerPrice / 6000));
      }
    } else {
      this.data = null
      this.measuredTotals = Array.from(Array(1), () => (0));
      this.averages = Array.from(Array(1), () => (0));
      this.variations = Array.from(Array(1), () => (0));
      this.averagedTotals = Array.from(Array(1), () => (0));
      this.calculatedConsumption = 0;
    }
  }

  useAverageChanged = (event: Event, unit: string, date: string) => {
    const useAverageCheckbox = event.currentTarget as HTMLInputElement;
    this.data$.next(this.updateData(this.data!, useAverageCheckbox.checked, unit, date));
  }

  useAverageForDateChanged = (event: Event, date: string) => {
    const useAverageForDateCheckbox = event.currentTarget as HTMLInputElement;
    this.data$.next(this.updateDataForDate(this.data!, useAverageForDateCheckbox.checked, date));
  }

  updateData = (data: SheetData, checked: boolean, unit: string, date: string) => {
    if (data[unit]) {
      let readings = data[unit] as Array<any>
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
        let unitData = data[unit];
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
      // let val = Date.now();
      // try {

      //   val = Date.parse(cell)
      // } catch {
      //   val = Date.now();
      // }

      // return {
      //   date: new Date(val).toLocaleString('en-IN', { dateStyle: 'medium' })
      // }
      return { date: cell }
    }).splice(1);
    this.dates = this.dates.slice(0, this.dates.length - 1);
    data = data.splice(1);

    const finalData: SheetData = {};
    return data.reduce((prev: any, row, index): SheetData => {
      const unit = row[0];
      row = row.splice(1);
      row = row.slice(0, row.length - 1);
      prev[`Unit ${unit}`] = [...row.map((reading, index) => ({ ...this.dates?.[index], reading: Number(reading), useAverage: false }))];
      return prev;
    }, finalData)
  }

}
