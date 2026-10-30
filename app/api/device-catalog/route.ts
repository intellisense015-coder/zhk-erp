import { NextRequest } from "next/server";
import { consumeRateLimit } from "../../../lib/security/rate-limit";

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
const allowedCategories = new Set<CatalogCategory>(["Mobiles", "Tablets", "Smartwatches", "Accessories"]);
const queryLimits = { manufacturer: 80, category: 24, model: 120 } as const;

function validQuery(value: string | null, maxLength: number) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(trimmed) ? trimmed : null;
}

function clientAddress(request: NextRequest) {
  return request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function json(payload: Record<string, unknown>, status = 200, headers?: Record<string, string>) {
  return Response.json(payload, { status, headers: { "Cache-Control": "private, max-age=300", ...headers } });
}

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
  const manufacturer = validQuery(request.nextUrl.searchParams.get("manufacturer"), queryLimits.manufacturer);
  const category = validQuery(request.nextUrl.searchParams.get("category"), queryLimits.category);
  const model = validQuery(request.nextUrl.searchParams.get("model"), queryLimits.model);
  const apiKey = process.env.MOBILEAPI_API_KEY;

  const rate = consumeRateLimit(`device-catalog:${clientAddress(request)}`, 30, 60_000);
  if (!rate.allowed) return json({ configured: Boolean(apiKey), devices: [], message: "Too many catalog requests. Please try again shortly." }, 429, { "Retry-After": String(rate.retryAfter) });
  if (manufacturer === null || category === null || model === null) return json({ configured: Boolean(apiKey), devices: [], message: "Catalog query is invalid or too long." }, 400);
  if (!manufacturer) return json({ configured: Boolean(apiKey), devices: [], message: "A manufacturer is required." }, 400);
  if (category && !allowedCategories.has(category as CatalogCategory)) return json({ configured: Boolean(apiKey), devices: [], message: "Catalog category is invalid." }, 400);
  if (!apiKey) return json({ configured: false, devices: [], message: "The remote device catalog is not configured." }, 503);

  try {
    if (model) {
      const exactDevice = await fetchExactModel(manufacturer, model, apiKey);
      if (!exactDevice) return json({ configured: true, devices: [] });
      const normalized = normalizeDevice(exactDevice);
      const imageUrl = normalized.imageUrl ?? await fetchDeviceImages(normalized.id, apiKey);
      return json({ configured: true, devices: [{ ...normalized, imageUrl }] });
    }

    const firstPage = await fetchManufacturerPage(manufacturer, 1, apiKey);
    const totalPages = Math.min(Math.max(firstPage.total_pages ?? 1, 1), 10);
    const remainingPages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => fetchManufacturerPage(manufacturer, index + 2, apiKey)));
    const devices = [firstPage, ...remainingPages].flatMap((page) => page.devices ?? []).map(normalizeDevice).filter((device) => device.name && (!category || device.category === category));
    const uniqueDevices = Array.from(new Map(devices.map((device) => [`${device.brand}:${device.name}`.toLowerCase(), device])).values());
    return json({ configured: true, devices: uniqueDevices });
  } catch {
    return json({ configured: true, devices: [], message: "The remote device catalog is temporarily unavailable." }, 502);
  }
}
