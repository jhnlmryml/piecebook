import "server-only";

import nodemailer from "nodemailer";

type OrderReceipt = {
  id: string;
  buyer_name: string;
  seller_name: string;
  listing_title: string;
  quantity: number;
  total_price: number;
};

export async function sendMarketplaceOrderEmails(
  order: OrderReceipt,
  buyerEmail: string | null,
  sellerEmail: string,
  currency: string,
) {
  const user = process.env.GMAIL_USER?.trim();
  const password = process.env.GMAIL_APP_PASSWORD?.trim();
  if (!user || !password) return;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: password },
  });
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(Number(order.total_price));
  const safeTitle = order.listing_title.replace(/[\r\n]+/g, " ").slice(0, 200);
  const safeOrderId = order.id.toUpperCase();
  const messages = [
    ...(buyerEmail ? [{
      to: buyerEmail,
      subject: `Piecebook order confirmed: ${safeTitle}`,
      text: `Hi ${order.buyer_name}, your payment for ${safeTitle} is confirmed. Quantity: ${order.quantity}. Total: ${amount}. Order: ${safeOrderId}.`,
    }] : []),
    {
      to: sellerEmail,
      subject: `Your Piecebook item sold: ${safeTitle}`,
      text: `Hi ${order.seller_name}, ${order.buyer_name} purchased ${safeTitle}. Quantity: ${order.quantity}. Total: ${amount}. Order: ${safeOrderId}.`,
    },
  ];

  const results = await Promise.allSettled(messages.map((message) => transporter.sendMail({
    from: `Piecebook Marketplace <${user}>`,
    ...message,
  })));
  if (results.some((result) => result.status === "rejected")) {
    console.error("One or more paid marketplace order emails could not be delivered.");
  }
}
