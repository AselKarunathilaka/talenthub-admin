const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config(); // Load environment variables from .env

// Create a transporter using Gmail's SMTP server
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // Gmail address
    pass: process.env.GMAIL_PASS, // Gmail password or app password
  },
});

// Function to send an email (returns a Promise)
const sendEmail = (to, subject, text) => {
  const mailOptions = {
    from: process.env.GMAIL_USER, // From address
    to: to, // Recipient email (intern's email)
    subject: subject, // Email subject
    text: text, // Email body content
  };

  // When no callback is provided, nodemailer returns a Promise
  return transporter
    .sendMail(mailOptions)
    .then((info) => {
      console.log("Email sent:", info.response);
      return info;
    })
    .catch((error) => {
      console.log("Error sending email:", error);
      throw error;
    });
};

module.exports = sendEmail;
