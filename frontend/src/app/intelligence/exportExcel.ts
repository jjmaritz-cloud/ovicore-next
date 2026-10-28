/* Offline, dependency-free XLSX export of the currently authorised Intelligence response.
 * Exports structured, filterable Excel tables; no server calls or extra permissions.
 */
type Cell = string | number | null | undefined;
type Column = { key: string; label: string };
type Chart = { title: string; points: Array<{date:string;[key:string]:Cell}>; series?: Array<{key:string;label:string;unit:string}>; metric?: string; additional_charts?: Chart[] };
export type IntelligenceExport = {
  title:string;answer:string;scope:{start?:string;end?:string};
  cards:Array<{label:string;value:number|null;unit?:string}>;
  columns:Column[];rows:Array<Record<string,Cell>>; chart:Chart|null;observations:string[];
};
const esc=(v:unknown)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function colName(n:number){let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function xmlCell(v:Cell,ref:string,header=false){
  if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}"${header?' s="1"':''}><v>${v}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${header?' s="1"':''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}
function sheetXml(matrix:Cell[][],autoFilter=false,hasTable=false){
  const width=Math.max(1,...matrix.map(r=>r.length)),end=`${colName(width)}${Math.max(1,matrix.length)}`;
  // Size columns from the actual header and a small sample of displayed values.
  // A minimum header width prevents truncated titles in Excel.
  const widths=Array.from({length:width},(_,j)=>{
    const header=String(matrix[0]?.[j]??'');
    const headerWidth=Math.min(62,header.length+6);
    const dataWidth=Math.max(0,...matrix.slice(1,101).map(r=>String(r[j]??'').length));
    return Math.min(62,Math.max(17,headerWidth,Math.min(dataWidth+3,38)));
  });
  const rows=matrix.map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>xmlCell(v,`${colName(j+1)}${i+1}`,i===0)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${end}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="19"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData>${autoFilter&&!hasTable?`<autoFilter ref="A1:${end}"/>`:''}${hasTable?'<tableParts count="1"><tablePart r:id="rId1"/></tableParts>':''}</worksheet>`;
}
function tableXml(id:number,name:string,headers:string[],rows:number){
  const ref=`A1:${colName(headers.length)}${rows}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${id}" name="${name}" displayName="${name}" ref="${ref}" totalsRowShown="0"><autoFilter ref="${ref}"/><tableColumns count="${headers.length}">${headers.map((h,i)=>`<tableColumn id="${i+1}" name="${esc(h)}"/>`).join('')}</tableColumns><tableStyleInfo name="TableStyleLight9" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`;
}
const encoder=new TextEncoder();
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(b:Uint8Array){let c=0xFFFFFFFF;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
function zip(files:Array<[string,string]>){
  const chunks:Uint8Array[]=[];const directory:Uint8Array[]=[];let offset=0;
  const u16=(d:DataView,p:number,v:number)=>d.setUint16(p,v,true);
  const u32=(d:DataView,p:number,v:number)=>d.setUint32(p,v>>>0,true);
  for(const [name,body] of files){
    const filename=encoder.encode(name),data=encoder.encode(body),crc=crc32(data);
    const local=new Uint8Array(30+filename.length),ld=new DataView(local.buffer);
    u32(ld,0,0x04034b50);u16(ld,4,20);u16(ld,6,0x0800);u16(ld,8,0);u32(ld,14,crc);u32(ld,18,data.length);u32(ld,22,data.length);u16(ld,26,filename.length);local.set(filename,30);
    const central=new Uint8Array(46+filename.length),cd=new DataView(central.buffer);
    u32(cd,0,0x02014b50);u16(cd,4,20);u16(cd,6,20);u16(cd,8,0x0800);u32(cd,16,crc);u32(cd,20,data.length);u32(cd,24,data.length);u16(cd,28,filename.length);u32(cd,42,offset);central.set(filename,46);
    chunks.push(local,data);directory.push(central);offset+=local.length+data.length;
  }
  const centralSize=directory.reduce((n,c)=>n+c.length,0);const end=new Uint8Array(22);const ed=new DataView(end.buffer);
  u32(ed,0,0x06054b50);u16(ed,8,files.length);u16(ed,10,files.length);u32(ed,12,centralSize);u32(ed,16,offset);
  return new Blob([...chunks,...directory,end] as BlobPart[],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export function exportIntelligenceExcel(result:IntelligenceExport){
  // Export only the columns and records displayed in the Supporting Records block.
  // Do not add summary, trend or other tabs: this is a working data table.
  const headings=result.columns.map(c=>c.label);
  const dateAU=(v:Cell):Cell=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
    ?`${v.slice(8,10)}/${v.slice(5,7)}/${v.slice(0,4)}`:v;
  const matrix:Cell[][]=[headings,...result.rows.map(row=>result.columns.map(c=>dateAU(row[c.key])))];
  const sheets=[{name:'Data breakdown',matrix,table:headings.length>0 && result.rows.length>0}];
  const files:Array<[string,string]>=[];
  const types=['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'];
  const relationships=['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'];
  const wbSheets:string[]=[];let tableNo=0;
  sheets.forEach((s,i)=>{
    const n=i+1;const hasTable=s.table;
    types.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    relationships.push(`<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`);
    wbSheets.push(`<sheet name="${esc(s.name)}" sheetId="${n}" r:id="rId${n}"/>`);
    files.push([`xl/worksheets/sheet${n}.xml`,sheetXml(s.matrix,hasTable,hasTable)]);
    if(hasTable){tableNo++;types.push(`<Override PartName="/xl/tables/table${tableNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`);
      files.push([`xl/tables/table${tableNo}.xml`,tableXml(tableNo,`OviCoreData${tableNo}`,s.matrix[0].map(x=>String(x??'')),s.matrix.length)]);
      files.push([`xl/worksheets/_rels/sheet${n}.xml.rels`,`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${tableNo}.xml"/></Relationships>`]);
    }
  });
  files.push(['[Content_Types].xml',types.join('')+'</Types>']);
  files.push(['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
  files.push(['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${wbSheets.join('')}</sheets></workbook>`]);
  files.push(['xl/_rels/workbook.xml.rels',relationships.join('')+`<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
  files.push(['xl/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FF133B4C"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCEFF4"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs></styleSheet>']);
  const blob=zip(files),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`OviCore_Intelligence_${result.scope.start||'export'}_${result.scope.end||''}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
