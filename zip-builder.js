// SimpleZip - Lightweight pure JavaScript ZIP builder (PKZIP format)
// Zero-dependency, 100% offline, client-side ZIP archive generator

class SimpleZip {
  constructor() {
    this.files = [];
  }

  // CRC-32 table
  static makeCrcTable() {
    let c;
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      crcTable[n] = c;
    }
    return crcTable;
  }

  static crc32(bytes) {
    if (!SimpleZip.crcTable) SimpleZip.crcTable = SimpleZip.makeCrcTable();
    let crc = 0 ^ (-1);
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ SimpleZip.crcTable[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  // Add file (name string, data: Uint8Array or String)
  file(name, data) {
    let bytes;
    if (typeof data === 'string') {
      bytes = new TextEncoder().encode(data);
    } else if (data instanceof Uint8Array) {
      bytes = data;
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else {
      bytes = new Uint8Array(0);
    }
    this.files.push({ name, bytes, crc: SimpleZip.crc32(bytes) });
  }

  // Generate ZIP as Blob or Uint8Array
  generate() {
    let offset = 0;
    const fileHeaders = [];

    // 1. Build Local File Headers and file data
    const parts = [];
    for (const f of this.files) {
      const nameBytes = new TextEncoder().encode(f.name);
      const header = new Uint8Array(30);
      const view = new DataView(header.buffer);

      view.setUint32(0, 0x04034b50, true); // Local file header signature
      view.setUint16(4, 20, true);         // Version needed to extract (2.0)
      view.setUint16(6, 0, true);          // General purpose bit flag
      view.setUint16(8, 0, true);          // Compression method (0 = store)
      view.setUint16(10, 0, true);         // File last mod time
      view.setUint16(12, 0, true);         // File last mod date
      view.setUint32(14, f.crc, true);     // CRC-32
      view.setUint32(18, f.bytes.length, true); // Compressed size
      view.setUint32(22, f.bytes.length, true); // Uncompressed size
      view.setUint16(26, nameBytes.length, true); // File name length
      view.setUint16(28, 0, true);         // Extra field length

      fileHeaders.push({
        nameBytes,
        offset,
        crc: f.crc,
        size: f.bytes.length
      });

      parts.push(header);
      parts.push(nameBytes);
      parts.push(f.bytes);

      offset += header.length + nameBytes.length + f.bytes.length;
    }

    // 2. Build Central Directory
    const cdOffset = offset;
    let cdSize = 0;

    for (const fh of fileHeaders) {
      const cdEntry = new Uint8Array(46);
      const view = new DataView(cdEntry.buffer);

      view.setUint32(0, 0x02014b50, true); // Central file header signature
      view.setUint16(4, 20, true);         // Version made by
      view.setUint16(6, 20, true);         // Version needed to extract
      view.setUint16(8, 0, true);          // General purpose bit flag
      view.setUint16(10, 0, true);         // Compression method (0 = store)
      view.setUint16(12, 0, true);         // File last mod time
      view.setUint16(14, 0, true);         // File last mod date
      view.setUint32(16, fh.crc, true);    // CRC-32
      view.setUint32(20, fh.size, true);   // Compressed size
      view.setUint32(24, fh.size, true);   // Uncompressed size
      view.setUint16(28, fh.nameBytes.length, true); // File name length
      view.setUint16(30, 0, true);         // Extra field length
      view.setUint16(32, 0, true);         // File comment length
      view.setUint16(34, 0, true);         // Disk number start
      view.setUint16(36, 0, true);         // Internal file attributes
      view.setUint32(38, 0, true);         // External file attributes
      view.setUint32(42, fh.offset, true); // Relative offset of local header

      parts.push(cdEntry);
      parts.push(fh.nameBytes);
      cdSize += cdEntry.length + fh.nameBytes.length;
    }

    // 3. End of Central Directory Record
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // End of central dir signature
    eocdView.setUint16(4, 0, true);          // Number of this disk
    eocdView.setUint16(6, 0, true);          // Disk where central directory starts
    eocdView.setUint16(8, fileHeaders.length, true);  // Number of central directory records on this disk
    eocdView.setUint16(10, fileHeaders.length, true); // Total number of central directory records
    eocdView.setUint32(12, cdSize, true);    // Size of central directory
    eocdView.setUint32(16, cdOffset, true);  // Offset of start of central directory
    eocdView.setUint16(20, 0, true);         // Comment length

    parts.push(eocd);

    // Combine into single Blob
    return new Blob(parts, { type: 'application/zip' });
  }
}

if (typeof module !== 'undefined') {
  module.exports = SimpleZip;
}
