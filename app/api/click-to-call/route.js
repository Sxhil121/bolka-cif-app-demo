/**
 * Server-side Tata Smartflo Click-to-Call integration.
 *
 * This runs only on the server (Next.js Route Handler) so the Tata
 * account credentials never reach the browser bundle. The client posts
 * only { fromNumber, toNumber } here; everything else (login, token,
 * caller ID) is server-held configuration.
 *
 * Reference docs:
 * - Generate a token:  https://docs.smartflo.tatatelebusiness.com/reference/generate-a-token
 * - Click to Call:     https://docs.smartflo.tatatelebusiness.com/reference/v1click_to_call
 */

import { NextResponse } from "next/server";

const TATA_BASE_URL = "https://api-smartflo.tatateleservices.com/v1";

// TODO: real integration (optimization) — a fresh token is fetched on
// every call for simplicity. The login response includes expires_in
// (3600s); a higher-volume deployment should cache the access_token in
// memory/KV for its lifetime instead of logging in on every request.
async function getAccessToken() {
  const email = process.env.TATA_EMAIL;
  const password = process.env.TATA_PASSWORD;

  if (!email || !password) {
    throw new Error("Server is missing TATA_EMAIL / TATA_PASSWORD configuration");
  }

  const res = await fetch(`${TATA_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.message || "Tata login failed");
  }
  return data.access_token;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const fromNumber = body && body.fromNumber;
  const toNumber = body && body.toNumber;

  if (!fromNumber || !toNumber) {
    return NextResponse.json(
      { success: false, message: "fromNumber and toNumber are both required" },
      { status: 400 }
    );
  }

  const callerId = process.env.TATA_CALLER_ID;
  if (!callerId) {
    return NextResponse.json(
      { success: false, message: "Server is missing TATA_CALLER_ID configuration" },
      { status: 500 }
    );
  }

  try {
    const accessToken = await getAccessToken();

    const res = await fetch(`${TATA_BASE_URL}/click_to_call`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        agent_number: fromNumber,
        destination_number: toNumber,
        caller_id: callerId,
        async: 1,
        call_timeout: 60,
      }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 502 });
  }
}
