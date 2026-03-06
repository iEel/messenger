import { NextRequest, NextResponse } from 'next/server';

// GET - Resolve Google Maps short URL → ดึง lat/lng จาก redirect
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // Follow redirects manually to get the final URL
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
    });

    const finalUrl = res.url;

    // Extract coordinates from the resolved URL
    // IMPORTANT: !3d...!4d... = actual pin coords, @lat,lng = viewport (less accurate)
    const patterns: { regex: RegExp; latGroup: number; lngGroup: number }[] = [
      { regex: /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, latGroup: 1, lngGroup: 2 },
      { regex: /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/, latGroup: 1, lngGroup: 2 },
      { regex: /ll=(-?\d+\.\d+),(-?\d+\.\d+)/, latGroup: 1, lngGroup: 2 },
      { regex: /destination=(-?\d+\.\d+),(-?\d+\.\d+)/, latGroup: 1, lngGroup: 2 },
      { regex: /@(-?\d+\.\d+),(-?\d+\.\d+)/, latGroup: 1, lngGroup: 2 },
    ];

    for (const { regex, latGroup, lngGroup } of patterns) {
      const match = finalUrl.match(regex);
      if (match) {
        return NextResponse.json({
          lat: match[latGroup],
          lng: match[lngGroup],
          resolvedUrl: finalUrl,
        });
      }
    }

    // Try fetching the body if HEAD didn't give us a full URL
    const bodyRes = await fetch(url, { redirect: 'follow' });
    const html = await bodyRes.text();

    for (const { regex, latGroup, lngGroup } of patterns) {
      const match = html.match(regex);
      if (match) {
        return NextResponse.json({
          lat: match[latGroup],
          lng: match[lngGroup],
          resolvedUrl: bodyRes.url,
        });
      }
    }

    return NextResponse.json({ error: 'ไม่พบพิกัดจาก URL นี้', resolvedUrl: finalUrl }, { status: 404 });
  } catch (error) {
    console.error('Resolve maps URL error:', error);
    return NextResponse.json({ error: 'ไม่สามารถเปิดลิงก์ได้' }, { status: 500 });
  }
}
