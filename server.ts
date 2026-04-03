import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to send confirmation email
  app.post('/api/send-confirmation', async (req, res) => {
    const { email, name, service, date, slot } = req.body;

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY is missing");
      return res.status(500).json({ error: "Email service not configured" });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: 'P&B Dental Clinic <onboarding@resend.dev>', // Resend default for testing
        to: [email],
        subject: 'Appointment Confirmed - P&B Dental Clinic',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-xl: 24px;">
            <h2 style="color: #2563eb;">Appointment Confirmed!</h2>
            <p>Hello <strong>${name}</strong>,</p>
            <p>Your appointment at <strong>P&B Dental Clinic</strong> has been officially confirmed by our team.</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #64748b;">Service:</p>
              <p style="margin: 0 0 10px 0; font-weight: bold;">${service}</p>
              
              <p style="margin: 0; font-size: 14px; color: #64748b;">Schedule:</p>
              <p style="margin: 0; font-weight: bold;">${date} at ${slot}</p>
            </div>
            
            <p>You can view your full history and manage your visits in our Patient Portal:</p>
            <a href="https://ais-pre-loqsbwadd7ab5gx32xhbbw-211100320874.asia-southeast1.run.app" 
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-weight: bold; margin-top: 10px;">
              Go to Patient Portal
            </a>
            
            <p style="margin-top: 30px; font-size: 12px; color: #94a3b8;">
              If you need to reschedule, please contact us at least 24 hours in advance.
            </p>
          </div>
        `,
      });

      if (error) {
        return res.status(400).json({ error });
      }

      res.status(200).json({ data });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
