function fallbackCopyToClipboard(text: string) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  
  textArea.style.position = "absolute";
  textArea.style.left = "-9999px";
  textArea.setAttribute("readonly", "");

  document.body.appendChild(textArea);
  textArea.select();
  
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error("Fallback clipboard copy failed:", err);
  }

  document.body.removeChild(textArea);
}

export function copyToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(err => {
      console.warn("Async clipboard copy failed, falling back.", err);
      fallbackCopyToClipboard(text);
    });
  } else {
    fallbackCopyToClipboard(text);
  }
}
