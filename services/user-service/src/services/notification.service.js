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

async function sendOtp({ channel, destination, code, purpose, requestId }) {
  const provider = channel === 'sms' ? process.env.SMS_PROVIDER || 'mock' : process.env.EMAIL_PROVIDER || 'mock';
  const masked = maskDestination(destination, channel);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      level: 'info',
      requestId,
      provider,
      channel,
      purpose,
      destination: masked,
      previewCode: process.env.NODE_ENV === 'production' ? undefined : code
    })
  );

  return {
    accepted: true
  };
}

module.exports = {
  sendOtp,
  maskDestination
};
