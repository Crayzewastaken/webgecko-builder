import { encryptPayload } from "@/lib/encryption";
import pb from "@/lib/pocketbase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const encryptedData = encryptPayload(body);

    await pb.collection("projects").create({
      encrypted: encryptedData.encrypted,
      iv: encryptedData.iv,
      tag: encryptedData.tag,
      status: "pending",
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Website request saved securely",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("ROUTE ERROR:", error);

    return new Response(
      JSON.stringify({
        success: false,
        message: "Failed to save request",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}