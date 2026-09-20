/**
 * Pure helper function to determine if the client is running on a desktop device.
 * A device is considered desktop if it does not match mobile User-Agent signatures,
 * does not have touch capability, and has a screen width greater than 768px.
 */
export function isDesktopDevice(
  userAgent: string = '',
  maxTouchPoints: number = 0,
  windowWidth: number = 1024
): boolean {
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Silk/i.test(userAgent);
  const hasTouch = maxTouchPoints > 0;
  const isSmallScreen = windowWidth <= 768;

  return !isMobileUA && !hasTouch && !isSmallScreen;
}
