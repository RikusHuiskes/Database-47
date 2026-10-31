import {analyticsRows,type AnalyticsReport} from './analytics-report.ts';
export async function analyticsWorkbook(report:AnalyticsReport,days:number){
 const {default:ExcelJS}=await import('exceljs');
 const workbook=new ExcelJS.Workbook();
 workbook.creator='Côte de Duras';
 const sheet=workbook.addWorksheet('Bereikrapport');
 sheet.addRows(analyticsRows(report,days));
 sheet.columns.forEach((column,index)=>{column.width=index===0?55:24;});
 sheet.getRow(1).font={bold:true,size:16,color:{argb:'FF21483D'}};
 sheet.views=[{state:'frozen',ySplit:3}];
 sheet.eachRow(row=>{row.alignment={vertical:'top',wrapText:true};});
 return workbook.xlsx.writeBuffer();
}
