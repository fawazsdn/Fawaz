const center = { latitude: 26.25044721525346, longitude: 50.05952833815672 };
const radius = 900;
const offsets = {
  center: [0, 0],
  northeast: [0.008, 0.008],
  northwest: [0.008, -0.008],
  southeast: [-0.008, 0.008],
  southwest: [-0.008, -0.008],
} as const;

const types = ['restaurant', 'cafe', 'bakery', 'supermarket', 'pharmacy', 'gym', 'beauty_salon', 'laundry', 'car_wash', 'park'] as const;

export function ajyalSearchRequest(input: unknown) {
  if (!input || typeof input !== 'object') return null;
  const { method, sector, category } = input as Record<string, unknown>;
  if (typeof sector !== 'string' || !Object.hasOwn(offsets, sector)) return null;
  const type = types.find((value) => value === category);
  if (!type) return null;

  const [lat, lng] = offsets[sector as keyof typeof offsets];
  const latitude = center.latitude + lat;
  const longitude = center.longitude + lng;
  if (method === 'nearby') {
    return {
      action: 'searchNearby',
      body: {
        includedTypes: [type],
        maxResultCount: 20,
        locationRestriction: { circle: { center: { latitude, longitude }, radius } },
      },
    };
  }
  if (method === 'text') {
    return {
      action: 'searchText',
      body: {
        textQuery: `${type.replaceAll('_', ' ')} in Ajyal, Dhahran`,
        includedType: type,
        strictTypeFiltering: true,
        pageSize: 20,
        locationRestriction: {
          rectangle: {
            low: { latitude: latitude - 0.008, longitude: longitude - 0.009 },
            high: { latitude: latitude + 0.008, longitude: longitude + 0.009 },
          },
        },
      },
    };
  }
  return null;
}

export async function discoverAjyalPlaceIds(
  request: NonNullable<ReturnType<typeof ajyalSearchRequest>>,
  apiKey: string,
  fetcher = fetch,
): Promise<{ ids: string[]; possiblyIncomplete: boolean }> {
  const response = await fetcher(`https://places.googleapis.com/v1/places:${request.action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': request.action === 'searchText' ? 'places.id,nextPageToken' : 'places.id',
    },
    body: JSON.stringify(request.body),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(response.status === 429 ? 'quota_exhausted' : 'places_unavailable');
  const data: { places?: { id?: unknown }[]; nextPageToken?: string } = await response.json();
  const places = Array.isArray(data.places) ? data.places : [];
  const ids = places.flatMap((place) => (typeof place?.id === 'string' && place.id ? [place.id] : []));
  return { ids: [...new Set(ids)], possiblyIncomplete: Boolean(data.nextPageToken) || places.length >= 20 };
}
