const AUDIO_EXTENSIONS = /\.(mp3|flac|wav)$/i;

function decodeText(bytes, encoding = 3) {
  try {
    if (encoding === 0) return new TextDecoder("windows-1252").decode(bytes);
    if (encoding === 1) return new TextDecoder("utf-16").decode(bytes);
    if (encoding === 2) return new TextDecoder("utf-16be").decode(bytes);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

function trimText(value) {
  return String(value || "").replace(/\0+$/g, "").trim();
}

function readSynchsafe(bytes, offset) {
  return ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f);
}

function readUint32BE(view, offset) {
  return view.getUint32(offset, false);
}

function findTextTerminator(bytes, start, encoding) {
  if (encoding === 1 || encoding === 2) {
    for (let i = start; i + 1 < bytes.length; i += 2) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) return i;
    }
  } else {
    for (let i = start; i < bytes.length; i += 1) {
      if (bytes[i] === 0) return i;
    }
  }
  return bytes.length;
}

function parseId3(file, bytes) {
  const result = {};
  if (bytes.length < 10 || String.fromCharCode(...bytes.subarray(0, 3)) !== "ID3") {
    return result;
  }
  const version = bytes[3];
  if (version < 2 || version > 4) return result;
  const tagSize = readSynchsafe(bytes, 6);
  const end = Math.min(bytes.length, 10 + tagSize);
  let offset = 10;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (offset + 10 <= end) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (!/^[A-Z0-9]{4}$/.test(id) || id === "0000") break;
    const frameSize = version === 4
      ? readSynchsafe(bytes, offset + 4)
      : view.getUint32(offset + 4, false);
    if (!frameSize || offset + 10 + frameSize > end) break;
    const frame = bytes.subarray(offset + 10, offset + 10 + frameSize);
    const encoding = frame[0] ?? 3;
    const content = frame.subarray(1);

    const fields = { TIT2: "title", TPE1: "artist", TALB: "album", TCON: "genre", TRCK: "track" };
    if (fields[id]) {
      result[fields[id]] = trimText(decodeText(content, encoding).split("\0")[0]);
    } else if (id === "APIC" && content.length > 5 && !result.coverArt) {
      let cursor = 0;
      let mimeEnd = content.indexOf(0, cursor);
      if (mimeEnd < 0) mimeEnd = cursor;
      const mime = decodeText(content.subarray(cursor, mimeEnd), 0) || "image/jpeg";
      cursor = mimeEnd + 2;
      const terminator = findTextTerminator(content, cursor, encoding);
      cursor = terminator + ((encoding === 1 || encoding === 2) ? 2 : 1);
      if (cursor < content.length) {
        const imageBytes = content.slice(cursor);
        result.coverArt = new Blob([imageBytes], { type: mime.startsWith("image/") ? mime : "image/jpeg" });
      }
    }
    offset += 10 + frameSize;
  }
  return result;
}

function parseId3v1(bytes) {
  if (bytes.length < 128) return {};
  const start = bytes.length - 128;
  if (String.fromCharCode(...bytes.subarray(start, start + 3)) !== "TAG") return {};
  const decode = part => trimText(decodeText(part, 0));
  return {
    title: decode(bytes.subarray(start + 3, start + 33)),
    artist: decode(bytes.subarray(start + 33, start + 63)),
    album: decode(bytes.subarray(start + 63, start + 93))
  };
}

function parseFlac(bytes) {
  const result = {};
  if (bytes.length < 8 || String.fromCharCode(...bytes.subarray(0, 4)) !== "fLaC") return result;
  let offset = 4;
  let last = false;
  while (!last && offset + 4 <= bytes.length) {
    const header = bytes[offset];
    last = Boolean(header & 0x80);
    const type = header & 0x7f;
    const length = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const start = offset + 4;
    const end = start + length;
    if (end > bytes.length) break;
    const block = bytes.subarray(start, end);
    if (type === 4 && block.length >= 8) {
      const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
      let cursor = 0;
      const vendorLength = readUint32BE(view, cursor); cursor += 4 + vendorLength;
      if (cursor + 4 <= block.length) {
        const count = readUint32BE(view, cursor); cursor += 4;
        for (let i = 0; i < count && cursor + 4 <= block.length; i += 1) {
          const itemLength = readUint32BE(view, cursor); cursor += 4;
          if (cursor + itemLength > block.length) break;
          const item = decodeText(block.subarray(cursor, cursor + itemLength), 3);
          cursor += itemLength;
          const split = item.indexOf("=");
          if (split < 1) continue;
          const key = item.slice(0, split).toUpperCase();
          const value = trimText(item.slice(split + 1));
          const map = { TITLE: "title", ARTIST: "artist", ALBUM: "album", GENRE: "genre", TRACKNUMBER: "track" };
          if (map[key] && !result[map[key]]) result[map[key]] = value;
        }
      }
    } else if (type === 6 && block.length >= 32 && !result.coverArt) {
      const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
      let cursor = 0;
      const mimeLength = readUint32BE(view, cursor); cursor += 4;
      const mime = decodeText(block.subarray(cursor, cursor + mimeLength), 3); cursor += mimeLength;
      const descriptionLength = readUint32BE(view, cursor); cursor += 4 + descriptionLength;
      cursor += 16;
      if (cursor + 4 <= block.length) {
        const imageLength = readUint32BE(view, cursor); cursor += 4;
        if (imageLength > 0 && cursor + imageLength <= block.length) {
          result.coverArt = new Blob([block.slice(cursor, cursor + imageLength)], {
            type: mime.startsWith("image/") ? mime : "image/jpeg"
          });
        }
      }
    }
    offset = end;
  }
  return result;
}

function parseWav(bytes) {
  const result = {};
  if (bytes.length < 12 || String.fromCharCode(...bytes.subarray(0, 4)) !== "RIFF" ||
      String.fromCharCode(...bytes.subarray(8, 12)) !== "WAVE") return result;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true);
    const start = offset + 8;
    const end = Math.min(bytes.length, start + size);
    if (id === "LIST" && String.fromCharCode(...bytes.subarray(start, start + 4)) === "INFO") {
      let cursor = start + 4;
      while (cursor + 8 <= end) {
        const tag = String.fromCharCode(...bytes.subarray(cursor, cursor + 4));
        const length = new DataView(bytes.buffer, bytes.byteOffset + cursor + 4, 4).getUint32(0, true);
        const value = trimText(decodeText(bytes.subarray(cursor + 8, Math.min(end, cursor + 8 + length)), 0));
        const map = { INAM: "title", IART: "artist", IPRD: "album", IGNR: "genre", ITRK: "track" };
        if (map[tag] && value) result[map[tag]] = value;
        cursor += 8 + length + (length % 2);
      }
    }
    offset = start + size + (size % 2);
  }
  return result;
}

export async function readAudioTags(file) {
  if (!(file instanceof Blob)) return {};
  const name = file.name || "";
  if (!AUDIO_EXTENSIONS.test(name)) return {};
  const bytes = new Uint8Array(await file.arrayBuffer());
  let parsed = {};
  if (/\.mp3$/i.test(name)) {
    parsed = { ...parseId3(file, bytes) };
    const v1 = parseId3v1(bytes);
    for (const key of ["title", "artist", "album"]) {
      if (!parsed[key] && v1[key]) parsed[key] = v1[key];
    }
  } else if (/\.flac$/i.test(name)) {
    parsed = parseFlac(bytes);
  } else if (/\.wav$/i.test(name)) {
    parsed = parseWav(bytes);
  }
  return {
    title: trimText(parsed.title),
    artist: trimText(parsed.artist),
    album: trimText(parsed.album),
    genre: trimText(parsed.genre),
    track: trimText(parsed.track),
    coverArt: parsed.coverArt instanceof Blob ? parsed.coverArt : null,
    tagParsed: true
  };
}
