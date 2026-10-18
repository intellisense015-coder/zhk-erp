import { NextRequest } from "next/server";

const MOBILE_API_BASE = "https://api.mobileapi.dev";

type CatalogCategory = "Mobiles" | "Tablets" | "Smartwatches" | "Accessories";

type UpstreamDevice = {
  id?: number | string;
  name?: string;
  full_name?: string;
  manufacturer_name?: string;
  brand_name?: string;
  brand?: string | { name?: string };
  manufacturer?: string | { name?: string };
  device_type?: string;
  type?: string;
  image_url?: string;
  thumbnail?: string;
  main_image_url?: string;
  image_b64?: string;
  main_image_b64?: string;
  colors?: string;
};

type CatalogResponse = { devices?: UpstreamDevice[]; results?: UpstreamDevice[]; total_pages?: number; total?: number; page_size?: number };

function categoryFor(type: string): CatalogCategory {
  if (type.includes("tablet")) return "Tablets";
  if (type.includes("wearable") || type.includes("watch")) return "Smartwatches";
  if (type.includes("phone") || type.includes("mobile")) return "Mobiles";
  return "Accessories";
}

function splitColors(value?: string) {
  return (value ?? "").split(",").map((color) => color.trim()).filter(Boolean);
}

function imageSource(device: UpstreamDevice) {
  const linkedImage = [device.image_url, device.thumbnail, device.main_image_url].find((value) => /^https?:\/\//i.test(value ?? "") || value?.startsWith("data:"));
  if (linkedImage) return linkedImage;
  const base64 = device.image_b64 ?? device.main_image_b64;
  return base64 ? `data:image/jpeg;base64,${base64}` : undefined;
}

function normalizeDevice(device: UpstreamDevice) {
  const manufacturer = typeof device.manufacturer === "string" ? device.manufacturer : device.manufacturer?.name;
  const brand = typeof device.brand === "string" ? device.brand : device.brand?.name ?? manufacturer ?? device.manufacturer_name ?? device.brand_name ?? "";
  const name = device.name ?? device.full_name?.replace(new RegExp(`^${brand}\\s+`, "i"), "") ?? "";
  return {
    id: String(device.id ?? `${brand}-${name}`),
    name: name.trim(),
    brand: brand.trim(),
    category: categoryFor(`${device.device_type ?? ""} ${device.type ?? ""}`.toLowerCase()),
    imageUrl: imageSource(device),
    colors: splitColors(device.colors),
  };
}

async function fetchManufacturerPage(manufacturer: string, page: number, apiKey: string) {
  const url = new URL(`${MOBILE_API_BASE}/devices/by-manufacturer/`);
  url.searchParams.set("manufacturer", manufacturer);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", "50");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, next: { revalidate: 86400 } });
  if (!response.ok) throw new Error(`Mobile catalog request failed with ${response.status}`);
  return response.json() as Promise<CatalogResponse>;
}

async function fetchExactModel(manufacturer: string, model: string, apiKey: string) {
  const url = new URL(`${MOBILE_API_BASE}/devices/search/`);
  url.searchParams.set("name", model);
  url.searchParams.set("manufacturer", manufacturer);
  url.searchParams.set("exact", "true");
  url.searchParams.set("limit", "10");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, next: { revalidate: 86400 } });
  if (!response.ok) throw new Error(`Mobile catalog search failed with ${response.status}`);
  const payload = await response.json() as CatalogResponse;
  return (payload.devices ?? payload.results ?? [])[0];
}

async function fetchDeviceImages(deviceId: string, apiKey: string) {
  const url = new URL(`${MOBILE_API_BASE}/devices/${encodeURIComponent(deviceId)}/images/`);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, next: { revalidate: 86400 } });
  if (!response.ok) return undefined;
  const payload = await response.json() as UpstreamDevice[] | { images?: UpstreamDevice[] };
  const images = Array.isArray(payload) ? payload : payload.images ?? [];
  return images[0] ? imageSource(images[0]) : undefined;
}

export async function GET(request: NextRequest) {
  const manufacturer = request.nextUrl.searchParams.get("manufacturer")?.trim();
  const category = request.nextUrl.searchParams.get("category")?.trim();
  const model = request.nextUrl.searchParams.get("model")?.trim();
  const apiKey = process.env.MOBILEAPI_API_KEY;

  if (!manufacturer) return Response.json({ configured: Boolean(apiKey), devices: [], message: "A manufacturer is required." }, { status: 400 });
  if (!apiKey) return Response.json({ configured: false, devices: [], message: "The remote device catalog is not configured." }, { status: 503 });

  try {
    if (model) {
      const exactDevice = await fetchExactModel(manufacturer, model, apiKey);
      if (!exactDevice) return Response.json({ configured: true, devices: [] });
      const normalized = normalizeDevice(exactDevice);
      const imageUrl = normalized.imageUrl ?? await fetchDeviceImages(normalized.id, apiKey);
      return Response.json({ configured: true, devices: [{ ...normalized, imageUrl }] });
    }

    const firstPage = await fetchManufacturerPage(manufacturer, 1, apiKey);
    const totalPages = Math.min(Math.max(firstPage.total_pages ?? 1, 1), 10);
    const remainingPages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => fetchManufacturerPage(manufacturer, index + 2, apiKey)));
    const devices = [firstPage, ...remainingPages].flatMap((page) => page.devices ?? []).map(normalizeDevice).filter((device) => device.name && (!category || device.category === category));
    const uniqueDevices = Array.from(new Map(devices.map((device) => [`${device.brand}:${device.name}`.toLowerCase(), device])).values());
    return Response.json({ configured: true, devices: uniqueDevices });
  } catch {
    return Response.json({ configured: true, devices: [], message: "The remote device catalog is temporarily unavailable." }, { status: 502 });
  }
}
