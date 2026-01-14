// Will return whether the current environment is in a regular browser
// and not CEF
export const isEnvBrowser = (): boolean => !(window as any).invokeNative;

// Basic no operation function
export const noop = () => {};

export const splitFAString = (faString:string) => {
  const [prefix, newIcon] = faString.split('-');
  if (!prefix || !newIcon) return {prefix: 'fas', newIcon: 'question'};
  return {prefix, newIcon};
}

export async function imageUrlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Convert in chunks to avoid call stack overflow
  let binary = '';
  const chunkSize = 0x8000; // 32KB
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  const base64 = btoa(binary);
  const mime = res.headers.get('content-type') || 'image/png';
  return `data:${mime};base64,${base64}`;
}
