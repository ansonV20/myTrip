export type GoogleMapsJson = {
  originalUrl: string;
  pathname: string;
  searchParams: Record<string, string>;
  placeName?: string;
  center?: {
    lat: number;
    lng: number;
    zoom?: string;
  };
  data?: {
    raw: string;
    tokens: string[];
    parsedTokens: Array<{
      index: number;
      id: number | null;
      type: string | null;
      value: string;
      raw: string;
    }>;
  };
};

export function googleMapsUrlToJson(url: string): GoogleMapsJson {
  const u = new URL(url);

  const searchParams: Record<string, string> = {};
  u.searchParams.forEach((value, key) => {
    searchParams[key] = value;
  });

  const pathParts = u.pathname.split("/").filter(Boolean);

  let placeName: string | undefined;
  const placeIndex = pathParts.indexOf("place");
  if (placeIndex !== -1 && pathParts[placeIndex + 1]) {
    placeName = decodeURIComponent(pathParts[placeIndex + 1]).replace(/\+/g, " ");
  }

  let center: GoogleMapsJson["center"];
  const atPart = pathParts.find((p) => p.startsWith("@"));
  if (atPart) {
    const raw = atPart.slice(1).split(",");
    const lat = Number(raw[0]);
    const lng = Number(raw[1]);
    const zoom = raw[2];
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      center = { lat, lng, zoom };
    }
  }

  let data: GoogleMapsJson["data"];
  const dataIndex = pathParts.indexOf("data=");
  let rawData = "";

  if (dataIndex !== -1 && pathParts[dataIndex + 1]) {
    rawData = pathParts.slice(dataIndex + 1).join("/");
  } else {
    const dataMatch = u.pathname.match(/\/data=([^?]+)/);
    if (dataMatch) rawData = dataMatch[1];
  }

  if (rawData) {
    const tokens = rawData.split("!").filter(Boolean);

    const parsedTokens = tokens.map((token, index) => {
      const match = token.match(/^(\d+)([a-zA-Z])(.*)$/);
      return {
        index,
        id: match ? Number(match[1]) : null,
        type: match ? match[2] : null,
        value: match ? match[3] : token,
        raw: token
      };
    });

    data = {
      raw: rawData,
      tokens,
      parsedTokens
    };
  }

  return {
    originalUrl: url,
    pathname: u.pathname,
    searchParams,
    placeName,
    center,
    data
  };
}