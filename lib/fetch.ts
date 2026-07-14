export function getCsrfHeader(): { "x-csrf-token": string } {
  const csrf = document.cookie
    .split("; ")
    .find((c) => c.startsWith("csrf_token="))
    ?.split("=")[1]

  return { "x-csrf-token": csrf || "" }
}

export async function fetchClient(input: RequestInfo, init?: RequestInit) {
  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...getCsrfHeader(),
      "Content-Type": "application/json",
    },
  })
}
