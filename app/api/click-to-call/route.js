/**
 * Server-side Tata Smartflo Click-to-Call Support integration.
 *
 * This runs only on the server (Next.js Route Handler) so the Tata API
 * key never reaches the browser bundle. The client posts only
 * { toNumber } here; the destination agent leg (Sandeep's Smartflo
 * *extension*, not his mobile) is baked into TATA_CTC_SUPPORT_API_KEY
 * itself, configured in the Smartflo dashboard under
 * API Connect -> Click to Call Support API.
 *
 * Unlike the plain click_to_call API (which only rings an agent's
 * mobile/follow_me_number), click_to_call_support's api_key can target
 * either a Mobile or an Extension as its destination — this key was
 * generated with "Assigned To: Sandeep (Extension)".
 *
 * Reference: https://docs.smartflo.tatatelebusiness.com/reference/v1click_to_call_support
 */

import { NextResponse } from "next/server";

const TATA_BASE_URL = "https://api-smartflo.tatateleservices.com/v1";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const toNumber = body && body.toNumber;
  if (!toNumber) {
    return NextResponse.json({ success: false, message: "toNumber is required" }, { status: 400 });
  }

  const apiKey = process.env.TATA_CTC_SUPPORT_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: "Server is missing TATA_CTC_SUPPORT_API_KEY configuration" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${TATA_BASE_URL}/click_to_call_support`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_number: toNumber,
        api_key: apiKey,
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
