// SPA fallback for Cloudflare Pages.
//
// The classic `_redirects` splash rule (`/* /index.html 200`) is no longer
// accepted by Cloudflare Pages' current build system — it is detected as an
// infinite loop and ignored. This middleware implements the same behaviour
// the supported way: asset-less GET/HEAD navigations are served index.html
// with a 200 so React Router can render client-side routes (deep links,
// refreshes, bookmarks). Real asset 404s (missing .js/.css/.png files) are
// intentionally NOT rewritten.
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // Only rewrite browser navigations.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return next();
  }

  // File-like requests (assets, favicon, etc.) pass through untouched.
  const lastSegment = url.pathname.split('/').pop();
  if (lastSegment.includes('.')) {
    return next();
  }

  const res = await next();
  if (res.status !== 404) {
    return res;
  }

  // Fetch the SPA shell from the Pages assets binding.
  let index;
  try {
    index = await env.ASSETS.fetch(new URL('/index.html', request.url));
  } catch {
    index = await fetch(new URL('/index.html', request.url));
  }

  return new Response(index.body, {
    status: 200,
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
}
