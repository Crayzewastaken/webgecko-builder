/**
 * Beehiiv Newsletter Subscription
 * Integrates with Beehiiv API to subscribe users to a newsletter publication
 */

interface SubscribeParams {
  email: string;
  name?: string;
  referringSite?: string;
}

/**
 * Subscribe an email address to the Beehiiv newsletter
 * @param params - Subscription parameters
 * @returns Promise<boolean> - True on success, false on failure
 */
export async function subscribeToNewsletter(
  params: SubscribeParams
): Promise<boolean> {
  const { email, name, referringSite } = params;

  // Check for required environment variables
  const apiKey = process.env.BEEHIIV_API_KEY;
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID;

  if (!apiKey || !publicationId) {
    console.warn(
      "[Beehiiv] Missing required env vars. BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID not set. Skipping subscription."
    );
    return false;
  }

  try {
    const payload: Record<string, any> = {
      email,
    };

    if (name) {
      payload.name = name;
    }

    if (referringSite) {
      payload.referring_site = referringSite;
    }

    const response = await fetch(
      `https://api.beehiiv.com/v2/publications/${publicationId}/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Beehiiv] Subscription failed for ${email}. Status: ${response.status}, Error: ${errorText}`
      );
      return false;
    }

    const data = await response.json();
    console.log(
      `[Beehiiv] Successfully subscribed ${email} to publication ${publicationId}`
    );
    return true;
  } catch (error) {
    console.error(
      `[Beehiiv] Exception during subscription for ${email}:`,
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}
