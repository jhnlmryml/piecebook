import nodemailer from "nodemailer";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase";
import { checkoutRequestSchema } from "@/lib/form-schemas";
import { ApiError, apiErrorResponse, json, readJson } from "@/lib/server/api-utils";
import type { Tables } from "@/types/supabase";

type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

type EmailNotificationResult = {
  buyerSent: boolean;
  sellerSent: boolean;
  errors: string[];
};

type MarketplaceOrder = Tables<"marketplace_orders">;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function buildOrderEmailHtml({
  order,
  recipientName,
  intro,
  accent,
  statusLabel,
  counterpartLabel,
  counterpartName,
}: {
  order: MarketplaceOrder;
  recipientName: string;
  intro: string;
  accent: string;
  statusLabel: string;
  counterpartLabel: string;
  counterpartName: string;
}): string {
  const title = escapeHtml(order.listing_title);
  const name = escapeHtml(recipientName);
  const counterpart = escapeHtml(counterpartName);
  const amount = escapeHtml(formatPrice(Number(order.total_price)));
  const orderReference = escapeHtml(order.id.slice(0, 8).toUpperCase());
  const safeIntro = escapeHtml(intro);
  const imageUrl = order.listing_photos?.[0];
  const imageMarkup =
    imageUrl && /^https?:\/\//i.test(imageUrl)
      ? `<img src="${escapeHtml(imageUrl)}" alt="${title}" width="88" height="88" style="display:block;width:88px;height:88px;object-fit:cover;border-radius:12px;border:1px solid #e2e8f0;">`
      : "";

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safeIntro} Order ${orderReference}.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;width:100%;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background-color:#0f172a;">
                <p style="margin:0;color:#ffffff;font-size:16px;font-weight:700;letter-spacing:1.5px;">PIECEBOOK <span style="color:#94a3b8;font-weight:400;">MARKETPLACE</span></p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 20px;">
                <span style="display:inline-block;padding:7px 11px;background-color:${accent};border-radius:999px;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.7px;">${escapeHtml(statusLabel)}</span>
                <h1 style="margin:18px 0 8px;font-size:26px;line-height:1.25;color:#0f172a;">${escapeHtml(statusLabel)}</h1>
                <p style="margin:0;color:#475569;font-size:15px;line-height:1.6;">Hi ${name}, ${safeIntro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 28px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
                  <tr>
                    <td style="padding:18px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          ${imageMarkup ? `<td width="104" valign="top" style="padding-right:16px;">${imageMarkup}</td>` : ""}
                          <td valign="top">
                            <p style="margin:0 0 6px;color:#64748b;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;">Order item</p>
                            <p style="margin:0;color:#0f172a;font-size:18px;font-weight:700;line-height:1.35;">${title}</p>
                            <p style="margin:9px 0 0;color:#475569;font-size:13px;">Quantity: <strong style="color:#0f172a;">${order.quantity}</strong></p>
                            <p style="margin:6px 0 0;color:#475569;font-size:13px;">${escapeHtml(counterpartLabel)}: <strong style="color:#0f172a;">${counterpart}</strong></p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px;">
                      <div style="height:1px;background-color:#e2e8f0;"></div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 18px 18px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="color:#64748b;font-size:13px;">Order reference</td>
                          <td align="right" style="color:#334155;font-size:13px;font-weight:700;">#${orderReference}</td>
                        </tr>
                        <tr>
                          <td style="padding-top:12px;color:#0f172a;font-size:15px;font-weight:700;">Total</td>
                          <td align="right" style="padding-top:12px;color:${accent};font-size:20px;font-weight:700;">${amount}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 26px;">
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">This confirmation was sent automatically by Piecebook Marketplace. Keep the order reference for your records.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;color:#94a3b8;font-size:11px;">Piecebook Marketplace · Happy trading</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendOrderNotifications(
  order: MarketplaceOrder,
  buyerEmail?: string,
  sellerEmail?: string,
): Promise<EmailNotificationResult> {
  const buyerRecipient = buyerEmail?.trim() || undefined;
  const sellerRecipient = sellerEmail?.trim() || undefined;
  if (!buyerRecipient && !sellerRecipient) {
    return { buyerSent: false, sellerSent: false, errors: [] };
  }

  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  const errors: string[] = [];

  if (!gmailUser || !gmailAppPassword) {
    console.error("Gmail SMTP is not configured for marketplace order notifications.");
    errors.push("Gmail SMTP is not configured on the server.");
    return { buyerSent: false, sellerSent: false, errors };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailAppPassword },
  });
  const title = order.listing_title.replace(/[\r\n]+/g, " ");
  const amount = formatPrice(Number(order.total_price));

  async function sendEmail(
    label: "buyer" | "seller",
    email: string | undefined,
    subject: string,
    text: string,
    html: string,
  ): Promise<boolean> {
    if (!email) return false;

    try {
      await transporter.sendMail({
        from: { name: "Piecebook Marketplace", address: gmailUser },
        to: email,
        subject,
        text,
        html,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown SMTP error.";
      console.error(`Could not send marketplace order email to ${label}:`, message);
      errors.push(`The ${label} email could not be sent.`);
      return false;
    }
  }

  const [buyerSent, sellerSent] = await Promise.all([
    sendEmail(
      "buyer",
      buyerRecipient,
      `Purchase confirmed: ${title}`,
      `Hi ${order.buyer_name},\n\nYour purchase of "${title}" is confirmed.\nQuantity: ${order.quantity}\nTotal: ${amount}\nOrder: ${order.id}`,
      buildOrderEmailHtml({
        order,
        recipientName: order.buyer_name,
        intro: `your purchase of "${title}" is confirmed.`,
        accent: "#2563eb",
        statusLabel: "PURCHASE CONFIRMED",
        counterpartLabel: "Seller",
        counterpartName: order.seller_name,
      }),
    ),
    sendEmail(
      "seller",
      sellerRecipient,
      `Your item sold: ${title}`,
      `Hi ${order.seller_name},\n\n${order.buyer_name} purchased "${title}".\nQuantity: ${order.quantity}\nTotal: ${amount}\nOrder: ${order.id}`,
      buildOrderEmailHtml({
        order,
        recipientName: order.seller_name,
        intro: `${order.buyer_name} purchased "${title}".`,
        accent: "#059669",
        statusLabel: "ITEM SOLD",
        counterpartLabel: "Buyer",
        counterpartName: order.buyer_name,
      }),
    ),
  ]);

  return { buyerSent, sellerSent, errors };
}

export async function POST(request: Request) {
  try {
    const checkoutRequest: CheckoutRequest = await readJson(request, checkoutRequestSchema);
    const result = await getSupabaseClient().rpc(
      "checkout_marketplace_listing",
      {
        requested_listing_id: checkoutRequest.listingId,
        requested_buyer_id: checkoutRequest.buyerId,
        requested_quantity: checkoutRequest.quantity,
      },
    );
    if (result.error) {
      if (result.error.code === "P0001") {
        throw new ApiError(409, "CHECKOUT_CONFLICT", result.error.message);
      }
      console.error(
        "Marketplace checkout failed:",
        result.error.code,
        result.error.message,
      );
      throw new ApiError(500, "CHECKOUT_FAILED", "Could not complete checkout right now.");
    }
    const order = result.data;
    if (!order) {
      console.error("Marketplace checkout returned no order record.");
      throw new ApiError(500, "CHECKOUT_FAILED", "Checkout did not return an order record.");
    }

    let emailNotifications: EmailNotificationResult;
    try {
      const { data: sellerContact, error: sellerContactError } =
        await getSupabaseClient()
          .from("marketplace_listing")
          .select("seller_email")
          .eq("id", checkoutRequest.listingId)
          .maybeSingle();
      if (sellerContactError) {
        console.error(
          "Could not load seller email for marketplace order:",
          sellerContactError.message,
        );
      }
      emailNotifications = await sendOrderNotifications(
        order,
        checkoutRequest.buyerEmail,
        sellerContact?.seller_email ?? undefined,
      );
      if (sellerContactError) {
        emailNotifications.errors.push("The seller email could not be loaded from the listing.");
      }
    } catch (notificationError) {
      const message = notificationError instanceof Error
        ? notificationError.message
        : "Unknown notification error.";
      console.error("Could not send marketplace order notifications:", message);
      emailNotifications = {
        buyerSent: false,
        sellerSent: false,
        errors: ["The order was placed, but email notifications could not be sent."],
      };
    }

    return json({ order, emailNotifications }, 201);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
