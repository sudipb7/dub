import { withWorkspace } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { APP_DOMAIN } from "@dub/utils";
import { NextResponse } from "next/server";

export const POST = withWorkspace(async ({ req, workspace, session }) => {
  let { plan, period, baseUrl, comparePlans, onboarding } = await req.json();

  if (!plan || !period) {
    return new Response("Invalid plan or period", { status: 400 });
  }

  plan = plan.replace(" ", "+");

  const prices = await stripe.prices.list({
    lookup_keys: [`${plan}_${period}`],
  });

  const subscription = workspace.stripeId
    ? await stripe.subscriptions.list({
        customer: workspace.stripeId,
        status: "active",
      })
    : null;

  // if the user has an active subscription, create billing portal to upgrade
  if (workspace.stripeId && subscription && subscription.data.length > 0) {
    const { url } = await stripe.billingPortal.sessions.create({
      customer: workspace.stripeId,
      return_url: baseUrl,
      flow_data: comparePlans
        ? {
            type: "subscription_update",
            subscription_update: {
              subscription: subscription.data[0].id,
            },
          }
        : {
            type: "subscription_update_confirm",
            subscription_update_confirm: {
              subscription: subscription.data[0].id,
              items: [
                {
                  id: subscription.data[0].items.data[0].id,
                  quantity: 1,
                  price: prices.data[0].id,
                },
              ],
            },
          },
    });

    return NextResponse.json({ url });

    // if the user does not have an active subscription (new user or canceled subscription), create a new checkout session
  } else {
    const stripeSession = await stripe.checkout.sessions.create({
      customer: workspace.stripeId || undefined, // Use existing stripeId if available
      customer_email: workspace.stripeId ? undefined : session.user.email, // Only set email if no stripeId
      billing_address_collection: "required",
      success_url: `${APP_DOMAIN}/${workspace.slug}?${onboarding ? "onboarded" : "upgraded"}=true&plan=${plan}&period=${period}`,
      cancel_url: baseUrl,
      line_items: [{ price: prices.data[0].id, quantity: 1 }],
      allow_promotion_codes: true,
      automatic_tax: {
        enabled: true,
      },
      tax_id_collection: {
        enabled: true,
      },
      mode: "subscription",
      client_reference_id: workspace.id,
      metadata: {
        dubCustomerId: session.user.id,
      },
    });

    return NextResponse.json(stripeSession);
  }
});
