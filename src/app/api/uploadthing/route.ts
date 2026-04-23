import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: false, message: "UploadThing adapter está preparado, mas o fluxo direto usa R2." },
    { status: 501 },
  );
}

export async function POST() {
  return NextResponse.json(
    { ok: false, message: "Endpoint de upload indireto não habilitado neste scaffold." },
    { status: 501 },
  );
}
