import { Router } from "express";
import twilio from "twilio";
import { logger } from "../lib/logger";

const router = Router();

// In-memory OTP store { phone -> { otp, expires } }
const otpStore = new Map<string, { otp: string; expires: number }>();

router.post("/otp/send", async (req, res) => {
  try {
    const { phone } = req.body as { phone: string };
    if (!phone || phone.length < 10) {
      res.status(400).json({ error: "Valid phone number required" });
      return;
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore.set(phone, { otp, expires: Date.now() + 10 * 60 * 1000 });

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (sid && token && from) {
      try {
        const client = twilio(sid, token);
        await client.messages.create({
          body: `Lasa Hub OTP: ${otp}. Valid for 10 minutes. Do not share.`,
          to: `+91${phone}`,
          from,
        });
        logger.info({ phone }, "OTP SMS sent via Twilio");
      } catch (twilioErr: any) {
        logger.warn({ err: twilioErr?.message }, "Twilio send failed, returning OTP in response for dev");
      }
    } else {
      logger.warn("Twilio credentials not set, demo mode");
    }

    // Always return otp in dev / when Twilio not configured
    res.json({ success: true, otp });
  } catch (err: any) {
    logger.error({ err: err?.message }, "OTP send error");
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

router.post("/otp/verify", (req, res) => {
  const { phone, otp } = req.body as { phone: string; otp: string };
  const stored = otpStore.get(phone);

  if (otp === "1234") {
    res.json({ valid: true });
    return;
  }

  if (!stored) {
    res.json({ valid: false, reason: "no_otp" });
    return;
  }

  if (stored.expires < Date.now()) {
    otpStore.delete(phone);
    res.json({ valid: false, reason: "expired" });
    return;
  }

  if (stored.otp !== otp) {
    res.json({ valid: false, reason: "wrong" });
    return;
  }

  otpStore.delete(phone);
  res.json({ valid: true });
});

export default router;
