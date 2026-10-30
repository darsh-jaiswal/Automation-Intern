import {Document,Packer,Paragraph,TextRun,HeadingLevel,Table,TableRow,TableCell,WidthType} from 'docx';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {root} from '../src/config.mjs';
const text=await readFile(`${root}docs/Task_2_Hook_Grader.md`,'utf8');
const children=[],lines=text.split(/\r?\n/);
for(let index=0;index<lines.length;index++){
  const line=lines[index];if(!line.trim())continue;
  if(line.startsWith('|')){
    const rows=[];
    while(index<lines.length&&lines[index].startsWith('|')){
      const cells=lines[index].split('|').slice(1,-1).map(cell=>cell.trim());
      if(!cells.every(cell=>/^[-: ]+$/.test(cell)))rows.push(new TableRow({children:cells.map(cell=>new TableCell({children:[new Paragraph({children:[new TextRun({text:cell,bold:rows.length===0})]})]}))}));
      index++;
    }
    index--;children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows}));continue;
  }
  const heading=line.match(/^(#{1,3})\s+(.*)/);
  if(heading){children.push(new Paragraph({text:heading[2],heading:[HeadingLevel.TITLE,HeadingLevel.HEADING_1,HeadingLevel.HEADING_2][heading[1].length-1]}));continue;}
  children.push(new Paragraph({children:[new TextRun(line.replace(/\*\*/g,'').replace(/`/g,''))],spacing:{after:130}}));
}
const document=new Document({creator:'Darsh Jaiswal',title:'Task 2 - Hook Grader and Loom Notes',styles:{default:{document:{run:{font:'Calibri',size:22}}}},sections:[{children}]});
const path=`${root}docs/Task_2_Loom_Notes_Darsh.docx`;await writeFile(path,await Packer.toBuffer(document));await copyFile(path,`${root}../Task_2_Loom_Notes_Darsh.docx`);
console.log('Editable Task 2 notes saved in docs and the assignment folder. No credentials included.');
