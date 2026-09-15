type BuildSubscriptionReminderEmailInput = {
    businessName:
      string;
  
    expiresAt:
      Date;
  
    daysRemaining:
      number;
  };
  
  export function buildSubscriptionReminderEmail({
    businessName,
    expiresAt,
    daysRemaining,
  }: BuildSubscriptionReminderEmailInput) {
    const expirationDate =
      new Intl.DateTimeFormat(
        "en-US",
        {
          dateStyle:
            "long",
        }
      ).format(
        expiresAt
      );
  
    const dayLabel =
      daysRemaining ===
      1
        ? "day"
        : "days";
  
    const subject =
      `Your ValYou subscription expires in ${daysRemaining} ${dayLabel}`;
  
    const text =
      [
        `Hi,`,
        ``,
        `Your ValYou subscription for ${businessName} expires in ${daysRemaining} ${dayLabel}.`,
        ``,
        `Expiration date: ${expirationDate}`,
        ``,
        `After your subscription expires, your NFC and QR review cards will temporarily stop redirecting customers.`,
        ``,
        `Please renew your subscription before the expiration date to avoid interruption.`,
        ``,
        `Your existing cards will automatically continue working after renewal.`,
        ``,
        `ValYou`,
      ].join(
        "\n"
      );
  
    const html =
      `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin-bottom: 16px;">
            Subscription renewal reminder
          </h2>
  
          <p>
            Your ValYou subscription for
            <strong>${businessName}</strong>
            expires in
            <strong>${daysRemaining} ${dayLabel}</strong>.
          </p>
  
          <p>
            Expiration date:
            <strong>${expirationDate}</strong>
          </p>
  
          <p>
            After your subscription expires,
            your NFC and QR review cards will temporarily
            stop redirecting customers.
          </p>
  
          <p>
            Please renew before the expiration date
            to avoid interruption.
          </p>
  
          <p>
            Your existing cards will automatically
            continue working after renewal.
          </p>
  
          <p style="margin-top: 24px;">
            ValYou
          </p>
        </div>
      `;
  
    return {
      subject,
      text,
      html,
    };
  }