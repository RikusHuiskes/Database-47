export const EVENT_PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export function eventPhotoType(file: { type: string; name: string }): string | null {
  const type = file.type.toLowerCase();
  if (Object.hasOwn(EVENT_PHOTO_TYPES, type)) return type;
  if (type === "image/jpg" || type === "image/pjpeg") return "image/jpeg";
  // Some file pickers supply no MIME type. The server still verifies bytes.
  if (!type || type === "application/octet-stream") {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
    if (extension === "png") return "image/png";
    if (extension === "webp") return "image/webp";
  }
  return null;
}

export function isEventPhoto(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 && bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  return type === "image/webp" && bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}
