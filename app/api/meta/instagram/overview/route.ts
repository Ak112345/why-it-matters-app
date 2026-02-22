import { NextResponse } from "next/server";
import { getMetaEnv, metaGet } from "@/lib/meta";

export async function GET() {
  try {
    const { igId, token } = getMetaEnv();

    const data = await metaGet<{
      id: string;
      username?: string;
      followers_count?: number;
      media_count?: number;
      name?: string;
    }>(`${igId}?fields=id,username,name,followers_count,media_count`, token);

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}