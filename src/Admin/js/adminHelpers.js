/* ------------------------------------------------------------------
   Small helpers shared by the Users, Audit, Reports & Stats
   and Profile screens. Kept simple on purpose.
------------------------------------------------------------------- */

// "2026-10-18T09:30:00" -> "Oct 18, 2026"
export function formatDate(iso) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// "2026-10-18T09:30:00" -> "Oct 18, 2026, 9:30 AM"
export function formatDateTime(iso) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Phone numbers must be text. If one was typed in the Firebase console it may be a
// number (09624661947 becomes 9624661947), so turn it back into text and put the 0 back.
export function phoneText(value) {
  const text = String(value ?? "").trim();
  if (/^9\d{9}$/.test(text)) return "0" + text; // Philippine mobile numbers start with 09
  return text;
}

// Turns "Under Review" into "under-review" so it can be used in a CSS class name.
export const slug = (text) => text.toLowerCase().replace(/\s+/g, "-");

// Downloads a CSV file.
//   filename = "users.csv"
//   headers  = ["Name", "Email"]
//   rows     = [["Ana", "ana@mail.com"], ...]
export function downloadCSV(filename, headers, rows) {
  const clean = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [headers, ...rows].map((row) => row.map(clean).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Shrinks a photo to a small square JPEG so it can be saved in the database.
// Returns a "data URL" text such as "data:image/jpeg;base64,...".
export function resizePhoto(file, size = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("That file is not a valid image."));
      image.onload = () => {
        // Crop the middle square of the picture, then draw it at size x size.
        const side = Math.min(image.width, image.height);
        const x = (image.width - side) / 2;
        const y = (image.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d").drawImage(image, x, y, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
