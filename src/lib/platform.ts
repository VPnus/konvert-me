/**
 * Safari deletes the data of a site that was not visited for seven days; an app
 * installed on the home screen is not affected. We detect the case to show the
 * install instructions where they matter.
 */

export interface PlatformInfo {
  readonly isSafari: boolean;
  readonly isIos: boolean;
  readonly isStandalone: boolean;
  /** Safari or iOS, and the app is not installed yet. */
  readonly needsInstallHint: boolean;
}

export function detectPlatform(
  userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  standalone: boolean = isStandaloneDisplay(),
): PlatformInfo {
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && hasTouch());
  const isSafari = /Safari/.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|OPR|YaBrowser/.test(userAgent);

  return {
    isSafari,
    isIos,
    isStandalone: standalone,
    needsInstallHint: (isSafari || isIos) && !standalone,
  };
}

function hasTouch(): boolean {
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return standaloneMedia || iosStandalone;
}

/**
 * Whether the page looks opened in a private window. There is no honest way to ask, so this is a
 * sign, not a proof: Safari and Firefox refuse the site's private file system in a private window
 * and allow it otherwise. Chrome's incognito gives no such sign; there the storage warning speaks.
 */
export async function looksPrivate(
  storage: { getDirectory?: () => Promise<unknown> } | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.storage,
): Promise<boolean> {
  if (!storage?.getDirectory) return false;
  try {
    await storage.getDirectory();
    return false;
  } catch {
    return true;
  }
}
