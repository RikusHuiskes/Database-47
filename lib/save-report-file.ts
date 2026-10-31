export type ReportFileHandle={createWritable:()=>Promise<{write:(data:Blob)=>Promise<void>;close:()=>Promise<void>;abort?:()=>Promise<void>}>};
export type ReportFilePicker=(options:{suggestedName:string;excludeAcceptAllOption:boolean;types:{description:string;accept:Record<string,string[]>}[]})=>Promise<ReportFileHandle>;

export async function saveReportFile(picker:ReportFilePicker|undefined,format:'csv'|'xlsx',days:number,load:()=>Promise<Blob>){
 if(!picker)throw Error('Deze browser ondersteunt geen rechtstreeks Opslaan als-venster. Open deze site in Chrome of Edge om het rapport op te slaan. Je kunt het rapport hieronder ook direct bekijken.');
 const filename=`cote-de-duras-bereik-${days}-dagen.${format}`;
 // Open from the button's user gesture, before any authentication or network await.
 const handle=await picker({suggestedName:filename,excludeAcceptAllOption:true,types:[{description:format==='csv'?'CSV-rapport':'Excel-rapport',accept:{[format==='csv'?'text/csv':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']:['.'+format]}}]});
 const data=await load();
 const file=await handle.createWritable();
 try{await file.write(data);await file.close();}catch(error){try{await file.abort?.();}catch{}throw error;}
 return filename;
}
