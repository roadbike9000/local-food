import { NextResponse } from "next/server";
import { sentMessages } from "@/lib/sms/providers/mockProvider";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  return NextResponse.json({ messages: sentMessages });
}
