/** Alias loopback hanya untuk pengembangan/tes, dengan protokol dan port yang sama. */
export function csrfOrigins(
  publicOrigin: string,
  environment: string | undefined,
  additionalOrigins = "",
): string[] {
  const origins = [publicOrigin];
  if (environment !== "development" && environment !== "test") return origins;
  const url = new URL(publicOrigin);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    url.hostname = url.hostname === "localhost" ? "127.0.0.1" : "localhost";
    origins.push(url.origin);
  }
  // Alamat LAN harus didaftarkan eksplisit; jangan mempercayai Host dari permintaan.
  for (const value of additionalOrigins
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)) {
    const additional = new URL(value);
    if (
      !["http:", "https:"].includes(additional.protocol) ||
      additional.username ||
      additional.password ||
      additional.pathname !== "/" ||
      additional.search ||
      additional.hash ||
      additional.hostname.includes("*")
    ) {
      throw new Error(
        "DEV_ADDITIONAL_ORIGINS harus berisi origin HTTP(S) tanpa path, kredensial, atau wildcard.",
      );
    }
    origins.push(additional.origin);
  }
  return [...new Set(origins)];
}
