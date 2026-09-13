import { countryLocale } from '../shared/locale.ts';

type RequestWithCountry = Request & { cf?: { country?: string } };
export default {
  async fetch(request: RequestWithCountry, env: { ASSETS: { fetch(request: Request): Promise<Response> } }) {
    if (new URL(request.url).pathname === '/api/locale') {
      // Use trusted edge metadata, never a client-supplied header or third-party lookup.
      return Response.json({ locale: countryLocale(request.cf?.country) }, {
        headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
