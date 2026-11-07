/** Clipboard and device share-sheet primitives (spec §7). */

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Falls through to the legacy path below.
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export async function shareText(text: string, title?: string): Promise<boolean> {
  if (!canShare()) return false;
  try {
    await navigator.share(title ? { title, text } : { text });
    return true;
  } catch {
    // User dismissed the sheet, or the platform refused.
    return false;
  }
}
