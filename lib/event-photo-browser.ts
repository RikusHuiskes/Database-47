import {eventPhotoType} from "./event-photo";
export async function prepareEventPhoto(photo: File): Promise<File> {
  const type = eventPhotoType(photo);
  if (!type) throw new Error("Kies een JPG-, PNG- of WebP-foto.");
  if (photo.size <= 3_500_000) return new File([photo], photo.name, { type });
  const bitmap = await createImageBitmap(photo);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("De foto kon niet worden voorbereid. Kies een kleinere foto."); }
  context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob || blob.size > 3_800_000) throw new Error("De foto is nog te groot. Kies een kleinere JPG-, PNG- of WebP-foto.");
  return new File([blob], photo.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}
