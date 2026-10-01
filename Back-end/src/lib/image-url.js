function publicApiUrl() {
  const url = new URL(process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4000}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('PUBLIC_API_URL must be an HTTP(S) origin without credentials, path, query or fragment');
  }
  return url.origin;
}
function medicineImageUrl(id) {
  return `${publicApiUrl()}/api/medicines/${encodeURIComponent(id)}/image`;
}
module.exports = { publicApiUrl, medicineImageUrl };
