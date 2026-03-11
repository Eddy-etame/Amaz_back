function maskDestination(destination, channel) {
  if (!destination) return '';
  const value = String(destination);
  if (channel === 'sms') {
    return value.length <= 4 ? '****' : `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
  }
  const [name, domain] = value.split('@');
  if (!domain) return '***';
  const maskedName = name.length <= 2 ? `${name[0] || '*'}*` : `${name.slice(0, 2)}***`;
  return `${maskedName}@${domain}`;
}

function logNotification(event) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(event));
}

function buildTransactionalEmail({ type, templateData = {} }) {
  const orderId = templateData.orderId || 'commande';
  const userName = templateData.userName || 'Client';
  const total = Number(templateData.total || 0);

  switch (type) {
    case 'order_confirmation':
      return {
        subject: `Confirmation de commande ${orderId}`,
        text: [
          `Bonjour ${userName},`,
          '',
          `Votre commande ${orderId} a bien été confirmée.`,
          `Montant total : ${total.toLocaleString('fr-FR')} FCFA.`,
          '',
          'Merci d’avoir choisi Amaz.'
        ].join('\n')
      };
    case 'order_delivered':
      return {
        subject: `Commande ${orderId} livrée`,
        text: [
          `Bonjour ${userName},`,
          '',
          `Votre commande ${orderId} a été marquée comme livrée.`,
          '',
          'Nous espérons que tout s’est bien passé.'
        ].join('\n')
      };
    default:
      return {
        subject: `Notification Amaz`,
        text: `Bonjour ${userName},\n\nUne nouvelle notification est disponible sur votre compte Amaz.`
      };
  }
}

async function sendEmailViaSmtp({ to, subject, text }) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        : undefined
  });

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'no-reply@amaz.local',
    to,
    subject,
    text
  });

  return {
    accepted: true,
    providerMessageId: info.messageId || null
  };
}

async function sendSmsViaTwilio({ to, body }) {
  const twilio = require('twilio');
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  const message = await client.messages.create({
    from: process.env.TWILIO_FROM,
    to,
    body
  });

  return {
    accepted: true,
    providerMessageId: message.sid || null
  };
}

async function sendEmail({ to, subject, text, type = 'email', requestId }) {
  const provider = String(process.env.EMAIL_PROVIDER || 'mock').trim().toLowerCase();
  const masked = maskDestination(to, 'email');

  if (provider === 'mock') {
    logNotification({
      level: 'info',
      requestId,
      provider,
      channel: 'email',
      type,
      destination: masked,
      subject,
      previewText: process.env.NODE_ENV === 'production' ? undefined : text
    });
    return {
      accepted: true
    };
  }

  if (provider === 'smtp') {
    const result = await sendEmailViaSmtp({ to, subject, text });
    logNotification({
      level: 'info',
      requestId,
      provider,
      channel: 'email',
      type,
      destination: masked,
      subject,
      providerMessageId: result.providerMessageId
    });
    return result;
  }

  throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
}

async function sendSms({ to, body, type = 'sms', requestId }) {
  const provider = String(process.env.SMS_PROVIDER || 'mock').trim().toLowerCase();
  const masked = maskDestination(to, 'sms');

  if (provider === 'mock') {
    logNotification({
      level: 'info',
      requestId,
      provider,
      channel: 'sms',
      type,
      destination: masked,
      previewText: process.env.NODE_ENV === 'production' ? undefined : body
    });
    return {
      accepted: true
    };
  }

  if (provider === 'twilio') {
    const result = await sendSmsViaTwilio({ to, body });
    logNotification({
      level: 'info',
      requestId,
      provider,
      channel: 'sms',
      type,
      destination: masked,
      providerMessageId: result.providerMessageId
    });
    return result;
  }

  throw new Error(`Unsupported SMS_PROVIDER: ${provider}`);
}

async function sendTransactionalEmail({ to, type, templateData, requestId }) {
  const email = buildTransactionalEmail({ type, templateData });
  return sendEmail({
    to,
    subject: email.subject,
    text: email.text,
    type,
    requestId
  });
}

async function sendOtp({ channel, destination, code, purpose, requestId }) {
  if (channel === 'sms') {
    return sendSms({
      to: destination,
      body: `Votre code de vérification Amaz : ${code}`,
      type: `otp_${purpose}`,
      requestId
    });
  }

  return sendEmail({
    to: destination,
    subject: 'Code de vérification Amaz',
    text: `Votre code de vérification est : ${code}`,
    type: `otp_${purpose}`,
    requestId
  });
}

module.exports = {
  buildTransactionalEmail,
  sendOtp,
  sendEmail,
  sendSms,
  sendTransactionalEmail,
  maskDestination
};
