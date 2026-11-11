/** Refresh application code without removing pairing, preferences or prepared media. */
export async function reloadDisplay() {
  if (!navigator.onLine) {
    location.reload();
    return;
  }
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) await registration.update();
    // Prime the navigation cache from the network, bypassing the HTTP cache.
    const response = await fetch(location.href, { cache: 'reload' });
    if (!response.ok) throw Error('Update unavailable');
    const url = new URL(location.href);
    url.searchParams.set('_update', String(Date.now()));
    location.replace(url.href);
  } catch {
    location.reload();
  }
}
