import { NextRequest, NextResponse } from "next/server";

/**
 * Unsplash Image Search API route — proxies requests to Unsplash
 * so the access key stays server-side.
 *
 * Query params:
 *   q        — search query (required)
 *   per_page — number of results (default 9, max 30)
 *   page     — pagination (default 1)
 */

interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string | null;
  description: string | null;
  color: string | null;
  user: {
    name: string;
    links: { html: string };
  };
  links: {
    html: string;
  };
}

export interface InspoImage {
  id: string;
  url: string;        // small size for grid display
  urlFull: string;     // regular size for saved display
  thumb: string;       // thumb for tiny previews
  alt: string;
  color: string;       // dominant color for placeholder
  photographer: string;
  photographerUrl: string;
  unsplashUrl: string; // link to photo on Unsplash (required by TOS)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const perPage = searchParams.get("per_page") || "9";
  const page = searchParams.get("page") || "1";

  if (!query) {
    return NextResponse.json({ error: "Missing search query (q)" }, { status: 400 });
  }

  // Server-only env var — no NEXT_PUBLIC_ prefix so it stays out of the client bundle
  const accessKey = process.env.UNSPLASH_ACCESS_KEY || process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return NextResponse.json(
      { error: "Unsplash API key not configured", code: "NO_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const params = new URLSearchParams({
      query,
      per_page: perPage,
      page,
      orientation: "portrait",    // Outfit photos look best in portrait
      content_filter: "high",     // Safe content only
    });

    const res = await fetch(
      `https://api.unsplash.com/search/photos?${params.toString()}`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
          "Accept-Version": "v1",
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Unsplash API error:", res.status, errorText);
      return NextResponse.json({ error: "Unsplash search failed" }, { status: 502 });
    }

    const data = await res.json();
    const photos: InspoImage[] = (data.results || []).map((p: UnsplashPhoto) => ({
      id: p.id,
      url: p.urls.small,
      urlFull: p.urls.regular,
      thumb: p.urls.thumb,
      alt: p.alt_description || p.description || "Outfit inspiration",
      color: p.color || "#e0e0e0",
      photographer: p.user.name,
      photographerUrl: p.user.links.html,
      unsplashUrl: p.links.html,
    }));

    return NextResponse.json({
      images: photos,
      total: data.total || 0,
      totalPages: data.total_pages || 0,
    });
  } catch (err) {
    console.error("Unsplash proxy error:", err);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}
