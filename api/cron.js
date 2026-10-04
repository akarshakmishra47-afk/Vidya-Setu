export default async function handler(req, res) {
  // If you set a CRON_SECRET in Vercel environment variables, uncomment the following check:
  /*
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  */

  try {
    // Replace this with your actual deployed Backend URL!
    const backendUrl = process.env.BACKEND_URL || 'https://your-backend-url.com';
    
    const response = await fetch(`${backendUrl}/api/perks/cron`, {
      method: 'GET',
      headers: {
        'Authorization': process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '',
      }
    });

    const data = await response.json();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Cron Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
