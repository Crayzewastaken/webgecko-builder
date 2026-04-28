import PocketBase from "pocketbase";

const pb = new PocketBase("http://127.0.0.1:8090");

export async function adminLogin() {
  await pb.admins.authWithPassword(
    process.env.PB_EMAIL!,
    process.env.PB_PASSWORD!
  );
}

export default pb;