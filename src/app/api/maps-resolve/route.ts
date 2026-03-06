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
    const patterns = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /place\/.*\/@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /destination=(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];

    for (const pattern of patterns) {
      const match = finalUrl.match(pattern);
      if (match) {
        return NextResponse.json({
          lat: match[1],
          lng: match[2],
          resolvedUrl: finalUrl,
        });
      }
    }

    // Try fetching the body if HEAD didn't give us a full URL
    const bodyRes = await fetch(url, { redirect: 'follow' });
    const html = await bodyRes.text();

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        return NextResponse.json({
          lat: match[1],
          lng: match[2],
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
