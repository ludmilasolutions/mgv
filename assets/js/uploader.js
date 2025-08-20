// assets/js/uploader.js
// Minimal helper to upload an image from the panel.
// Usage:
//   const input = document.getElementById('imgInput');
//   input.addEventListener('change', async () => {
//     const file = input.files[0];
//     const res = await uploadImage(file);
//     if (res.ok) console.log(res.url);
//   });

export async function uploadImage(file) {
  if (!file) return { ok: false, error: "No file" };
  const fd = new FormData();
  fd.append("file", file, file.name);

  const resp = await fetch("/api/upload-image", {
    method: "POST",
    body: fd,
  });
  return await resp.json();
}
