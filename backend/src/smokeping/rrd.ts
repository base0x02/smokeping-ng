/**
 * Minimal reader for rrdtool's native binary .rrd format (versions 0001-0004),
 * so SmokePing history can be imported without rrdtool installed.
 *
 * The file is a raw dump of C structs, so its layout depends on the machine that
 * wrote it: byte order, sizeof(long) and the alignment of doubles. We try each
 * common ABI and keep the one whose float cookie matches and whose computed size
 * equals the file size exactly.
 */

const FLOAT_COOKIE = 8.642135e130;

interface Abi {
  littleEndian: boolean;
  /** sizeof(unsigned long) / sizeof(time_t) */
  longSize: 4 | 8;
  /** alignment of double inside structs */
  doubleAlign: 4 | 8;
}

const ABIS: Abi[] = [
  { littleEndian: true, longSize: 8, doubleAlign: 8 }, // amd64, arm64
  { littleEndian: true, longSize: 4, doubleAlign: 8 }, // armhf (Raspberry Pi)
  { littleEndian: true, longSize: 4, doubleAlign: 4 }, // i386
  { littleEndian: false, longSize: 8, doubleAlign: 8 }, // ppc64, s390x
  { littleEndian: false, longSize: 4, doubleAlign: 8 }, // ppc, mips
];

export interface RrdDataSource {
  name: string;
  type: string;
}

export interface RrdArchive {
  cf: string;
  pdpPerRow: number;
  rowCount: number;
  /** Seconds covered by one row. */
  stepSeconds: number;
  /** Rows oldest first; each row has one value per data source (NaN = unknown). */
  rows: Float64Array[];
  /** Unix seconds of the *end* of each row's interval, parallel to rows. */
  rowEndTimes: number[];
}

export interface RrdFile {
  version: string;
  pdpStep: number;
  lastUpdate: number;
  dataSources: RrdDataSource[];
  archives: RrdArchive[];
}

const align = (n: number, a: number) => Math.ceil(n / a) * a;

function cString(buf: Buffer, offset: number, len: number): string {
  const end = buf.indexOf(0, offset);
  return buf.toString("latin1", offset, end === -1 || end > offset + len ? offset + len : end);
}

function tryParse(buf: Buffer, abi: Abi): RrdFile | null {
  const { littleEndian: le, longSize: L, doubleAlign: A } = abi;
  const unAlign = Math.max(L, A); // union { unsigned long; double }
  const structAlign = unAlign;
  const readLong = (off: number) =>
    L === 8
      ? Number(le ? buf.readBigUInt64LE(off) : buf.readBigUInt64BE(off))
      : le
        ? buf.readUInt32LE(off)
        : buf.readUInt32BE(off);
  const readDouble = (off: number) => (le ? buf.readDoubleLE(off) : buf.readDoubleBE(off));

  // stat_head_t
  const fcOff = align(9, A);
  if (buf.length < fcOff + 8) return null;
  if (Math.abs(readDouble(fcOff) - FLOAT_COOKIE) > 1e125) return null;
  const dsCntOff = align(fcOff + 8, L);
  const dsCnt = readLong(dsCntOff);
  const rraCnt = readLong(dsCntOff + L);
  const pdpStep = readLong(dsCntOff + 2 * L);
  const statHeadSize = align(align(dsCntOff + 3 * L, unAlign) + 80, structAlign);
  if (dsCnt < 1 || dsCnt > 1000 || rraCnt < 1 || rraCnt > 1000 || pdpStep < 1) return null;

  const version = buf.toString("latin1", 4, 8);
  const dsDefSize = align(align(40, unAlign) + 80, structAlign);
  const rraRowCntOff = align(20, L);
  const rraDefSize = align(align(rraRowCntOff + 2 * L, unAlign) + 80, structAlign);
  const liveHeadSize = Number(version) >= 3 ? 2 * L : L;
  const pdpPrepSize = align(align(30, unAlign) + 80, structAlign);
  const cdpPrepSize = 80;

  let off = statHeadSize;
  const dataSources: RrdDataSource[] = [];
  for (let i = 0; i < dsCnt; i++, off += dsDefSize) {
    dataSources.push({ name: cString(buf, off, 20), type: cString(buf, off + 20, 20) });
  }

  const rraDefs: { cf: string; rowCount: number; pdpPerRow: number }[] = [];
  for (let i = 0; i < rraCnt; i++, off += rraDefSize) {
    rraDefs.push({
      cf: cString(buf, off, 20),
      rowCount: readLong(off + rraRowCntOff),
      pdpPerRow: readLong(off + rraRowCntOff + L),
    });
  }

  const lastUpdate = readLong(off);
  off += liveHeadSize + dsCnt * pdpPrepSize + rraCnt * dsCnt * cdpPrepSize;

  const curRows: number[] = [];
  for (let i = 0; i < rraCnt; i++, off += L) curRows.push(readLong(off));

  const totalRows = rraDefs.reduce((n, r) => n + r.rowCount, 0);
  if (off + totalRows * dsCnt * 8 !== buf.length) return null;

  const archives: RrdArchive[] = rraDefs.map((def, i) => {
    const stepSeconds = def.pdpPerRow * pdpStep;
    const lastRowEnd = lastUpdate - (lastUpdate % stepSeconds);
    const base = off;
    off += def.rowCount * dsCnt * 8;
    const rows: Float64Array[] = [];
    const rowEndTimes: number[] = [];
    // The ring buffer's newest row is cur_row; the oldest is the one after it.
    for (let k = 0; k < def.rowCount; k++) {
      const ringIdx = (curRows[i] + 1 + k) % def.rowCount;
      const row = new Float64Array(dsCnt);
      for (let d = 0; d < dsCnt; d++) row[d] = readDouble(base + (ringIdx * dsCnt + d) * 8);
      rows.push(row);
      rowEndTimes.push(lastRowEnd - (def.rowCount - 1 - k) * stepSeconds);
    }
    return { ...def, stepSeconds, rows, rowEndTimes };
  });

  return { version, pdpStep, lastUpdate, dataSources, archives };
}

export function parseRrd(buf: Buffer): RrdFile {
  if (buf.length < 16 || buf.toString("latin1", 0, 3) !== "RRD") {
    throw new Error("Not an RRD file");
  }
  for (const abi of ABIS) {
    const parsed = tryParse(buf, abi);
    if (parsed) return parsed;
  }
  throw new Error("Unsupported RRD layout (unknown architecture or corrupt file)");
}
