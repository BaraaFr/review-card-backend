import nodemailer, {
    type Transporter,
  } from "nodemailer";
  
  let transporter: Transporter | null =
    null;
  
  function getTransporter(): Transporter {
    if (transporter) {
      return transporter;
    }
  
    const host =
      process.env.SMTP_HOST;
  
    const port =
      Number(
        process.env.SMTP_PORT ??
          587
      );
  
    const secure =
      process.env.SMTP_SECURE ===
      "true";
  
    const user =
      process.env.SMTP_USER;
  
    const pass =
      process.env.SMTP_PASS;
  
    if (
      !host ||
      !user ||
      !pass
    ) {
      throw new Error(
        "SMTP configuration is incomplete"
      );
    }
  
    transporter =
      nodemailer.createTransport({
        host,
  
        port,
  
        secure,
  
        auth: {
          user,
  
          pass,
        },
  
        pool:
          true,
  
        maxConnections:
          5,
  
        maxMessages:
          100,
      });
  
    return transporter;
  }
  
  type SendEmailInput = {
    to:
      string;
  
    subject:
      string;
  
    html:
      string;
  
    text?:
      string;
  
    messageId?:
      string;
  };
  
  export async function sendEmail({
    to,
    subject,
    html,
    text,
    messageId,
  }: SendEmailInput) {
    const fromEmail =
      process.env
        .SMTP_FROM_EMAIL;
  
    const fromName =
      process.env
        .SMTP_FROM_NAME ??
      "ValYou";
  
    if (!fromEmail) {
      throw new Error(
        "SMTP_FROM_EMAIL is required"
      );
    }
  
    const mailer =
      getTransporter();
  
    return mailer.sendMail({
      from: {
        name:
          fromName,
  
        address:
          fromEmail,
      },
  
      to,
  
      subject,
  
      html,
  
      text,
  
      messageId,
    });
  }