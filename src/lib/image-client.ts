// Browser-only helpers for check-in photos.

const MAX_EDGE = 1600;
const QUALITY = 0.82;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh."));
    };
    img.src = url;
  });
}

/**
 * Resizes to ≤1600 px (the browser applies EXIF rotation when decoding into
 * an <img>), stamps a bottom band with the event, time and student, and
 * re-encodes as JPEG (~200–400 KB). The server records its own time; the
 * stamp is for people looking at the photo.
 */
export async function preparePhoto(
  file: File,
  stamp: { label: string; time: string; studentName: string },
): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  ctx.drawImage(img, 0, 0, width, height);

  const size = Math.max(16, Math.round(Math.min(width, height) * 0.042));
  const band = Math.round(size * 2.4);
  const gradient = ctx.createLinearGradient(0, height - band * 1.6, 0, height);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.45, "rgba(0,0,0,0.45)");
  gradient.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - band * 1.6, width, band * 1.6);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const x = Math.round(size * 0.9);
  const y = height - Math.round(size * 0.9);
  ctx.fillText(`${stamp.label}  ${stamp.time}`, x, y - Math.round(size * 1.25));
  ctx.font = `500 ${Math.round(size * 0.82)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillText(`${stamp.studentName}  ·  AIO`, x, y);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Không nén được ảnh."))), "image/jpeg", QUALITY),
  );
}

export function currentPosition(timeoutMs = 6000): Promise<{ lat: number; lng: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
