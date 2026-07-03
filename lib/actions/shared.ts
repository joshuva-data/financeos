'use server'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export async function ok<T>(data: T): Promise<ActionResult<T>> {
  return { ok: true, data }
}

export async function fail(error: string): Promise<ActionResult<never>> {
  return { ok: false, error }
}

export async function getCurrentFY(): Promise<string> {
  const now = new Date()
  return now.getMonth() >= 3
    ? `${now.getFullYear()}-${now.getFullYear() + 1}`
    : `${now.getFullYear() - 1}-${now.getFullYear()}`
}