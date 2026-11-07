/** MathType MTEF v3/v5 decoder for Word OLE Equation Native streams. */
const RT = { END: 0, LINE: 1, CHAR: 2, TMPL: 3, PILE: 4, MATRIX: 5, SIZE: 9, FUTURE: 100 } as const;
const OPT = { NUDGE: 0x08, EMBELL: 0x01, CHAR8: 0x04, CHAR16: 0x10, NO_MTCODE: 0x20, LSPACE: 0x04 } as const;
const SYMBOLS: Record<number, string> = { 32:' ',42:' \\times ',43:' + ',45:' - ',47:'/',60:' < ',61:' = ',62:' > ',177:' \\pm ',215:' \\times ',247:' \\div ',8730:' \\sqrt ',8734:' \\infty ',8776:' \\approx ',8800:' \\ne ',8804:' \\le ',8805:' \\ge ',8592:' \\leftarrow ',8594:' \\to ',8652:' \\rightleftharpoons ',945:' \\alpha ',946:' \\beta ',947:' \\gamma ',948:' \\delta ',949:' \\varepsilon ',955:' \\lambda ',956:' \\mu ',960:' \\pi ',961:' \\rho ',963:' \\sigma ',969:' \\omega ',916:' \\Delta ',937:' \\Omega ' };

export function decodeMtefStream(bytes: Buffer, start: number): string {
  let pos = start; if (pos + 8 >= bytes.length) return '';
  const version = bytes[pos++]; pos += 4;
  if (version === 3) pos += 3; else { while (pos < bytes.length && bytes[pos] !== 0) pos++; pos += 2; }
  const parseLine = (): string => {
    if (pos >= bytes.length) return '';
    const options = bytes[pos++]; if (options & OPT.NUDGE) pos += 4; if (options & OPT.LSPACE) pos++;
    let out = '';
    while (pos < bytes.length) {
      const tag = bytes[pos++]; if (tag === RT.END) break;
      if (tag >= RT.FUTURE) { if (pos < bytes.length) pos += bytes[pos++]; continue; }
      if (tag === RT.LINE) { out += parseLine(); continue; }
      if (tag === RT.CHAR) {
        if (pos >= bytes.length) break;
        const charOptions = bytes[pos++]; if (charOptions & OPT.NUDGE) pos += 4; pos++;
        let mtcode = 0, glyph = 0;
        if (!(charOptions & OPT.NO_MTCODE) && pos + 2 <= bytes.length) { mtcode = bytes.readUInt16LE(pos); pos += 2; }
        if (charOptions & OPT.CHAR8 && pos < bytes.length) glyph = bytes[pos++];
        if (charOptions & OPT.CHAR16 && pos + 2 <= bytes.length) { glyph = bytes.readUInt16LE(pos); pos += 2; }
        if (charOptions & OPT.EMBELL) { while (pos < bytes.length && bytes[pos] !== 0) pos++; pos++; }
        const code = mtcode || glyph;
        out += code === 0x2113 ? 'l' : SYMBOLS[code] ?? (code >= 32 && code <= 126 ? String.fromCharCode(code) : code >= 0x0370 && code <= 0x03ff ? String.fromCharCode(code) : '');
        continue;
      }
      if (tag === RT.TMPL) {
        if (pos + 3 >= bytes.length) break;
        const templateOptions = bytes[pos++]; if (templateOptions & OPT.NUDGE) pos += 4;
        const selector = bytes[pos++], variation = bytes.readUInt16LE(pos); pos += 2;
        if (pos < bytes.length && ![RT.LINE, RT.CHAR, RT.TMPL, RT.END].includes(bytes[pos] as any)) pos++;
        const slot = (): string => { if (bytes[pos] !== RT.LINE) return ''; pos++; return parseLine().trim(); };
        if (selector === 29) { const sub = slot(), sup = slot(); out += variation & 1 ? `{}^{${sup}}_{${sub}}` : `_{${sub}}^{${sup}}`; }
        else if (selector === 27) out += `_{${slot()}}`;
        else if (selector === 28) out += `^{${slot()}}`;
        else if (selector === 0 || selector === 6) out += `\\frac{${slot()}}{${slot()}}`;
        else if (selector === 4) out += `\\sqrt{${slot()}}`;
        else if (selector === 5) out += `\\sqrt[${slot()}]{${slot()}}`;
        else if (selector === 31) out += `\\vec{${slot()}}`;
        else if (selector === 16) out += '\\sum ';
        else if (selector === 21) out += '\\int ';
        else out += slot();
        if (bytes[pos] === RT.END) pos++;
        continue;
      }
      if (tag === RT.SIZE) { pos += 2; continue; }
      if (tag === RT.PILE || tag === RT.MATRIX) out += parseLine();
    }
    return out;
  };
  let result = '';
  while (pos < bytes.length) { const tag = bytes[pos++]; if (tag === RT.END) break; if (tag === RT.LINE) result += parseLine(); else if (tag >= RT.FUTURE && pos < bytes.length) pos += bytes[pos++]; }
  return result.replace(/\s+/g, ' ').trim();
}

function cfbf(buffer: Buffer, name: string): Buffer | null {
  if (buffer.length < 512 || buffer.readUInt32LE(0) !== 0xe011cfd0 || buffer.readUInt32LE(4) !== 0xe11ab1a1) return null;
  const ss = 1 << buffer.readUInt16LE(30), ms = 1 << buffer.readUInt16LE(32), fatStart = buffer.readUInt32LE(76), dirStart = buffer.readUInt32LE(48), miniFatStart = buffer.readUInt32LE(60);
  const fat: number[] = [], fatBuf = buffer.slice((fatStart + 1) * ss, (fatStart + 2) * ss); for (let i=0;i<fatBuf.length;i+=4) fat.push(fatBuf.readUInt32LE(i));
  const dirs: Buffer[] = []; let d=dirStart; while(d<0xfffffffe&&d<fat.length){dirs.push(buffer.slice((d+1)*ss,(d+2)*ss));d=fat[d];} const dir=Buffer.concat(dirs), root=dir.slice(0,128);
  const miniParts: Buffer[]=[]; let m=root.readUInt32LE(116), mr=root.readUInt32LE(120); while(m<0xfffffffe&&m<fat.length&&mr>0){const n=Math.min(mr,ss);miniParts.push(buffer.slice((m+1)*ss,(m+1)*ss+n));mr-=n;m=fat[m];} const mini=Buffer.concat(miniParts);
  const mf:number[]=[]; let mfSec=miniFatStart; while(mfSec<0xfffffffe&&mfSec<fat.length){const part=buffer.slice((mfSec+1)*ss,(mfSec+2)*ss);for(let i=0;i<part.length;i+=4)mf.push(part.readUInt32LE(i));mfSec=fat[mfSec];}
  const target=Buffer.from(name,'utf16le');let entry:Buffer|null=null;for(let i=0;i<dir.length;i+=128){const e=dir.slice(i,i+128);if(e.readUInt16LE(64)>=target.length&&e.slice(0,target.length).equals(target)){entry=e;break;}}if(!entry)return null;
  const start=entry.readUInt32LE(116), size=entry.readUInt32LE(120), out:Buffer[]=[];let s=start, rem=size;
  if(size<4096&&mini.length&&mf.length){while(s<0xfffffffe&&s<mf.length&&rem>0){const n=Math.min(rem,ms);out.push(mini.slice(s*ms,s*ms+n));rem-=n;s=mf[s];}return Buffer.concat(out);}
  while(s<0xfffffffe&&s<fat.length&&rem>0){const n=Math.min(rem,ss);out.push(buffer.slice((s+1)*ss,(s+1)*ss+n));rem-=n;s=fat[s];}return Buffer.concat(out);
}
export function readCfbfStream(buffer: Buffer, name: string): Buffer|null { return cfbf(buffer,name); }
export function decodeMtefFromOleBuffer(buffer: Buffer): string|null { const stream=cfbf(buffer,'Equation Native'); if(!stream)return null; for(let i=0;i<stream.length-4;i++){if((stream[i]===3&&stream[i+1]===0&&stream[i+2]===1&&stream[i+3]===0)||(stream[i]===5&&stream[i+1]===1&&stream[i+2]===1)){const out=decodeMtefStream(stream,i);if(out)return out;}}return null; }
