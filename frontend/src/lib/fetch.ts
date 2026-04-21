export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const apiKey = localStorage.getItem('api_key') || ''
  const headers = new Headers(init?.headers)
  if (apiKey) headers.set('x-api-key', apiKey)
  return fetch(input, { ...init, headers })
}
