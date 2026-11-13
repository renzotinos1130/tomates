/** Saves a small text document as a file from the browser. */
export function downloadTextFile(filename: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Saves the file at this address under that name. An address that says so
 * itself (a signed storage URL asked for with a download name) is saved as it
 * comes; a local one (a blob) needs the name given here.
 */
export function downloadFromUrl(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
