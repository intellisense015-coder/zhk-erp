import process from "node:process";

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const publicRoutes = ["/login", "/forgot-password", "/forgot-pin", "/onboarding"];
const protectedRoutes = [
  "/dashboard",
  "/inventory",
  "/purchases",
  "/sales",
  "/customers",
  "/suppliers",
  "/capital",
  "/expenses",
  "/transactions",
  "/reports",
  "/settings",
  "/invoices",
  "/low-stock",
  "/pos",
];

const failures = [];
const requestHeaders = process.env.SMOKE_COOKIE ? { cookie: process.env.SMOKE_COOKIE } : undefined;
const isLoginRedirect = (response) => {
  if (response.status < 300 || response.status >= 400) return false;
  try {
    return new URL(response.headers.get("location") || "/", baseUrl).pathname === "/login";
  } catch {
    return false;
  }
};
const check = async (path, expected) => {
  const url = `${baseUrl}${path}`;
  let response;
  try {
    response = await fetch(url, { redirect: "manual", headers: requestHeaders });
  } catch (error) {
    failures.push(`${path}: server unavailable (${error instanceof Error ? error.message : String(error)})`);
    return;
  }

  if (!expected(response)) {
    failures.push(`${path}: unexpected HTTP ${response.status} and location ${response.headers.get("location") || "none"}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (response.status >= 200 && response.status < 300 && !contentType.includes("text/html")) failures.push(`${path}: expected HTML, received ${contentType || "unknown content type"}`);
};

for (const path of publicRoutes) {
  await check(path, (response) => response.status === 200 || (path === "/onboarding" && isLoginRedirect(response)));
}

for (const path of protectedRoutes) {
  await check(path, (response) => response.status === 200 || (response.status >= 300 && response.status < 400 && (response.headers.get("location") || "").includes("/login")));
}

let rootResponse;
try {
  rootResponse = await fetch(`${baseUrl}/`, { redirect: "manual", headers: requestHeaders });
  if (rootResponse.status < 300 || rootResponse.status >= 400 || !(rootResponse.headers.get("location") || "").includes("/splash")) failures.push(`/: expected redirect to /splash, received ${rootResponse.status} ${rootResponse.headers.get("location") || ""}`);
} catch (error) {
  failures.push(`/: server unavailable (${error instanceof Error ? error.message : String(error)})`);
}

if (failures.length) {
  console.error("Production smoke test failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Production smoke test passed for ${baseUrl}`);
  console.log(`Checked ${publicRoutes.length} public routes, ${protectedRoutes.length} protected routes, and root redirect.`);
}
